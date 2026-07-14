const db = require('../config/db');
const orderStateMachine = require('../services/order-state-machine.service');
const PaymentService = require('../services/payment.service');
const crypto = require('crypto');
const { ValidationError } = require('../utils/errors');

class WebhookController {
  async handlePhonepe(req, res, next) {
    const xVerify = req.headers['x-verify'];
    if (!PaymentService.verifyWebhookSignature(xVerify, req.body)) {
      console.warn('PhonePe webhook signature verification failed.');
      return res.status(401).json({ success: false, message: 'Unauthorized webhook source.' });
    }

    try {
      const rawBody = req.body ? req.body.toString('utf8') : '{}';
      const { response: base64Response } = JSON.parse(rawBody);
      const decoded = JSON.parse(Buffer.from(base64Response, 'base64').toString('utf8'));
      const merchantTransactionId = decoded.data?.merchantTransactionId || decoded.merchantTransactionId;
      const phonepeState = decoded.data?.state || (decoded.success ? 'COMPLETED' : 'FAILED');
      const code = decoded.code;

      // check-then-transition (idempotency, 05-STATE-MACHINES.md rule 4)
      const existingPayments = await db.query(
        "SELECT * FROM order_payments WHERE gateway_payment_id = ?",
        [merchantTransactionId]
      );

      if (existingPayments.length === 0) {
        console.warn(`No payment record found for gateway payment ID ${merchantTransactionId}.`);
        return res.status(200).json({ success: true, message: 'Acknowledge unknown transaction' });
      }

      const paymentRecord = existingPayments[0];
      if (paymentRecord.status === 'CAPTURED') {
        return res.status(200).json({ success: true, message: 'Idempotent webhook: Payment already captured.' });
      }

      // Map PhonePe state: COMPLETED->CAPTURED, FAILED->FAILED, PENDING->CREATED
      let internalStatus = 'CREATED';
      if (phonepeState === 'COMPLETED' || code === 'PAYMENT_SUCCESS') {
        internalStatus = 'CAPTURED';
      } else if (phonepeState === 'FAILED' || code === 'PAYMENT_ERROR' || code === 'FAILURE' || code === 'TIMED_OUT') {
        internalStatus = 'FAILED';
      }

      const orderId = Number(paymentRecord.order_id);

      // Update payment record directly without nested transaction blocks
      await db.query(
        `UPDATE order_payments 
         SET status = ?, gateway_payment_id = ?, raw_webhook_payload = ?
         WHERE id = ?`,
        [internalStatus, merchantTransactionId, rawBody, paymentRecord.id]
      );

      if (internalStatus === 'CAPTURED') {
        if (paymentRecord.payment_type === 'FULL') {
          await orderStateMachine.transition(orderId, 'PAID', {
            actorType: 'WEBHOOK',
            note: `PhonePe V1 payment success: ${code}`
          });
        } else if (paymentRecord.payment_type === 'ADVANCE') {
          await orderStateMachine.transition(orderId, 'ADVANCE_PAID', {
            actorType: 'WEBHOOK',
            note: `PhonePe V1 advance success: ${code}`
          });
        } else if (paymentRecord.payment_type === 'FINAL') {
          await orderStateMachine.transition(orderId, 'FINAL_PAID', {
            actorType: 'WEBHOOK',
            note: `PhonePe V1 final success: ${code}`
          });
        }
      } else if (internalStatus === 'FAILED') {
        if (paymentRecord.payment_type === 'FULL' || paymentRecord.payment_type === 'ADVANCE') {
          await orderStateMachine.transition(orderId, 'CANCELLED', {
            actorType: 'WEBHOOK',
            note: `PhonePe V1 payment failed: ${code}`
          });
        }
      }

    } catch (err) {
      console.error('Error processing PhonePe V1 webhook:', err);
      // Catch processing errors and still return 200 to acknowledge webhook receipt
    }

    return res.status(200).json({ success: true });
  }

  async handleShiprocket(req, res, next) {
    try {
      const { awb, shipment_id, current_status, status_datetime } = req.body;

      if (!awb && !shipment_id) {
        throw new ValidationError('awb or shipment_id is required.');
      }

      // Find the shipment row
      const shipments = await db.query(
        "SELECT * FROM shipments WHERE awb_code = ? OR shiprocket_shipment_id = ?",
        [awb || null, shipment_id || null]
      );

      if (shipments.length === 0) {
        return res.status(200).json({
          success: true,
          message: 'Shipment record not found in system.'
        });
      }

      const shipment = shipments[0];
      const orderId = Number(shipment.order_id);

      // Check Idempotency: if status in DB is already same as current_status
      if (shipment.status === current_status) {
        return res.status(200).json({
          success: true,
          message: 'Idempotent webhook: shipment status is already up to date.'
        });
      }

      // Map Shiprocket status to order status
      let nextOrderStatus = null;
      const cleanStatus = String(current_status).toLowerCase().trim();

      if (['shipped', 'out_for_delivery', 'in_transit'].includes(cleanStatus)) {
        nextOrderStatus = 'SHIPPED';
      } else if (['delivered'].includes(cleanStatus)) {
        nextOrderStatus = 'DELIVERED';
      } else if (['rto', 'returned', 'undelivered'].includes(cleanStatus)) {
        nextOrderStatus = 'RTO';
      }

      await db.transaction(async (conn) => {
        // Update shipment status
        const updates = ['status = ?', 'tracking_payload = ?'];
        const params = [current_status, JSON.stringify(req.body)];

        if (cleanStatus === 'shipped') {
          updates.push('pickup_scheduled_at = ?');
          params.push(status_datetime ? new Date(status_datetime) : new Date());
        } else if (cleanStatus === 'delivered') {
          updates.push('delivered_at = ?');
          params.push(status_datetime ? new Date(status_datetime) : new Date());
        }

        params.push(shipment.id);
        await conn.query(
          `UPDATE shipments SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      });

      // Transition order status
      if (nextOrderStatus) {
        await orderStateMachine.transition(orderId, nextOrderStatus, {
          actorType: 'WEBHOOK',
          note: `Shiprocket webhook update: Shipment status is "${current_status}"`
        });
      }

      res.status(200).json({
        success: true,
        message: 'Shiprocket status processed successfully.'
      });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new WebhookController();
