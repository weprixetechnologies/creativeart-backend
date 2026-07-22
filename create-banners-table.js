const db = require('./src/config/db');

async function createBannersTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS banners (
      id INT AUTO_INCREMENT PRIMARY KEY,
      image_url VARCHAR(255) NOT NULL,
      link_url VARCHAR(255),
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(query);
    console.log('Banners table created successfully.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    process.exit();
  }
}

createBannersTable();
