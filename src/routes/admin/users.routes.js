const express = require('express');
const router = express.Router();
const AdminUserController = require('../../controllers/admin/user.controller');
const authMiddleware = require('../../middlewares/auth.middleware');
const roleGuard = require('../../middlewares/role.middleware');

router.use(authMiddleware, roleGuard('ADMIN'));

router.get('/', AdminUserController.listStaff);
router.get('/customers', AdminUserController.listCustomers);
router.put('/:id/role', AdminUserController.updateStaffRole);

module.exports = router;
