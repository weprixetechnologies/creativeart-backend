const Joi = require('joi');
const { ValidationError } = require('../utils/errors');

const validateCouponSchema = Joi.object({
  code: Joi.string().trim().uppercase().required()
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
  validateCouponParams: validate(validateCouponSchema)
};
