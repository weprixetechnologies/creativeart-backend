const fs = require('fs');
const path = require('path');
const db = require('../config/db');

async function runMigrations() {
  const migrationsDir = path.resolve(__dirname, '../../migrations');
  if (!fs.existsSync(migrationsDir)) {
    fs.mkdirSync(migrationsDir, { recursive: true });
  }

  // Ensure schema_migrations table exists
  await db.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      migration_name VARCHAR(255) PRIMARY KEY,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
  `);

  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.js') || f.endsWith('.sql'))
    .sort();

  const appliedRows = await db.query('SELECT migration_name FROM schema_migrations');
  const appliedSet = new Set(appliedRows.map(r => r.migration_name));

  console.log(`Found ${files.length} migrations in migrations folder.`);

  for (const file of files) {
    if (appliedSet.has(file)) {
      continue;
    }

    console.log(`Applying migration: ${file}...`);
    const filePath = path.join(migrationsDir, file);

    if (file.endsWith('.js')) {
      const migration = require(filePath);
      if (typeof migration.up !== 'function') {
        throw new Error(`Migration ${file} must export an 'up' function.`);
      }
      await db.transaction(async (conn) => {
        await migration.up(conn);
        await conn.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      });
    } else if (file.endsWith('.sql')) {
      const sqlContent = fs.readFileSync(filePath, 'utf8');
      // Simple splitter for statements (note: does not handle complex triggers/procedures, but sufficient for schema definitions)
      const statements = sqlContent
        .split(/;\s*$/m)
        .map(s => s.trim())
        .filter(s => s.length > 0);

      await db.transaction(async (conn) => {
        for (const statement of statements) {
          await conn.query(statement);
        }
        await conn.query('INSERT INTO schema_migrations (migration_name) VALUES (?)', [file]);
      });
    }

    console.log(`Migration ${file} applied successfully.`);
  }

  console.log('All migrations are up to date.');
}

if (require.main === module) {
  runMigrations()
    .then(() => {
      console.log('Migration runner finished successfully.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Migration runner failed:', err);
      process.exit(1);
    });
}

module.exports = { runMigrations };
