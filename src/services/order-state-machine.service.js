const db = require('../config/db');
const eventEmitter = require('../utils/event-emitter');
const { 
  NotFoundError, 
  IllegalTransitionError, 
  ValidationError 
} = require('../utils/errors');

const TRANSITIONS = {
  STANDARD: {
    'PLACED': ['PAID', 'PACKED', 'CANCELLED'],
    'PAID': ['PACKED', 'REFUNDED'],
    'PACKED': ['SHIPPED', 'CANCELLED'],
    'SHIPPED': ['DELIVERED', 'RTO', 'EXCEPTION', 'CANCELLED'],
    'DELIVERED': []
  },
  DUAL_PAYMENT: {
    'BOOKED_PENDING_ADVANCE': ['ADVANCE_PAID', 'CANCELLED'],
    'ADVANCE_PAID': ['AWAITING_MATERIAL_DISPATCH', 'MATERIAL_IN_TRANSIT'],
    'AWAITING_MATERIAL_DISPATCH': ['MATERIAL_IN_TRANSIT', 'ON_HOLD', 'CANCELLED'],
    'MATERIAL_IN_TRANSIT': ['MATERIAL_RECEIVED', 'ON_HOLD', 'CANCELLED'],
    'MATERIAL_RECEIVED': ['IN_PRODUCTION', 'ON_HOLD', 'CANCELLED'],
    'IN_PRODUCTION': ['READY_PENDING_FINAL_PAYMENT', 'ON_HOLD', 'CANCELLED'],
    'READY_PENDING_FINAL_PAYMENT': ['FINAL_PAID', 'ON_HOLD', 'CANCELLED'],
    'FINAL_PAID': ['PACKED', 'ON_HOLD', 'CANCELLED'],
    'PACKED': ['SHIPPED', 'ON_HOLD', 'CANCELLED'],
    'SHIPPED': ['DELIVERED', 'RTO', 'EXCEPTION'],
    'ON_HOLD': [] // Resume is handled specially via pre_hold_status check
  }
};

const DUAL_PAYMENT_PRE_SHIPPED = [
  'BOOKED_PENDING_ADVANCE',
  'ADVANCE_PAID',
  'AWAITING_MATERIAL_DISPATCH',
  'MATERIAL_IN_TRANSIT',
  'MATERIAL_RECEIVED',
  'IN_PRODUCTION',
  'READY_PENDING_FINAL_PAYMENT',
  'FINAL_PAID',
  'PACKED'
];

function isTransitionAllowed(orderType, fromStatus, toStatus, preHoldStatus) {
  if (fromStatus === toStatus) return true;

  // 1. DUAL_PAYMENT special rule: ON_HOLD manual override
  if (orderType === 'DUAL_PAYMENT') {
    if (toStatus === 'ON_HOLD') {
      return DUAL_PAYMENT_PRE_SHIPPED.includes(fromStatus);
    }
    if (fromStatus === 'ON_HOLD') {
      return toStatus === preHoldStatus;
    }
    if (toStatus === 'CANCELLED') {
      return DUAL_PAYMENT_PRE_SHIPPED.includes(fromStatus);
    }
  }

  // 2. Lookup check
  const allowed = TRANSITIONS[orderType]?.[fromStatus];
  return allowed ? allowed.includes(toStatus) : false;
}

