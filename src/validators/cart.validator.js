const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

const cartItemSchema = Joi.object({
  productId: Joi.number().integer().positive().required(),
  variantId: Joi.number().integer().positive().allow(null).optional(),
  qty: Joi.number().integer().positive().default(1).optional(),
  customFieldValues: Joi.object().pattern(Joi.string(), Joi.any().allow('', null)).optional()
});

const updateQtySchema = Joi.object({
  qty: Joi.number().integer().min(0).required()
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
  validateAddItem: validate(cartItemSchema),
  validateUpdateQty: validate(updateQtySchema)
};
