const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');

let adminToken = '';
let categoryId = '';
let simpleProductId = '';
let variableProductId = '';

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

  // Create a category
  const catRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Art Crafts',
      slug: 'art-crafts'
    });
  categoryId = catRes.body.data.id;

  // Create a SIMPLE product
  const spRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'SIMPLE',
      name: 'Simple Mug',
      slug: 'simple-mug',
      description: 'A simple mug.',
      basePrice: 199.00
    });
  simpleProductId = spRes.body.data.id;

  // Create a VARIABLE product
  const vpRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'VARIABLE',
      name: 'Variable T-Shirt',
      slug: 'variable-t-shirt',
      description: 'A customizable sizing T-Shirt.',
      basePrice: 499.00
    });
  variableProductId = vpRes.body.data.id;
}

async function runTests() {
  console.log('Running Product Variant Tests...');
  await setup();

  // 1. Try to add variant to SIMPLE product: should fail (400)
  const failVarRes = await request(app)
    .post(`/api/v1/admin/products/${simpleProductId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'MUG-RED',
      attributes: { color: 'Red' },
      stockQty: 50
    });
  assert.strictEqual(failVarRes.status, 400);
  console.log('✓ Adding variant to SIMPLE product correctly blocked');

  // 2. Add variant to VARIABLE product: should succeed
  const createRes1 = await request(app)
    .post(`/api/v1/admin/products/${variableProductId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'TSHIRT-L-RED',
      attributes: { size: 'L', color: 'Red' },
      priceOverride: 549.00,
      stockQty: 25
    });

  assert.strictEqual(createRes1.status, 201);
  assert.strictEqual(createRes1.body.success, true);
  assert.strictEqual(createRes1.body.data.sku, 'TSHIRT-L-RED');
  assert.strictEqual(createRes1.body.data.price_override, '549.00');
  assert.strictEqual(createRes1.body.data.stock_qty, 25);
  // MariaDB JSON columns return as parsed JS object/array or string depending on version/connector.
  // Our system parser handles it:
  const attrs = typeof createRes1.body.data.attributes === 'string'
    ? JSON.parse(createRes1.body.data.attributes)
    : createRes1.body.data.attributes;
  assert.strictEqual(attrs.size, 'L');
  assert.strictEqual(attrs.color, 'Red');
  const v1Id = createRes1.body.data.id;
  console.log('✓ First variant added successfully');

  // 3. Add duplicate SKU variant: should fail (409)
  const dupSkuRes = await request(app)
    .post(`/api/v1/admin/products/${variableProductId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      sku: 'TSHIRT-L-RED',
      attributes: { size: 'L', color: 'Red' },
      stockQty: 10
    });
  assert.strictEqual(dupSkuRes.status, 409);
  console.log('✓ Duplicate SKU variant correctly blocked');

  // 4. Update variant: should succeed
  const updateRes = await request(app)
    .put(`/api/v1/admin/products/${variableProductId}/variants/${v1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      stockQty: 100,
      priceOverride: 599.00
    });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.data.stock_qty, 100);
  assert.strictEqual(updateRes.body.data.price_override, '599.00');
  console.log('✓ Variant updated successfully');

  // 5. List variants: should return list of 1 variant
  const listRes = await request(app)
    .get(`/api/v1/admin/products/${variableProductId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(listRes.status, 200);
  assert.strictEqual(listRes.body.data.length, 1);
  assert.strictEqual(listRes.body.data[0].id, v1Id);
  console.log('✓ Variant list retrieved successfully');

  // 6. Delete variant: should succeed
  const delRes = await request(app)
    .delete(`/api/v1/admin/products/${variableProductId}/variants/${v1Id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delRes.status, 200);

  const listAfterDel = await request(app)
    .get(`/api/v1/admin/products/${variableProductId}/variants`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(listAfterDel.body.data.length, 0);
  console.log('✓ Variant deleted successfully');

  console.log('All Product Variant Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Product Variant Tests Failed:', err);
      process.exit(1);
    });
}
