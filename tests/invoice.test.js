const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const orderStateMachine = require('../src/services/order-state-machine.service');

let userToken = '';
let userId = '';
let anotherToken = '';
let anotherUserId = '';
let categoryId = '';
let productId = '';
let orderId = '';
let orderNumber = 'ORD-INVTEST-001';

async function setup() {
  // Clear tables in dependency order
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
  await db.query('DELETE FROM users');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');

  // Create primary customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Invoice Customer', 'invcustomer@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Create another customer user (unauthorized)
  const anotherRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Another Customer', 'another@example.com', 'hashedpassword', 'CUSTOMER']
  );
  anotherUserId = anotherRes.insertId;

  // Mock JWT tokens
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  userToken = jwt.sign({ userId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });
  anotherToken = jwt.sign({ userId: anotherUserId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });

  // Create User Shipping Address
  const addrRes = await db.query(
    `INSERT INTO addresses (user_id, label, contact_name, contact_phone, line1, city, state, pincode) 
     VALUES (?, 'Home', 'Invoice Recipient', '9876543210', '456 Preservations Road', 'Bangalore', 'Karnataka', '560001')`,
    [userId]
  );
  const addressId = addrRes.insertId;

  // Create Category
  const catRes = await db.query(
    "INSERT INTO categories (name, slug) VALUES ('Wedding Frames', 'wedding-frames')"
  );
  categoryId = catRes.insertId;

  // Create Product
  const prodRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) 
     VALUES (?, 'PRODUCT', 'SIMPLE', 'Golden Keepsake', 'golden-keepsake', 'Gold description', 2500.00, 'ACTIVE')`,
    [categoryId]
  );
  productId = prodRes.insertId;

  // Create Order in PLACED status
  const orderRes = await db.query(
    `INSERT INTO orders (order_number, user_id, order_type, status, address_id, subtotal, total_amount) 
     VALUES (?, ?, 'STANDARD', 'PLACED', ?, 2500.00, 2500.00)`,
    [orderNumber, userId, addressId]
  );
  orderId = orderRes.insertId;

  // Create Order Item
  await db.query(
    `INSERT INTO order_items (order_id, product_id, product_name_snapshot, qty, unit_price, line_total) 
     VALUES (?, ?, 'Golden Keepsake', 1, 2500.00, 2500.00)`,
    [orderId, productId]
  );

  // Clear existing file if any
  const filePath = path.resolve(__dirname, `../storage/invoices/invoice-${orderNumber}.pdf`);
  if (fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
}

async function runTests() {
  console.log('Running Invoice Generation & Job Queue Tests...');
  await setup();

  // Test 1: Transition standard order to PAID to trigger job enqueuing
  console.log('  Transitioning order to PAID...');
  await orderStateMachine.transition(orderId, 'PAID', {
    actorType: 'WEBHOOK',
    note: 'Payment webhook capture standard test'
  });

  // Since job executes asynchronously via setImmediate, wait a brief moment for it to generate the invoice
  console.log('  Waiting for local queue to process invoice generation...');
  await new Promise(resolve => setTimeout(resolve, 100));

  // Verify invoice file exists on disk
  const filePath = path.resolve(__dirname, `../storage/invoices/invoice-${orderNumber}.pdf`);
  assert.ok(fs.existsSync(filePath), 'Invoice PDF/text file should exist on disk.');

  // Read invoice content and verify key details
  const invoiceText = fs.readFileSync(filePath, 'utf8');
  assert.ok(invoiceText.includes('Golden Keepsake'), 'Invoice should list order items.');
  assert.ok(invoiceText.includes('Invoice Recipient'), 'Invoice should list shipping address recipient.');
  assert.ok(invoiceText.includes('Rs. 2500.00'), 'Invoice should state final total amount.');

  // Test 2: Download invoice endpoint happy path
  console.log('  Testing download invoice endpoint (authorized)...');
  const res1 = await request(app)
    .get(`/api/v1/orders/${orderId}/invoice`)
    .set('Authorization', `Bearer ${userToken}`);

  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.headers['content-type'], 'application/pdf');
  assert.ok(res1.headers['content-disposition'].includes(`invoice-${orderId}.pdf`));

  // Test 3: Download invoice unauthorized (should return 404 to mask ownership)
  console.log('  Testing download invoice endpoint (unauthorized)...');
  const res2 = await request(app)
    .get(`/api/v1/orders/${orderId}/invoice`)
    .set('Authorization', `Bearer ${anotherToken}`);

  assert.strictEqual(res2.status, 404);

  console.log('All Invoice Generation & Job Queue Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Invoice Test Suite Failed:', err);
  process.exit(1);
});
