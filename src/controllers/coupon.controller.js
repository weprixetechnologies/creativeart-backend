const CouponService = require('../services/coupon.service');
const CartService = require('../services/cart.service');
const { ValidationError } = require('../utils/errors');

class CouponController {
  async validateCoupon(req, res, next) {
    try {
      const userId = req.user ? req.user.id : null;
      const sessionId = req.headers['x-session-id'] || null;
      const { code } = req.body;

      if (!code || code.trim() === '') {
        throw new ValidationError('Coupon code is required.');
      }

      // Fetch current cart details to compute current subtotal
      const cart = await CartService.getCart({ userId, sessionId });
      if (cart.items.length === 0) {
        throw new ValidationError('Your cart is empty. Cannot validate coupon.');
      }

      // Coupons only apply to standard checkout
      if (cart.cartItemType === 'PROJECT') {
        throw new ValidationError('Coupons cannot be applied to custom project bookings.');
      }

      // Re-calculate subtotal based on current snapshot unit prices
      const subtotal = cart.items.reduce((acc, item) => {
        return acc + (item.unitPriceSnapshot * item.qty);
      }, 0);

      const result = await CouponService.validateCoupon({
        code,
        userId,
        subtotal
      });

      res.status(200).json({
        success: true,
        data: result
      });

    } catch (err) {
      next(err);
    }
  }

  async getActiveOffers(req, res, next) {
    try {
      const db = require('../config/db');
      const rows = await db.query(
        "SELECT id, code, type, value, min_order_value, expires_at FROM coupons WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
      );
      res.status(200).json({
        success: true,
        data: rows
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CouponController();
