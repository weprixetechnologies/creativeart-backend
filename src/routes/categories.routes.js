const express = require('express');
const CategoryController = require('../controllers/category.controller');

const router = express.Router();

router.get('/', CategoryController.getCategoriesTree);
router.get('/:id', CategoryController.getCategory);

module.exports = router;
