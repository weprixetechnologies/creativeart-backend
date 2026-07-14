const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cart.controller');
const { validateAddItem, validateUpdateQty } = require('../validators/cart.validator');
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

router.get('/', optionalAuth, CartController.getCart);
router.post('/items', optionalAuth, validateAddItem, CartController.addItem);
router.patch('/items/:id', optionalAuth, validateUpdateQty, CartController.updateQty);
router.delete('/items/:id', optionalAuth, CartController.removeItem);

module.exports = router;
