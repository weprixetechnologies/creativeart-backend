const db = require('../config/db');

class CategoryModel {
  static async create({ parentId, name, slug, sortOrder, status }) {
    const sql = `
      INSERT INTO categories (parent_id, name, slug, sort_order, status)
      VALUES (?, ?, ?, ?, ?)
    `;
    const res = await db.query(sql, [
      parentId || null,
      name,
      slug,
      sortOrder || 0,
      status || 'ACTIVE'
    ]);
    return this.findById(res.insertId);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM categories WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findBySlug(slug) {
    const rows = await db.query('SELECT * FROM categories WHERE slug = ?', [slug]);
    return rows[0] || null;
  }

  static async findAll() {
    const sql = 'SELECT * FROM categories ORDER BY sort_order ASC, name ASC';
    return db.query(sql);
  }

  static async countProducts(id) {
    const sql = 'SELECT COUNT(*) as count FROM products WHERE category_id = ?';
    const rows = await db.query(sql, [id]);
    return parseInt(rows[0]?.count || 0, 10);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.parentId !== undefined) {
      fields.push('parent_id = ?');
      values.push(updates.parentId || null);
    }
    if (updates.name !== undefined) {
      fields.push('name = ?');
      values.push(updates.name);
    }
    if (updates.slug !== undefined) {
      fields.push('slug = ?');
      values.push(updates.slug);
    }
    if (updates.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(updates.sortOrder);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE categories SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM categories WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = CategoryModel;
