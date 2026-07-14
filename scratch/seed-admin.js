const bcrypt = require('bcrypt');
const db = require('../src/config/db');

async function seedAdmins() {
  console.log('Starting Administrative Seeding...');
  
  const staffAccounts = [
    {
      name: 'CreativeArt Admin',
      email: 'admin@creativeart.com',
      password: 'admin123',
      role: 'ADMIN'
    },
    {
      name: 'Production Staff',
      email: 'production@creativeart.com',
      password: 'production123',
      role: 'STAFF_PRODUCTION'
    },
    {
      name: 'Packaging Staff',
      email: 'packaging@creativeart.com',
      password: 'packaging123',
      role: 'STAFF_PACKAGING'
    }
  ];

  try {
    for (const account of staffAccounts) {
      const existing = await db.query('SELECT id FROM users WHERE email = ?', [account.email]);
      
      const saltRounds = 10;
      const passwordHash = await bcrypt.hash(account.password, saltRounds);

      if (existing.length > 0) {
        console.log(`Account ${account.email} already exists. Updating details...`);
        await db.query(
          'UPDATE users SET name = ?, password_hash = ?, role = ?, status = "ACTIVE" WHERE email = ?',
          [account.name, passwordHash, account.role, account.email]
        );
      } else {
        console.log(`Creating new account ${account.email}...`);
        await db.query(
          'INSERT INTO users (name, email, password_hash, role, status) VALUES (?, ?, ?, ?, "ACTIVE")',
          [account.name, account.email, passwordHash, account.role]
        );
      }
    }
    
    console.log('Administrative & Staff Seeding completed successfully!');
  } catch (err) {
    console.error('Error during administrative seeding:', err);
  } finally {
    process.exit(0);
  }
}

seedAdmins();