class OrderStateMachineService {
  async transition(orderId, toStatus, { actorType, actorUserId = null, note = null } = {}) {
    // Validate actorType
    const validActors = ['CUSTOMER', 'ADMIN', 'STAFF', 'SYSTEM', 'WEBHOOK'];
    if (!validActors.includes(actorType)) {
      throw new ValidationError(`Invalid actorType: ${actorType}`);
    }

    // Require note for manual hold, resume, and cancellation overrides
    const isHoldOrResume = toStatus === 'ON_HOLD' || (note && note.includes('Resume'));
    const isCancel = toStatus === 'CANCELLED';
    if ((isHoldOrResume || isCancel) && actorType !== 'SYSTEM' && (!note || note.trim() === '')) {
      throw new ValidationError(`A descriptive note is required for manual hold/resume/cancellation overrides.`);
    }

    const conn = await db.pool.getConnection();
    try {
      await conn.beginTransaction();

      // Fetch order with row locking
      const orders = await conn.query(
        'SELECT id, status, order_type, pre_hold_status FROM orders WHERE id = ? FOR UPDATE',
        [orderId]
      );

      if (orders.length === 0) {
        throw new NotFoundError(`Order with ID ${orderId} not found.`);
      }

      const order = orders[0];
      const fromStatus = order.status;

      // Idempotency: return early if already in target state
      if (fromStatus === toStatus) {
        await conn.commit();
        return order;
      }

      // Check transition legality
      const preHoldStatus = order.pre_hold_status;
      if (!isTransitionAllowed(order.order_type, fromStatus, toStatus, preHoldStatus)) {
        throw new IllegalTransitionError(
          `Cannot transition order of type ${order.order_type} from ${fromStatus} to ${toStatus}.`
        );
      }

      // Determine new columns
      let nextPreHoldStatus = preHoldStatus;
      if (toStatus === 'ON_HOLD') {
        nextPreHoldStatus = fromStatus;
      } else if (fromStatus === 'ON_HOLD') {
        nextPreHoldStatus = null;
      }

      // Perform update
      if (toStatus === 'ADVANCE_PAID') {
        await conn.query(
          'UPDATE orders SET status = ?, pre_hold_status = ?, advance_paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [toStatus, nextPreHoldStatus, orderId]
        );
      } else if (toStatus === 'FINAL_PAID') {
        await conn.query(
          'UPDATE orders SET status = ?, pre_hold_status = ?, final_paid_at = CURRENT_TIMESTAMP WHERE id = ?',
          [toStatus, nextPreHoldStatus, orderId]
        );
      } else {
        await conn.query(
          'UPDATE orders SET status = ?, pre_hold_status = ? WHERE id = ?',
          [toStatus, nextPreHoldStatus, orderId]
        );
      }

      // Write status change history audit log
      await conn.query(
        `INSERT INTO order_status_history 
         (order_id, from_status, to_status, actor_type, actor_user_id, note) 
         VALUES (?, ?, ?, ?, ?, ?)`,
        [orderId, fromStatus, toStatus, actorType, actorUserId, note]
      );

      await conn.commit();

      // Enqueue async side effects
      try {
        const localQueue = require('../utils/queue');
        if (toStatus === 'PAID' || toStatus === 'FINAL_PAID') {
          localQueue.add('invoice-generation', { orderId });
        }

        let eventKey = toStatus;
        if (toStatus === 'PAID') {
          eventKey = 'ORDER_PAID';
        }

        const validEvents = [
          'ORDER_PLACED', 'ORDER_PAID', 'ADVANCE_PAID', 'AWAITING_MATERIAL_DISPATCH',
          'MATERIAL_RECEIVED', 'IN_PRODUCTION', 'READY_PENDING_FINAL_PAYMENT',
          'FINAL_PAID', 'PACKED', 'SHIPPED', 'DELIVERED', 'CANCELLED'
        ];

        if (validEvents.includes(eventKey)) {
          localQueue.add('notification', { orderId, event: eventKey });
        }
      } catch (queueErr) {
        console.error('Failed to enqueue job in state machine:', queueErr);
      }

      // Emit event after transaction commits successfully
      eventEmitter.emit('orderStatusChanged', { orderId, fromStatus, toStatus });

      // Trigger automatic cascade transitions (Rule 3)
      if (toStatus === 'ADVANCE_PAID' && order.order_type === 'DUAL_PAYMENT') {
        const shipments = await db.query(
          "SELECT id FROM material_shipments WHERE order_id = ? LIMIT 1",
          [orderId]
        );
        if (shipments.length > 0) {
          return await this.transition(orderId, 'MATERIAL_IN_TRANSIT', {
            actorType: 'SYSTEM',
            note: 'Auto-transition directly to MATERIAL_IN_TRANSIT because AWB tracking details were provided during checkout'
          });
        }
        return await this.transition(orderId, 'AWAITING_MATERIAL_DISPATCH', {
          actorType: 'SYSTEM',
          note: 'Auto-transition immediately following advance payment capture'
        });
      }

      return {
        ...order,
        status: toStatus,
        pre_hold_status: nextPreHoldStatus
      };

    } catch (err) {
      await conn.rollback();
      throw err;
    } finally {
      conn.release();
    }
  }
}

module.exports = new OrderStateMachineService();
