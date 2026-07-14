const express = require('express');
const router = express.Router();
const CouponController = require('../controllers/coupon.controller');
const { validateCouponParams } = require('../validators/coupon.validator');
const jwt = require('jsonwebtoken');

// Optional auth helper to check session token if present
const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.split(' ')[1];
  const secret = process.env.JWT_ACCESS_SECRET || 'creativeart_access_secret_key_2026';

  jwt.verify(token, secret, (err, decoded) => {
    if (!err) {
      req.user = {
        id: decoded.userId,
        role: decoded.role
      };
    }
    next();
  });
};

router.get('/', CouponController.getActiveOffers);
router.post('/validate', optionalAuth, validateCouponParams, CouponController.validateCoupon);

module.exports = router;
