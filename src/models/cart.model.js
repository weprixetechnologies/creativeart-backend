const db = require('../config/db');

class CartModel {
  async findActiveByUserId(userId) {
    const rows = await db.query(
      "SELECT * FROM carts WHERE user_id = ? AND status = 'ACTIVE'",
      [userId]
    );
    return rows[0] || null;
  }

  async findActiveBySessionId(sessionId) {
    const rows = await db.query(
      "SELECT * FROM carts WHERE session_id = ? AND status = 'ACTIVE'",
      [sessionId]
    );
    return rows[0] || null;
  }

  async create({ userId = null, sessionId = null, cartItemType = null } = {}) {
    const res = await db.query(
      "INSERT INTO carts (user_id, session_id, cart_item_type, status) VALUES (?, ?, ?, 'ACTIVE')",
      [userId, sessionId, cartItemType]
    );
    return {
      id: res.insertId,
      user_id: userId,
      session_id: sessionId,
      cart_item_type: cartItemType,
      status: 'ACTIVE'
    };
  }

  async update(cartId, { userId = null, sessionId = null, cartItemType = null, status = 'ACTIVE' } = {}) {
    await db.query(
      "UPDATE carts SET user_id = ?, session_id = ?, cart_item_type = ?, status = ? WHERE id = ?",
      [userId, sessionId, cartItemType, status, cartId]
    );
  }

  async getItems(cartId) {
    const items = await db.query(
      `SELECT ci.*, 
              p.name as product_name, 
              p.slug as product_slug, 
              p.item_type,
              p.product_type,
              pv.sku as variant_sku,
              pv.attributes as variant_attributes,
              pv.price_override as variant_price_override
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       LEFT JOIN product_variants pv ON ci.variant_id = pv.id
       WHERE ci.cart_id = ?`,
      [cartId]
    );
    return items;
  }

  async getCustomValuesForItems(cartItemIds) {
    if (cartItemIds.length === 0) return [];
    
    // MariaDB query with placeholder array injection
    const values = await db.query(
      `SELECT cicv.*, pcf.field_key, pcf.label, pcf.type
       FROM cart_item_custom_values cicv
       JOIN product_custom_fields pcf ON cicv.custom_field_id = pcf.id
       WHERE cicv.cart_item_id IN (${cartItemIds.map(() => '?').join(',')})`,
      cartItemIds
    );
    return values;
  }

  async addItem(conn, { cartId, productId, variantId = null, qty = 1, unitPriceSnapshot }) {
    const res = await conn.query(
      `INSERT INTO cart_items (cart_id, product_id, variant_id, qty, unit_price_snapshot) 
       VALUES (?, ?, ?, ?, ?)`,
      [cartId, productId, variantId, qty, unitPriceSnapshot]
    );
    return res.insertId;
  }

  async updateItemQty(cartItemId, qty) {
    await db.query(
      "UPDATE cart_items SET qty = ? WHERE id = ?",
      [qty, cartItemId]
    );
  }

  async removeItem(conn, cartItemId) {
    await conn.query("DELETE FROM cart_items WHERE id = ?", [cartItemId]);
  }

  async addCustomValues(conn, cartItemId, customValues) {
    if (customValues.length === 0) return;
    
    for (const val of customValues) {
      await conn.query(
        "INSERT INTO cart_item_custom_values (cart_item_id, custom_field_id, value) VALUES (?, ?, ?)",
        [cartItemId, val.customFieldId, val.value]
      );
    }
  }

  async clearCustomValues(conn, cartItemId) {
    await conn.query("DELETE FROM cart_item_custom_values WHERE cart_item_id = ?", [cartItemId]);
  }

  async findItemById(conn, cartItemId) {
    const rows = await conn.query(
      "SELECT * FROM cart_items WHERE id = ?",
      [cartItemId]
    );
    return rows[0] || null;
  }
}

module.exports = new CartModel();
