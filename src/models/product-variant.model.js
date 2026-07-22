const db = require('../config/db');

class ProductVariantModel {
  static async create({ productId, sku, attributes, priceOverride, stockQty, status }) {
    const sql = `
      INSERT INTO product_variants (product_id, sku, attributes, price_override, stock_qty, status)
      VALUES (?, ?, ?, ?, ?, ?)
    `;
    const res = await db.query(sql, [
      productId,
      sku,
      typeof attributes === 'object' ? JSON.stringify(attributes) : attributes,
      priceOverride !== undefined ? priceOverride : null,
      stockQty || 0,
      status || 'ACTIVE'
    ]);
    return this.findById(res.insertId);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM product_variants WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findBySku(sku) {
    const rows = await db.query('SELECT * FROM product_variants WHERE sku = ?', [sku]);
    return rows[0] || null;
  }

  static async findByProductId(productId) {
    const sql = 'SELECT * FROM product_variants WHERE product_id = ?';
    return db.query(sql, [productId]);
  }

  static async findByProductIds(productIds, status) {
    if (!productIds || productIds.length === 0) return [];
    const placeholders = productIds.map(() => '?').join(',');
    let sql = `SELECT * FROM product_variants WHERE product_id IN (${placeholders})`;
    const params = [...productIds];
    if (status) {
      sql += ' AND status = ?';
      params.push(status);
    }
    return db.query(sql, params);
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.sku !== undefined) {
      fields.push('sku = ?');
      values.push(updates.sku);
    }
    if (updates.attributes !== undefined) {
      fields.push('attributes = ?');
      values.push(typeof updates.attributes === 'object' ? JSON.stringify(updates.attributes) : updates.attributes);
    }
    if (updates.priceOverride !== undefined) {
      fields.push('price_override = ?');
      values.push(updates.priceOverride);
    }
    if (updates.stockQty !== undefined) {
      fields.push('stock_qty = ?');
      values.push(updates.stockQty);
    }
    if (updates.status !== undefined) {
      fields.push('status = ?');
      values.push(updates.status);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE product_variants SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM product_variants WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = ProductVariantModel;
