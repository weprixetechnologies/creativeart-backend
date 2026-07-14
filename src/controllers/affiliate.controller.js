'use strict';

const db = require('../config/db');
const { ValidationError, NotFoundError } = require('../utils/errors');
const localQueue = require('../utils/queue');

class AffiliateController {
  // ── Public Endpoints ────────────────────────────────────────────────────────

  async validateCode(req, res, next) {
    try {
      const { code } = req.params;
      const affiliates = await db.query(
        "SELECT id FROM affiliates WHERE referral_code = ? AND status = 'APPROVED' LIMIT 1",
        [code.trim()]
      );

      res.status(200).json({
        success: true,
        data: {
          valid: affiliates.length > 0
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ── Customer / Affiliate Endpoints ──────────────────────────────────────────

  async apply(req, res, next) {
    try {
      const userId = req.user.id;
      const { referralCode, payoutNotes } = req.body;

      if (!referralCode || referralCode.trim().length < 3) {
        throw new ValidationError('Referral code must be at least 3 characters long.');
      }

      // Check if user already has an affiliate profile
      const existing = await db.query(
        "SELECT id, status FROM affiliates WHERE user_id = ? LIMIT 1",
        [userId]
      );

      if (existing.length > 0) {
        throw new ValidationError(`You have already applied. Current status: ${existing[0].status}`);
      }

      // Check if referral code is already taken
      const codeTaken = await db.query(
        "SELECT id FROM affiliates WHERE referral_code = ? LIMIT 1",
        [referralCode.trim()]
      );

      if (codeTaken.length > 0) {
        throw new ValidationError('This referral code is already taken.');
      }

      const result = await db.query(
        `INSERT INTO affiliates (user_id, referral_code, payout_notes, status) 
         VALUES (?, ?, ?, 'PENDING')`,
        [userId, referralCode.trim().toUpperCase(), payoutNotes || null]
      );

      // Trigger admin notification
      try {
        localQueue.add('notification', { orderId: 0, event: 'AFFILIATE_APPLICATION_RECEIVED', customData: { userId } });
      } catch (err) {
        console.error('[AffiliateController] Failed to enqueue application received notification:', err);
      }

      res.status(201).json({
        success: true,
        data: {
          id: Number(result.insertId),
          status: 'PENDING'
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async me(req, res, next) {
    try {
      const userId = req.user.id;
      const affiliates = await db.query(
        "SELECT * FROM affiliates WHERE user_id = ? LIMIT 1",
        [userId]
      );

      if (affiliates.length === 0) {
        return res.status(200).json({
          success: true,
          data: null
        });
      }

      const affiliate = affiliates[0];

      // Aggregate commissions
      const stats = await db.query(
        `SELECT 
           COALESCE(SUM(CASE WHEN status = 'PENDING' THEN commission_amount ELSE 0 END), 0) as pendingAmount,
           COALESCE(SUM(CASE WHEN status = 'CONFIRMED' THEN commission_amount ELSE 0 END), 0) as confirmedAmount,
           COALESCE(SUM(CASE WHEN status = 'PAID' THEN commission_amount ELSE 0 END), 0) as paidAmount
         FROM affiliate_commissions 
         WHERE affiliate_id = ?`,
        [affiliate.id]
      );

      res.status(200).json({
        success: true,
        data: {
          id: Number(affiliate.id),
          referralCode: affiliate.referral_code,
          status: affiliate.status,
          appliedAt: affiliate.applied_at,
          approvedAt: affiliate.approved_at,
          commissionType: affiliate.commission_type,
          commissionValue: affiliate.commission_value,
          payoutNotes: affiliate.payout_notes,
          summary: {
            pending: parseFloat(stats[0].pendingAmount),
            confirmed: parseFloat(stats[0].confirmedAmount),
            paid: parseFloat(stats[0].paidAmount),
            total: parseFloat(stats[0].pendingAmount) + parseFloat(stats[0].confirmedAmount) + parseFloat(stats[0].paidAmount)
          }
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async myCommissions(req, res, next) {
    try {
      const userId = req.user.id;
      const { status } = req.query;

      const affiliates = await db.query("SELECT id FROM affiliates WHERE user_id = ? LIMIT 1", [userId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate profile not found.');
      }
      const affiliateId = affiliates[0].id;

      let query = `
        SELECT ac.*, o.order_number 
        FROM affiliate_commissions ac
        JOIN orders o ON ac.order_id = o.id
        WHERE ac.affiliate_id = ?`;
      const params = [affiliateId];

      if (status) {
        query += " AND ac.status = ?";
        params.push(status);
      }

      query += " ORDER BY ac.id DESC";

      const rows = await db.query(query, params);
      const formatted = rows.map(r => ({
        id: Number(r.id),
        orderId: Number(r.order_id),
        orderNumber: r.order_number,
        baseAmount: parseFloat(r.base_amount),
        commissionType: r.commission_type,
        commissionValue: parseFloat(r.commission_value),
        commissionAmount: parseFloat(r.commission_amount),
        status: r.status,
        confirmedAt: r.confirmed_at,
        cancelledAt: r.cancelled_at,
        paidAt: r.paid_at
      }));

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async getReferralLink(req, res, next) {
    try {
      const userId = req.user.id;
      const affiliates = await db.query("SELECT referral_code FROM affiliates WHERE user_id = ? LIMIT 1", [userId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate profile not found.');
      }

      const frontendUrl = process.env.FRONTEND_URL || 'http://localhost:3001';
      res.status(200).json({
        success: true,
        data: {
          link: `${frontendUrl}/?ref=${affiliates[0].referral_code}`
        }
      });
    } catch (err) {
      next(err);
    }
  }

  // ── Admin Endpoints ──────────────────────────────────────────────────────────

  async listAffiliates(req, res, next) {
    try {
      const { status } = req.query;
      let query = `
        SELECT a.*, u.name as user_name, u.email as user_email 
        FROM affiliates a
        JOIN users u ON a.user_id = u.id`;
      const params = [];

      if (status) {
        query += " WHERE a.status = ?";
        params.push(status);
      }

      query += " ORDER BY a.id DESC";

      const rows = await db.query(query, params);
      const formatted = rows.map(r => ({
        id: Number(r.id),
        userId: Number(r.user_id),
        userName: r.user_name,
        userEmail: r.user_email,
        referralCode: r.referral_code,
        status: r.status,
        appliedAt: r.applied_at,
        approvedAt: r.approved_at,
        commissionType: r.commission_type,
        commissionValue: r.commission_value ? parseFloat(r.commission_value) : null,
        payoutNotes: r.payout_notes
      }));

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async approveAffiliate(req, res, next) {
    try {
      const affiliateId = parseInt(req.params.id, 10);
      const adminUserId = req.user.id;
      const { referralCode, commissionType, commissionValue } = req.body;

      const affiliates = await db.query("SELECT user_id FROM affiliates WHERE id = ?", [affiliateId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate not found.');
      }

      const updates = [];
      const params = [];

      if (referralCode && referralCode.trim() !== '') {
        // Check duplicate code
        const codeCheck = await db.query("SELECT id FROM affiliates WHERE referral_code = ? AND id != ?", [referralCode.trim().toUpperCase(), affiliateId]);
        if (codeCheck.length > 0) {
          throw new ValidationError('This referral code is already taken.');
        }
        updates.push("referral_code = ?");
        params.push(referralCode.trim().toUpperCase());
      }

      if (commissionType) {
        updates.push("commission_type = ?");
        params.push(commissionType);
      }

      if (commissionValue !== undefined) {
        updates.push("commission_value = ?");
        params.push(commissionValue === null ? null : parseFloat(commissionValue));
      }

      updates.push("status = 'APPROVED'", "approved_at = CURRENT_TIMESTAMP", "approved_by_user_id = ?");
      params.push(adminUserId, affiliateId);

      await db.query(
        `UPDATE affiliates SET ${updates.join(', ')} WHERE id = ?`,
        params
      );

      // Trigger notification (BullMQ)
      try {
        localQueue.add('notification', { orderId: 0, event: 'AFFILIATE_APPROVED', customData: { affiliateId } });
      } catch (err) {
        console.error('[AffiliateController] Failed to enqueue approved notification:', err);
      }

      res.status(200).json({
        success: true,
        message: 'Affiliate approved successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async rejectAffiliate(req, res, next) {
    try {
      const affiliateId = parseInt(req.params.id, 10);
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        throw new ValidationError('A reason is mandatory for rejection.');
      }

      const affiliates = await db.query("SELECT id FROM affiliates WHERE id = ?", [affiliateId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate not found.');
      }

      await db.query(
        "UPDATE affiliates SET status = 'REJECTED', rejection_reason = ? WHERE id = ?",
        [reason.trim(), affiliateId]
      );

      // Trigger notification (BullMQ)
      try {
        localQueue.add('notification', { orderId: 0, event: 'AFFILIATE_REJECTED', customData: { affiliateId, reason } });
      } catch (err) {
        console.error('[AffiliateController] Failed to enqueue rejected notification:', err);
      }

      res.status(200).json({
        success: true,
        message: 'Affiliate application rejected.'
      });
    } catch (err) {
      next(err);
    }
  }

  async suspendAffiliate(req, res, next) {
    try {
      const affiliateId = parseInt(req.params.id, 10);
      const { reason } = req.body;

      if (!reason || reason.trim() === '') {
        throw new ValidationError('A reason is mandatory for suspension.');
      }

      const affiliates = await db.query("SELECT id FROM affiliates WHERE id = ?", [affiliateId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate not found.');
      }

      await db.query(
        "UPDATE affiliates SET status = 'SUSPENDED', rejection_reason = ? WHERE id = ?",
        [reason.trim(), affiliateId]
      );

      res.status(200).json({
        success: true,
        message: 'Affiliate suspended successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async updateCommissionOverride(req, res, next) {
    try {
      const affiliateId = parseInt(req.params.id, 10);
      const { commissionType, commissionValue } = req.body;

      const affiliates = await db.query("SELECT id FROM affiliates WHERE id = ?", [affiliateId]);
      if (affiliates.length === 0) {
        throw new NotFoundError('Affiliate not found.');
      }

      await db.query(
        "UPDATE affiliates SET commission_type = ?, commission_value = ? WHERE id = ?",
        [commissionType || null, commissionValue === undefined ? null : parseFloat(commissionValue), affiliateId]
      );

      res.status(200).json({
        success: true,
        message: 'Commission overrides updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async listCommissionsForAffiliate(req, res, next) {
    try {
      const affiliateId = parseInt(req.params.id, 10);
      const rows = await db.query(
        `SELECT ac.*, o.order_number 
         FROM affiliate_commissions ac
         JOIN orders o ON ac.order_id = o.id
         WHERE ac.affiliate_id = ?
         ORDER BY ac.id DESC`,
        [affiliateId]
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        orderId: Number(r.order_id),
        orderNumber: r.order_number,
        baseAmount: parseFloat(r.base_amount),
        commissionType: r.commission_type,
        commissionValue: parseFloat(r.commission_value),
        commissionAmount: parseFloat(r.commission_amount),
        status: r.status,
        confirmedAt: r.confirmed_at,
        cancelledAt: r.cancelled_at,
        paidAt: r.paid_at
      }));

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async createPayoutBatch(req, res, next) {
    try {
      const adminUserId = req.user.id;
      const { affiliateId, commissionIds, notes } = req.body;

      if (!commissionIds || !Array.isArray(commissionIds) || commissionIds.length === 0) {
        throw new ValidationError('At least one commission ID must be selected for payout.');
      }

      // Verify the commissions belong to this affiliate, are status = CONFIRMED, and not yet paid
      const placeholders = commissionIds.map(() => '?').join(',');
      const validCommissions = await db.query(
        `SELECT id, commission_amount FROM affiliate_commissions 
         WHERE id IN (${placeholders}) AND affiliate_id = ? AND status = 'CONFIRMED'`,
        [...commissionIds, affiliateId]
      );

      if (validCommissions.length !== commissionIds.length) {
        throw new ValidationError('One or more selected commissions are invalid, not confirmed, or already paid.');
      }

      const totalAmount = validCommissions.reduce((sum, c) => sum + parseFloat(c.commission_amount), 0.00);

      let batchId = null;
      await db.transaction(async (conn) => {
        // 1. Create payout batch
        const batchRes = await conn.query(
          `INSERT INTO affiliate_payout_batches (affiliate_id, total_amount, status, processed_by_user_id, notes) 
           VALUES (?, ?, 'COMPLETED', ?, ?)`,
          [affiliateId, totalAmount, adminUserId, notes || null]
        );
        batchId = batchRes.insertId;

        // 2. Mark commissions as PAID and link to batch
        await conn.query(
          `UPDATE affiliate_commissions 
           SET status = 'PAID', payout_batch_id = ?, paid_at = CURRENT_TIMESTAMP 
           WHERE id IN (${placeholders})`,
          [batchId, ...commissionIds]
        );
      });

      // Trigger notification (BullMQ)
      try {
        localQueue.add('notification', { orderId: 0, event: 'AFFILIATE_PAYOUT_PROCESSED', customData: { affiliateId, batchId, totalAmount } });
      } catch (err) {
        console.error('[AffiliateController] Failed to enqueue payout notification:', err);
      }

      res.status(200).json({
        success: true,
        data: {
          batchId: Number(batchId),
          totalAmount
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async listPayoutBatches(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT pb.*, a.referral_code, u.name as affiliate_name 
         FROM affiliate_payout_batches pb
         JOIN affiliates a ON pb.affiliate_id = a.id
         JOIN users u ON a.user_id = u.id
         ORDER BY pb.id DESC`
      );

      const formatted = rows.map(r => ({
        id: Number(r.id),
        affiliateId: Number(r.affiliate_id),
        affiliateName: r.affiliate_name,
        referralCode: r.referral_code,
        totalAmount: parseFloat(r.total_amount),
        status: r.status,
        processedAt: r.processed_at,
        notes: r.notes
      }));

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async getAffiliateSettings(req, res, next) {
    try {
      const keys = [
        'affiliate_default_commission_type',
        'affiliate_default_commission_value',
        'affiliate_cookie_window_days',
        'affiliate_min_payout_threshold'
      ];

      const rows = await db.query("SELECT * FROM settings WHERE `key` IN (?, ?, ?, ?)", keys);
      const settings = {};
      
      // Default value fallbacks
      settings.affiliate_default_commission_type = 'PERCENTAGE';
      settings.affiliate_default_commission_value = '10.00';
      settings.affiliate_cookie_window_days = '30';
      settings.affiliate_min_payout_threshold = '0';

      rows.forEach(r => {
        settings[r.key] = r.value;
      });

      res.status(200).json({
        success: true,
        data: settings
      });
    } catch (err) {
      next(err);
    }
  }

  async updateAffiliateSettings(req, res, next) {
    try {
      const {
        affiliate_default_commission_type,
        affiliate_default_commission_value,
        affiliate_cookie_window_days,
        affiliate_min_payout_threshold
      } = req.body;

      const adminUserId = req.user.id;

      const payload = {
        affiliate_default_commission_type,
        affiliate_default_commission_value,
        affiliate_cookie_window_days,
        affiliate_min_payout_threshold
      };

      for (const [key, value] of Object.entries(payload)) {
        if (value !== undefined) {
          await db.query(
            `INSERT INTO settings (\`key\`, value, updated_by_user_id) 
             VALUES (?, ?, ?) 
             ON DUPLICATE KEY UPDATE value = ?, updated_by_user_id = ?`,
            [key, String(value), adminUserId, String(value), adminUserId]
          );
        }
      }

      res.status(200).json({
        success: true,
        message: 'Affiliate settings updated successfully.'
      });
    } catch (err) {
      next(err);
    }
  }

  async getAdminDashboardKPIs(req, res, next) {
    try {
      // 1. Pending applications count
      const pendingApps = await db.query("SELECT COUNT(*) as cnt FROM affiliates WHERE status = 'PENDING'");
      
      // 2. Total active approved affiliates
      const activeAffiliates = await db.query("SELECT COUNT(*) as cnt FROM affiliates WHERE status = 'APPROVED'");

      // 3. Pending commission liability (sum of PENDING + CONFIRMED commissions)
      const liability = await db.query(
        "SELECT COALESCE(SUM(commission_amount), 0) as total FROM affiliate_commissions WHERE status IN ('PENDING', 'CONFIRMED')"
      );

      // 4. This month's affiliate-attributed revenue (attributed orders subtotal)
      const revenue = await db.query(
        `SELECT COALESCE(SUM(subtotal - discount_amount), 0) as total 
         FROM orders 
         WHERE affiliate_id IS NOT NULL 
           AND status IN ('PAID', 'FINAL_PAID', 'DELIVERED', 'PACKED', 'SHIPPED')
           AND placed_at >= DATE_FORMAT(NOW() ,'%Y-%m-01 00:00:00')`
      );

      res.status(200).json({
        success: true,
        data: {
          pendingApplications: Number(pendingApps[0].cnt),
          activeAffiliates: Number(activeAffiliates[0].cnt),
          pendingLiability: parseFloat(liability[0].total),
          attributedRevenueThisMonth: parseFloat(revenue[0].total)
        }
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AffiliateController();
