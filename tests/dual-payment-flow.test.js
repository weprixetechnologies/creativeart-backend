const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const crypto = require('crypto');

let userId = '';
let token = '';
let staffToken = '';
let officeAddressId = '';
let productId = '';
let customFieldId = '';
let orderId = '';
let orderNumber = '';
let advanceGatewayOrderId = '';
let finalGatewayOrderId = '';

function buildMockPhonepeWebhook(merchantTransactionId, code, amountVal) {
  const payload = {
    merchantId: 'PGTESTPAYUAT86',
    merchantTransactionId,
    amount: amountVal,
    state: code === 'PAYMENT_SUCCESS' ? 'COMPLETED' : 'FAILED',
    code
  };
  const base64Response = Buffer.from(JSON.stringify(payload)).toString('base64');
  const body = { response: base64Response };
  const rawBodyStr = JSON.stringify(body);
  
  // Calculate signature
  const key = '96434309-7796-489d-8924-ab56988a6076';
  const computedHash = crypto
    .createHash('sha256')
    .update(base64Response + key)
    .digest('hex');
  const xVerify = `${computedHash}###1`;
  
  return {
    rawBodyStr,
    xVerify
  };
}

async function setup() {
  // Clear tables
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_item_custom_values');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM cart_item_custom_values');
  await db.query('DELETE FROM cart_items');
  await db.query('DELETE FROM carts');
  await db.query('DELETE FROM addresses');
  await db.query('DELETE FROM office_addresses');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM users');

  // Create users
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Custom User', 'custom@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  const staffRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Staff User', 'staff@example.com', 'hashedpassword', 'ADMIN']
  );

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  token = jwt.sign({ userId, role: 'CUSTOMER' }, JWT_SECRET);
  staffToken = jwt.sign({ userId: staffRes.insertId, role: 'ADMIN' }, JWT_SECRET);

  // Create Category
  const catRes = await db.query("INSERT INTO categories (name, slug) VALUES ('Frames', 'frames')");
  const categoryId = catRes.insertId;

  // Create Project Product
  const prodRes = await db.query(
    `INSERT INTO products (category_id, item_type, name, slug, description, base_price, advance_amount, final_amount, total_amount, status) 
     VALUES (?, 'PROJECT', 'Custom Wedding Frame', 'wedding-frame', 'desc', 5000.00, 2000.00, 3000.00, 5000.00, 'ACTIVE')`,
    [categoryId]
  );
  productId = prodRes.insertId;

  // Create custom fields for project
  const cfRes = await db.query(
    `INSERT INTO product_custom_fields (product_id, field_key, label, type, required) 
     VALUES (?, 'notes', 'Special Notes', 'TEXT', 1)`,
    [productId]
  );
  customFieldId = cfRes.insertId;

  // Create Shipping Address
  const addrRes = await db.query(
    `INSERT INTO addresses (user_id, label, contact_name, contact_phone, line1, city, state, pincode) 
     VALUES (?, 'Home', 'Custom User', '9876543210', '123 Road', 'Mumbai', 'Maharashtra', '400001')`,
    [userId]
  );
  addressId = addrRes.insertId;

  // Create Intake Office Address
  const officeRes = await db.query(
    `INSERT INTO office_addresses (label, contact_name, contact_phone, line1, city, state, pincode, status) 
     VALUES ('Guwahati Warehouse', 'Office Staff', '9876543210', 'Warehouse Road', 'Guwahati', 'Assam', '781001', 'ACTIVE')`,
  );
  officeAddressId = officeRes.insertId;
}

