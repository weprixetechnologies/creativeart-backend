const db = require('../config/db');

class ProductImageModel {
  static async create({ productId, url, isPrimary, sortOrder }) {
    const sql = `
      INSERT INTO product_images (product_id, url, is_primary, sort_order)
      VALUES (?, ?, ?, ?)
    `;
    const res = await db.query(sql, [
      productId,
      url,
      isPrimary ? 1 : 0,
      sortOrder || 0
    ]);
    return this.findById(res.insertId);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM product_images WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByProductId(productId) {
    const sql = 'SELECT * FROM product_images WHERE product_id = ? ORDER BY sort_order ASC';
    return db.query(sql, [productId]);
  }

  static async clearPrimary(productId) {
    const sql = 'UPDATE product_images SET is_primary = 0 WHERE product_id = ?';
    await db.query(sql, [productId]);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.isPrimary !== undefined) {
      fields.push('is_primary = ?');
      values.push(updates.isPrimary ? 1 : 0);
    }
    if (updates.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(updates.sortOrder);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE product_images SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM product_images WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = ProductImageModel;
