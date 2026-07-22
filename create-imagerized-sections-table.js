const db = require('./src/config/db');

async function createImagerizedSectionsTable() {
  const query = `
    CREATE TABLE IF NOT EXISTS imagerized_sections (
      id INT AUTO_INCREMENT PRIMARY KEY,
      title VARCHAR(255),
      layout VARCHAR(20) NOT NULL,
      images JSON NOT NULL,
      is_active BOOLEAN DEFAULT true,
      sort_order INT DEFAULT 0,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    );
  `;
  try {
    await db.query(query);
    console.log('imagerized_sections table created successfully.');
  } catch (error) {
    console.error('Error creating table:', error);
  } finally {
    process.exit();
  }
}

createImagerizedSectionsTable();
