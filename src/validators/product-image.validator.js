const Joi = require('joi');

const reorderItemSchema = Joi.object({
  id: Joi.number().integer().min(1).required(),
  sortOrder: Joi.number().integer().required()
});

const productImageSchema = Joi.object({
  action: Joi.string().valid('add', 'reorder', 'set-primary', 'delete').required(),
  
  // Fields for 'add'
  url: Joi.string().max(500).when('action', { is: 'add', then: Joi.required(), otherwise: Joi.forbidden() }),
  isPrimary: Joi.boolean().default(false).when('action', { is: 'add', then: Joi.optional(), otherwise: Joi.forbidden() }),
  sortOrder: Joi.number().integer().default(0).when('action', { is: 'add', then: Joi.optional(), otherwise: Joi.forbidden() }),

  // Fields for 'reorder'
  images: Joi.array().items(reorderItemSchema).when('action', { is: 'reorder', then: Joi.required(), otherwise: Joi.forbidden() }),

  // Fields for 'set-primary' and 'delete'
  imageId: Joi.number().integer().min(1).when('action', {
    is: Joi.valid('set-primary', 'delete'),
    then: Joi.required(),
    otherwise: Joi.forbidden()
  })
});

module.exports = {
  validateProductImageAction: (data) => productImageSchema.validate(data)
};
