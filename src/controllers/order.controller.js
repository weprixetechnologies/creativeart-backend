const OrderModel = require('../models/order.model');
const InvoiceService = require('../services/invoice.service');
const orderStateMachine = require('../services/order-state-machine.service');
const PaymentService = require('../services/payment.service');
const { v4: uuidv4 } = require('uuid');
const db = require('../config/db');
const { NotFoundError } = require('../utils/errors');

class OrderController {
  async getMyOrders(req, res, next) {
    try {
      const userId = req.user.id;

      const rows = await db.query(
        "SELECT * FROM orders WHERE user_id = ? ORDER BY id DESC",
        [userId]
      );

      if (rows.length === 0) {
        return res.status(200).json({
          success: true,
          data: []
        });
      }

      const orderIds = rows.map(o => o.id);
      
      // Fetch all items for these orders
      const itemsRows = await db.query(
        `SELECT oi.*, p.slug as product_slug, pv.sku as variant_sku,
                (SELECT pi.url FROM product_images pi WHERE pi.product_id = oi.product_id ORDER BY pi.sort_order ASC LIMIT 1) as product_image
         FROM order_items oi
         JOIN products p ON oi.product_id = p.id
         LEFT JOIN product_variants pv ON oi.variant_id = pv.id
         WHERE oi.order_id IN (${orderIds.map(() => '?').join(',')})`,
        orderIds
      );

      // Load custom values for these items
      const itemIds = itemsRows.map(item => item.id);
      let customsByItemId = {};
      if (itemIds.length > 0) {
        const customValues = await OrderModel.getCustomValuesForItems(itemIds);
        customValues.forEach(val => {
          if (!customsByItemId[val.order_item_id]) {
            customsByItemId[val.order_item_id] = {};
          }
          customsByItemId[val.order_item_id][val.custom_field_id] = {
            label: val.field_label_snapshot,
            value: val.value
          };
        });
      }

      // Group items by order_id
      const itemsByOrderId = {};
      itemsRows.forEach(item => {
        if (!itemsByOrderId[item.order_id]) {
          itemsByOrderId[item.order_id] = [];
        }
        itemsByOrderId[item.order_id].push({
          id: Number(item.id),
          productId: Number(item.product_id),
          variantId: item.variant_id ? Number(item.variant_id) : null,
          productNameSnapshot: item.product_name_snapshot,
          productSlug: item.product_slug,
          productImage: item.product_image,
          variantSku: item.variant_sku,
          qty: item.qty,
          unitPrice: parseFloat(item.unit_price),
          lineTotal: parseFloat(item.line_total),
          customFieldValues: customsByItemId[item.id] || {}
        });
      });

      const formatted = rows.map(order => ({
        id: Number(order.id),
        orderNumber: order.order_number,
        orderType: order.order_type,
        status: order.status,
        subtotal: parseFloat(order.subtotal),
        discountAmount: parseFloat(order.discount_amount),
        taxAmount: parseFloat(order.tax_amount),
        shippingAmount: parseFloat(order.shipping_amount),
        totalAmount: parseFloat(order.total_amount),
        advanceAmount: order.advance_amount ? parseFloat(order.advance_amount) : null,
        finalAmount: order.final_amount ? parseFloat(order.final_amount) : null,
        placedAt: order.placed_at,
        createdAt: order.created_at,
        items: itemsByOrderId[order.id] || []
      }));

      res.status(200).json({
        success: true,
        data: formatted
      });
    } catch (err) {
      next(err);
    }
  }

