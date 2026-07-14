const request = require('supertest');
const app = require('../server');
const db = require('../src/config/db');
const assert = require('assert');

let userToken = '';
let adminToken = '';
let productId = '';

async function setup() {
  await db.query('DELETE FROM order_status_history');
  await db.query('DELETE FROM coupon_usages');
  await db.query('DELETE FROM order_payments');
  await db.query('DELETE FROM shipments');
  await db.query('DELETE FROM product_reviews');
  await db.query('DELETE FROM wishlists');
  await db.query('DELETE FROM order_items');
  await db.query('DELETE FROM orders');
  await db.query('DELETE FROM product_images');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM users');

  // Create Category
  const cat = await db.query(
    "INSERT INTO categories (name, slug, status) VALUES ('Artworks', 'artworks', 'ACTIVE')"
  );
  const categoryId = cat.insertId;

  // Insert two products for testing search
  const prod1 = await db.query(
    `INSERT INTO products (category_id, name, slug, description, base_price, item_type, product_type, status) 
     VALUES (?, 'Gorgeous Red Painting', 'gorgeous-red-painting', 'A beautiful hand-drawn red painting on canvas.', 1200.00, 'PRODUCT', 'SIMPLE', 'ACTIVE')`,
    [categoryId]
  );
  productId = prod1.insertId;

  const prod2 = await db.query(
    `INSERT INTO products (category_id, name, slug, description, base_price, item_type, product_type, status) 
     VALUES (?, 'Vibrant Yellow Sculpture', 'vibrant-yellow-sculpture', 'A handmade yellow clay sculpture.', 3400.00, 'PRODUCT', 'SIMPLE', 'ACTIVE')`,
    [categoryId]
  );

  // Create customer user
  const userRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Customer One', 'customer1@example.com', 'hashedpassword', 'CUSTOMER']
  );
  
  // Create admin user
  const adminRes = await db.query(
    `INSERT INTO users (name, email, password_hash, role) 
     VALUES (?, ?, ?, ?)`,
    ['Admin Master', 'adminmaster@example.com', 'hashedpassword', 'ADMIN']
  );

  const jwt = require('jsonwebtoken');
  const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';
  
  userToken = jwt.sign({ userId: userRes.insertId, role: 'CUSTOMER' }, JWT_SECRET);
  adminToken = jwt.sign({ userId: adminRes.insertId, role: 'ADMIN' }, JWT_SECRET);
}

async function runTests() {
  console.log('Running Reviews, Wishlist, and Search Polish Tests...');
  await setup();

  // Test 1: Search - Strict AND match
  console.log('  Testing strict AND multi-term search...');
  const search1 = await request(app)
    .get('/api/v1/products?search=Gorgeous+Red');
  assert.strictEqual(search1.status, 200);
  assert.strictEqual(search1.body.data.length, 1);
  assert.strictEqual(search1.body.data[0].name, 'Gorgeous Red Painting');

  // Test 2: Search - OR fallback match
  console.log('  Testing fallback OR search when strict AND returns 0...');
  const search2 = await request(app)
    .get('/api/v1/products?search=Red+Sculpture');
  assert.strictEqual(search2.status, 200);
  // Should return both products because "Red" matches prod1 and "Sculpture" matches prod2
  assert.strictEqual(search2.body.data.length, 2);

  // Test 3: Wishlist - Toggle Add
  console.log('  Testing wishlist add toggle...');
  const wlAdd = await request(app)
    .post('/api/v1/wishlist')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ productId });
  assert.strictEqual(wlAdd.status, 200);
  assert.strictEqual(wlAdd.body.data.inWishlist, true);

  // Test 4: Wishlist - List
  console.log('  Testing wishlist listing...');
  const wlList = await request(app)
    .get('/api/v1/wishlist')
    .set('Authorization', `Bearer ${userToken}`);
  assert.strictEqual(wlList.status, 200);
  assert.strictEqual(wlList.body.data.length, 1);
  assert.strictEqual(Number(wlList.body.data[0].id), Number(productId));

  // Test 5: Wishlist - Toggle Remove
  console.log('  Testing wishlist remove toggle...');
  const wlRem = await request(app)
    .post('/api/v1/wishlist')
    .set('Authorization', `Bearer ${userToken}`)
    .send({ productId });
  assert.strictEqual(wlRem.status, 200);
  assert.strictEqual(wlRem.body.data.inWishlist, false);

  // Test 6: Reviews - Submit Review
  console.log('  Testing review submission...');
  const revSub = await request(app)
    .post(`/api/v1/products/${productId}/reviews`)
    .set('Authorization', `Bearer ${userToken}`)
    .send({
      rating: 5,
      title: 'Amazing canvas print!',
      comment: 'Super crisp colors, love it.'
    });
  assert.strictEqual(revSub.status, 201);

  // Test 7: Reviews - Not visible until approved
  console.log('  Testing review visibility (pending)...');
  const revList1 = await request(app)
    .get(`/api/v1/products/${productId}/reviews`);
  assert.strictEqual(revList1.status, 200);
  assert.strictEqual(revList1.body.data.reviews.length, 0);

  // Test 8: Reviews - Approval moderation
  console.log('  Testing review approval moderation...');
  // Get all reviews as admin
  const adminRevList = await request(app)
    .get('/api/v1/admin/reviews')
    .set('Authorization', `Bearer ${adminToken}`);
  assert.strictEqual(adminRevList.status, 200);
  const reviewId = adminRevList.body.data[0].id;

  // Approve the review
  const approveRes = await request(app)
    .put(`/api/v1/admin/reviews/${reviewId}/status`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({ status: 'APPROVED' });
  assert.strictEqual(approveRes.status, 200);

  // Test 9: Reviews - Visible and stats recalculated after approval
  console.log('  Testing review visibility & stats post-approval...');
  const revList2 = await request(app)
    .get(`/api/v1/products/${productId}/reviews`);
  assert.strictEqual(revList2.status, 200);
  assert.strictEqual(revList2.body.data.reviews.length, 1);
  assert.strictEqual(parseFloat(revList2.body.data.averageRating), 5.0);

  console.log('All Reviews, Wishlist, and Search Polish Tests Passed!');
  process.exit(0);
}

runTests().catch(err => {
  console.error('Reviews and Wishlist Tests Failed:', err);
  process.exit(1);
});
