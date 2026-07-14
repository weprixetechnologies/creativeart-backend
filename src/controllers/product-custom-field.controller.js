const ProductCustomFieldService = require('../services/product-custom-field.service');
const { ValidationError } = require('../utils/errors');
const {
  validateCreateCustomField,
  validateUpdateCustomField
} = require('../validators/product-custom-field.validator');

class ProductCustomFieldController {
  static async getCustomFields(req, res, next) {
    try {
      const productId = req.params.id;
      const list = await ProductCustomFieldService.getCustomFields(productId);
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  static async createCustomField(req, res, next) {
    try {
      const productId = req.params.id;
      const { error, value } = validateCreateCustomField(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const field = await ProductCustomFieldService.createCustomField(productId, value);
      res.status(201).json({
        success: true,
        data: field
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateCustomField(req, res, next) {
    try {
      const { id: productId, fieldId } = req.params;
      const { error, value } = validateUpdateCustomField(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const field = await ProductCustomFieldService.updateCustomField(productId, fieldId, value);
      res.status(200).json({
        success: true,
        data: field
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteCustomField(req, res, next) {
    try {
      const { id: productId, fieldId } = req.params;
      await ProductCustomFieldService.deleteCustomField(productId, fieldId);
      res.status(200).json({
        success: true,
        data: { message: 'Custom field deleted successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductCustomFieldController;
