const express = require('express');
const router = express.Router();
const AdminCouponController = require('../../controllers/admin/coupon.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminOnly = require('../../middlewares/admin.middleware');

router.use(authMiddleware, adminOnly);

router.get('/', AdminCouponController.listCoupons);
router.get('/:id', AdminCouponController.getCoupon);
router.post('/', AdminCouponController.createCoupon);
router.patch('/:id', AdminCouponController.updateCoupon);
router.delete('/:id', AdminCouponController.deleteCoupon);

module.exports = router;
