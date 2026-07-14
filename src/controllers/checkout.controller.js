const CheckoutService = require('../services/checkout.service');

class CheckoutController {
  async checkoutStandard(req, res, next) {
    try {
      const userId = req.user.id;
      const { addressId, couponCode, items, paymentMethod, referralCode } = req.body;

      const result = await CheckoutService.checkoutStandard({
        userId,
        addressId,
        couponCode,
        items,
        paymentMethod,
        referralCode
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }

  async checkoutDualPayment(req, res, next) {
    try {
      const userId = req.user.id;
      const { productId, addressId, selectedOfficeAddressId, materialShipmentMode, courierName, trackingNumber, customFieldValues, referralCode } = req.body;

      const result = await CheckoutService.checkoutDualPayment({
        userId,
        productId,
        addressId,
        selectedOfficeAddressId,
        materialShipmentMode,
        courierName,
        trackingNumber,
        customFieldValues: customFieldValues || {},
        referralCode
      });

      res.status(200).json({
        success: true,
        data: result
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new CheckoutController();
