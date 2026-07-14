const express = require('express');
const ProductController = require('../controllers/product.controller');

const ReviewController = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.get('/', ProductController.getProducts);
router.get('/:slug', ProductController.getProductBySlug);
router.get('/:id/reviews', ReviewController.listApprovedReviews);
router.post('/:id/reviews', authMiddleware, ReviewController.submitReview);

module.exports = router;
