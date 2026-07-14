const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

const standardCheckoutSchema = Joi.object({
  addressId: Joi.number().integer().positive().required(),
  couponCode: Joi.string().trim().allow(null, '').optional(),
  paymentMethod: Joi.string().valid('COD', 'PREPAID').default('PREPAID'),
  referralCode: Joi.string().trim().allow(null, '').optional(),
  items: Joi.array().items(Joi.object({
    productId: Joi.number().integer().positive().required(),
    variantId: Joi.number().integer().positive().optional().allow(null),
    name: Joi.string().required(),
    price: Joi.number().positive().required(),
    quantity: Joi.number().integer().positive().required(),
    customFieldValues: Joi.object().pattern(Joi.string(), Joi.any()).optional().default({})
  })).required()
});

const dualPaymentCheckoutSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  addressId: Joi.number().integer().positive().required(),
  selectedOfficeAddressId: Joi.number().integer().positive().optional().allow(null),
  materialShipmentMode: Joi.string().valid('SELF_SHIP', 'DROP_AT_HUB').default('SELF_SHIP'),
  courierName: Joi.string().trim().allow(null, '').optional(),
  trackingNumber: Joi.string().trim().allow(null, '').optional(),
  customFieldValues: Joi.object().pattern(Joi.string(), Joi.any()).optional().default({}),
  referralCode: Joi.string().trim().allow(null, '').optional()
});

const validate = (schema) => (req, res, next) => {
  const { error, value } = schema.validate(req.body, { abortEarly: false, stripUnknown: true });
  if (error) {
    const msg = error.details.map(d => d.message).join(', ');
    return next(new ValidationError(msg));
  }
  req.body = value;
  next();
};

module.exports = {
  validateStandardCheckout: validate(standardCheckoutSchema),
  validateDualPaymentCheckout: validate(dualPaymentCheckoutSchema)
};
