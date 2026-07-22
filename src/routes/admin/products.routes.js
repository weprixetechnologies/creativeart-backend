const express = require('express');
const ProductController = require('../../controllers/product.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

const router = express.Router();

// Guard all admin product routes
router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

const ProductImageController = require('../../controllers/product-image.controller');

const ProductVariantController = require('../../controllers/product-variant.controller');

const ProductCustomFieldController = require('../../controllers/product-custom-field.controller');

router.post('/cache/clear', ProductController.clearCache);
router.get('/', ProductController.getProducts);
router.get('/:id', ProductController.getProduct);
router.post('/', ProductController.createProduct);
router.put('/:id', ProductController.updateProduct);
router.delete('/:id', ProductController.deleteProduct);

router.get('/:id/images', ProductImageController.getProductImages);
router.post('/:id/images', ProductImageController.handleImageAction);

router.get('/:id/variants', ProductVariantController.getVariants);
router.post('/:id/variants', ProductVariantController.createVariant);
router.put('/:id/variants/:variantId', ProductVariantController.updateVariant);
router.delete('/:id/variants/:variantId', ProductVariantController.deleteVariant);

router.get('/:id/custom-fields', ProductCustomFieldController.getCustomFields);
router.post('/:id/custom-fields', ProductCustomFieldController.createCustomField);
router.put('/:id/custom-fields/:fieldId', ProductCustomFieldController.updateCustomField);
router.delete('/:id/custom-fields/:fieldId', ProductCustomFieldController.deleteCustomField);

module.exports = router;
