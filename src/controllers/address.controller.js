const AddressService = require('../services/address.service');

class AddressController {
  async getAddresses(req, res, next) {
    try {
      const userId = req.user.id;
      const list = await AddressService.getAddresses(userId);
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  async createAddress(req, res, next) {
    try {
      const userId = req.user.id;
      const data = req.body;
      const addr = await AddressService.createAddress(userId, data);
      res.status(200).json({
        success: true,
        data: addr
      });
    } catch (err) {
      next(err);
    }
  }

  async updateAddress(req, res, next) {
    try {
      const userId = req.user.id;
      const addressId = parseInt(req.params.id, 10);
      const data = req.body;
      const addr = await AddressService.updateAddress(userId, addressId, data);
      res.status(200).json({
        success: true,
        data: addr
      });
    } catch (err) {
      next(err);
    }
  }

  async deleteAddress(req, res, next) {
    try {
      const userId = req.user.id;
      const addressId = parseInt(req.params.id, 10);
      await AddressService.deleteAddress(userId, addressId);
      res.status(200).json({
        success: true,
        message: 'Address deleted successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async setDefaultAddress(req, res, next) {
    try {
      const userId = req.user.id;
      const addressId = parseInt(req.params.id, 10);
      const addr = await AddressService.setDefault(userId, addressId);
      res.status(200).json({
        success: true,
        data: addr
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AddressController();
