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
let addressId = '';
let officeAddressId = '';
let couponId = '';

async function setup() {
  // Clear tables in dependency order
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM coupons');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM order_status_history');
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
  await db.query('DELETE FROM addresses');
  await db.query('DELETE FROM office_addresses');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM users');

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Checkout Test User', 'checkoutuser@example.com', 'hashedpassword', 'CUSTOMER']
  );
  userId = userRes.insertId;

  // Mock JWT token
  const jwt = require('jsonwebtoken');
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  userToken = jwt.sign({ userId, role: 'CUSTOMER' }, secret, { expiresIn: '1h' });

  // Create User Shipping Address
  const addrRes = await db.query(
    `INSERT INTO addresses (user_id, label, contact_name, contact_phone, line1, city, state, pincode) 
     VALUES (?, 'Home', 'Test User', '9876543210', '123 Test St', 'Mumbai', 'Maharashtra', '400001')`,
    [userId]
  );
  addressId = addrRes.insertId;

  // Create Office Receiving Address
  const officeRes = await db.query(
    `INSERT INTO office_addresses (label, contact_name, contact_phone, line1, city, state, pincode, status) 
     VALUES ('Workshop HQ', 'Workshop Manager', '9876500000', 'Office Block A', 'Mumbai', 'Maharashtra', '400002', 'ACTIVE')`
  );
  officeAddressId = officeRes.insertId;

  // Create Category
  const catRes = await db.query(
    "INSERT INTO categories (name, slug) VALUES ('Art Preservations', 'art-preservations')"
  );
  categoryId = catRes.insertId;

  // Create Simple Product
  const prodRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) 
     VALUES (?, 'PRODUCT', 'SIMPLE', 'Standard Frame', 'standard-frame', 'Frame description', 1200.00, 'ACTIVE')`,
    [categoryId]
  );
  simpleProductId = prodRes.insertId;

  // Create Variable Product with Variant
  const varProdRes = await db.query(
    `INSERT INTO products (category_id, item_type, product_type, name, slug, description, base_price, status) 
     VALUES (?, 'PRODUCT', 'VARIABLE', 'Engraved Frame', 'engraved-frame', 'Frame description', 1500.00, 'ACTIVE')`,
    [categoryId]
  );
  variableProductId = varProdRes.insertId;

  const variantRes = await db.query(
    `INSERT INTO product_variants (product_id, sku, attributes, price_override, stock_qty, status) 
     VALUES (?, 'SKU-FRAME-L', ?, 1800.00, 10, 'ACTIVE')`,
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

  // Create Coupon
  const couponRes = await db.query(
    `INSERT INTO coupons (code, type, value, min_order_value, usage_limit_global, usage_limit_per_user, status) 
     VALUES ('TEST50', 'FLAT', 50.00, 100.00, 100, 1, 'ACTIVE')`
  );
  couponId = couponRes.insertId;
}

async function runTests() {
  console.log('Running Checkout Endpoint Tests...');
  await setup();

  // Test 1: Standard checkout with empty cart (should fail)
  console.log('  Testing standard checkout with empty cart (should fail)...');
  const res1 = await request(app)
    .post('/api/v1/checkout/standard')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ addressId: Number(addressId), items: [] });

  assert.strictEqual(res1.status, 400);
  assert.ok(res1.body.error.message.includes('empty'));

  // Test 2: Standard checkout happy path
  console.log('  Testing standard checkout happy path...');
  // Add item to cart
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: Number(simpleProductId),
      qty: 1
    });

  const res2 = await request(app)
    .post('/api/v1/checkout/standard')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      addressId: Number(addressId),
      couponCode: 'TEST50',
      items: [
        {
          productId: Number(simpleProductId),
          name: 'Simple Product',
          price: 1200.00,
          quantity: 1
        }
      ]
    });

  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.body.success, true);
  assert.ok(res2.body.data.orderId);
  assert.ok(res2.body.data.orderNumber);
  assert.strictEqual(res2.body.data.totalAmount, 1150.00); // 1200 - 50 discount
  const createdOrderId = res2.body.data.orderId;

  // Verify order payments row status is CREATED and amount is 1150
  const [payments] = await db.query("SELECT * FROM order_payments WHERE order_id = ?", [createdOrderId]);
  assert.ok(payments.gateway_order_id);
  assert.strictEqual(payments.status, 'CREATED');
  assert.strictEqual(parseFloat(payments.amount), 1150.00);
  assert.strictEqual(payments.payment_type, 'FULL');

  // Verify cart status is CONVERTED
  const [cart] = await db.query("SELECT * FROM carts WHERE user_id = ? ORDER BY id DESC", [userId]);
  assert.strictEqual(cart.status, 'CONVERTED');

  // Test 3: Standard checkout decrementing variant stock
  console.log('  Testing standard variant stock decrement...');
  // Add variant item to new cart
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: Number(variableProductId),
      variantId: Number(variantId),
      qty: 2
    });

  // Verify initial variant stock is 10
  const [vInit] = await db.query("SELECT stock_qty FROM product_variants WHERE id = ?", [variantId]);
  assert.strictEqual(vInit.stock_qty, 10);

  const res3 = await request(app)
    .post('/api/v1/checkout/standard')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      addressId: Number(addressId),
      items: [
        {
          productId: Number(variableProductId),
          variantId: Number(variantId),
          name: 'Variable Product',
          price: 1800.00,
          quantity: 2
        }
      ]
    });

  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.body.data.totalAmount, 3600.00); // 2 * 1800

  // Verify stock was decremented by 2 to 8
  const [vFinal] = await db.query("SELECT stock_qty FROM product_variants WHERE id = ?", [variantId]);
  assert.strictEqual(vFinal.stock_qty, 8);

  // Test 4: Dual-payment checkout happy path
  console.log('  Testing dual-payment project checkout happy path...');
  // Add project to new cart
  await request(app)
    .post('/api/v1/cart/items')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: Number(projectProductId),
      customFieldValues: {
        engraving_text: 'My Wed Preserv'
      }
    });

  const res4 = await request(app)
    .post('/api/v1/checkout/dual-payment')
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      productId: Number(projectProductId),
      addressId: Number(addressId),
      selectedOfficeAddressId: Number(officeAddressId)
    });

  assert.strictEqual(res4.status, 200);
  assert.strictEqual(res4.body.success, true);
  assert.strictEqual(res4.body.data.advanceAmount, 2000.00);
  assert.strictEqual(res4.body.data.totalAmount, 5000.00);

  const projectOrderId = res4.body.data.orderId;

  // Verify dual-payment order status starts at BOOKED_PENDING_ADVANCE
  const [order] = await db.query("SELECT status, order_type FROM orders WHERE id = ?", [projectOrderId]);
  assert.strictEqual(order.status, 'BOOKED_PENDING_ADVANCE');
  assert.strictEqual(order.order_type, 'DUAL_PAYMENT');

  // Verify payment record is created for ADVANCE and amount is 2000
  const [paymentsProj] = await db.query("SELECT * FROM order_payments WHERE order_id = ?", [projectOrderId]);
  assert.strictEqual(paymentsProj.payment_type, 'ADVANCE');
  assert.strictEqual(parseFloat(paymentsProj.amount), 2000.00);

  console.log('All Checkout Endpoint Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Checkout Test Suite Failed:', err);
  process.exit(1);
});
