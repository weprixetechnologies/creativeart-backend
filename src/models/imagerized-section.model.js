const db = require('../config/db');

class ImagerizedSectionModel {
  static async findAll(activeOnly = false) {
    let sql = 'SELECT * FROM imagerized_sections';
    if (activeOnly) {
      sql += ' WHERE is_active = true';
    }
    sql += ' ORDER BY sort_order ASC, created_at DESC';
    return await db.query(sql);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM imagerized_sections WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const { title, layout, images, isActive, sortOrder } = data;
    const result = await db.query(
      'INSERT INTO imagerized_sections (title, layout, images, is_active, sort_order) VALUES (?, ?, ?, ?, ?)',
      [title || null, layout, JSON.stringify(images || []), isActive !== false, sortOrder || 0]
    );
    return await this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.title !== undefined) {
      fields.push('title = ?');
      values.push(data.title || null);
    }
    if (data.layout !== undefined) {
      fields.push('layout = ?');
      values.push(data.layout);
    }
    if (data.images !== undefined) {
      fields.push('images = ?');
      values.push(JSON.stringify(data.images));
    }
    if (data.isActive !== undefined) {
      fields.push('is_active = ?');
      values.push(data.isActive);
    }
    if (data.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(data.sortOrder);
    }

    if (fields.length === 0) return await this.findById(id);

    values.push(id);
    const sql = `UPDATE imagerized_sections SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);

    return await this.findById(id);
  }

  static async delete(id) {
    await db.query('DELETE FROM imagerized_sections WHERE id = ?', [id]);
  }
}

module.exports = ImagerizedSectionModel;
