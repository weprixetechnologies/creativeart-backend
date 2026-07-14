const db = require('../../config/db');
const { ValidationError } = require('../../utils/errors');

class AdminSettingsController {
  async getSettings(req, res, next) {
    try {
      const rows = await db.query("SELECT `key`, value FROM settings");
      const settingsMap = {};
      rows.forEach(r => {
        settingsMap[r.key] = r.value;
      });
      res.status(200).json({ success: true, data: settingsMap });
    } catch (err) {
      next(err);
    }
  }

  async updateSettings(req, res, next) {
    try {
      const updates = req.body;
      const userId = req.user.id;

      if (!updates || typeof updates !== 'object') {
        throw new ValidationError('Invalid request body. Expected settings object.');
      }

      await db.transaction(async (conn) => {
        for (const [key, value] of Object.entries(updates)) {
          await conn.query(
            `INSERT INTO settings (\`key\`, value, updated_by_user_id) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE value = ?, updated_by_user_id = ?`,
            [key, String(value), userId, String(value), userId]
          );
        }
      });

      res.status(200).json({ success: true, message: 'Settings updated successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminSettingsController();
