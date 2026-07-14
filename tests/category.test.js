const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');

let adminToken = '';
let customerToken = '';

async function setup() {
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM product_images');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM users');

  // Register and login Admin
  await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'ADMIN'
    });
  
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'admin@example.com',
      password: 'password123'
    });
  adminToken = adminLogin.body.data.accessToken;

  // Register and login Customer
  await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Customer User',
      email: 'customer@example.com',
      password: 'password123',
      role: 'CUSTOMER'
    });

  const customerLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'customer@example.com',
      password: 'password123'
    });
  customerToken = customerLogin.body.data.accessToken;
}

async function runTests() {
  console.log('Running Category Tests...');
  await setup();

  // 1. GET tree should be empty initially
  const initialTree = await request(app).get('/api/v1/categories');
  assert.strictEqual(initialTree.status, 200);
  assert.strictEqual(initialTree.body.success, true);
  assert.deepStrictEqual(initialTree.body.data, []);
  console.log('✓ Initial empty tree verified');

  // 2. Customer attempts to create category: should fail (403)
  const custCreateRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      name: 'Gifts',
      slug: 'gifts'
    });
  assert.strictEqual(custCreateRes.status, 403, 'Customer should not be allowed to create category');
  console.log('✓ Non-admin creation rejected');

  // 3. Admin creates parent category: should succeed
  const createParentRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Gifts',
      slug: 'gifts',
      sortOrder: 1
    });
  assert.strictEqual(createParentRes.status, 201);
  assert.strictEqual(createParentRes.body.success, true);
  assert.ok(createParentRes.body.data.id);
  const parentId = createParentRes.body.data.id;
  console.log('✓ Parent category created successfully');

  // 4. Admin creates duplicate slug: should fail (409)
  const dupSlugRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Gifts Duplicate',
      slug: 'gifts'
    });
  assert.strictEqual(dupSlugRes.status, 409);
  assert.strictEqual(dupSlugRes.body.error.code, 'CONFLICT');
  console.log('✓ Duplicate slug creation rejected');

  // 5. Admin creates invalid slug: should fail (400)
  const invSlugRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Invalid Gifts',
      slug: 'gifts info invalid!'
    });
  assert.strictEqual(invSlugRes.status, 400);
  assert.strictEqual(invSlugRes.body.error.code, 'VALIDATION_ERROR');
  console.log('✓ Invalid slug creation rejected');

  // 6. Admin creates subcategory: should succeed
  const createSubRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      parentId: parentId,
      name: 'Photo Frames',
      slug: 'photo-frames',
      sortOrder: 2
    });
  assert.strictEqual(createSubRes.status, 201);
  assert.ok(createSubRes.body.data.id);
  const subId = createSubRes.body.data.id;
  console.log('✓ Subcategory created successfully');

  // 7. GET tree should return hierarchy
  const treeRes = await request(app).get('/api/v1/categories');
  assert.strictEqual(treeRes.status, 200);
  assert.strictEqual(treeRes.body.data.length, 1);
  assert.strictEqual(treeRes.body.data[0].id, parentId);
  assert.strictEqual(treeRes.body.data[0].children.length, 1);
  assert.strictEqual(treeRes.body.data[0].children[0].id, subId);
  console.log('✓ Category hierarchy tree returned correctly');

  // 8. Admin updates category: should succeed
  const updateRes = await request(app)
    .put(`/api/v1/admin/categories/${parentId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Curated Gifts'
    });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.data.name, 'Curated Gifts');
  console.log('✓ Category updated successfully');

  // 9. Admin attempts to delete parent category with child subcategory: should fail (409)
  const delParentRes = await request(app)
    .delete(`/api/v1/admin/categories/${parentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delParentRes.status, 409);
  assert.strictEqual(delParentRes.body.error.code, 'CONFLICT');
  console.log('✓ Deleting parent category with children blocked');

  // 10. Admin deletes subcategory, then deletes parent category: should succeed
  const delSubRes = await request(app)
    .delete(`/api/v1/admin/categories/${subId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delSubRes.status, 200);

  const delParentSuccess = await request(app)
    .delete(`/api/v1/admin/categories/${parentId}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delParentSuccess.status, 200);
  console.log('✓ Categories deleted successfully when empty');

  // 11. GET tree should be empty again
  const finalTreeRes = await request(app).get('/api/v1/categories');
  assert.deepStrictEqual(finalTreeRes.body.data, []);
  console.log('✓ Tree is empty again');

  console.log('All Category Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Category Tests Failed:', err);
      process.exit(1);
    });
}
