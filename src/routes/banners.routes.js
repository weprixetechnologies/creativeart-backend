const express = require('express');
const router = express.Router();
const BannerController = require('../controllers/banner.controller');
const authMiddleware = require('../middlewares/auth.middleware');
const adminOnly = require('../middlewares/admin.middleware');

// Public route
router.get('/', BannerController.getActiveBanners);

// Admin routes
router.get('/all', authMiddleware, adminOnly, BannerController.getAllBanners);
router.post('/', authMiddleware, adminOnly, BannerController.createBanner);
router.put('/:id', authMiddleware, adminOnly, BannerController.updateBanner);
router.delete('/:id', authMiddleware, adminOnly, BannerController.deleteBanner);

module.exports = router;
