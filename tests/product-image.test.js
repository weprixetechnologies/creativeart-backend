const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');

let adminToken = '';
let categoryId = '';
let productId = '';

async function setup() {
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM product_variants');
  await db.query('DELETE FROM product_custom_fields');
  await db.query('DELETE FROM product_images');
  await db.query('DELETE FROM products');
  await db.query('DELETE FROM categories');
  await db.query('DELETE FROM users');

  // Register and login Admin
  await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'password123',
      role: 'ADMIN'
    });
  
  const adminLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'admin@example.com',
      password: 'password123'
    });
  adminToken = adminLogin.body.data.accessToken;

  // Create a category
  const catRes = await request(app)
    .post('/api/v1/admin/categories')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      name: 'Art Crafts',
      slug: 'art-crafts'
    });
  categoryId = catRes.body.data.id;

  // Create a product
  const pRes = await request(app)
    .post('/api/v1/admin/products')
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      categoryId,
      itemType: 'PRODUCT',
      productType: 'SIMPLE',
      name: 'Standard Mug',
      slug: 'standard-mug',
      description: 'A standard ceramic coffee mug.',
      basePrice: 299.00
    });
  productId = pRes.body.data.id;
}

async function runTests() {
  console.log('Running Product Image Tests...');
  await setup();

  // 1. Add first image: should succeed and be primary automatically
  const img1Res = await request(app)
    .post(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      action: 'add',
      url: 'https://cdn.com/image1.png',
      isPrimary: false, // will be overridden to true since it's the first image
      sortOrder: 1
    });

  assert.strictEqual(img1Res.status, 200);
  assert.strictEqual(img1Res.body.success, true);
  assert.strictEqual(img1Res.body.data.is_primary, 1);
  assert.strictEqual(img1Res.body.data.url, 'https://cdn.com/image1.png');
  const img1Id = img1Res.body.data.id;
  console.log('✓ First image added and correctly set to primary');

  // 2. Add second image: should succeed and be non-primary
  const img2Res = await request(app)
    .post(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      action: 'add',
      url: 'https://cdn.com/image2.png',
      isPrimary: false,
      sortOrder: 2
    });
  assert.strictEqual(img2Res.status, 200);
  assert.strictEqual(img2Res.body.data.is_primary, 0);
  const img2Id = img2Res.body.data.id;
  console.log('✓ Second image added as non-primary');

  // 3. Add third image explicitly as primary: first image should become non-primary
  const img3Res = await request(app)
    .post(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      action: 'add',
      url: 'https://cdn.com/image3.png',
      isPrimary: true,
      sortOrder: 3
    });
  assert.strictEqual(img3Res.status, 200);
  assert.strictEqual(img3Res.body.data.is_primary, 1);
  const img3Id = img3Res.body.data.id;

  // Retrieve images and verify primary flags
  const listRes = await request(app)
    .get(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`);
  
  const images = listRes.body.data;
  assert.strictEqual(images.length, 3);
  
  const img1 = images.find(img => img.id === img1Id);
  const img2 = images.find(img => img.id === img2Id);
  const img3 = images.find(img => img.id === img3Id);

  assert.strictEqual(img1.is_primary, 0, 'First image should no longer be primary');
  assert.strictEqual(img2.is_primary, 0, 'Second image should be non-primary');
  assert.strictEqual(img3.is_primary, 1, 'Third image should be primary');
  console.log('✓ Set primary in add actions switches correctly');

  // 4. Reorder images
  const reorderRes = await request(app)
    .post(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      action: 'reorder',
      images: [
        { id: img1Id, sortOrder: 10 },
        { id: img2Id, sortOrder: 5 },
        { id: img3Id, sortOrder: 1 }
      ]
    });
  
  assert.strictEqual(reorderRes.status, 200);
  // Sort order sequence should be img3 (1) -> img2 (5) -> img1 (10)
  assert.strictEqual(reorderRes.body.data[0].id, img3Id);
  assert.strictEqual(reorderRes.body.data[1].id, img2Id);
  assert.strictEqual(reorderRes.body.data[2].id, img1Id);
  console.log('✓ Reorder action succeeded and sorted correctly');

  // 5. Delete primary image (img3): next image (img2) should automatically become primary
  const deleteRes = await request(app)
    .post(`/api/v1/admin/products/${productId}/images`)
    .set('Authorization', `Bearer ${adminToken}`)
    .send({
      action: 'delete',
      imageId: img3Id
    });
  
  assert.strictEqual(deleteRes.status, 200);
  assert.strictEqual(deleteRes.body.data.length, 2);
  
  // img2 is now the first sorted remaining image, verify it became primary
  const updatedImg2 = deleteRes.body.data.find(img => img.id === img2Id);
  assert.strictEqual(updatedImg2.is_primary, 1, 'img2 should become primary after primary img3 deleted');
  console.log('✓ Deleting primary image triggers fallback primary reassignment');

  console.log('All Product Image Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Product Image Tests Failed:', err);
      process.exit(1);
    });
}
