const ProductCustomFieldModel = require('../models/product-custom-field.model');
const ProductModel = require('../models/product.model');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');

class ProductCustomFieldService {
  static async verifyCustomizableProduct(productId) {
    const product = await ProductModel.findById(productId);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }
    if (product.item_type === 'PRODUCT' && product.product_type !== 'CUSTOMISABLE') {
      throw new ValidationError('Custom fields can only be managed for CUSTOMISABLE products or PROJECTs.');
    }
    return product;
  }

  static async getCustomFields(productId) {
    await this.verifyCustomizableProduct(productId);
    return ProductCustomFieldModel.findByProductId(productId);
  }

  static async createCustomField(productId, data) {
    await this.verifyCustomizableProduct(productId);

    // Validate key uniqueness for this product
    const existing = await ProductCustomFieldModel.findByKey(productId, data.fieldKey);
    if (existing) {
      throw new ConflictError(`Custom field with key "${data.fieldKey}" already exists for this product.`);
    }

    // Type validation constraints
    if (data.type === 'DROPDOWN') {
      if (!data.options || !Array.isArray(data.options) || data.options.length === 0) {
        throw new ValidationError('Options array is required for DROPDOWN custom fields.');
      }
    }

    return ProductCustomFieldModel.create({ ...data, productId });
  }

  static async updateCustomField(productId, fieldId, updates) {
    await this.verifyCustomizableProduct(productId);

    const field = await ProductCustomFieldModel.findById(fieldId);
    if (!field || Number(field.product_id) !== Number(productId)) {
      throw new NotFoundError('Custom field not found for this product.');
    }

    // Validate key uniqueness
    if (updates.fieldKey && updates.fieldKey !== field.field_key) {
      const existing = await ProductCustomFieldModel.findByKey(productId, updates.fieldKey);
      if (existing) {
        throw new ConflictError(`Custom field with key "${updates.fieldKey}" already exists for this product.`);
      }
    }

    return ProductCustomFieldModel.update(fieldId, updates);
  }

  static async deleteCustomField(productId, fieldId) {
    await this.verifyCustomizableProduct(productId);

    const field = await ProductCustomFieldModel.findById(fieldId);
    if (!field || Number(field.product_id) !== Number(productId)) {
      throw new NotFoundError('Custom field not found for this product.');
    }

    await ProductCustomFieldModel.delete(fieldId);
  }

  /**
   * Validates user-submitted inputs against custom fields defined for a product.
   * @param {number|string} productId 
   * @param {object} values - Key-value pair of custom field inputs
   * @throws {ValidationError} if validation fails
   */
  static async validateCustomFieldValues(productId, values = {}) {
    const fields = await ProductCustomFieldModel.findByProductId(productId);

    for (const field of fields) {
      const val = values[field.field_key];
      const isPresent = val !== undefined && val !== null && String(val).trim() !== '';

      // Check required status
      if (field.required && !isPresent) {
        throw new ValidationError(`Custom field "${field.label}" is required.`);
      }

      // Check types if value is present
      if (isPresent) {
        switch (field.type) {
          case 'NUMBER':
            if (isNaN(Number(val))) {
              throw new ValidationError(`Custom field "${field.label}" must be a valid number.`);
            }
            break;

          case 'DATE':
            const dateParsed = Date.parse(val);
            if (isNaN(dateParsed)) {
              throw new ValidationError(`Custom field "${field.label}" must be a valid date.`);
            }
            break;

          case 'DROPDOWN':
            let allowedOptions = field.options;
            if (typeof allowedOptions === 'string') {
              try {
                allowedOptions = JSON.parse(allowedOptions);
              } catch (e) {
                allowedOptions = [];
              }
            }
            if (!Array.isArray(allowedOptions) || !allowedOptions.includes(val)) {
              throw new ValidationError(`Custom field "${field.label}" must be one of: ${allowedOptions.join(', ')}.`);
            }
            break;

          case 'FILE':
            // Verify it is a valid URL string matching Bunny Pull Zone or HTTP format
            const isUrl = typeof val === 'string' && (val.startsWith('http://') || val.startsWith('https://'));
            if (!isUrl) {
              throw new ValidationError(`Custom field "${field.label}" must be a valid uploaded file URL.`);
            }
            break;

          case 'TEXT':
          case 'TEXTAREA':
            if (typeof val !== 'string') {
              throw new ValidationError(`Custom field "${field.label}" must be a valid string.`);
            }
            break;
        }
      }
    }
  }
}

module.exports = ProductCustomFieldService;
