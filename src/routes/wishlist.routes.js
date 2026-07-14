const express = require('express');
const router = express.Router();
const WishlistController = require('../controllers/wishlist.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.post('/', WishlistController.toggleWishlist);
router.get('/', WishlistController.listWishlist);

module.exports = router;
