const request = require('supertest');
const assert = require('assert');
const app = require('../server');
const StorageService = require('../src/services/storage.service');

async function runTests() {
  console.log('Running Bunny Storage Proxy Tests...');

  const key = 'test-assets/logo.png';
  const contentType = 'image/png';
  const testBuffer = Buffer.from('fake-binary-image-data-here-12345');

  // 1. Generate upload URL
  const { uploadUrl, fileUrl } = StorageService.getPresignedUploadUrl(key, contentType);

  assert.ok(uploadUrl, 'uploadUrl should be returned');
  assert.ok(fileUrl, 'fileUrl should be returned');
  assert.ok(uploadUrl.includes('/api/v1/storage/upload'), 'uploadUrl should route to proxy');
  assert.ok(fileUrl.startsWith('https://cly-pull-bunny.b-cdn.net'), 'fileUrl should point to Bunny Pull Zone');
  
  console.log('✓ URL Generation Successful');
  console.log('  Upload URL:', uploadUrl);
  console.log('  File URL:', fileUrl);

  // 2. Perform upload via proxy endpoint
  // We extract the relative path and query from uploadUrl since supertest takes app and relative path
  const urlObj = new URL(uploadUrl);
  const relativePath = urlObj.pathname + urlObj.search;

  console.log(`Simulating upload to local proxy path: ${urlObj.pathname}...`);
  
  // Mock the external upload request to Bunny.net to keep tests fast and prevent network call failures
  const originalUploadToBunny = StorageService.uploadToBunny;
  StorageService.uploadToBunny = async (k, buf, ct) => {
    assert.strictEqual(k, key);
    assert.strictEqual(ct, contentType);
    assert.ok(Buffer.isBuffer(buf));
    assert.strictEqual(buf.toString(), testBuffer.toString());
    return `${urlObj.origin}/${k}`;
  };

  try {
    const uploadRes = await request(app)
      .put(relativePath)
      .set('Content-Type', contentType)
      .send(testBuffer);

    assert.strictEqual(uploadRes.status, 200, 'Upload request should return 200');
    assert.strictEqual(uploadRes.body.success, true);
    assert.ok(uploadRes.body.data.fileUrl);
    console.log('✓ Upload to proxy successful');
  } finally {
    // Restore original upload function
    StorageService.uploadToBunny = originalUploadToBunny;
  }

  console.log('All Bunny Storage Tests Passed!');
}

if (require.main === module) {
  runTests()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error('Bunny Storage Tests Failed:', err);
      process.exit(1);
    });
}
