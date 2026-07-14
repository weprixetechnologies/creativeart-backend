const request = require('supertest');
const assert = require('assert');
const express = require('express');
const redisClient = require('../src/config/redis');
const rateLimiter = require('../src/middlewares/rate-limiter.middleware');
const errorMiddleware = require('../src/middlewares/error.middleware');

// Create a standalone express app to isolate rate limiter tests
const app = express();
app.use(express.json());

// Set up a route with a limit of 3 requests per minute
app.get('/test-limit', rateLimiter({ limit: 3, windowMs: 60000, keyPrefix: 'test_rate_limit:' }), (req, res) => {
  res.json({ success: true, message: 'Passed' });
});

app.use(errorMiddleware);

async function runTests() {
  console.log('Running Rate Limiter Tests...');

  // Reset Redis keys for our test
  const keys = await redisClient.keys('test_rate_limit:*');
  if (keys.length > 0) {
    await redisClient.del(...keys);
  }

  // Request 1: should pass
  const res1 = await request(app).get('/test-limit');
  assert.strictEqual(res1.status, 200);
  assert.strictEqual(res1.headers['x-ratelimit-limit'], '3');
  assert.strictEqual(res1.headers['x-ratelimit-remaining'], '2');
  console.log('✓ Request 1 passed');

  // Request 2: should pass
  const res2 = await request(app).get('/test-limit');
  assert.strictEqual(res2.status, 200);
  assert.strictEqual(res2.headers['x-ratelimit-remaining'], '1');
  console.log('✓ Request 2 passed');

  // Request 3: should pass
  const res3 = await request(app).get('/test-limit');
  assert.strictEqual(res3.status, 200);
  assert.strictEqual(res3.headers['x-ratelimit-remaining'], '0');
  console.log('✓ Request 3 passed');

  // Request 4: should fail with 429
  const res4 = await request(app).get('/test-limit');
  assert.strictEqual(res4.status, 429);
  assert.strictEqual(res4.body.success, false);
  assert.strictEqual(res4.body.error.code, 'TOO_MANY_REQUESTS');
  console.log('✓ Request 4 blocked with 429 (rate-limited)');

  // Clean up Redis keys
  const endKeys = await redisClient.keys('test_rate_limit:*');
  if (endKeys.length > 0) {
    await redisClient.del(...endKeys);
  }

  console.log('All Rate Limiter Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => {
      // Disconnect Redis client so the test process exits cleanly
      redisClient.disconnect();
      process.exit(0);
    })
    .catch((err) => {
      console.error('Rate Limiter Tests Failed:', err);
      redisClient.disconnect();
      process.exit(1);
    });
}
