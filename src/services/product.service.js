const ProductModel = require('../models/product.model');
const CategoryModel = require('../models/category.model');
const ProductImageModel = require('../models/product-image.model');
const ProductVariantModel = require('../models/product-variant.model');
const ProductCustomFieldModel = require('../models/product-custom-field.model');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');

class ProductService {
  static async createProduct(data) {
    const existing = await ProductModel.findBySlug(data.slug);
    if (existing) {
      throw new ConflictError('Product slug is already in use.');
    }

    const category = await CategoryModel.findById(data.categoryId);
    if (!category) {
      throw new NotFoundError('Category not found.');
    }

    if (data.itemType === 'PRODUCT') {
      if (!data.productType) {
        throw new ValidationError('productType is required for PRODUCT item type.');
      }
      if (
        (data.advanceAmount !== undefined && data.advanceAmount !== null) ||
        (data.finalAmount !== undefined && data.finalAmount !== null) ||
        (data.totalAmount !== undefined && data.totalAmount !== null) ||
        (data.materialInstructions !== undefined && data.materialInstructions !== null)
      ) {
        throw new ValidationError('Project pricing fields must not be provided for PRODUCT.');
      }
      data.advanceAmount = null;
      data.finalAmount = null;
      data.totalAmount = null;
      data.materialInstructions = null;
    } else if (data.itemType === 'PROJECT') {
      if (data.productType !== undefined && data.productType !== null) {
        throw new ValidationError('productType must not be provided for PROJECT.');
      }
      data.productType = null;

      if (data.advanceAmount === undefined || data.advanceAmount === null ||
          data.finalAmount === undefined || data.finalAmount === null ||
          data.totalAmount === undefined || data.totalAmount === null) {
        throw new ValidationError('advanceAmount, finalAmount, and totalAmount are required for PROJECT.');
      }

      const sum = Number(data.advanceAmount) + Number(data.finalAmount);
      if (Number(data.totalAmount) !== sum) {
        throw new ValidationError('totalAmount must equal advanceAmount + finalAmount.');
      }
    }

    return ProductModel.create(data);
  }

  static async getProductById(id) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }

    const images = await ProductImageModel.findByProductId(product.id);
    const variants = await ProductVariantModel.findByProductId(product.id);
    const customFields = await ProductCustomFieldModel.findByProductId(product.id);

    return {
      ...product,
      images,
      variants,
      customFields
    };
  }

  static async getProductBySlug(slug, isPublic = false) {
    const product = await ProductModel.findBySlug(slug);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }

    if (isPublic && product.status !== 'ACTIVE') {
      throw new NotFoundError('Catalog item not found.');
    }

    const images = await ProductImageModel.findByProductId(product.id);
    let variants = await ProductVariantModel.findByProductId(product.id);
    if (isPublic) {
      variants = variants.filter(v => v.status === 'ACTIVE');
    }
    const customFields = await ProductCustomFieldModel.findByProductId(product.id);

    return {
      ...product,
      images,
      variants,
      customFields
    };
  }

  static async getProducts(filters) {
    const result = await ProductModel.findAll(filters);
    
    // Enrich catalog items with their images and variants
    const enriched = await Promise.all(result.data.map(async (prod) => {
      const images = await ProductImageModel.findByProductId(prod.id);
      let variants = await ProductVariantModel.findByProductId(prod.id);
      if (filters.status !== undefined && filters.status === 'ACTIVE') {
        variants = variants.filter(v => v.status === 'ACTIVE');
      }
      return {
        ...prod,
        images,
        variants
      };
    }));

    return {
      data: enriched,
      meta: result.meta
    };
  }

  static async updateProduct(id, updates) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }

    if (updates.slug && updates.slug !== product.slug) {
      const existing = await ProductModel.findBySlug(updates.slug);
      if (existing) {
        throw new ConflictError('Product slug is already in use.');
      }
    }

    if (updates.categoryId) {
      const category = await CategoryModel.findById(updates.categoryId);
      if (!category) {
        throw new NotFoundError('Category not found.');
      }
    }

    const finalItemType = updates.itemType || product.item_type;
    
    if (finalItemType === 'PRODUCT') {
      if (
        (updates.advanceAmount !== undefined && updates.advanceAmount !== null) ||
        (updates.finalAmount !== undefined && updates.finalAmount !== null) ||
        (updates.totalAmount !== undefined && updates.totalAmount !== null) ||
        (updates.materialInstructions !== undefined && updates.materialInstructions !== null)
      ) {
        throw new ValidationError('Project pricing fields are not allowed for PRODUCT.');
      }
      updates.advanceAmount = null;
      updates.finalAmount = null;
      updates.totalAmount = null;
      updates.materialInstructions = null;
    } else if (finalItemType === 'PROJECT') {
      if (updates.productType !== undefined && updates.productType !== null) {
        throw new ValidationError('productType is not allowed for PROJECT.');
      }
      updates.productType = null;

      const adv = updates.advanceAmount !== undefined ? updates.advanceAmount : product.advance_amount;
      const fin = updates.finalAmount !== undefined ? updates.finalAmount : product.final_amount;
      const tot = updates.totalAmount !== undefined ? updates.totalAmount : product.total_amount;

      if (adv !== null || fin !== null || tot !== null) {
        const sum = Number(adv) + Number(fin);
        if (Number(tot) !== sum) {
          throw new ValidationError('totalAmount must equal advanceAmount + finalAmount.');
        }
      }
    }

    return ProductModel.update(id, updates);
  }

  static async deleteProduct(id) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }

    await ProductModel.delete(id);
  }
}

module.exports = ProductService;
