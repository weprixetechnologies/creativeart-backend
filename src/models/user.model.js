const db = require('../config/db');

class UserModel {
  static async create({ name, email, phone, passwordHash, role, status }) {
    const roleVal = role || 'CUSTOMER';
    const statusVal = status || 'ACTIVE';
    const sql = `
      INSERT INTO users (name, email, phone, password_hash, role, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const res = await db.query(sql, [name, email || null, phone || null, passwordHash, roleVal, statusVal]);
    return { id: res.insertId, name, email, phone, role: roleVal, status: statusVal };
  }

  static async findByEmail(email) {
    const rows = await db.query('SELECT * FROM users WHERE email = ?', [email]);
    return rows[0] || null;
  }

  static async findByPhone(phone) {
    const rows = await db.query('SELECT * FROM users WHERE phone = ?', [phone]);
    return rows[0] || null;
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM users WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];
    
    // Whitelist updates
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.email !== undefined) {
      fields.push('email = ?');
      values.push(updates.email || null);
    }
    if (updates.phone !== undefined) {
      fields.push('phone = ?');
      values.push(updates.phone || null);
    }
    if (updates.password_hash !== undefined) {
      fields.push('password_hash = ?');
      values.push(updates.password_hash);
    }
    if (updates.role !== undefined) {
      fields.push('role = ?');
      values.push(updates.role);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }
    if (updates.email_verified_at !== undefined) {
      fields.push('email_verified_at = ?');
      values.push(updates.email_verified_at);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }
}

module.exports = UserModel;
