const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');
const ProductCustomFieldService = require('../src/services/product-custom-field.service');

let adminToken = '';
let categoryId = '';
let simpleProductId = '';
let customProductId = '';

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

  // Create a SIMPLE product (not customizable)
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

  // Create a CUSTOMISABLE product
  const cpRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'CUSTOMISABLE',
      name: 'Custom Engraved Ring',
      slug: 'custom-engraved-ring',
      description: 'A silver ring with custom engraving.',
      basePrice: 1499.00
    });
  customProductId = cpRes.body.data.id;
}

async function runTests() {
  console.log('Running Custom Fields Tests...');
  await setup();

  // 1. Try to add custom field to SIMPLE product: should fail (400)
  const failRes = await request(app)
    .post(`/api/v1/admin/products/${simpleProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fieldKey: 'engraving_text',
      label: 'Engraving Text',
      type: 'TEXT',
      required: true
    });
  assert.strictEqual(failRes.status, 400);
  console.log('✓ Custom field creation on SIMPLE product correctly blocked');

  // 2. Add custom fields to CUSTOMISABLE product: should succeed
  const f1 = await request(app)
    .post(`/api/v1/admin/products/${customProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fieldKey: 'engraving_text',
      label: 'Engraving Text',
      type: 'TEXT',
      required: true,
      sortOrder: 1
    });
  assert.strictEqual(f1.status, 201);
  const f1Id = f1.body.data.id;

  const f2 = await request(app)
    .post(`/api/v1/admin/products/${customProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fieldKey: 'font_size',
      label: 'Font Size',
      type: 'NUMBER',
      required: false,
      sortOrder: 2
    });
  assert.strictEqual(f2.status, 201);

  const f3 = await request(app)
    .post(`/api/v1/admin/products/${customProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fieldKey: 'font_style',
      label: 'Font Style',
      type: 'DROPDOWN',
      options: ['Serif', 'Sans-Serif'],
      required: true,
      sortOrder: 3
    });
  assert.strictEqual(f3.status, 201);

  const f4 = await request(app)
    .post(`/api/v1/admin/products/${customProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      fieldKey: 'logo_graphic',
      label: 'Logo Graphic',
      type: 'FILE',
      required: false,
      sortOrder: 4
    });
  assert.strictEqual(f4.status, 201);
  console.log('✓ All 4 custom fields created successfully');

  // 3. Test validation service: valid input should pass
  await assert.doesNotReject(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      engraving_text: 'Love Conquers All',
      font_size: 12,
      font_style: 'Serif'
    });
  }, 'Valid custom values should pass validation');
  console.log('✓ Validation service: valid values pass');

  // 4. Test validation service: missing required field should fail
  await assert.rejects(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      font_size: 12,
      font_style: 'Serif'
      // engraving_text missing
    });
  }, /is required/, 'Missing required engraving_text should reject');
  console.log('✓ Validation service: missing required field rejected');

  // 5. Test validation service: invalid number should fail
  await assert.rejects(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      engraving_text: 'Hello',
      font_size: 'not-a-number',
      font_style: 'Serif'
    });
  }, /must be a valid number/, 'Invalid number type should reject');
  console.log('✓ Validation service: invalid number rejected');

  // 6. Test validation service: invalid dropdown option should fail
  await assert.rejects(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      engraving_text: 'Hello',
      font_style: 'Comic Sans' // not in ['Serif', 'Sans-Serif']
    });
  }, /must be one of:/, 'Invalid dropdown option should reject');
  console.log('✓ Validation service: invalid dropdown option rejected');

  // 7. Test validation service: invalid file URL should fail
  await assert.rejects(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      engraving_text: 'Hello',
      font_style: 'Serif',
      logo_graphic: 'not-a-url'
    });
  }, /must be a valid uploaded file URL/, 'Invalid file URL should reject');
  
  await assert.doesNotReject(async () => {
    await ProductCustomFieldService.validateCustomFieldValues(customProductId, {
      engraving_text: 'Hello',
      font_style: 'Serif',
      logo_graphic: 'https://cly-pull-bunny.b-cdn.net/designs/logo.png'
    });
  }, 'Valid file URL should pass');
  console.log('✓ Validation service: file URL validation verified');

  // 8. Update and delete custom field
  const updateRes = await request(app)
    .put(`/api/v1/admin/products/${customProductId}/custom-fields/${f1Id}`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      label: 'New Engraving Text'
    });
  assert.strictEqual(updateRes.status, 200);
  assert.strictEqual(updateRes.body.data.label, 'New Engraving Text');
  console.log('✓ Custom field updated successfully');

  const delRes = await request(app)
    .delete(`/api/v1/admin/products/${customProductId}/custom-fields/${f1Id}`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(delRes.status, 200);
  
  const listRes = await request(app)
    .get(`/api/v1/admin/products/${customProductId}/custom-fields`)
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(listRes.body.data.length, 3, 'Should have 3 custom fields remaining');
  console.log('✓ Custom field deleted successfully');

  console.log('All Custom Fields Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Custom Fields Tests Failed:', err);
      process.exit(1);
    });
}
