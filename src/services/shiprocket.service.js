const db = require('../config/db');
const orderStateMachine = require('./order-state-machine.service');
const { ValidationError, NotFoundError } = require('../utils/errors');

class ShiprocketService {
  constructor() {
    this.tokenCache = null;
    this.tokenExpiry = null;
  }

  async getAuthToken() {
    // Check local cache first
    if (this.tokenCache && this.tokenExpiry && Date.now() < this.tokenExpiry) {
      return this.tokenCache;
    }

    const email = process.env.SHIPROCKET_EMAIL || 'shiprocket@creativeart.in';
    const password = process.env.SHIPROCKET_PASSWORD || 'mock_password_123';

    console.log('[Shiprocket] Fetching new authentication token...');
    // Mock the external auth request for sandbox environment
    this.tokenCache = 'mock_shiprocket_jwt_token_xyz_888';
    this.tokenExpiry = Date.now() + 9 * 24 * 60 * 60 * 1000; // Cache for 9 days
    return this.tokenCache;
  }

  async createAdhocOrder(orderId) {
    const token = await this.getAuthToken();
    
    const order = await db.query(
      `SELECT o.*, u.name as customer_name, u.email as customer_email, 
              a.line1, a.line2, a.city, a.state, a.pincode, a.contact_phone
       FROM orders o
       JOIN users u ON o.user_id = u.id
       LEFT JOIN addresses a ON o.address_id = a.id
       WHERE o.id = ?`,
      [orderId]
    );

    if (order.length === 0) {
      throw new NotFoundError('Order not found.');
    }

    const o = order[0];

    // Mock API creation response payload
    const shiprocketOrderId = 'sr_ord_' + Math.random().toString(36).substring(2, 10);
    const shiprocketShipmentId = 'sr_ship_' + Math.random().toString(36).substring(2, 10);
    const awbCode = 'AWB-' + Math.floor(10000000 + Math.random() * 90000000);
    const courierName = 'Delhivery';
    const labelUrl = `https://cdn.shiprocket.co/labels/${shiprocketShipmentId}.pdf`;
    const manifestUrl = `https://cdn.shiprocket.co/manifests/${shiprocketShipmentId}.pdf`;

    return {
      shiprocketOrderId,
      shiprocketShipmentId,
      awbCode,
      courierName,
      labelUrl,
      manifestUrl
    };
  }

  async markPacked(orderId, staffUserId) {
    const order = await db.query("SELECT id, status, order_type FROM orders WHERE id = ?", [orderId]);
    if (order.length === 0) {
      throw new NotFoundError('Order not found.');
    }

    if (order[0].status !== 'PAID' && order[0].status !== 'FINAL_PAID') {
      throw new ValidationError(`Order must be PAID or FINAL_PAID to pack. Current status: ${order[0].status}`);
    }

    // 1. Trigger adhoc order creation on Shiprocket
    const sr = await this.createAdhocOrder(orderId);

    // 2. Write to shipments table
    await db.transaction(async (conn) => {
      // Check if shipment already exists
      const existing = await conn.query("SELECT id FROM shipments WHERE order_id = ?", [orderId]);
      if (existing.length > 0) {
        await conn.query(
          `UPDATE shipments 
           SET shiprocket_order_id = ?, shiprocket_shipment_id = ?, awb_code = ?, courier_name = ?, label_url = ?, manifest_url = ?, status = 'READY_TO_SHIP', packed_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [sr.shiprocketOrderId, sr.shiprocketShipmentId, sr.awbCode, sr.courierName, sr.labelUrl, sr.manifestUrl, existing[0].id]
        );
      } else {
        await conn.query(
          `INSERT INTO shipments 
           (order_id, shiprocket_order_id, shiprocket_shipment_id, awb_code, courier_name, status, label_url, manifest_url, packed_at) 
           VALUES (?, ?, ?, ?, ?, 'READY_TO_SHIP', ?, ?, CURRENT_TIMESTAMP)`,
          [orderId, sr.shiprocketOrderId, sr.shiprocketShipmentId, sr.awbCode, sr.courierName, sr.labelUrl, sr.manifestUrl]
        );
      }
    });

    // 3. Transition order to PACKED status
    await orderStateMachine.transition(orderId, 'PACKED', {
      actorType: 'STAFF',
      actorUserId: staffUserId,
      note: `Order packed. Courier: ${sr.courierName} (AWB: ${sr.awbCode})`
    });

    return sr;
  }
}

module.exports = new ShiprocketService();
