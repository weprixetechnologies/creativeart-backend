const express = require('express');
const router = express.Router();
const OfficeAddressController = require('../controllers/office-address.controller');

router.get('/', OfficeAddressController.getActiveOfficeAddresses);

module.exports = router;
