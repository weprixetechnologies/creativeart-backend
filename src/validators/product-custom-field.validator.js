const Joi = require('joi');

const fieldKeyRegex = /^[a-z0-9_]+$/;

const createCustomFieldSchema = Joi.object({
  fieldKey: Joi.string().max(100).regex(fieldKeyRegex).message('fieldKey must only contain lowercase alphanumeric characters and underscores.').required(),
  label: Joi.string().max(200).required(),
  type: Joi.string().valid('TEXT', 'NUMBER', 'DROPDOWN', 'DATE', 'FILE', 'TEXTAREA').required(),
  required: Joi.boolean().default(false),
  helpText: Joi.string().max(500).allow(null, ''),
  options: Joi.array().items(Joi.string()).allow(null),
  maxFileSizeKb: Joi.number().integer().min(0).allow(null),
  allowedMimeTypes: Joi.array().items(Joi.string()).allow(null),
  sortOrder: Joi.number().integer().default(0)
});

const updateCustomFieldSchema = Joi.object({
  fieldKey: Joi.string().max(100).regex(fieldKeyRegex).message('fieldKey must only contain lowercase alphanumeric characters and underscores.'),
  label: Joi.string().max(200),
  type: Joi.string().valid('TEXT', 'NUMBER', 'DROPDOWN', 'DATE', 'FILE', 'TEXTAREA'),
  required: Joi.boolean(),
  helpText: Joi.string().max(500).allow(null, ''),
  options: Joi.array().items(Joi.string()).allow(null),
  maxFileSizeKb: Joi.number().integer().min(0).allow(null),
  allowedMimeTypes: Joi.array().items(Joi.string()).allow(null),
  sortOrder: Joi.number().integer()
});

module.exports = {
  validateCreateCustomField: (data) => createCustomFieldSchema.validate(data),
  validateUpdateCustomField: (data) => updateCustomFieldSchema.validate(data)
};
