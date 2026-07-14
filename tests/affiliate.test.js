const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const eventEmitter = require('../src/utils/event-emitter');
const affiliateService = require('../src/services/affiliate.service');

let customerToken = '';
let affiliateToken = '';
let customerId = '';
let affiliateUserId = '';
let affiliateId = '';

async function setup() {
  // Clear tables in correct dependency order
  await db.query('DELETE FROM affiliate_commissions');
  await db.query('DELETE FROM affiliate_referrals');
  await db.query('DELETE FROM affiliate_clicks');
  await db.query('DELETE FROM affiliate_payout_batches');
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM affiliates');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM notification_logs');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM users');

  // Create users
  const custRes = await db.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Customer User', 'customer@example.com', 'hash', 'CUSTOMER')"
  );
  customerId = custRes.insertId;

  const affRes = await db.query(
    "INSERT INTO users (name, email, password_hash, role) VALUES ('Affiliate User', 'affiliate@example.com', 'hash', 'CUSTOMER')"
  );
  affiliateUserId = affRes.insertId;

  // Create affiliate record
  const affProfileRes = await db.query(
    "INSERT INTO affiliates (user_id, referral_code, status) VALUES (?, 'RONIT10', 'APPROVED')",
    [affiliateUserId]
  );
  affiliateId = affProfileRes.insertId;

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  customerToken = jwt.sign({ userId: customerId, role: 'CUSTOMER' }, JWT_SECRET);
  affiliateToken = jwt.sign({ userId: affiliateUserId, role: 'CUSTOMER' }, JWT_SECRET);
}

