const express = require('express');
const router = express.Router();
const AdminOrderController = require('../../controllers/admin/order.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminOnly = require('../../middlewares/admin.middleware');

const roleGuard = require('../../middlewares/role.middleware');

router.use(authMiddleware);

router.get('/', roleGuard('ADMIN'), AdminOrderController.listOrders);
router.get('/materials-inbox', roleGuard('ADMIN', 'STAFF_PRODUCTION'), AdminOrderController.listMaterialsInbox);
router.get('/shipments', roleGuard('ADMIN', 'STAFF_PACKAGING'), AdminOrderController.listShipments);
router.get('/:id', roleGuard('ADMIN', 'STAFF_PRODUCTION', 'STAFF_PACKAGING'), AdminOrderController.getOrderDetail);
router.post('/:id/status', roleGuard('ADMIN'), AdminOrderController.overrideStatus);
router.post('/:id/force-payment-status', roleGuard('ADMIN'), AdminOrderController.forceCheckPaymentStatus);
router.post('/:id/confirm-material-received', roleGuard('ADMIN', 'STAFF_PRODUCTION'), AdminOrderController.confirmMaterialReceived);
router.post('/:id/start-production', roleGuard('ADMIN', 'STAFF_PRODUCTION'), AdminOrderController.startProduction);
router.post('/:id/mark-ready', roleGuard('ADMIN', 'STAFF_PRODUCTION'), AdminOrderController.markReady);
router.post('/:id/mark-packed', roleGuard('ADMIN', 'STAFF_PACKAGING'), AdminOrderController.markPacked);
router.post('/:id/update-manual-shipping', roleGuard('ADMIN'), AdminOrderController.updateManualShipping);

module.exports = router;
