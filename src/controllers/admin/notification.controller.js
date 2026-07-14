const db = require('../../config/db');
const { ValidationError, NotFoundError } = require('../../utils/errors');

class AdminNotificationController {
  // Templates CRUD
  async listTemplates(req, res, next) {
    try {
      const rows = await db.query("SELECT * FROM notification_templates ORDER BY id DESC");
      const formatted = rows.map(r => ({
        id: Number(r.id),
        templateKey: r.template_key,
        channels: r.channels,
        subjectTemplate: r.subject_template,
        bodyTemplate: r.body_template,
        createdAt: r.created_at,
        updatedAt: r.updated_at
      }));
      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async createTemplate(req, res, next) {
    try {
      const { templateKey, channels, subjectTemplate, bodyTemplate } = req.body;

      if (!templateKey || !channels || !bodyTemplate) {
        throw new ValidationError('templateKey, channels, and bodyTemplate are required.');
      }

      await db.query(
        `INSERT INTO notification_templates (template_key, channels, subject_template, body_template) 
         VALUES (?, ?, ?, ?)`,
        [templateKey.toUpperCase().trim(), channels.trim(), subjectTemplate || null, bodyTemplate.trim()]
      );

      res.status(201).json({ success: true, message: 'Template created successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async updateTemplate(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);
      const { channels, subjectTemplate, bodyTemplate } = req.body;

      if (!channels || !bodyTemplate) {
        throw new ValidationError('channels and bodyTemplate are required.');
      }

      // Check existence
      const template = await db.query("SELECT id FROM notification_templates WHERE id = ?", [id]);
      if (template.length === 0) {
        throw new NotFoundError('Template not found.');
      }

      await db.query(
        `UPDATE notification_templates 
         SET channels = ?, subject_template = ?, body_template = ? 
         WHERE id = ?`,
        [channels.trim(), subjectTemplate || null, bodyTemplate.trim(), id]
      );

      res.status(200).json({ success: true, message: 'Template updated successfully.' });
    } catch (err) {
      next(err);
    }
  }

  async deleteTemplate(req, res, next) {
    try {
      const id = parseInt(req.params.id, 10);

      const template = await db.query("SELECT id FROM notification_templates WHERE id = ?", [id]);
      if (template.length === 0) {
        throw new NotFoundError('Template not found.');
      }

      await db.query("DELETE FROM notification_templates WHERE id = ?", [id]);

      res.status(200).json({ success: true, message: 'Template deleted successfully.' });
    } catch (err) {
      next(err);
    }
  }

  // Logs
  async listLogs(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT l.*, o.order_number 
         FROM notification_logs l
         LEFT JOIN orders o ON l.order_id = o.id
         ORDER BY l.id DESC
         LIMIT 1000`
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        orderId: r.order_id ? Number(r.order_id) : null,
        orderNumber: r.order_number || '—',
        recipient: r.recipient,
        channel: r.channel,
        status: r.status,
        sentAt: r.sent_at,
        errorMessage: r.error_message
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminNotificationController();
