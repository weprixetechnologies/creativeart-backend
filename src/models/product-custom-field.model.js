const db = require('../config/db');

class ProductCustomFieldModel {
  static async create({
    productId,
    fieldKey,
    label,
    type,
    required,
    helpText,
    options,
    maxFileSizeKb,
    allowedMimeTypes,
    sortOrder
  }) {
    const sql = `
      INSERT INTO product_custom_fields (
        product_id, field_key, label, type, required, help_text, options,
        max_file_size_kb, allowed_mime_types, sort_order
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `;
    const res = await db.query(sql, [
      productId,
      fieldKey,
      label,
      type,
      required ? 1 : 0,
      helpText !== undefined ? helpText : null,
      options ? (typeof options === 'object' ? JSON.stringify(options) : options) : null,
      maxFileSizeKb !== undefined ? maxFileSizeKb : null,
      allowedMimeTypes ? (typeof allowedMimeTypes === 'object' ? JSON.stringify(allowedMimeTypes) : allowedMimeTypes) : null,
      sortOrder || 0
    ]);
    return this.findById(res.insertId);
  }

  static async findById(id) {
    const rows = await db.query('SELECT * FROM product_custom_fields WHERE id = ?', [id]);
    return rows[0] || null;
  }

  static async findByProductId(productId) {
    const sql = 'SELECT * FROM product_custom_fields WHERE product_id = ? ORDER BY sort_order ASC, id ASC';
    return db.query(sql, [productId]);
  }

  static async findByKey(productId, fieldKey) {
    const sql = 'SELECT * FROM product_custom_fields WHERE product_id = ? AND field_key = ?';
    const rows = await db.query(sql, [productId, fieldKey]);
    return rows[0] || null;
  }

  static async update(id, updates) {
    const fields = [];
    const values = [];

    if (updates.fieldKey !== undefined) {
      fields.push('field_key = ?');
      values.push(updates.fieldKey);
    }
    if (updates.label !== undefined) {
      fields.push('label = ?');
      values.push(updates.label);
    }
    if (updates.type !== undefined) {
      fields.push('type = ?');
      values.push(updates.type);
    }
    if (updates.required !== undefined) {
      fields.push('required = ?');
      values.push(updates.required ? 1 : 0);
    }
    if (updates.helpText !== undefined) {
      fields.push('help_text = ?');
      values.push(updates.helpText);
    }
    if (updates.options !== undefined) {
      fields.push('options = ?');
      values.push(updates.options ? (typeof updates.options === 'object' ? JSON.stringify(updates.options) : updates.options) : null);
    }
    if (updates.maxFileSizeKb !== undefined) {
      fields.push('max_file_size_kb = ?');
      values.push(updates.maxFileSizeKb);
    }
    if (updates.allowedMimeTypes !== undefined) {
      fields.push('allowed_mime_types = ?');
      values.push(updates.allowedMimeTypes ? (typeof updates.allowedMimeTypes === 'object' ? JSON.stringify(updates.allowedMimeTypes) : updates.allowedMimeTypes) : null);
    }
    if (updates.sortOrder !== undefined) {
      fields.push('sort_order = ?');
      values.push(updates.sortOrder);
    }

    if (fields.length === 0) return null;

    values.push(id);
    const sql = `UPDATE product_custom_fields SET ${fields.join(', ')} WHERE id = ?`;
    await db.query(sql, values);
    return this.findById(id);
  }

  static async delete(id) {
    const sql = 'DELETE FROM product_custom_fields WHERE id = ?';
    await db.query(sql, [id]);
  }
}

module.exports = ProductCustomFieldModel;
