const Joi = require('joi');

const slugRegex = /^[a-z0-9-]+$/;

const createProductSchema = Joi.object({
  categoryId: Joi.number().integer().min(1).required(),
  itemType: Joi.string().valid('PRODUCT', 'PROJECT').required(),
  productType: Joi.string().valid('SIMPLE', 'VARIABLE', 'CUSTOMISABLE').allow(null),
  name: Joi.string().max(200).required(),
  slug: Joi.string().max(220).regex(slugRegex).message('Slug must only contain lowercase alphanumeric characters and hyphens.').required(),
  description: Joi.string().required(),
  basePrice: Joi.number().min(0).precision(2).required(),
  advanceAmount: Joi.number().min(0).precision(2).allow(null),
  finalAmount: Joi.number().min(0).precision(2).allow(null),
  totalAmount: Joi.number().min(0).precision(2).allow(null),
  materialInstructions: Joi.string().allow(null, ''),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED').default('DRAFT')
});

const updateProductSchema = Joi.object({
  categoryId: Joi.number().integer().min(1),
  itemType: Joi.string().valid('PRODUCT', 'PROJECT'),
  productType: Joi.string().valid('SIMPLE', 'VARIABLE', 'CUSTOMISABLE').allow(null),
  name: Joi.string().max(200),
  slug: Joi.string().max(220).regex(slugRegex).message('Slug must only contain lowercase alphanumeric characters and hyphens.'),
  description: Joi.string(),
  basePrice: Joi.number().min(0).precision(2),
  advanceAmount: Joi.number().min(0).precision(2).allow(null),
  finalAmount: Joi.number().min(0).precision(2).allow(null),
  totalAmount: Joi.number().min(0).precision(2).allow(null),
  materialInstructions: Joi.string().allow(null, ''),
  status: Joi.string().valid('DRAFT', 'ACTIVE', 'ARCHIVED')
});

module.exports = {
  validateCreateProduct: (data) => createProductSchema.validate(data),
  validateUpdateProduct: (data) => updateProductSchema.validate(data)
};
