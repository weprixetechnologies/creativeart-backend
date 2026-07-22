const db = require('../../config/db');
const OrderModel = require('../../models/order.model');
const orderStateMachine = require('../../services/order-state-machine.service');
const { NotFoundError, ValidationError } = require('../../utils/errors');

class AdminOrderController {
  async forceCheckPaymentStatus(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const PaymentService = require('../../services/payment.service');

      const order = await OrderModel.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');

      // Fetch all payments for this order
      const payments = await OrderModel.getPayments(orderId);

      // Find the most relevant pending payment to check:
      // For DUAL_PAYMENT orders: check ADVANCE first, then FINAL
      // For STANDARD orders: check FULL
      const pendingPayment = payments.find(p => p.gateway === 'PHONEPE' && p.status === 'CREATED');

      // Determine display status from what exists
      let currentPaymentStatus;
      if (!pendingPayment) {
        // No pending payments — report status of the most recent payment
        const lastCaptured = payments.find(p => p.status === 'CAPTURED');
        const lastFailed   = payments.find(p => p.status === 'FAILED');
        currentPaymentStatus = lastCaptured ? 'CAPTURED' : (lastFailed ? 'FAILED' : 'NO_PENDING_PAYMENT');
      } else {
        currentPaymentStatus = 'PENDING';
      }

      if (pendingPayment) {
        try {
          const phonepeStatus = await PaymentService.checkPaymentStatus(pendingPayment.gateway_order_id);
          const state = phonepeStatus.state; // COMPLETED | FAILED | PENDING

          if (state === 'COMPLETED') {
            // ── Step 1: update payment record with a plain query.
            // IMPORTANT: Do NOT wrap orderStateMachine.transition() in an outer db.transaction().
            // The state machine opens its own internal transaction with FOR UPDATE.
            // Nesting transactions causes ER_LOCK_WAIT_TIMEOUT.
            await db.query(
              "UPDATE order_payments SET status = 'CAPTURED', gateway_payment_id = ? WHERE id = ?",
              [pendingPayment.gateway_order_id, pendingPayment.id]
            );

            // ── Step 2: transition order — each call is fully atomic on its own
            if (pendingPayment.payment_type === 'FULL') {
              await orderStateMachine.transition(orderId, 'PAID', {
                actorType: 'SYSTEM',
                note: 'Full payment confirmed via manual admin force check'
              });
            } else if (pendingPayment.payment_type === 'ADVANCE') {
              // State machine handles advance_paid_at timestamp internally
              await orderStateMachine.transition(orderId, 'ADVANCE_PAID', {
                actorType: 'SYSTEM',
                note: 'Advance deposit confirmed via manual admin force check'
              });
              // Note: state machine auto-cascades ADVANCE_PAID → AWAITING_MATERIAL_DISPATCH
            } else if (pendingPayment.payment_type === 'FINAL') {
              // State machine handles final_paid_at timestamp internally
              await orderStateMachine.transition(orderId, 'FINAL_PAID', {
                actorType: 'SYSTEM',
                note: 'Final project balance payment confirmed via manual admin force check'
              });
            }

            currentPaymentStatus = 'CAPTURED';

          } else if (state === 'FAILED') {
            // ── Step 1: mark payment failed
            await db.query(
              "UPDATE order_payments SET status = 'FAILED' WHERE id = ?",
              [pendingPayment.id]
            );

            // ── Step 2: cancel order only for full-pay or advance (not final — project is already in progress)
            if (pendingPayment.payment_type === 'FULL' || pendingPayment.payment_type === 'ADVANCE') {
              await orderStateMachine.transition(orderId, 'CANCELLED', {
                actorType: 'SYSTEM',
                note: 'Order cancelled due to failed payment during manual admin force check'
              });
            }

            currentPaymentStatus = 'FAILED';
          }
          // PENDING state: no DB changes needed, just return current state

        } catch (pollErr) {
          console.error(`Error forcing PhonePe payment status check for order ${orderId}:`, pollErr);
          throw new Error('Failed to force check payment status: ' + pollErr.message);
        }
      }

      // Re-fetch the order after any transitions
      const updatedOrder = await OrderModel.findById(orderId);

      res.status(200).json({
        success: true,
        data: {
          orderId,
          orderStatus: updatedOrder.status,
          paymentStatus: currentPaymentStatus
        }
      });
    } catch (err) {
      next(err);
    }
  }
  async listOrders(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT o.*, u.name as customer_name, u.email as customer_email
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.id DESC
         LIMIT 500`
      );

      const formatted = rows.map(order => ({
        id: Number(order.id),
        orderNumber: order.order_number,
        orderType: order.order_type,
        status: order.status,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        subtotal: parseFloat(order.subtotal),
        discountAmount: parseFloat(order.discount_amount),
        taxAmount: parseFloat(order.tax_amount),
        shippingAmount: parseFloat(order.shipping_amount),
        totalAmount: parseFloat(order.total_amount),
        advanceAmount: order.advance_amount ? parseFloat(order.advance_amount) : null,
        finalAmount: order.final_amount ? parseFloat(order.final_amount) : null,
        createdAt: order.created_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async getOrderDetail(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);

      const order = await OrderModel.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');

      const items = await OrderModel.getOrderItems(orderId);
      const payments = await OrderModel.getPayments(orderId);
      const statusHistory = await OrderModel.getStatusHistory(orderId);
      const shipments = await db.query("SELECT * FROM shipments WHERE order_id = ?", [orderId]);

      const itemIds = items.map(item => item.id);
      const customValues = await OrderModel.getCustomValuesForItems(itemIds);

      const customsByItemId = {};
      customValues.forEach(val => {
        if (!customsByItemId[val.order_item_id]) customsByItemId[val.order_item_id] = {};
        customsByItemId[val.order_item_id][val.custom_field_id] = {
          label: val.field_label_snapshot,
          value: val.value
        };
      });

      const formattedItems = items.map(item => ({
        id: Number(item.id),
        productId: Number(item.product_id),
        variantId: item.variant_id ? Number(item.variant_id) : null,
        productNameSnapshot: item.product_name_snapshot,
        productSlug: item.product_slug,
        variantSku: item.variant_sku,
        qty: item.qty,
        unitPrice: parseFloat(item.unit_price),
        lineTotal: parseFloat(item.line_total),
        customFieldValues: customsByItemId[item.id] || {}
      }));

      const formattedPayments = payments.map(pay => ({
        id: Number(pay.id),
        paymentType: pay.payment_type,
        gateway: pay.gateway,
        gatewayOrderId: pay.gateway_order_id,
        gatewayPaymentId: pay.gateway_payment_id,
        amount: parseFloat(pay.amount),
        status: pay.status,
        createdAt: pay.created_at
      }));

      const formattedHistory = statusHistory.map(hist => ({
        id: Number(hist.id),
        fromStatus: hist.from_status,
        toStatus: hist.to_status,
        actorType: hist.actor_type,
        actorUserId: hist.actor_user_id ? Number(hist.actor_user_id) : null,
        note: hist.note,
        createdAt: hist.created_at
      }));

      res.status(200).json({
        success: true,
        data: {
          id: Number(order.id),
          orderNumber: order.order_number,
          orderType: order.order_type,
          status: order.status,
          userId: Number(order.user_id),
          addressId: order.address_id ? Number(order.address_id) : null,
          selectedOfficeAddressId: order.selected_office_address_id ? Number(order.selected_office_address_id) : null,
          couponId: order.coupon_id ? Number(order.coupon_id) : null,
          subtotal: parseFloat(order.subtotal),
          discountAmount: parseFloat(order.discount_amount),
          taxAmount: parseFloat(order.tax_amount),
          shippingAmount: parseFloat(order.shipping_amount),
          totalAmount: parseFloat(order.total_amount),
          advanceAmount: order.advance_amount ? parseFloat(order.advance_amount) : null,
          finalAmount: order.final_amount ? parseFloat(order.final_amount) : null,
          awbNumber: order.awb_number,
          courierName: order.courier_name,
          expectedDeliveryDate: order.expected_delivery_date,
          createdAt: order.created_at,
          items: formattedItems,
          payments: formattedPayments,
          statusHistory: formattedHistory,
          shipment: shipments.length > 0 ? {
            id: Number(shipments[0].id),
            awbCode: shipments[0].awb_code,
            courierName: shipments[0].courier_name,
            status: shipments[0].status,
            packedAt: shipments[0].packed_at,
            pickupScheduledAt: shipments[0].pickup_scheduled_at,
            deliveredAt: shipments[0].delivered_at,
            labelUrl: shipments[0].label_url,
            manifestUrl: shipments[0].manifest_url
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async overrideStatus(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const adminUserId = req.user.id;
      const { toStatus, note } = req.body;

      if (!toStatus || toStatus.trim() === '') {
        throw new ValidationError('toStatus is required.');
      }
      if (!note || note.trim() === '') {
        throw new ValidationError('A descriptive note is required for admin status overrides.');
      }

      const result = await orderStateMachine.transition(orderId, toStatus.trim(), {
        actorType: 'ADMIN',
        actorUserId: adminUserId,
        note: note.trim()
      });

      res.status(200).json({ success: true, data: { status: result.status } });
    } catch (err) {
      next(err);
    }
  }

  async listMaterialsInbox(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT o.*, u.name as customer_name, u.email as customer_email, ms.courier_name, ms.tracking_number, ms.shipped_at
         FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         LEFT JOIN material_shipments ms ON ms.order_id = o.id AND ms.received_at IS NULL
         WHERE o.status = 'MATERIAL_IN_TRANSIT'
         ORDER BY o.id DESC`
      );

      const formatted = rows.map(order => ({
        id: Number(order.id),
        orderNumber: order.order_number,
        status: order.status,
        customerName: order.customer_name,
        customerEmail: order.customer_email,
        courierName: order.courier_name,
        trackingNumber: order.tracking_number,
        shippedAt: order.shipped_at,
        totalAmount: parseFloat(order.total_amount),
        createdAt: order.created_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async confirmMaterialReceived(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { conditionNotes, conditionPhotoUrl } = req.body;

      const order = await OrderModel.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');

      // Update material shipment
      const shipments = await db.query(
        "SELECT id FROM material_shipments WHERE order_id = ? AND received_at IS NULL ORDER BY id DESC LIMIT 1",
        [orderId]
      );

      await db.transaction(async (conn) => {
        if (shipments.length > 0) {
          await conn.query(
            `UPDATE material_shipments 
             SET received_at = CURRENT_TIMESTAMP, received_by_user_id = ?, condition_notes = ?, condition_photo_url = ?
             WHERE id = ?`,
            [userId, conditionNotes || null, conditionPhotoUrl || null, shipments[0].id]
          );
        } else {
          // If no shipment record exists (e.g. manual status transition/override by admin), insert a placeholder record
          await conn.query(
            `INSERT INTO material_shipments 
             (order_id, office_address_id, courier_name, tracking_number, shipped_at, received_at, received_by_user_id, condition_notes, condition_photo_url) 
             VALUES (?, ?, 'MANUAL', 'MANUAL', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP, ?, ?, ?)`,
            [orderId, order.selected_office_address_id || 1, userId, conditionNotes || null, conditionPhotoUrl || null]
          );
        }
      });

      const updated = await orderStateMachine.transition(orderId, 'MATERIAL_RECEIVED', {
        actorType: 'STAFF',
        actorUserId: userId,
        note: `Material confirmed received by staff. Notes: ${conditionNotes || 'None'}`
      });

      res.status(200).json({ success: true, data: { status: updated.status } });
    } catch (err) {
      next(err);
    }
  }

  async startProduction(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const updated = await orderStateMachine.transition(orderId, 'IN_PRODUCTION', {
        actorType: 'STAFF',
        actorUserId: userId,
        note: 'Production started'
      });

      res.status(200).json({ success: true, data: { status: updated.status } });
    } catch (err) {
      next(err);
    }
  }

  async markReady(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { finalAmount, overrideReason } = req.body;

      const order = await OrderModel.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');

      if (finalAmount !== undefined && finalAmount !== null) {
        const amt = parseFloat(finalAmount);
        if (isNaN(amt) || amt < 0) {
          throw new ValidationError('Invalid finalAmount override value.');
        }
        if (!overrideReason || overrideReason.trim() === '') {
          throw new ValidationError('A descriptive override reason is required to override final amount.');
        }
        // Update final amount and total amount
        await db.query(
          "UPDATE orders SET final_amount = ?, total_amount = advance_amount + ?, final_amount_override_reason = ? WHERE id = ?",
          [amt, amt, overrideReason.trim(), orderId]
        );
      }

      const updated = await orderStateMachine.transition(orderId, 'READY_PENDING_FINAL_PAYMENT', {
        actorType: 'STAFF',
        actorUserId: userId,
        note: `Order marked ready for final payment. Final Amount: ${finalAmount !== undefined ? finalAmount : 'Original'}`
      });

      res.status(200).json({ success: true, data: { status: updated.status } });
    } catch (err) {
      next(err);
    }
  }

  async markPacked(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const staffUserId = req.user.id;
      const shiprocketService = require('../../services/shiprocket.service');

      const sr = await shiprocketService.markPacked(orderId, staffUserId);
      res.status(200).json({ success: true, data: sr });
    } catch (err) {
      next(err);
    }
  }

  async listShipments(req, res, next) {
    try {
      const rows = await db.query(
        `SELECT s.*, o.order_number, u.name as customer_name, u.email as customer_email
         FROM shipments s
         JOIN orders o ON s.order_id = o.id
         JOIN users u ON o.user_id = u.id
         ORDER BY s.id DESC
         LIMIT 500`
      );

      const formatted = rows.map(s => ({
        id: Number(s.id),
        orderId: Number(s.order_id),
        orderNumber: s.order_number,
        customerName: s.customer_name,
        customerEmail: s.customer_email,
        shiprocketOrderId: s.shiprocket_order_id,
        shiprocketShipmentId: s.shiprocket_shipment_id,
        awbCode: s.awb_code,
        courierName: s.courier_name,
        status: s.status,
        labelUrl: s.label_url,
        manifestUrl: s.manifest_url,
        packedAt: s.packed_at,
        pickupScheduledAt: s.pickup_scheduled_at,
        deliveredAt: s.delivered_at
      }));

      res.status(200).json({ success: true, data: formatted });
    } catch (err) {
      next(err);
    }
  }

  async updateManualShipping(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const adminUserId = req.user.id;
      const { awbNumber, courierName, expectedDeliveryDate } = req.body;

      const order = await OrderModel.findById(orderId);
      if (!order) throw new NotFoundError('Order not found.');

      await db.query(
        "UPDATE orders SET awb_number = ?, courier_name = ?, expected_delivery_date = ? WHERE id = ?",
        [awbNumber || null, courierName || null, expectedDeliveryDate || null, orderId]
      );

      await orderStateMachine.transition(orderId, 'SHIPPED', {
        actorType: 'ADMIN',
        actorUserId: adminUserId,
        note: `Manual shipping details updated: Courier - ${courierName}, AWB - ${awbNumber}`
      });

      res.status(200).json({ success: true, message: 'Shipping details updated successfully.' });
    } catch (err) {
      next(err);
    }
  }
}

module.exports = new AdminOrderController();
