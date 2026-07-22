const db = require('../config/db');

class BannerModel {
  static async findAll(activeOnly = false) {
    let sql = 'SELECT * FROM banners';
    if (activeOnly) {
      sql += ' WHERE is_active = true';
    }
    sql += ' ORDER BY sort_order ASC, created_at DESC';
    return await db.query(sql);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM banners WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async create(data) {
    const { imageUrl, linkUrl, isActive, sortOrder } = data;
    const result = await db.query(
      'INSERT INTO banners (image_url, link_url, is_active, sort_order) VALUES (?, ?, ?, ?)',
      [imageUrl, linkUrl || null, isActive !== false, sortOrder || 0]
    );
    return await this.findById(result.insertId);
  }

  static async update(id, data) {
    const fields = [];
    const values = [];

    if (data.imageUrl !== undefined) {
      fields.push('image_url = ?');
      values.push(data.imageUrl);
    }
    if (data.linkUrl !== undefined) {
      fields.push('link_url = ?');
      values.push(data.linkUrl || null);
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
    const sql = `UPDATE banners SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);

    return await this.findById(id);
  }

  static async delete(id) {
    await db.query('DELETE FROM banners WHERE id = ?', [id]);
  }
}

module.exports = BannerModel;
