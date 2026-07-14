const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

const addressSchema = Joi.object({
  label:       Joi.string().max(50).allow(null, '').optional(),
  contactName: Joi.string().max(150).required(),
  phone:       Joi.string().max(20).allow(null, '').optional(),
  contactPhone: Joi.string().max(20).allow(null, '').optional(),
  line1:       Joi.string().max(255).required(),
  line2:       Joi.string().max(255).allow(null, '').optional(),
  city:        Joi.string().max(100).required(),
  state:       Joi.string().max(100).required(),
  pincode:     Joi.string().max(10).required(),
  country:     Joi.string().max(100).default('India').optional(),
  isDefault:   Joi.boolean().default(false).optional()
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
  validateAddress: validate(addressSchema)
};