async function runTests() {
  console.log('Starting Full Dual-Payment Custom Project State Walk & Audit Tests...');
  await setup();

  // 1. Create a cart with custom project item
  console.log('  1. Creating cart & adding project item...');
  const sessId = 'sess-flow-123';
  
  // Add item to cart
  const cartAddRes = await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${token}`)
    .set('x-session-id', sessId)
    .send({
      productId,
      qty: 1,
      customFieldValues: {
        notes: 'Please build with golden border.'
      }
    });
  assert.strictEqual(cartAddRes.status, 200);

  // 2. Checkout
  console.log('  2. Placing project booking...');
  const checkoutRes = await request(app)
    .post('/api/v1/checkout/dual-payment')
    .set('Authorization', `Bearer ${token}`)
    .set('x-session-id', sessId)
    .send({
      addressId,
      productId,
      selectedOfficeAddressId: officeAddressId
    });

  assert.strictEqual(checkoutRes.status, 200);
  assert.strictEqual(checkoutRes.body.success, true);
  orderId = checkoutRes.body.data.orderId;
  orderNumber = checkoutRes.body.data.orderNumber;
  assert.ok(checkoutRes.body.data.checkoutUrl);

  // Retrieve gatewayOrderId from DB
  const advancePayments = await db.query(
    "SELECT gateway_order_id FROM order_payments WHERE order_id = ? AND payment_type = 'ADVANCE'",
    [orderId]
  );
  assert.ok(advancePayments.length > 0);
  advanceGatewayOrderId = advancePayments[0].gateway_order_id;

  // Assert status is BOOKED_PENDING_ADVANCE
  const [order1] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order1.status, 'BOOKED_PENDING_ADVANCE');

  // 3. Simulate advance payment capture webhook
  console.log('  3. Simulating advance payment capture webhook...');
  const webhookData1 = buildMockPhonepeWebhook(advanceGatewayOrderId, 'PAYMENT_SUCCESS', 200000);
  const webRes1 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData1.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData1.rawBodyStr);

  assert.strictEqual(webRes1.status, 200);
  assert.strictEqual(webRes1.body.success, true);

  // Verify auto-transition to AWAITING_MATERIAL_DISPATCH
  const [order2] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order2.status, 'AWAITING_MATERIAL_DISPATCH');

  // 4. Submit material shipment
  console.log('  4. Submitting material shipment tracking...');
  const shipRes = await request(app)
    .post(`/api/v1/orders/${orderId}/material-shipment`)
    .set('Authorization', `Bearer ${token}`)
    .send({
      officeAddressId,
      courierName: 'FedEx India',
      trackingNumber: 'FX-INT-992'
    });

  if (shipRes.status !== 200) {
    console.error('Shipment submission failed:', shipRes.body);
  }
  assert.strictEqual(shipRes.status, 200);
  assert.strictEqual(shipRes.body.data.status, 'MATERIAL_IN_TRANSIT');

  // 5. Confirm material received
  console.log('  5. Confirming material intake...');
  const intakeRes = await request(app)
    .post(`/api/v1/admin/orders/${orderId}/confirm-material-received`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send({
      conditionNotes: 'Box slightly damaged but internal wood frame in pristine shape.',
      conditionPhotoUrl: 'https://cdn.creativeart.in/photos/intake-22.jpg'
    });

  assert.strictEqual(intakeRes.status, 200);
  assert.strictEqual(intakeRes.body.data.status, 'MATERIAL_RECEIVED');

  // 6. Start production
  console.log('  6. Starting production...');
  const prodStartRes = await request(app)
    .post(`/api/v1/admin/orders/${orderId}/start-production`)
    .set('Authorization', `Bearer ${staffToken}`);

  assert.strictEqual(prodStartRes.status, 200);
  assert.strictEqual(prodStartRes.body.data.status, 'IN_PRODUCTION');

  // 7. Mark ready with final amount override + reason
  console.log('  7. Marking finished with final pricing override...');
  const markReadyRes = await request(app)
    .post(`/api/v1/admin/orders/${orderId}/mark-ready`)
    .set('Authorization', `Bearer ${staffToken}`)
    .send({
      finalAmount: 3200.00,
      overrideReason: 'Golden border requests extra premium coating sealant.'
    });

  assert.strictEqual(markReadyRes.status, 200);
  assert.strictEqual(markReadyRes.body.data.status, 'READY_PENDING_FINAL_PAYMENT');

  // Verify pricing database totals updated
  const [orderPrices] = await db.query("SELECT final_amount, total_amount, final_amount_override_reason FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(parseFloat(orderPrices.final_amount), 3200.00);
  assert.strictEqual(parseFloat(orderPrices.total_amount), 5200.00);
  assert.strictEqual(orderPrices.final_amount_override_reason, 'Golden border requests extra premium coating sealant.');

  // 8. Initiate final payment
  console.log('  8. Customer initiating final payment...');
  const initFinalRes = await request(app)
    .post(`/api/v1/orders/${orderId}/final-payment`)
    .set('Authorization', `Bearer ${token}`);

  assert.strictEqual(initFinalRes.status, 200);
  assert.ok(initFinalRes.body.data.checkoutUrl);

  // Retrieve finalGatewayOrderId from DB
  const finalPayments = await db.query(
    "SELECT gateway_order_id FROM order_payments WHERE order_id = ? AND payment_type = 'FINAL'",
    [orderId]
  );
  assert.ok(finalPayments.length > 0);
  finalGatewayOrderId = finalPayments[0].gateway_order_id;

  // 9. Simulate final payment capture webhook
  console.log('  9. Simulating final payment capture webhook...');
  const webhookData2 = buildMockPhonepeWebhook(finalGatewayOrderId, 'PAYMENT_SUCCESS', 320000);
  const webRes2 = await request(app)
    .post('/api/v1/webhooks/phonepe')
    .set('x-verify', webhookData2.xVerify)
    .set('Content-Type', 'application/json')
    .send(webhookData2.rawBodyStr);

  assert.strictEqual(webRes2.status, 200);
  
  // Verify order transitioned to FINAL_PAID
  const [order3] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order3.status, 'FINAL_PAID');

  // 10. Audit log checks
  console.log('  10. Asserting correct status history timeline entries...');
  const history = await db.query("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC", [orderId]);
  
  const expectedHistory = [
    { status: 'BOOKED_PENDING_ADVANCE', actor: 'SYSTEM' },
    { status: 'ADVANCE_PAID', actor: 'WEBHOOK' },
    { status: 'AWAITING_MATERIAL_DISPATCH', actor: 'SYSTEM' },
    { status: 'MATERIAL_IN_TRANSIT', actor: 'CUSTOMER' },
    { status: 'MATERIAL_RECEIVED', actor: 'STAFF' },
    { status: 'IN_PRODUCTION', actor: 'STAFF' },
    { status: 'READY_PENDING_FINAL_PAYMENT', actor: 'STAFF' },
    { status: 'FINAL_PAID', actor: 'WEBHOOK' }
  ];

  assert.strictEqual(history.length, expectedHistory.length);
  expectedHistory.forEach((expected, idx) => {
    assert.strictEqual(history[idx].to_status, expected.status);
    assert.strictEqual(history[idx].actor_type, expected.actor);
  });

  console.log('All Custom Project Walk & Timeline Stepper Tests Passed Successfully!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Walk test failed:', err);
  process.exit(1);
});
