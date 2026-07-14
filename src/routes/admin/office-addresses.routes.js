const express = require('express');
const router = express.Router();
const OfficeAddressController = require('../../controllers/office-address.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const adminOnly = require('../../middlewares/admin.middleware');

router.use(authMiddleware, adminOnly);

router.get('/', OfficeAddressController.adminListOfficeAddresses);
router.get('/:id', OfficeAddressController.adminGetOfficeAddress);
router.post('/', OfficeAddressController.adminCreateOfficeAddress);
router.put('/:id', OfficeAddressController.adminUpdateOfficeAddress);
router.delete('/:id', OfficeAddressController.adminDeleteOfficeAddress);

module.exports = router;
