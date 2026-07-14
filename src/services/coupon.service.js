const CouponModel = require('../models/coupon.model');
const { NotFoundError, ValidationError } = require('../utils/errors');

class CouponService {
  async validateCoupon({ code, userId = null, subtotal }) {
    if (!code || code.trim() === '') {
      throw new ValidationError('Coupon code is required.');
    }

    const coupon = await CouponModel.findByCode(code.trim().toUpperCase());
    if (!coupon) {
      throw new NotFoundError('Invalid coupon code.');
    }

    if (coupon.status !== 'ACTIVE') {
      throw new ValidationError('This coupon is no longer active.');
    }

    // Check expiry
    if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
      throw new ValidationError('This coupon has expired.');
    }

    // Check minimum order value
    const subtotalNum = parseFloat(subtotal);
    const minVal = coupon.min_order_value ? parseFloat(coupon.min_order_value) : 0;
    if (subtotalNum < minVal) {
      throw new ValidationError(`Minimum order value of ₹${minVal.toFixed(2)} is required to apply this coupon.`);
    }

    // Check global usage limit
    if (coupon.usage_limit_global !== null) {
      const globalCount = await CouponModel.getGlobalUsageCount(coupon.id);
      if (globalCount >= coupon.usage_limit_global) {
        throw new ValidationError('This coupon usage limit has been reached.');
      }
    }

    // Check user-specific usage limit
    if (userId && coupon.usage_limit_per_user !== null) {
      const userCount = await CouponModel.getUserUsageCount(coupon.id, userId);
      if (userCount >= coupon.usage_limit_per_user) {
        throw new ValidationError('You have already used this coupon maximum number of times.');
      }
    }

    // Calculate discount
    let discount = 0;
    if (coupon.type === 'PERCENTAGE') {
      discount = (parseFloat(coupon.value) / 100) * subtotalNum;
    } else if (coupon.type === 'FLAT') {
      discount = parseFloat(coupon.value);
    }

    // Cap discount to subtotal
    if (discount > subtotalNum) {
      discount = subtotalNum;
    }

    // Standardize to 2 decimal places
    discount = Math.round(discount * 100) / 100;
    const payable = Math.round((subtotalNum - discount) * 100) / 100;

    return {
      id: Number(coupon.id),
      code: coupon.code,
      type: coupon.type,
      value: parseFloat(coupon.value),
      discountAmount: discount,
      payableAmount: payable
    };
  }
}

module.exports = new CouponService();
