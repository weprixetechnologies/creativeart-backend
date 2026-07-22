const ProductModel = require('../models/product.model');
const CategoryModel = require('../models/category.model');
const ProductImageModel = require('../models/product-image.model');
const ProductVariantModel = require('../models/product-variant.model');
const ProductCustomFieldModel = require('../models/product-custom-field.model');
const { NotFoundError, ConflictError, ValidationError } = require('../utils/errors');
const redisClient = require('../config/redis');

class ProductService {
  static async clearProductsCache() {
    try {
      if (redisClient.status === 'ready') {
        const keys = await redisClient.keys('cache:products:*');
        if (keys.length > 0) {
          await redisClient.del(...keys);
        }
      }
    } catch (err) {
      console.error('Failed to clear products cache:', err.message);
    }
  }

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

      const adv = data.advanceAmount || 0;
      const fin = data.finalAmount || 0;
      const tot = data.totalAmount || 0;
      if (tot !== adv + fin) {
        throw new ValidationError('totalAmount must equal advanceAmount + finalAmount.');
      }
    }

    const created = await ProductModel.create(data);
    await this.clearProductsCache();
    return created;
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
    const cacheKey = `cache:products:${JSON.stringify(filters)}`;

    // Try Redis cache first
    try {
      if (redisClient.status === 'ready') {
        const cached = await redisClient.get(cacheKey);
        if (cached) {
          return JSON.parse(cached);
        }
      }
    } catch (e) {
      // Degrade gracefully on Redis errors
    }

    const result = await ProductModel.findAll(filters);
    const productIds = result.data.map(p => p.id);

    if (productIds.length === 0) {
      return { data: [], meta: result.meta };
    }

    // Batch fetch all images & variants in 2 single SQL queries (eliminates N+1 queries)
    const variantStatusFilter = (filters.status !== undefined && filters.status === 'ACTIVE') ? 'ACTIVE' : null;
    const [allImages, allVariants] = await Promise.all([
      ProductImageModel.findByProductIds(productIds),
      ProductVariantModel.findByProductIds(productIds, variantStatusFilter)
    ]);

    const imagesMap = {};
    allImages.forEach(img => {
      if (!imagesMap[img.product_id]) imagesMap[img.product_id] = [];
      imagesMap[img.product_id].push(img);
    });

    const variantsMap = {};
    allVariants.forEach(v => {
      if (!variantsMap[v.product_id]) variantsMap[v.product_id] = [];
      variantsMap[v.product_id].push(v);
    });

    const enriched = result.data.map(prod => ({
      ...prod,
      images: imagesMap[prod.id] || [],
      variants: variantsMap[prod.id] || []
    }));

    const response = {
      data: enriched,
      meta: result.meta
    };

    // Store in Redis with 60s TTL
    try {
      if (redisClient.status === 'ready') {
        await redisClient.set(cacheKey, JSON.stringify(response), 'EX', 60);
      }
    } catch (e) {
      // ignore cache write error
    }

    return response;
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

    const updated = await ProductModel.update(id, updates);
    await this.clearProductsCache();
    return updated;
  }

  static async deleteProduct(id) {
    const product = await ProductModel.findById(id);
    if (!product) {
      throw new NotFoundError('Catalog item not found.');
    }

    await ProductModel.delete(id);
    await this.clearProductsCache();
  }
}

module.exports = ProductService;
