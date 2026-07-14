const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let orderId = '';
const awbCode = 'AWB-MOCK-987';
const shipmentId = 'sr_ship_mock_987';

async function setup() {
  // Clear tables
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Shiprocket User', 'shipuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  const userId = userRes.insertId;

  // Create standard order
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-SR-PACKED', ?, 'STANDARD', 'PACKED', 1000.00, 1000.00)`,
    [userId]
  );
  orderId = orderRes.insertId;

  // Insert packed status history
  await db.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_type) 
     VALUES (?, 'PAID', 'PACKED', 'STAFF')`,
    [orderId]
  );

  // Insert shipment record
  await db.query(
    `INSERT INTO shipments (order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, status) 
     VALUES (?, 'sr_ord_mock_987', ?, ?, 'READY_TO_SHIP')`,
    [orderId, shipmentId, awbCode]
  );
}

async function runTests() {
  console.log('Running Shiprocket Webhook Tests...');
  await setup();

  // Test 1: Webhook updates shipment status to shipped
  console.log('  Testing webhook shipped status transition...');
  const res1 = await request(app)
    .post('/api/v1/webhooks/shiprocket')
    .send({
      awb: awbCode,
      shipment_id: shipmentId,
      current_status: 'shipped',
      status_datetime: new Date().toISOString()
    });

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.body.success, true);

  // Verify order transitioned to SHIPPED in DB
  const [order1] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order1.status, 'SHIPPED');

  // Verify shipment status updated in DB
  const [ship1] = await db.query("SELECT status FROM shipments WHERE id = (SELECT id FROM shipments WHERE order_id = ?)", [orderId]);
  assert.strictEqual(ship1.status, 'shipped');

  // Test 2: Webhook idempotency check
  console.log('  Testing webhook idempotency...');
  const res2 = await request(app)
    .post('/api/v1/webhooks/shiprocket')
    .send({
      awb: awbCode,
      shipment_id: shipmentId,
      current_status: 'shipped'
    });

  assert.strictEqual(res2.status, 200);
  assert.ok(res2.body.message.includes('Idempotent'));

  // Test 3: Webhook updates shipment status to delivered
  console.log('  Testing webhook delivered status transition...');
  const res3 = await request(app)
    .post('/api/v1/webhooks/shiprocket')
    .send({
      awb: awbCode,
      shipment_id: shipmentId,
      current_status: 'delivered',
      status_datetime: new Date().toISOString()
    });

  assert.strictEqual(res3.status, 200);

  // Verify order transitioned to DELIVERED in DB
  const [order2] = await db.query("SELECT status FROM orders WHERE id = ?", [orderId]);
  assert.strictEqual(order2.status, 'DELIVERED');

  console.log('All Shiprocket Webhook Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Shiprocket Webhook Tests Failed:', err);
  process.exit(1);
});
