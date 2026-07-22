const db = require('../config/db');

class SettingsController {
  async getPublicSettings(req, res, next) {
    try {
      const rows = await db.query("SELECT `key`, value FROM settings");
      const settingsMap = {};
      rows.forEach(r => {
        // Return booleans correctly if possible
        if (r.value === 'true') settingsMap[r.key] = true;
        else if (r.value === 'false') settingsMap[r.key] = false;
        else settingsMap[r.key] = r.value;
      });
      res.status(200).json({ success: true, data: settingsMap });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new SettingsController();
