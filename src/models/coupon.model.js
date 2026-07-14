const db = require('../config/db');

class CouponModel {
  async findByCode(code) {
    const rows = await db.query(
      "SELECT * FROM coupons WHERE code = ?",
      [code]
    );
    return rows[0] || null;
  }

  async findById(id) {
    const rows = await db.query(
      "SELECT * FROM coupons WHERE id = ?",
      [id]
    );
    return rows[0] || null;
  }

  async getGlobalUsageCount(couponId) {
    const rows = await db.query(
      "SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ?",
      [couponId]
    );
    return parseInt(rows[0]?.count || 0, 10);
  }

  async getUserUsageCount(couponId, userId) {
    const rows = await db.query(
      "SELECT COUNT(*) as count FROM coupon_usages WHERE coupon_id = ? AND user_id = ?",
      [couponId, userId]
    );
    return parseInt(rows[0]?.count || 0, 10);
  }

  async create({ code, type, value, minOrderValue = null, usageLimitGlobal = null, usageLimitPerUser = null, expiresAt = null, status = 'ACTIVE' }) {
    const res = await db.query(
      `INSERT INTO coupons 
       (code, type, value, min_order_value, usage_limit_global, usage_limit_per_user, expires_at, status) 
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [code, type, value, minOrderValue, usageLimitGlobal, usageLimitPerUser, expiresAt, status]
    );
    return this.findById(res.insertId);
  }
}

module.exports = new CouponModel();
