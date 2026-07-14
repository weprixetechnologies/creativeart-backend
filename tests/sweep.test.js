const db = require('../src/config/db');
const StuckOrderSweepService = require('../src/services/stuck-order-sweep.service');
const assert = require('assert');

let userId = '';
let stuckOrderId = '';
let normalOrderId = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM settings');

  // Seed threshold settings (e.g. 5 days to make testing fast)
  await db.query("INSERT INTO settings (`key`, value) VALUES ('stuck_order_sweep_threshold_days', '5')");

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Sweep Test User', 'sweepuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // 1. Create a DUAL_PAYMENT order that is stuck (transitioned 6 days ago)
  const stuckRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-STUCK-1', ?, 'DUAL_PAYMENT', 'AWAITING_MATERIAL_DISPATCH', 2000.00, 2000.00)`,
    [userId]
  );
  stuckOrderId = stuckRes.insertId;

  // Insert status history entry with historical date (6 days ago)
  const sixDaysAgo = new Date();
  sixDaysAgo.setDate(sixDaysAgo.getDate() - 6);
  await db.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, created_at) 
     VALUES (?, NULL, 'AWAITING_MATERIAL_DISPATCH', 'SYSTEM', ?)`,
    [stuckOrderId, sixDaysAgo]
  );

  // 2. Create a DUAL_PAYMENT order that is fresh (transitioned 2 days ago)
  const freshRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES ('ORD-FRESH-1', ?, 'DUAL_PAYMENT', 'AWAITING_MATERIAL_DISPATCH', 2000.00, 2000.00)`,
    [userId]
  );
  normalOrderId = freshRes.insertId;

  const twoDaysAgo = new Date();
  twoDaysAgo.setDate(twoDaysAgo.getDate() - 2);
  await db.query(
    `INSERT INTO order_status_history (order_id, from_status, to_status, actor_type, created_at) 
     VALUES (?, NULL, 'AWAITING_MATERIAL_DISPATCH', 'SYSTEM', ?)`,
    [normalOrderId, twoDaysAgo]
  );
}

async function runTests() {
  console.log('Running Stuck Order Sweep Job Tests...');
  await setup();

  // Run the sweep
  const result = await StuckOrderSweepService.runSweep();

  assert.strictEqual(result.found, 1, 'Should find 1 stuck order');
  assert.strictEqual(result.flagged, 1, 'Should flag 1 stuck order');

  // Verify database state of stuck order
  const [stuckOrder] = await db.query("SELECT status, pre_hold_status FROM orders WHERE id = ?", [stuckOrderId]);
  assert.strictEqual(stuckOrder.status, 'ON_HOLD', 'Stuck order status should update to ON_HOLD');
  assert.strictEqual(stuckOrder.pre_hold_status, 'AWAITING_MATERIAL_DISPATCH', 'pre_hold_status should snapshot original status');

  // Verify database state of fresh order
  const [freshOrder] = await db.query("SELECT status, pre_hold_status FROM orders WHERE id = ?", [normalOrderId]);
  assert.strictEqual(freshOrder.status, 'AWAITING_MATERIAL_DISPATCH', 'Fresh order status should remain unchanged');
  assert.strictEqual(freshOrder.pre_hold_status, null);

  console.log('All Stuck Order Sweep Job Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Sweep Test Suite Failed:', err);
  process.exit(1);
});
