const express = require('express');
const router = express.Router();
const CheckoutController = require('../controllers/checkout.controller');
const { validateStandardCheckout, validateDualPaymentCheckout } = require('../validators/checkout.validator');
const authMiddleware = require('../middlewares/auth.middleware');

router.post('/standard', authMiddleware, validateStandardCheckout, CheckoutController.checkoutStandard);
router.post('/dual-payment', authMiddleware, validateDualPaymentCheckout, CheckoutController.checkoutDualPayment);

module.exports = router;
