const db = require('../config/db');

class OrderModel {
  async findById(id) {
    const rows = await db.query(
      "SELECT * FROM orders WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  async findByOrderNumber(orderNumber) {
    const rows = await db.query(
      "SELECT * FROM orders WHERE order_number = ?",
      [orderNumber]
    );
    return rows[0] || null;
  }

  async getOrderItems(orderId) {
    const rows = await db.query(
      `SELECT oi.*, p.slug as product_slug, pv.sku as variant_sku,
              (SELECT pi.url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.sort_order ASC LIMIT 1) as product_image
       FROM order_items oi
       JOIN products p ON oi.product_id = p.id
       LEFT JOIN product_variants pv ON oi.variant_id = pv.id
       WHERE oi.order_id = ?`,
      [orderId]
    );
    return rows;
  }

  async getCustomValuesForItems(orderItemIds) {
    if (orderItemIds.length === 0) return [];
    const rows = await db.query(
      `SELECT * FROM order_item_custom_values 
       WHERE order_item_id IN (${orderItemIds.map(() => '?').join(',')})`,
      orderItemIds
    );
    return rows;
  }

  async getPayments(orderId) {
    const rows = await db.query(
      "SELECT * FROM order_payments WHERE order_id = ? ORDER BY id ASC",
      [orderId]
    );
    return rows;
  }

  async getStatusHistory(orderId) {
    const rows = await db.query(
      "SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC",
      [orderId]
    );
    return rows;
  }

  async createOrder(conn, {
    orderNumber,
    userId,
    orderType,
    status,
    addressId = null,
    selectedOfficeAddressId = null,
    couponId = null,
    subtotal,
    discountAmount = 0.00,
    taxAmount = 0.00,
    shippingAmount = 0.00,
    totalAmount,
    advanceAmount = null,
    finalAmount = null,
    affiliateId = null,
    referralCodeUsed = null
  }) {
    const res = await conn.query(
      `INSERT INTO orders (
        order_number, user_id, order_type, status, address_id, selected_office_address_id,
        coupon_id, subtotal, discount_amount, tax_amount, shipping_amount, total_amount,
        advance_amount, final_amount, affiliate_id, referral_code_used
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        orderNumber, userId, orderType, status, addressId, selectedOfficeAddressId,
        couponId, subtotal, discountAmount, taxAmount, shippingAmount, totalAmount,
        advanceAmount, finalAmount, affiliateId, referralCodeUsed
      ]
    );
    return res.insertId;
  }

  async createOrderItem(conn, {
    orderId,
    productId,
    variantId = null,
    productNameSnapshot,
    qty,
    unitPrice,
    lineTotal
  }) {
    const res = await conn.query(
      `INSERT INTO order_items (
        order_id, product_id, variant_id, product_name_snapshot, qty, unit_price, line_total
      ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [orderId, productId, variantId, productNameSnapshot, qty, unitPrice, lineTotal]
    );
    return res.insertId;
  }

  async createOrderItemCustomValue(conn, {
    orderItemId,
    customFieldId,
    fieldLabelSnapshot,
    value
  }) {
    await conn.query(
      `INSERT INTO order_item_custom_values (
        order_item_id, custom_field_id, field_label_snapshot, value
      ) VALUES (?, ?, ?, ?)`,
      [orderItemId, customFieldId, fieldLabelSnapshot, value]
    );
  }

  async createPaymentRecord(conn, {
    orderId,
    paymentType,
    gateway = 'PHONEPE',
    gatewayOrderId,
    amount,
    status = 'CREATED'
  }) {
    const res = await conn.query(
      `INSERT INTO order_payments (
        order_id, payment_type, gateway, gateway_order_id, amount, status
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, paymentType, gateway, gatewayOrderId, amount, status]
    );
    return res.insertId;
  }

  async writeStatusHistory(conn, {
    orderId,
    fromStatus = null,
    toStatus,
    actorType,
    actorUserId = null,
    note = null
  }) {
    await conn.query(
      `INSERT INTO order_status_history (
        order_id, from_status, to_status, actor_type, actor_user_id, note
      ) VALUES (?, ?, ?, ?, ?, ?)`,
      [orderId, fromStatus, toStatus, actorType, actorUserId, note]
    );
  }

  async findAddressById(userId, addressId) {
    const rows = await db.query(
      "SELECT * FROM addresses WHERE id = ? AND user_id = ?",
      [addressId, userId]
    );
    return rows[0] || null;
  }

  async findOfficeAddressById(officeAddressId) {
    const rows = await db.query(
      "SELECT id FROM office_addresses WHERE id = ? AND status = 'ACTIVE'",
      [officeAddressId]
    );
    return rows[0] || null;
  }
}

module.exports = new OrderModel();
