const db = require('../../config/db');

class AdminDashboardController {
  async getKpis(req, res, next) {
    try {
      // 1. Total Revenue (captured payments)
      const revenueRow = await db.query(
        "SELECT SUM(amount) as total FROM order_payments WHERE status = 'CAPTURED'"
      );
      const totalRevenue = parseFloat(revenueRow[0]?.total || 0);

      // 2. Total Orders
      const orderCountRow = await db.query("SELECT COUNT(*) as count FROM orders");
      const totalOrders = Number(orderCountRow[0]?.count || 0);

      // 3. Active Coupons
      const couponCountRow = await db.query(
        "SELECT COUNT(*) as count FROM coupons WHERE status = 'ACTIVE' AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)"
      );
      const activeCoupons = Number(couponCountRow[0]?.count || 0);

      // 4. Custom Projects In Production
      const productionCountRow = await db.query(
        "SELECT COUNT(*) as count FROM orders WHERE status = 'IN_PRODUCTION'"
      );
      const projectsInProduction = Number(productionCountRow[0]?.count || 0);

      res.status(200).json({
        success: true,
        data: {
          totalRevenue,
          totalOrders,
          activeCoupons,
          projectsInProduction
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async getReports(req, res, next) {
    try {
      // Return simple mock charts/reports data for dashboard graphs
      const monthlyRevenue = [
        { month: 'Jan', revenue: 15000 },
        { month: 'Feb', revenue: 23000 },
        { month: 'Mar', revenue: 32050 },
        { month: 'Apr', revenue: 28000 },
        { month: 'May', revenue: 45000 },
        { month: 'Jun', revenue: 58000 }
      ];

      const ordersByType = [
        { name: 'Standard Products', value: 120 },
        { name: 'Custom Projects', value: 45 }
      ];

      res.status(200).json({
        success: true,
        data: {
          monthlyRevenue,
          ordersByType
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async listAuditLogs(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT h.*, o.order_number, u.name as actor_name, u.email as actor_email
         FROM order_status_history h
         JOIN orders o ON h.order_id = o.id
         LEFT JOIN users u ON h.actor_user_id = u.id
         ORDER BY h.id DESC
         LIMIT 1000`
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        orderId: Number(r.order_id),
        orderNumber: r.order_number,
        fromStatus: r.from_status,
        toStatus: r.to_status,
        changedAt: r.changed_at,
        actorType: r.actor_type,
        actorName: r.actor_name || 'System / Webhook',
        actorEmail: r.actor_email || 'system@creativeart.in',
        note: r.note
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async exportAuditLogs(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT h.*, o.order_number, u.name as actor_name, u.email as actor_email
         FROM order_status_history h
         JOIN orders o ON h.order_id = o.id
         LEFT JOIN users u ON h.actor_user_id = u.id
         ORDER BY h.id DESC`
      );

      // Create CSV content
      let csv = 'ID,Order Number,From Status,To Status,Changed At,Actor Type,Actor Name,Actor Email,Note\n';
      rows.forEach(r => {
        csv += `"${r.id}","${r.order_number}","${r.from_status}","${r.to_status}","${r.changed_at}","${r.actor_type}","${r.actor_name || 'System'}","${r.actor_email || ''}","${(r.note || '').replace(/"/g, '""')}"\n`;
      });

      res.setHeader('Content-Type', 'text/csv');
      res.setHeader('Content-Disposition', 'attachment; filename=audit-logs.csv');
      res.status(200).send(csv);
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminDashboardController();
