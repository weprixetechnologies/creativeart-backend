const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/review.controller');
const authMiddleware = require('../middlewares/auth.middleware');

// Public route to get approved reviews for a product
router.get('/products/:id/reviews', ReviewController.listApprovedReviews);

// Protected route to submit a review
router.post('/products/:id/reviews', authMiddleware, ReviewController.submitReview);

module.exports = router;