async function runTests() {
  console.log('Running Affiliate Program Lifecycle and Isolation Tests...');
  await setup();

  // 1. Commission Created exactly once per order (idempotency, UNIQUE constraint test)
  console.log('  Testing commission creation & unique constraint idempotency...');
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount, affiliate_id, referral_code_used) 
     VALUES ('ORD-AFF-1', ?, 'STANDARD', 'PLACED', 1000.00, 1000.00, ?, 'RONIT10')`,
    [customerId, affiliateId]
  );
  const orderId = orderRes.insertId;

  // Fire event first time (triggers creation)
  eventEmitter.emit('orderStatusChanged', { orderId, fromStatus: 'PLACED', toStatus: 'PAID' });
  
  // Wait short bit
  await new Promise(r => setTimeout(r, 200));

  const comms1 = await db.query('SELECT * FROM affiliate_commissions WHERE order_id = ?', [orderId]);
  assert.strictEqual(comms1.length, 1, 'Commission should be created.');
  assert.strictEqual(comms1[0].status, 'PENDING');
  assert.strictEqual(parseFloat(comms1[0].commission_amount), 100.00, '10% of 1000 subtotal is 100');

  // Fire event second time (should trigger unique key constraint block inside service and not create a second row or crash)
  eventEmitter.emit('orderStatusChanged', { orderId, fromStatus: 'PAID', toStatus: 'PAID' });
  await new Promise(r => setTimeout(r, 200));

  const comms2 = await db.query('SELECT * FROM affiliate_commissions WHERE order_id = ?', [orderId]);
  assert.strictEqual(comms2.length, 1, 'Only exactly one commission row should exist.');

  // Test direct insert to verify DB UNIQUE constraint works as expected
  try {
    await db.query(
      `INSERT INTO affiliate_commissions 
       (affiliate_id, order_id, referral_id, base_amount, commission_type, commission_value, commission_amount, status)
       VALUES (?, ?, ?, 1000.00, 'PERCENTAGE', 10.00, 100.00, 'PENDING')`,
      [affiliateId, orderId, comms1[0].referral_id]
    );
    assert.fail('Should have thrown ER_DUP_ENTRY UNIQUE constraint error');
  } catch (err) {
    assert.ok(err.message.includes('Duplicate entry') || err.code === 'ER_DUP_ENTRY', 'Should throw duplicate key error.');
  }

  // 2. Commission status transition logic
  console.log('  Testing status transition rules...');
  // Confirm DELIVERED moves PENDING -> CONFIRMED
  eventEmitter.emit('orderStatusChanged', { orderId, fromStatus: 'PAID', toStatus: 'DELIVERED' });
  await new Promise(r => setTimeout(r, 200));

  const commsConfirmed = await db.query('SELECT status FROM affiliate_commissions WHERE order_id = ?', [orderId]);
  assert.strictEqual(commsConfirmed[0].status, 'CONFIRMED', 'DELIVERED status must confirm the commission.');

  // Negative test: intermediate status (e.g. SHIPPED, IN_PRODUCTION) does NOT confirm or cancel
  const orderRes2 = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount, affiliate_id, referral_code_used) 
     VALUES ('ORD-AFF-2', ?, 'STANDARD', 'PLACED', 500.00, 500.00, ?, 'RONIT10')`,
    [customerId, affiliateId]
  );
  const orderId2 = orderRes2.insertId;

  // Initially transition to PAID to create pending commission
  eventEmitter.emit('orderStatusChanged', { orderId: orderId2, fromStatus: 'PLACED', toStatus: 'PAID' });
  await new Promise(r => setTimeout(r, 200));

  // Transition to intermediate status
  eventEmitter.emit('orderStatusChanged', { orderId: orderId2, fromStatus: 'PAID', toStatus: 'SHIPPED' });
  await new Promise(r => setTimeout(r, 200));

  const commsIntermediate = await db.query('SELECT status FROM affiliate_commissions WHERE order_id = ?', [orderId2]);
  assert.strictEqual(commsIntermediate[0].status, 'PENDING', 'Intermediate status must not alter PENDING status.');

  // Cancel PENDING on CANCELLED
  eventEmitter.emit('orderStatusChanged', { orderId: orderId2, fromStatus: 'SHIPPED', toStatus: 'CANCELLED' });
  await new Promise(r => setTimeout(r, 200));

  const commsCancelled = await db.query('SELECT status FROM affiliate_commissions WHERE order_id = ?', [orderId2]);
  assert.strictEqual(commsCancelled[0].status, 'CANCELLED', 'CANCELLED status must cancel the commission.');

  // 3. Checkout Integration & Self-referral block
  console.log('  Testing checkout integration and self-referral block...');
  
  // Set up addresses, categories, products for standard checkout
  const catRes = await db.query(
    "INSERT INTO categories (name, slug, parent_id, sort_order, status) VALUES ('Art', 'art', NULL, 1, 'ACTIVE')"
  );
  const catId = catRes.insertId;

  const addrRes = await db.query(
    "INSERT INTO addresses (user_id, label, contact_name, contact_phone, line1, city, state, pincode) VALUES (?, 'Home', 'Customer', '9999999999', 'Road 1', 'City', 'State', '110001')",
    [customerId]
  );
  const addressId = addrRes.insertId;

  const affAddrRes = await db.query(
    "INSERT INTO addresses (user_id, label, contact_name, contact_phone, line1, city, state, pincode) VALUES (?, 'Home', 'Affiliate', '9999999999', 'Road 2', 'City', 'State', '110001')",
    [affiliateUserId]
  );
  const affAddressId = affAddrRes.insertId;

  const prodRes = await db.query(
    "INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) VALUES (?, 'PRODUCT', 'SIMPLE', 'Preservation Piece', 'preservation-piece', 'desc', 1000.00, 'ACTIVE')",
    [catId]
  );
  const productId = prodRes.insertId;

  // Let's seed a setting for default commission values
  await db.query("INSERT INTO settings (\`key\`, value) VALUES ('affiliate_default_commission_type', 'PERCENTAGE') ON DUPLICATE KEY UPDATE value = 'PERCENTAGE'");
  await db.query("INSERT INTO settings (\`key\`, value) VALUES ('affiliate_default_commission_value', '10.00') ON DUPLICATE KEY UPDATE value = '10.00'");

  // Standard checkout by Customer referred by Affiliate: should set affiliate_id
  const checkRes1 = await request(app)
    .post('/api/v1/checkout/standard')
    .set('Authorization', `Bearer ${customerToken}`)
    .send({
      addressId,
      items: [{ productId, quantity: 1, name: 'Piece', price: 1000.00 }],
      paymentMethod: 'COD',
      referralCode: 'RONIT10'
    });

  assert.strictEqual(checkRes1.status, 200);
  const createdOrderId = checkRes1.body.data.orderId;
  const verifiedOrder1 = await db.query('SELECT affiliate_id, referral_code_used FROM orders WHERE id = ?', [createdOrderId]);
  assert.strictEqual(Number(verifiedOrder1[0].affiliate_id), Number(affiliateId), 'Affiliate ID must be associated on order.');
  assert.strictEqual(verifiedOrder1[0].referral_code_used, 'RONIT10');

  // Standard checkout by Affiliate using their own referral code: self-referral block (must set affiliate_id = NULL)
  const checkRes2 = await request(app)
    .post('/api/v1/checkout/standard')
    .set('Authorization', `Bearer ${affiliateToken}`)
    .send({
      addressId: affAddressId,
      items: [{ productId, quantity: 1, name: 'Piece', price: 1000.00 }],
      paymentMethod: 'COD',
      referralCode: 'RONIT10'
    });

  assert.strictEqual(checkRes2.status, 200);
  const selfOrderId = checkRes2.body.data.orderId;
  const verifiedOrder2 = await db.query('SELECT affiliate_id FROM orders WHERE id = ?', [selfOrderId]);
  assert.strictEqual(verifiedOrder2[0].affiliate_id, null, 'Self-referral must set affiliate_id to NULL.');

  console.log('All Affiliate Service Isolation & Checkout Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Affiliate tests failed:', err);
  process.exit(1);
});