  async getOrderDetail(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const orderId = parseInt(req.params.id, 10);

      const order = await OrderModel.findById(orderId);
      if (!order) {
        throw new NotFoundError('Order not found.');
      }

      // Verify ownership
      if (userRole !== 'ADMIN' && Number(order.user_id) !== Number(userId)) {
        throw new NotFoundError('Order not found.');
      }

      const items = await OrderModel.getOrderItems(orderId);
      const payments = await OrderModel.getPayments(orderId);
      const statusHistory = await OrderModel.getStatusHistory(orderId);
      const shipments = await db.query("SELECT * FROM shipments WHERE order_id = ?", [orderId]);
      const address = order.address_id ? await OrderModel.findAddressById(order.user_id, order.address_id) : null;

      // Load custom values
      const itemIds = items.map(item => item.id);
      const customValues = await OrderModel.getCustomValuesForItems(itemIds);

      const customsByItemId = {};
      customValues.forEach(val => {
        if (!customsByItemId[val.order_item_id]) {
          customsByItemId[val.order_item_id] = {};
        }
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
        productImage: item.product_image,
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
          addressId: order.address_id ? Number(order.address_id) : null,
          address: address ? {
            id: Number(address.id),
            label: address.label,
            contactName: address.contact_name,
            line1: address.line1,
            line2: address.line2,
            city: address.city,
            state: address.state,
            pincode: address.pincode,
            phone: address.contact_phone
          } : null,
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
          placedAt: order.placed_at,
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
            deliveredAt: shipments[0].delivered_at
          } : null
        }
      });
    } catch (err) {
      next(err);
    }
  }

  async downloadInvoice(req, res, next) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      const orderId = parseInt(req.params.id, 10);

      const filePath = await InvoiceService.getInvoicePath(orderId, userId, userRole);
      
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename=invoice-${orderId}.pdf`);
      res.sendFile(filePath);
    } catch (err) {
      next(err);
    }
  }
  async submitMaterialShipment(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;
      const { officeAddressId, courierName, trackingNumber } = req.body;

      if (!courierName || !trackingNumber) {
        throw new Error('courierName and trackingNumber are required.');
      }

      // Verify order exists, belongs to user, is DUAL_PAYMENT, and is in AWAITING_MATERIAL_DISPATCH
      const order = await OrderModel.findById(orderId);
      if (!order || Number(order.user_id) !== Number(userId)) {
        throw new Error('Order not found.');
      }

      if (order.order_type !== 'DUAL_PAYMENT') {
        throw new Error('Only custom dual-payment projects require material shipment.');
      }

      if (order.status !== 'AWAITING_MATERIAL_DISPATCH') {
        throw new Error(`Cannot submit shipment in current order status: ${order.status}`);
      }

      let finalOfficeAddressId = officeAddressId || order.selected_office_address_id;
      if (!finalOfficeAddressId) {
        const activeOffices = await db.query(
          "SELECT id FROM office_addresses WHERE status = 'ACTIVE' ORDER BY id ASC LIMIT 1"
        );
        if (activeOffices.length > 0) {
          finalOfficeAddressId = activeOffices[0].id;
        }
      }

      if (!finalOfficeAddressId) {
        throw new Error('No active office address is available to receive shipments.');
      }

      await db.transaction(async (conn) => {
        // Insert material shipment
        await conn.query(
          `INSERT INTO material_shipments 
           (order_id, office_address_id, courier_name, tracking_number, shipped_at) 
           VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)`,
          [orderId, finalOfficeAddressId, courierName.trim(), trackingNumber.trim()]
        );
      });

      // Transition order status
      const updated = await orderStateMachine.transition(orderId, 'MATERIAL_IN_TRANSIT', {
        actorType: 'CUSTOMER',
        actorUserId: userId,
        note: `Material shipment submitted via ${courierName} (AWB: ${trackingNumber})`
      });

      res.status(200).json({
        success: true,
        data: {
          status: updated.status
        }
      });
    } catch (err) {
      // Keep errors consistent as validation / operations errors
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: err.message
        }
      });
    }
  }

  async initiateAdvancePayment(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const order = await OrderModel.findById(orderId);
      if (!order || Number(order.user_id) !== Number(userId)) {
        throw new NotFoundError('Order not found.');
      }

      if (order.order_type !== 'DUAL_PAYMENT') {
        throw new Error('Only custom dual-payment projects require an advance payment.');
      }

      if (order.status !== 'BOOKED_PENDING_ADVANCE') {
        throw new Error(`Order is not pending advance payment. Current status: ${order.status}`);
      }

      const advanceAmount = parseFloat(order.advance_amount);

      // Check if there is already a captured advance payment record
      const payments = await OrderModel.getPayments(orderId);
      const existingAdvance = payments.find(p => p.payment_type === 'ADVANCE' && p.status === 'CAPTURED');
      if (existingAdvance) {
        throw new Error('Advance payment has already been captured.');
      }

      let gatewayOrderId;
      const pendingPayment = payments.find(p => p.payment_type === 'ADVANCE' && p.status === 'CREATED');
      if (pendingPayment) {
        gatewayOrderId = pendingPayment.gateway_order_id;
      } else {
        gatewayOrderId = uuidv4();
        await db.query(
          `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status)
           VALUES (?, 'ADVANCE', 'PHONEPE', ?, ?, ?, 'CREATED')`,
          [orderId, gatewayOrderId, gatewayOrderId, advanceAmount]
        );
      }

      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendBase}/order-confirmation?orderId=${orderId}`;
      const initiateRes = await PaymentService.initiatePayment({
        merchantOrderId: gatewayOrderId,
        amount: advanceAmount,
        redirectUrl,
        description: `Advance deposit for preservation project order ${order.order_number}`
      });

      res.status(200).json({
        success: true,
        data: {
          checkoutUrl: initiateRes.redirectUrl
        }
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: err.message
        }
      });
    }
  }

  async initiateFinalPayment(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const order = await OrderModel.findById(orderId);
      if (!order || Number(order.user_id) !== Number(userId)) {
        throw new NotFoundError('Order not found.');
      }

      if (order.order_type !== 'DUAL_PAYMENT') {
        throw new Error('Only custom dual-payment projects require a final payment.');
      }

      if (order.status !== 'READY_PENDING_FINAL_PAYMENT') {
        throw new Error(`Order is not ready for final payment. Current status: ${order.status}`);
      }

      const finalAmount = parseFloat(order.final_amount);

      // Check if there is already a captured final payment record
      const payments = await OrderModel.getPayments(orderId);
      const existingFinal = payments.find(p => p.payment_type === 'FINAL' && p.status === 'CAPTURED');
      if (existingFinal) {
        throw new Error('Final payment has already been captured.');
      }

      let gatewayOrderId;
      const pendingPayment = payments.find(p => p.payment_type === 'FINAL' && p.status === 'CREATED');
      if (pendingPayment) {
        gatewayOrderId = pendingPayment.gateway_order_id;
      } else {
        gatewayOrderId = uuidv4();
        await db.query(
          `INSERT INTO order_payments (order_id, payment_type, gateway, gateway_order_id, gateway_payment_id, amount, status)
           VALUES (?, 'FINAL', 'PHONEPE', ?, ?, ?, 'CREATED')`,
          [orderId, gatewayOrderId, gatewayOrderId, finalAmount]
        );
      }

      const frontendBase = process.env.FRONTEND_URL || 'http://localhost:3001';
      const redirectUrl = `${frontendBase}/order-confirmation?orderId=${orderId}`;
      const initiateRes = await PaymentService.initiatePayment({
        merchantOrderId: gatewayOrderId,
        amount: finalAmount,
        redirectUrl,
        description: `Final payment balance for project order ${order.order_number}`
      });

      res.status(200).json({
        success: true,
        data: {
          checkoutUrl: initiateRes.redirectUrl
        }
      });
    } catch (err) {
      res.status(400).json({
        success: false,
        error: {
          code: 'BAD_REQUEST',
          message: err.message
        }
      });
    }
  }
  async getPaymentStatus(req, res, next) {
    try {
      const orderId = parseInt(req.params.id, 10);
      const userId = req.user.id;

      const order = await OrderModel.findById(orderId);
      if (!order || Number(order.user_id) !== Number(userId)) {
        throw new NotFoundError('Order not found.');
      }

      // Check payments status
      const payments = await OrderModel.getPayments(orderId);
      
      // Find the pending PhonePe payment (CREATED = awaiting gateway confirmation)
      const pendingPayment = payments.find(p => p.gateway === 'PHONEPE' && p.status === 'CREATED');
      let currentPaymentStatus = pendingPayment ? 'PENDING' : (payments.length > 0 ? payments[0].status : 'PENDING');
      
      if (pendingPayment) {
        try {
          const phonepeStatus = await PaymentService.checkPaymentStatus(pendingPayment.gateway_order_id);
          const state = phonepeStatus.state; // COMPLETED | FAILED | PENDING
          
          if (state === 'COMPLETED') {
            // ── Step 1: update payment record (plain query — no outer transaction).
            // orderStateMachine.transition() opens its own internal transaction with FOR UPDATE.
            // Nesting it inside db.transaction() causes ER_LOCK_WAIT_TIMEOUT (MariaDB deadlock).
            await db.query(
              "UPDATE order_payments SET status = 'CAPTURED', gateway_payment_id = ? WHERE id = ?",
              [pendingPayment.gateway_order_id, pendingPayment.id]
            );

            // ── Step 2: transition order — each call is fully atomic on its own
            if (pendingPayment.payment_type === 'FULL') {
              await orderStateMachine.transition(orderId, 'PAID', {
                actorType: 'SYSTEM',
                note: 'Full payment confirmed via client polling check'
              });
            } else if (pendingPayment.payment_type === 'ADVANCE') {
              // State machine sets advance_paid_at internally and auto-cascades to AWAITING_MATERIAL_DISPATCH
              await orderStateMachine.transition(orderId, 'ADVANCE_PAID', {
                actorType: 'SYSTEM',
                note: 'Advance deposit confirmed via client polling check'
              });
            } else if (pendingPayment.payment_type === 'FINAL') {
              // State machine sets final_paid_at internally
              await orderStateMachine.transition(orderId, 'FINAL_PAID', {
                actorType: 'SYSTEM',
                note: 'Final project balance payment confirmed via client polling check'
              });
            }

            currentPaymentStatus = 'CAPTURED';
          } else if (state === 'FAILED') {
            // ── Step 1: mark payment as failed (plain query)
            await db.query(
              "UPDATE order_payments SET status = 'FAILED' WHERE id = ?",
              [pendingPayment.id]
            );

            // ── Step 2: cancel order only for full-pay or advance (not final — project already in progress)
            if (pendingPayment.payment_type === 'FULL' || pendingPayment.payment_type === 'ADVANCE') {
              await orderStateMachine.transition(orderId, 'CANCELLED', {
                actorType: 'SYSTEM',
                note: 'Order cancelled due to failed payment check'
              });
            }

            currentPaymentStatus = 'FAILED';
          }
          // PENDING: no changes, just return current state
        } catch (pollErr) {
          console.error(`Error polling PhonePe payment status for order ${orderId}:`, pollErr);
        }
      }

      // Re-fetch order status to return the updated status
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
}

module.exports = new OrderController();
