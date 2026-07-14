const ProductVariantModel = require('../models/product-variant.model');
const ProductModel = require('../models/product.model');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');

class ProductVariantService {
  static async verifyVariableProduct(productId) {
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }
    if (product.item_type !== 'PRODUCT' || product.product_type !== 'VARIABLE') {
      throw new ValidationError('Variants can only be managed for PRODUCT items of product_type VARIABLE.');
    }
    return product;
  }

  static async getVariants(productId) {
    await this.verifyVariableProduct(productId);
    return ProductVariantModel.findByProductId(productId);
  }

  static async createVariant(productId, data) {
    await this.verifyVariableProduct(productId);

    // Validate SKU uniqueness
    const existing = await ProductVariantModel.findBySku(data.sku);
    if (existing) {
      throw new ConflictError('Variant SKU is already in use.');
    }

    return ProductVariantModel.create({ ...data, productId });
  }

  static async updateVariant(productId, variantId, updates) {
    await this.verifyVariableProduct(productId);

    const variant = await ProductVariantModel.findById(variantId);
    if (!variant || Number(variant.product_id) !== Number(productId)) {
      throw new NotFoundError('Variant not found for this product.');
    }

    // Validate SKU uniqueness on change
    if (updates.sku && updates.sku !== variant.sku) {
      const existing = await ProductVariantModel.findBySku(updates.sku);
      if (existing) {
        throw new ConflictError('Variant SKU is already in use.');
      }
    }

    return ProductVariantModel.update(variantId, updates);
  }

  static async deleteVariant(productId, variantId) {
    await this.verifyVariableProduct(productId);

    const variant = await ProductVariantModel.findById(variantId);
    if (!variant || Number(variant.product_id) !== Number(productId)) {
      throw new NotFoundError('Variant not found for this product.');
    }

    await ProductVariantModel.delete(variantId);
  }
}

module.exports = ProductVariantService;
