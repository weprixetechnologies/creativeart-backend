const fs = require('fs');
const path = require('path');
const db = require('../src/config/db');

async function run() {
  console.log('Running reviews and wishlist table migration...');
  const sqlPath = path.resolve(__dirname, '../migrations/20260712050000_create_reviews_and_wishlist_tables.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  // Split sql by semicolon
  const statements = sql
    .split(';')
    .map(s => s.trim())
    .filter(s => s.length > 0);

  for (const statement of statements) {
    console.log(`Executing statement: ${statement.substring(0, 50)}...`);
    await db.query(statement);
  }

  console.log('Migration ran successfully!');
  process.exit(0);
}

run().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
