const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const db = require('../src/config/db');
async function setup() {
  await db.query('SET FOREIGN_KEY_CHECKS = 0');
  await db.query('DELETE FROM refresh_tokens');
  await db.query('DELETE FROM addresses');
  await db.query('DELETE FROM users');
  await db.query('SET FOREIGN_KEY_CHECKS = 1');
}
async function runTests() {
  console.log('Running Auth Tests...');

  // Setup db
  await setup();

  // 1. Test registration
  const regRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'John Doe',
      email: 'john@example.com',
      password: 'password123'
    });

  assert.strictEqual(regRes.status, 201, 'Registration should return 210');
  assert.strictEqual(regRes.body.success, true);
  assert.strictEqual(regRes.body.data.name, 'John Doe');
  assert.strictEqual(regRes.body.data.email, 'john@example.com');
  assert.strictEqual(regRes.body.data.role, 'CUSTOMER');
  console.log('✓ Registration successful');

  // 2. Test duplicate registration
  const dupRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'John Dup',
      email: 'john@example.com',
      password: 'password123'
    });

  assert.strictEqual(dupRes.status, 409, 'Duplicate registration should return 409');
  assert.strictEqual(dupRes.body.success, false);
  assert.strictEqual(dupRes.body.error.code, 'CONFLICT');
  console.log('✓ Duplicate registration rejected');

  // 3. Test login
  const loginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'john@example.com',
      password: 'password123'
    });

  assert.strictEqual(loginRes.status, 200, 'Login should return 200');
  assert.strictEqual(loginRes.body.success, true);
  assert.ok(loginRes.body.data.accessToken);
  assert.ok(loginRes.body.data.refreshToken);
  assert.strictEqual(loginRes.body.data.user.email, 'john@example.com');
  
  const accessToken = loginRes.body.data.accessToken;
  const refreshToken = loginRes.body.data.refreshToken;
  console.log('✓ Login successful');

  // 4. Test login failure
  const failLogin = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'john@example.com',
      password: 'wrongpassword'
    });

  assert.strictEqual(failLogin.status, 401, 'Wrong password login should return 401');
  assert.strictEqual(failLogin.body.success, false);
  assert.strictEqual(failLogin.body.error.code, 'AUTHENTICATION_FAILED');
  console.log('✓ Invalid login rejected');

  // 5. Test token refresh
  const refreshRes = await request(app)
    .post('/api/v1/auth/refresh')
    .send({
      refreshToken: refreshToken
    });

  assert.strictEqual(refreshRes.status, 200, 'Token refresh should return 200');
  assert.strictEqual(refreshRes.body.success, true);
  assert.ok(refreshRes.body.data.accessToken);
  assert.ok(refreshRes.body.data.refreshToken);
  
  const newAccessToken = refreshRes.body.data.accessToken;
  const newRefreshToken = refreshRes.body.data.refreshToken;
  console.log('✓ Token refresh successful');

  // 6. Test reused refresh token (should be revoked and reject)
  const reusedRefreshRes = await request(app)
    .post('/api/v1/auth/refresh')
    .send({
      refreshToken: refreshToken
    });

  assert.strictEqual(reusedRefreshRes.status, 401, 'Reused refresh token should be rejected');
  console.log('✓ Reused refresh token rejected (revoked)');

  // 7. Test forgot password
  const forgotRes = await request(app)
    .post('/api/v1/auth/forgot-password')
    .send({
      email: 'john@example.com'
    });

  assert.strictEqual(forgotRes.status, 200);
  assert.ok(forgotRes.body.data.resetToken);
  
  const resetToken = forgotRes.body.data.resetToken;
  console.log('✓ Forgot password link generation successful');

  // 8. Test reset password
  const resetRes = await request(app)
    .post('/api/v1/auth/reset-password')
    .send({
      token: resetToken,
      newPassword: 'newpassword123'
    });

  assert.strictEqual(resetRes.status, 200);
  assert.strictEqual(resetRes.body.success, true);
  console.log('✓ Reset password successful');

  // 9. Test login with new password
  const newLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'john@example.com',
      password: 'newpassword123'
    });

  assert.strictEqual(newLoginRes.status, 200);
  console.log('✓ Login with new password successful');

  // 9a. Test Role Guard
  // Create an ADMIN user
  const adminRegRes = await request(app)
    .post('/api/v1/auth/register')
    .send({
      name: 'Admin User',
      email: 'admin@example.com',
      password: 'adminpassword',
      role: 'ADMIN'
    });
  assert.strictEqual(adminRegRes.status, 201);

  // Login as Admin
  const adminLoginRes = await request(app)
    .post('/api/v1/auth/login')
    .send({
      email: 'admin@example.com',
      password: 'adminpassword'
    });
  assert.strictEqual(adminLoginRes.status, 200);
  const adminAccessToken = adminLoginRes.body.data.accessToken;

  // Attempt to access admin route as Customer (newLoginRes token)
  const custAccessRes = await request(app)
    .get('/api/v1/auth/admin-only')
    .set('Authorization', `Bearer ${newLoginRes.body.data.accessToken}`);
  assert.strictEqual(custAccessRes.status, 403, 'Customer accessing admin route should return 403 Forbidden');
  assert.strictEqual(custAccessRes.body.success, false);
  assert.strictEqual(custAccessRes.body.error.code, 'FORBIDDEN');

  // Attempt to access admin route as Admin (adminAccessToken token)
  const adminAccessRes = await request(app)
    .get('/api/v1/auth/admin-only')
    .set('Authorization', `Bearer ${adminAccessToken}`);
  assert.strictEqual(adminAccessRes.status, 200, 'Admin accessing admin route should return 200 OK');
  assert.strictEqual(adminAccessRes.body.success, true);
  console.log('✓ Role guard middleware successful');

  // 10. Test logout
  const logoutRes = await request(app)
    .post('/api/v1/auth/logout')
    .set('Authorization', `Bearer ${newLoginRes.body.data.accessToken}`)
    .send({
      refreshToken: newLoginRes.body.data.refreshToken
    });

  assert.strictEqual(logoutRes.status, 200);
  console.log('✓ Logout successful');

  console.log('All Auth Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error('Auth Tests Failed:', err);
      process.exit(1);
    });
}
