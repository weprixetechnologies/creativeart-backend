const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');

let adminToken = '';
let categoryId = '';

async function setup() {
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
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

  // Create a category
  const catRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Art Crafts',
      slug: 'art-crafts'
    });
  categoryId = catRes.body.data.id;
}

async function runTests() {
  console.log('Running Product/Project Tests...');
  await setup();

  // 1. Create a standard PRODUCT - SIMPLE: should succeed
  const p1Res = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'SIMPLE',
      name: 'Standard Mug',
      slug: 'standard-mug',
      description: 'A standard ceramic coffee mug.',
      basePrice: 299.00,
      status: 'ACTIVE'
    });

  assert.strictEqual(p1Res.status, 201);
  assert.strictEqual(p1Res.body.success, true);
  assert.strictEqual(p1Res.body.data.item_type, 'PRODUCT');
  assert.strictEqual(p1Res.body.data.product_type, 'SIMPLE');
  assert.strictEqual(p1Res.body.data.base_price, '299.00');
  const p1Id = p1Res.body.data.id;
  console.log('✓ Standard PRODUCT created successfully');

  // 2. Create a PRODUCT with project pricing details: should fail (validation block or DB constraint block)
  const failPRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'SIMPLE',
      name: 'Bugged Mug',
      slug: 'bugged-mug',
      description: 'Should fail.',
      basePrice: 299.00,
      advanceAmount: 100 // invalid for PRODUCT
    });
  assert.strictEqual(failPRes.status, 400);
  console.log('✓ PRODUCT with project fields correctly rejected');

  // 3. Create a DUAL_PAYMENT PROJECT: should succeed
  const projRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PROJECT',
      name: 'Custom Resin Preservation',
      slug: 'custom-resin-preservation',
      description: 'Ship us your wedding flowers to preserve in high quality resin.',
      basePrice: 5000.00,
      advanceAmount: 2000.00,
      finalAmount: 3000.00,
      totalAmount: 5000.00,
      materialInstructions: 'Pack flowers in bubble wrap and keep dry.',
      status: 'ACTIVE'
    });

  assert.strictEqual(projRes.status, 201);
  assert.strictEqual(projRes.body.data.item_type, 'PROJECT');
  assert.strictEqual(projRes.body.data.product_type, null);
  assert.strictEqual(projRes.body.data.advance_amount, '2000.00');
  assert.strictEqual(projRes.body.data.final_amount, '3000.00');
  assert.strictEqual(projRes.body.data.total_amount, '5000.00');
  const projectId = projRes.body.data.id;
  console.log('✓ Dual-payment PROJECT created successfully');

  // 4. Create a PROJECT where advance + final !== total: should fail
  const failProjSum = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PROJECT',
      name: 'Bugged Resin Preservation',
      slug: 'bugged-resin-preservation',
      description: 'Should fail.',
      basePrice: 5000.00,
      advanceAmount: 2000.00,
      finalAmount: 3000.00,
      totalAmount: 9999.00 // invalid sum
    });
  assert.strictEqual(failProjSum.status, 400);
  assert.strictEqual(failProjSum.body.error.code, 'VALIDATION_ERROR');
  console.log('✓ PROJECT with invalid sum correctly rejected');

  // 5. GET products list with search and filters: should work
  const listRes = await request(app)
    .get('/api/v1/products')
    .query({ itemType: 'PROJECT', search: 'Preservation' });
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.body.data.length, 1);
  assert.strictEqual(listRes.body.data[0].slug, 'custom-resin-preservation');
  console.log('✓ List and search filtering successful');

  // 6. Public GET product by slug: should work
  const detailRes = await request(app)
    .get('/api/v1/products/custom-resin-preservation');
  assert.strictEqual(detailRes.status, 200);
  assert.strictEqual(detailRes.body.data.id, projectId);
  console.log('✓ Detail view by slug successful');

  // 7. Update product: should succeed
  const updateRes = await request(app)
    .put(`/api/v1/admin/products/${p1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      basePrice: 350.00
    });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.data.base_price, '350.00');
  console.log('✓ Product updated successfully');

  // 7b. Update MADE TO ORDER PROJECT product with stockQty: null (should succeed and sanitize stockQty)
  const updateProjRes = await request(app)
    .put(`/api/v1/admin/products/${projectId}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PROJECT',
      productType: null,
      name: 'Preserve Your Wedding Frame',
      slug: 'preserve-your-wedding-frame',
      description: 'Preserve Your Wedding Flowers',
      basePrice: 5000.00,
      stockQty: null,
      status: 'ACTIVE'
    });
  assert.strictEqual(updateProjRes.status, 200);
  assert.strictEqual(updateProjRes.body.success, true);
  assert.strictEqual(updateProjRes.body.data.name, 'Preserve Your Wedding Frame');
  console.log('✓ MADE TO ORDER PROJECT updated successfully with stockQty null handling');

  // 8. Delete product: should succeed
  const delRes = await request(app)
    .delete(`/api/v1/admin/products/${p1Id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delRes.status, 200);
  
  const getDelRes = await request(app).get(`/api/v1/products/standard-mug`);
  assert.strictEqual(getDelRes.status, 404);
  console.log('✓ Product deleted successfully');

  console.log('All Product/Project Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Product/Project Tests Failed:', err);
      process.exit(1);
    });
}
