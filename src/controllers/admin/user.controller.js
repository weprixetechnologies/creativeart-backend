const db = require('../../config/db');
const { ValidationError, NotFoundError } = require('../../utils/errors');

class AdminUserController {
  async listStaff(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT id, name, email, role, created_at 
         FROM users 
         WHERE role IN ('ADMIN', 'STAFF_PRODUCTION', 'STAFF_PACKAGING') 
         ORDER BY id DESC`
      );

      const formatted = rows.map(u => ({
        id: Number(u.id),
        name: u.name,
        email: u.email,
        role: u.role,
        createdAt: u.created_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async updateStaffRole(req, res, next) {
    try {
      const userId = parseInt(req.params.id, 10);
      const { role } = req.body;

      if (!['ADMIN', 'STAFF_PRODUCTION', 'STAFF_PACKAGING', 'CUSTOMER'].includes(role)) {
        throw new ValidationError('Invalid role selection.');
      }

      // Check if user exists
      const user = await db.query("SELECT id FROM users WHERE id = ?", [userId]);
      if (user.length === 0) {
        throw new NotFoundError('User not found.');
      }

      // Update role
      await db.query("UPDATE users SET role = ? WHERE id = ?", [role, userId]);

      res.status(200).json({ success: true, message: 'Staff role updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async listCustomers(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT id, name, email, phone, created_at 
         FROM users 
         WHERE role = 'CUSTOMER' 
         ORDER BY id DESC`
      );

      const formatted = rows.map(u => ({
        id: Number(u.id),
        name: u.name,
        email: u.email,
        phone: u.phone,
        createdAt: u.created_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminUserController();
