const db = require('../../config/db');
const CouponModel = require('../../models/coupon.model');
const { NotFoundError, ValidationError } = require('../../utils/errors');

class AdminCouponController {
  async listCoupons(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT c.*, 
          (SELECT COUNT(*) FROM coupon_usages cu WHERE cu.coupon_id = c.id) as usage_count
         FROM coupons c
         ORDER BY c.id DESC`
      );
      const formatted = rows.map(c => ({
        id: Number(c.id),
        code: c.code,
        type: c.type,
        value: parseFloat(c.value),
        minOrderValue: c.min_order_value ? parseFloat(c.min_order_value) : null,
        usageLimitGlobal: c.usage_limit_global,
        usageLimitPerUser: c.usage_limit_per_user,
        expiresAt: c.expires_at,
        status: c.status,
        usageCount: parseInt(c.usage_count, 10),
        createdAt: c.created_at
      }));
      res.status(200).json({ success: true, data: formatted });
    } catch (err) { next(err); }
  }

  async getCoupon(req, res, next) {
    try {
      const coupon = await CouponModel.findById(req.params.id);
      if (!coupon) throw new NotFoundError('Coupon not found.');
      const usageCount = await CouponModel.getGlobalUsageCount(coupon.id);
      const usages = await db.query(
        `SELECT cu.*, u.name as user_name, u.email as user_email, o.order_number
         FROM coupon_usages cu
         LEFT JOIN users u ON cu.user_id = u.id
         LEFT JOIN orders o ON cu.order_id = o.id
         WHERE cu.coupon_id = ?
         ORDER BY cu.id DESC LIMIT 100`,
        [coupon.id]
      );
      res.status(200).json({
        success: true, data: {
          id: Number(coupon.id),
          code: coupon.code, type: coupon.type, value: parseFloat(coupon.value),
          minOrderValue: coupon.min_order_value ? parseFloat(coupon.min_order_value) : null,
          usageLimitGlobal: coupon.usage_limit_global,
          usageLimitPerUser: coupon.usage_limit_per_user,
          expiresAt: coupon.expires_at, status: coupon.status,
          usageCount,
          usages: usages.map(u => ({
            id: Number(u.id), userName: u.user_name, userEmail: u.user_email,
            orderNumber: u.order_number, createdAt: u.created_at
          }))
        }
      });
    } catch (err) { next(err); }
  }

  async createCoupon(req, res, next) {
    try {
      const { code, type, value, minOrderValue, usageLimitGlobal, usageLimitPerUser, expiresAt, status } = req.body;
      if (!code || !type || value === undefined) throw new ValidationError('code, type, and value are required.');
      if (!['FLAT', 'PERCENTAGE'].includes(type)) throw new ValidationError('type must be FLAT or PERCENTAGE.');
      const existing = await CouponModel.findByCode(code.trim().toUpperCase());
      if (existing) throw new ValidationError('A coupon with this code already exists.');
      const coupon = await CouponModel.create({ code: code.trim().toUpperCase(), type, value, minOrderValue, usageLimitGlobal, usageLimitPerUser, expiresAt, status: status || 'ACTIVE' });
      res.status(200).json({ success: true, data: { id: Number(coupon.id), code: coupon.code } });
    } catch (err) { next(err); }
  }

  async updateCoupon(req, res, next) {
    try {
      const coupon = await CouponModel.findById(req.params.id);
      if (!coupon) throw new NotFoundError('Coupon not found.');
      const { status, expiresAt, usageLimitGlobal, usageLimitPerUser, minOrderValue } = req.body;
      const updates = {};
      if (status !== undefined) updates.status = status;
      if (expiresAt !== undefined) updates.expires_at = expiresAt;
      if (usageLimitGlobal !== undefined) updates.usage_limit_global = usageLimitGlobal;
      if (usageLimitPerUser !== undefined) updates.usage_limit_per_user = usageLimitPerUser;
      if (minOrderValue !== undefined) updates.min_order_value = minOrderValue;
      if (Object.keys(updates).length === 0) throw new ValidationError('No updatable fields provided.');
      const setClauses = Object.keys(updates).map(k => `${k} = ?`).join(', ');
      await db.query(`UPDATE coupons SET ${setClauses} WHERE id = ?`, [...Object.values(updates), coupon.id]);
      res.status(200).json({ success: true, message: 'Coupon updated.' });
    } catch (err) { next(err); }
  }

  async deleteCoupon(req, res, next) {
    try {
      const coupon = await CouponModel.findById(req.params.id);
      if (!coupon) throw new NotFoundError('Coupon not found.');
      await db.query('DELETE FROM coupon_usages WHERE coupon_id = ?', [coupon.id]);
      await db.query('DELETE FROM coupons WHERE id = ?', [coupon.id]);
      res.status(200).json({ success: true, message: 'Coupon deleted.' });
    } catch (err) { next(err); }
  }
}

module.exports = new AdminCouponController();
