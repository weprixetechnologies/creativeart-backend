const Joi = require('joi');

const slugRegex = /^[a-z0-9-]+$/;

const createCategorySchema = Joi.object({
  parentId: Joi.number().integer().min(1).allow(null),
  name: Joi.string().max(150).required(),
  slug: Joi.string().max(150).regex(slugRegex).message('Slug must only contain lowercase alphanumeric characters and hyphens.').required(),
  sortOrder: Joi.number().integer().default(0),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED').default('ACTIVE')
});

const updateCategorySchema = Joi.object({
  parentId: Joi.number().integer().min(1).allow(null),
  name: Joi.string().max(150),
  slug: Joi.string().max(150).regex(slugRegex)
    .message('Slug must only contain lowercase alphanumeric characters and hyphens.'),
  sortOrder: Joi.number().integer(),
  status: Joi.string().valid('ACTIVE', 'ARCHIVED')
});

module.exports = {
  validateCreateCategory: (data) => createCategorySchema.validate(data),
  validateUpdateCategory: (data) => updateCategorySchema.validate(data)
};
