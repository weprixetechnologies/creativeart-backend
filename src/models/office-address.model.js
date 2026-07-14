const db = require('../config/db');

class OfficeAddressModel {
  async findById(id) {
    const rows = await db.query(
      "SELECT * FROM office_addresses WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  async findAll() {
    const rows = await db.query(
      "SELECT * FROM office_addresses ORDER BY id ASC"
    );
    return rows;
  }

  async findActive() {
    const rows = await db.query(
      "SELECT * FROM office_addresses WHERE status = 'ACTIVE' ORDER BY id ASC"
    );
    return rows;
  }

  async create({
    label,
    contactName,
    contactPhone,
    line1,
    line2 = null,
    city,
    state,
    pincode,
    country = 'India',
    status = 'ACTIVE'
  }) {
    const res = await db.query(
      `INSERT INTO office_addresses 
       (label, contact_name, contact_phone, line1, line2, city, state, pincode, country, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [label, contactName, contactPhone, line1, line2, city, state, pincode, country, status]
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
      status: 'status = ?'
    };

    Object.entries(updates).forEach(([key, val]) => {
      if (fieldMap[key] !== undefined && val !== undefined) {
        fields.push(fieldMap[key]);
        values.push(val);
      }
    });

    if (fields.length === 0) return this.findById(id);

    values.push(id);
    const sql = `UPDATE office_addresses SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  async delete(id) {
    await db.query(
      "DELETE FROM office_addresses WHERE id = ?",
      [id]
    );
  }
}

module.exports = new OfficeAddressModel();
