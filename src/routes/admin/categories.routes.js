const express = require('express');
const CategoryController = require('../../controllers/category.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

const router = express.Router();

// Guard all admin category routes
router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

router.post('/', CategoryController.createCategory);
router.put('/:id', CategoryController.updateCategory);
router.delete('/:id', CategoryController.deleteCategory);

module.exports = router;
