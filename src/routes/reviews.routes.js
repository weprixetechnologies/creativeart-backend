const express = require('express');
const router = express.Router();
const ReviewController = require('../controllers/review.controller');

// Public route to fetch Google reviews
router.get('/google', ReviewController.getGoogleReviews);

module.exports = router;
