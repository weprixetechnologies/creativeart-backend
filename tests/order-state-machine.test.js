const db = require('../src/config/db');
const orderStateMachine = require('../src/services/order-state-machine.service');
const { IllegalTransitionError, ValidationError } = require('../src/utils/errors');
const assert = require('assert');

let userId = '';
let standardOrderId = '';
let dualPaymentOrderId = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM material_shipments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM users');

  // Create a customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Test Customer', 'customer@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Create STANDARD order
  const stdOrderRes = await db.query(
    `INSERT INTO orders 
     (order_number, user_id, order_type, status, subtotal, total_amount) 
     VALUES (?, ?, ?, ?, ?, ?)`,
    ['ORD-STD-TEST-001', userId, 'STANDARD', 'PLACED', 500.00, 500.00]
  );
  standardOrderId = stdOrderRes.insertId;

  // Create DUAL_PAYMENT order
  const dualOrderRes = await db.query(
    `INSERT INTO orders 
     (order_number, user_id, order_type, status, subtotal, total_amount, advance_amount, final_amount) 
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ['ORD-DUAL-TEST-001', userId, 'DUAL_PAYMENT', 'BOOKED_PENDING_ADVANCE', 1500.00, 1500.00, 500.00, 1000.00]
  );
  dualPaymentOrderId = dualOrderRes.insertId;
}

async function runTests() {
  console.log('Running Order State Machine Tests...');
  await setup();

  // Test 1: Valid STANDARD path
  console.log('  Testing valid STANDARD transitions...');
  let order = await orderStateMachine.transition(standardOrderId, 'PAID', {
    actorType: 'WEBHOOK',
    note: 'PhonePe payment confirmation success'
  });
  assert.strictEqual(order.status, 'PAID');

  order = await orderStateMachine.transition(standardOrderId, 'PACKED', {
    actorType: 'ADMIN',
    actorUserId: userId
  });
  assert.strictEqual(order.status, 'PACKED');

  order = await orderStateMachine.transition(standardOrderId, 'SHIPPED', {
    actorType: 'WEBHOOK',
    note: 'Shiprocket pickup scanned'
  });
  assert.strictEqual(order.status, 'SHIPPED');

  order = await orderStateMachine.transition(standardOrderId, 'DELIVERED', {
    actorType: 'WEBHOOK',
    note: 'Shiprocket delivered payload'
  });
  assert.strictEqual(order.status, 'DELIVERED');

  // Test 2: Idempotency (transition to same state should skip updates)
  console.log('  Testing transition idempotency...');
  const doubleDelivered = await orderStateMachine.transition(standardOrderId, 'DELIVERED', {
    actorType: 'WEBHOOK'
  });
  assert.strictEqual(doubleDelivered.status, 'DELIVERED');

  // Test 3: Invalid STANDARD transition (e.g. from DELIVERED back to PAID)
  console.log('  Testing illegal transitions (DELIVERED -> PAID)...');
  try {
    await orderStateMachine.transition(standardOrderId, 'PAID', { actorType: 'ADMIN' });
    assert.fail('Should have failed to transition from DELIVERED back to PAID');
  } catch (err) {
    assert.ok(err instanceof IllegalTransitionError);
  }

  // Test 4: DUAL_PAYMENT auto-cascade transition
  console.log('  Testing dual-payment auto-transitions (BOOKED -> ADVANCE_PAID -> AWAITING_MATERIAL)...');
  const dualOrder = await orderStateMachine.transition(dualPaymentOrderId, 'ADVANCE_PAID', {
    actorType: 'WEBHOOK',
    note: 'PhonePe advance checkout success'
  });
  // Since ADVANCE_PAID triggers system auto-transition to AWAITING_MATERIAL_DISPATCH:
  assert.strictEqual(dualOrder.status, 'AWAITING_MATERIAL_DISPATCH');

  // Test 5: Manual Hold & Resume transitions
  console.log('  Testing manual ON_HOLD & resume triggers...');
  // Attempting to hold without a note should fail
  try {
    await orderStateMachine.transition(dualPaymentOrderId, 'ON_HOLD', { actorType: 'ADMIN' });
    assert.fail('Should have failed to transition to ON_HOLD without a note');
  } catch (err) {
    assert.ok(err instanceof ValidationError);
  }

  // Hold with note should succeed
  const heldOrder = await orderStateMachine.transition(dualPaymentOrderId, 'ON_HOLD', {
    actorType: 'ADMIN',
    note: 'Customer requested a temporary hold'
  });
  assert.strictEqual(heldOrder.status, 'ON_HOLD');
  assert.strictEqual(heldOrder.pre_hold_status, 'AWAITING_MATERIAL_DISPATCH');

  // Resume to old state (requires Resume keyword check or target matching pre_hold_status)
  const resumedOrder = await orderStateMachine.transition(dualPaymentOrderId, 'AWAITING_MATERIAL_DISPATCH', {
    actorType: 'ADMIN',
    note: 'Resuming order processing'
  });
  assert.strictEqual(resumedOrder.status, 'AWAITING_MATERIAL_DISPATCH');
  assert.strictEqual(resumedOrder.pre_hold_status, null);

  // Test 6: Verify history log insertions
  console.log('  Testing audit history assertions...');
  const history = await db.query(
    'SELECT from_status, to_status, actor_type, note FROM order_status_history WHERE order_id = ? ORDER BY id ASC',
    [dualPaymentOrderId]
  );
  // BOOKED -> ADVANCE_PAID, ADVANCE_PAID -> AWAITING_MATERIAL (SYSTEM), AWAITING_MATERIAL -> ON_HOLD, ON_HOLD -> AWAITING_MATERIAL
  assert.strictEqual(history.length, 4);
  assert.strictEqual(history[0].to_status, 'ADVANCE_PAID');
  assert.strictEqual(history[1].to_status, 'AWAITING_MATERIAL_DISPATCH');
  assert.strictEqual(history[1].actor_type, 'SYSTEM');
  assert.strictEqual(history[2].to_status, 'ON_HOLD');

  console.log('All Order State Machine Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Test Suite Failed:', err);
  process.exit(1);
});
