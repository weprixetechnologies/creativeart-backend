const ProductVariantService = require('../services/product-variant.service');
const { ValidationError } = require('../utils/errors');
const {
  validateCreateVariant,
  validateUpdateVariant
} = require('../validators/product-variant.validator');

class ProductVariantController {
  static async getVariants(req, res, next) {
    try {
      const productId = req.params.id;
      const list = await ProductVariantService.getVariants(productId);
      res.status(200).json({
        success: true,
        data: list
      });
    } catch (err) {
      next(err);
    }
  }

  static async createVariant(req, res, next) {
    try {
      const productId = req.params.id;
      const { error, value } = validateCreateVariant(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const variant = await ProductVariantService.createVariant(productId, value);
      res.status(201).json({
        success: true,
        data: variant
      });
    } catch (err) {
      next(err);
    }
  }

  static async updateVariant(req, res, next) {
    try {
      const { id: productId, variantId } = req.params;
      const { error, value } = validateUpdateVariant(req.body);
      if (error) {
        throw new ValidationError(error.details[0].message);
      }

      const variant = await ProductVariantService.updateVariant(productId, variantId, value);
      res.status(200).json({
        success: true,
        data: variant
      });
    } catch (err) {
      next(err);
    }
  }

  static async deleteVariant(req, res, next) {
    try {
      const { id: productId, variantId } = req.params;
      await ProductVariantService.deleteVariant(productId, variantId);
      res.status(200).json({
        success: true,
        data: { message: 'Variant deleted successfully.' }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = ProductVariantController;
