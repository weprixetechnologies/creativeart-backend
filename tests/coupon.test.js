const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let userToken = '';
let userId = '';
let categoryId = '';
let productId = '';
let cartId = '';
let coupon10Id = '';
let couponFlatId = '';
let couponExpiredId = '';

const sessionId = 'guest-session-uuid-123456';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM coupons');
  await db.query('DELETE FROM cart_item_custom_values');
  await db.query('DELETE FROM cart_items');
  await db.query('DELETE FROM carts');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Coupon Test User', 'couponuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Mock JWT token
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  userToken = jwt.sign({ userId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });

  // Create Category
  const catRes = await db.query(
    "INSERT INTO categories (name, slug) VALUES ('Art Preservations', 'art-preservations')"
  );
  categoryId = catRes.insertId;

  // Create Product
  const prodRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) 
     VALUES (?, 'PRODUCT', 'SIMPLE', 'Standard Frame', 'standard-frame', 'Frame description', 1200.00, 'ACTIVE')`,
    [categoryId]
  );
  productId = prodRes.insertId;

  // Create Cart with 2 items (Subtotal = 2 * 1200 = 2400)
  const cartRes = await db.query(
    "INSERT INTO carts (user_id, cart_item_type, status) VALUES (?, 'PRODUCT', 'ACTIVE')",
    [userId]
  );
  cartId = cartRes.insertId;

  await db.query(
    "INSERT INTO cart_items (cart_id, product_id, qty, unit_price_snapshot) VALUES (?, ?, 2, 1200.00)",
    [cartId, productId]
  );

  // Create Coupons
  const c1Res = await db.query(
    `INSERT INTO coupons (code, type, value, min_order_value, usage_limit_global, usage_limit_per_user, status) 
     VALUES ('WELCOME10', 'PERCENTAGE', 10.00, 1000.00, 100, 2, 'ACTIVE')`
  );
  coupon10Id = c1Res.insertId;

  const c2Res = await db.query(
    `INSERT INTO coupons (code, type, value, min_order_value, usage_limit_global, usage_limit_per_user, status) 
     VALUES ('FLAT500', 'FLAT', 500.00, 2000.00, 100, 1, 'ACTIVE')`
  );
  couponFlatId = c2Res.insertId;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const c3Res = await db.query(
    `INSERT INTO coupons (code, type, value, min_order_value, expires_at, status) 
     VALUES ('EXPIRED50', 'PERCENTAGE', 50.00, 100.00, ?, 'ACTIVE')`,
    [yesterday]
  );
  couponExpiredId = c3Res.insertId;
}

async function runTests() {
  console.log('Running Coupon Endpoint Tests...');
  await setup();

  // Test 1: Validate percentage coupon (WELCOME10)
  console.log('  Testing validate WELCOME10 (10% on ₹2400)...');
  const res1 = await request(app)
    .post('/api/v1/coupons/validate')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ code: 'WELCOME10' });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);
  assert.strictEqual(res1.body.data.discountAmount, 240); // 10% of 2400
  assert.strictEqual(res1.body.data.payableAmount, 2160);

  // Test 2: Validate flat coupon (FLAT500)
  console.log('  Testing validate FLAT500 (₹500 flat discount)...');
  const res2 = await request(app)
    .post('/api/v1/coupons/validate')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ code: 'FLAT500' });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.data.discountAmount, 500);
  assert.strictEqual(res2.body.data.payableAmount, 1900);

  // Test 3: Expired coupon check
  console.log('  Testing validate EXPIRED50 (should reject)...');
  const res3 = await request(app)
    .post('/api/v1/coupons/validate')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ code: 'EXPIRED50' });

  assert.strictEqual(res3.status, 400);
  assert.strictEqual(res3.body.success, false);
  assert.ok(res3.body.error.message.includes('expired'));

  // Test 4: Minimum order value not met (WELCOME10 on ₹600)
  console.log('  Testing validate min order value (decrease qty to 0.5, subtotal = 600)...');
  // Update cart item qty to 1 (subtotal = 1200) -> let's make it 0 to fail min order value limit check
  // But qty cannot be 0, so let's temporarily decrease to 1 (subtotal = 1200). Min order value is 1000, so WELCOME10 still works.
  // Wait, let's update coupon flatness to min_order_value = 5000 to test min order violation!
  await db.query("UPDATE coupons SET min_order_value = 5000.00 WHERE id = ?", [couponFlatId]);

  const res4 = await request(app)
    .post('/api/v1/coupons/validate')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ code: 'FLAT500' });

  assert.strictEqual(res4.status, 400);
  assert.ok(res4.body.error.message.includes('Minimum order value'));

  // Test 5: Usage limit per user check
  console.log('  Testing validate usage limits (inserting coupon usage record)...');
  // Revert coupon Flat min_order_value first so it passes subtotal check
  await db.query("UPDATE coupons SET min_order_value = 2000.00 WHERE id = ?", [couponFlatId]);
  
  // Create mock order
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-MOCK-999', ?, 'STANDARD', 'PLACED', 1000.00, 1000.00)`,
    [userId]
  );
  const mockOrderId = orderRes.insertId;

  // Insert coupon usages record
  await db.query(
    `INSERT INTO coupon_usages (coupon_id, user_id, order_id) 
     VALUES (?, ?, ?)`,
    [couponFlatId, userId, mockOrderId]
  );

  const res5 = await request(app)
    .post('/api/v1/coupons/validate')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ code: 'FLAT500' });

  assert.strictEqual(res5.status, 400);
  assert.ok(res5.body.error.message.includes('used this coupon maximum number of times'));

  console.log('All Coupon Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Coupon Test Suite Failed:', err);
  process.exit(1);
});
