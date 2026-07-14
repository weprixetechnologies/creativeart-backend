const express = require('express');
const router = express.Router();
const AddressController = require('../controllers/address.controller');
const { validateAddress } = require('../validators/address.validator');
const authMiddleware = require('../middlewares/auth.middleware');

router.use(authMiddleware);

router.get('/', AddressController.getAddresses);
router.post('/', validateAddress, AddressController.createAddress);
router.put('/:id', validateAddress, AddressController.updateAddress);
router.patch('/:id/default', AddressController.setDefaultAddress);
router.delete('/:id', AddressController.deleteAddress);

module.exports = router;
