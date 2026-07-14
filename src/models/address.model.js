const db = require('../config/db');

class AddressModel {
  async findById(id) {
    const rows = await db.query(
      "SELECT * FROM addresses WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  async findByUserId(userId) {
    const rows = await db.query(
      "SELECT * FROM addresses WHERE user_id = ? ORDER BY is_default DESC, id DESC",
      [userId]
    );
    return rows;
  }

  async create({
    userId,
    label,
    contactName,
    contactPhone,
    line1,
    line2 = null,
    city,
    state,
    pincode,
    country = 'India',
    isDefault = false
  }) {
    const res = await db.query(
      `INSERT INTO addresses 
       (user_id, label, contact_name, contact_phone, line1, line2, city, state, pincode, country, is_default) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [userId, label, contactName, contactPhone, line1, line2, city, state, pincode, country, isDefault ? 1 : 0]
    );
    return this.findById(res.insertId);
  }

  async update(id, updates) {
    const fields = [];
    const values = [];

    const fieldMap = {
      label: 'label = ?',
      contactName: 'contact_name = ?',
      contactPhone: 'contact_phone = ?',
      line1: 'line1 = ?',
      line2: 'line2 = ?',
      city: 'city = ?',
      state: 'state = ?',
      pincode: 'pincode = ?',
      country: 'country = ?',
      isDefault: 'is_default = ?'
    };

    Object.entries(updates).forEach(([key, val]) => {
      if (fieldMap[key] !== undefined && val !== undefined) {
        fields.push(fieldMap[key]);
        values.push(key === 'isDefault' ? (val ? 1 : 0) : val);
      }
    });

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const sql = `UPDATE addresses SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  async clearDefaults(userId) {
    await db.query(
      "UPDATE addresses SET is_default = FALSE WHERE user_id = ?",
      [userId]
    );
  }

  async delete(id) {
    await db.query(
      "DELETE FROM addresses WHERE id = ?",
      [id]
    );
  }
}

module.exports = new AddressModel();
