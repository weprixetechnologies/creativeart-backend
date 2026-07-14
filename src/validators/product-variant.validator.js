const Joi = require('joi');

const createVariantSchema = Joi.object({
  sku: Joi.string().max(100).required(),
  attributes: Joi.object().min(1).required(),
  priceOverride: Joi.number().min(0).precision(2).allow(null),
  stockQty: Joi.number().integer().min(0).required(),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED').default('ACTIVE')
});

const updateVariantSchema = Joi.object({
  sku: Joi.string().max(100),
  attributes: Joi.object().min(1),
  priceOverride: Joi.number().min(0).precision(2).allow(null),
  stockQty: Joi.number().integer().min(0),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED')
});

module.exports = {
  validateCreateVariant: (data) => createVariantSchema.validate(data),
  validateUpdateVariant: (data) => updateVariantSchema.validate(data)
};
