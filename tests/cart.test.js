const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let userToken = '';
let userId = '';
let categoryId = '';
let simpleProductId = '';
let variableProductId = '';
let variantId = '';
let projectProductId = '';
let customFieldId = '';

const sessionId = 'guest-session-uuid-12345';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM cart_item_custom_values');
  await db.query('DELETE FROM cart_items');
  await db.query('DELETE FROM carts');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Cart Test User', 'cartuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Login to get token
  const authRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'cartuser@example.com',
      password: 'password123' // password verification mock or we can just mock a token?
    });
  
  // Ah, since we cleared users and inserted manually, login requires actual password validation matching bcrypt!
  // To avoid running bcrypt.hash during setup, let's just sign a quick jwt token directly for userToken!
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  userToken = jwt.sign({ userId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });

  // Create Category
  const catRes = await db.query(
    "INSERT INTO categories (name, slug) VALUES ('Art Preservations', 'art-preservations')"
  );
  categoryId = catRes.insertId;

  // Create Variable Product
  const varProdRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) 
     VALUES (?, 'PRODUCT', 'VARIABLE', 'Engraved Frame', 'engraved-frame', 'Frame description', 1200.00, 'ACTIVE')`,
    [categoryId]
  );
  variableProductId = varProdRes.insertId;

  // Create Variant
  const variantRes = await db.query(
    `INSERT INTO product_variants (product_id, sku, attributes, price_override, stock_qty, status) 
     VALUES (?, 'SKU-FRAME-L', ?, 1350.00, 10, 'ACTIVE')`,
    [variableProductId, JSON.stringify({ size: 'L' })]
  );
  variantId = variantRes.insertId;

  // Create Project Product
  const projProdRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, advance_amount, final_amount, total_amount, status) 
     VALUES (?, 'PROJECT', NULL, 'Bespoke Bouquet Preservation', 'bespoke-bouquet-preservation', 'Bouquet description', 5000.00, 2000.00, 3000.00, 5000.00, 'ACTIVE')`,
    [categoryId]
  );
  projectProductId = projProdRes.insertId;

  // Create Custom Field for Project
  const fieldRes = await db.query(
    `INSERT INTO product_custom_fields (product_id, field_key, label, type, required, sort_order) 
     VALUES (?, 'engraving_text', 'Custom Engraving Text', 'TEXT', 1, 1)`,
    [projectProductId]
  );
  customFieldId = fieldRes.insertId;
}

async function runTests() {
  console.log('Running Cart Endpoint Tests...');
  await setup();

  // Test 1: Get cart (empty)
  console.log('  Testing GET /cart (empty)...');
  const resGet = await request(app)
    .get('/api/v1/cart')
    .set('Authorization', `Bearer ${userToken}`);
  
  assert.strictEqual(resGet.status, 200);
  assert.strictEqual(resGet.body.success, true);
  assert.strictEqual(resGet.body.data.items.length, 0);

  // Test 2: Add standard product to cart
  console.log('  Testing POST /cart/items (add variable product)...');
  const resAdd = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: variableProductId,
      variantId: variantId,
      qty: 1
    });

  assert.strictEqual(resAdd.status, 200);
  assert.strictEqual(resAdd.body.data.cartItemType, 'PRODUCT');
  assert.strictEqual(resAdd.body.data.items.length, 1);
  assert.strictEqual(resAdd.body.data.items[0].productId, Number(variableProductId));
  assert.strictEqual(resAdd.body.data.items[0].variantId, Number(variantId));
  assert.strictEqual(resAdd.body.data.items[0].unitPriceSnapshot, 1350.00);

  const cartItemId = resAdd.body.data.items[0].id;

  // Test 3: Add project product to product cart (No-Mixing violation check)
  console.log('  Testing no-mixing rejection (PROJECT add to PRODUCT cart)...');
  const resAddMixed = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: projectProductId,
      customFieldValues: {
        engraving_text: 'My Wedding Bouquet'
      }
    });

  assert.strictEqual(resAddMixed.status, 400);
  assert.strictEqual(resAddMixed.body.success, false);
  assert.strictEqual(resAddMixed.body.error.code, 'MIXED_CART_NOT_ALLOWED');

  // Test 4: Update cart item quantity
  console.log('  Testing PATCH /cart/items/:id (update qty)...');
  const resUpdate = await request(app)
    .patch(`/api/v1/cart/items/${cartItemId}`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      qty: 3
    });

  assert.strictEqual(resUpdate.status, 200);
  assert.strictEqual(resUpdate.body.data.items[0].qty, 3);

  // Test 5: Delete cart item (resetting type to null)
  console.log('  Testing DELETE /cart/items/:id (empty cart)...');
  const resRemove = await request(app)
    .delete(`/api/v1/cart/items/${cartItemId}`)
    .set('Authorization', `Bearer ${userToken}`);

  assert.strictEqual(resRemove.status, 200);
  assert.strictEqual(resRemove.body.data.items.length, 0);
  assert.strictEqual(resRemove.body.data.cartItemType, null);

  // Test 6: Add project product (with custom fields validation)
  console.log('  Testing custom field validation (missing required)...');
  const resAddMissing = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: projectProductId,
      customFieldValues: {} // Missing 'engraving_text'
    });

  assert.strictEqual(resAddMissing.status, 400);
  assert.ok(resAddMissing.body.error.message.includes('required'));

  console.log('  Testing custom field success...');
  const resAddProject = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: projectProductId,
      customFieldValues: {
        engraving_text: 'My Wedding Bouquet'
      }
    });

  assert.strictEqual(resAddProject.status, 200);
  assert.strictEqual(resAddProject.body.data.cartItemType, 'PROJECT');
  assert.strictEqual(resAddProject.body.data.items[0].customFieldValues.engraving_text, 'My Wedding Bouquet');

  // Clear cart again for guest merge check
  const projectItemId = resAddProject.body.data.items[0].id;
  await request(app).delete(`/api/v1/cart/items/${projectItemId}`).set('Authorization', `Bearer ${userToken}`);

  // Test 7: Guest session cart merge
  console.log('  Testing guest session item adding...');
  const resGuestAdd = await request(app)
    .post('/api/v1/cart/items')
    .set('x-session-id', sessionId)
    .send({
      productId: variableProductId,
      variantId: variantId,
      qty: 2
    });

  assert.strictEqual(resGuestAdd.status, 200);
  assert.strictEqual(resGuestAdd.body.data.items.length, 1);
  assert.strictEqual(resGuestAdd.body.data.items[0].qty, 2);

  console.log('  Testing login merge action on GET /cart...');
  const resMerge = await request(app)
    .get('/api/v1/cart')
    .set('Authorization', `Bearer ${userToken}`)
    .set('x-session-id', sessionId);

  assert.strictEqual(resMerge.status, 200);
  assert.strictEqual(resMerge.body.data.items.length, 1);
  assert.strictEqual(resMerge.body.data.items[0].qty, 2);
  assert.strictEqual(resMerge.body.data.items[0].productId, Number(variableProductId));

  // Guest cart should now be abandoned / empty
  console.log('  Testing guest cart empty post-merge...');
  const resGuestEmpty = await request(app)
    .get('/api/v1/cart')
    .set('x-session-id', sessionId);
  
  assert.strictEqual(resGuestEmpty.status, 200);
  assert.strictEqual(resGuestEmpty.body.data.items.length, 0);

  console.log('All Cart Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Cart Test Suite Failed:', err);
  process.exit(1);
});
