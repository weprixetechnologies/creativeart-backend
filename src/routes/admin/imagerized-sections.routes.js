const express = require('express');
const router = express.Router();
const imagerizedSectionController = require('../../controllers/admin/imagerized-section.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

router.use(authMiddleware);
router.use(roleGuard('ADMIN'));

router.get('/', imagerizedSectionController.getAllSections);
router.post('/', imagerizedSectionController.createSection);
router.get('/:id', imagerizedSectionController.getSectionById);
router.put('/:id', imagerizedSectionController.updateSection);
router.delete('/:id', imagerizedSectionController.deleteSection);

module.exports = router;
