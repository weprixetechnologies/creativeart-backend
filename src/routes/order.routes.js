const express = require('express');
const router = express.Router();
const OrderController = require('../controllers/order.controller');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', OrderController.getMyOrders);
router.get('/:id', OrderController.getOrderDetail);
router.get('/:id/payment-status', OrderController.getPaymentStatus);
router.post('/:id/material-shipment', OrderController.submitMaterialShipment);
router.post('/:id/shipment', OrderController.submitMaterialShipment);
router.post('/:id/advance-payment', OrderController.initiateAdvancePayment);
router.post('/:id/final-payment', OrderController.initiateFinalPayment);
router.get('/:id/invoice', OrderController.downloadInvoice);

module.exports = router;
