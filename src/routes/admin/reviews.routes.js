const express = require('express');
const router = express.Router();
const AdminReviewController = require('../../controllers/admin/review.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

router.use(authMiddleware, roleGuard('ADMIN'));

router.get('/', AdminReviewController.listAllReviews);
router.put('/:id/status', AdminReviewController.updateReviewStatus);

module.exports = router;
