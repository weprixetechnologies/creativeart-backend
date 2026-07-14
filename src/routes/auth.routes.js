const express = require('express');
const AuthController = require('../controllers/auth.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.post('/register', AuthController.register);
router.post('/login', AuthController.login);
router.post('/refresh', AuthController.refresh);
router.post('/logout', authMiddleware, AuthController.logout);
router.post('/forgot-password', AuthController.forgotPassword);
router.post('/reset-password', AuthController.resetPassword);

const roleGuard = require('../middlewares/role.middleware');
router.get('/admin-only', authMiddleware, roleGuard('ADMIN'), (req, res) => {
  res.json({ success: true, data: { message: 'Welcome Admin' } });
});

module.exports = router;
