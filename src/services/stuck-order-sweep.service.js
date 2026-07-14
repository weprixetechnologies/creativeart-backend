const db = require('../config/db');
const orderStateMachine = require('./order-state-machine.service');

class StuckOrderSweepService {
  async runSweep() {
    console.log('[StuckOrderSweep] Starting sweep...');
    
    // 1. Get threshold from settings
    let thresholdDays = 14;
    try {
      const rows = await db.query("SELECT value FROM settings WHERE `key` = 'stuck_order_sweep_threshold_days'");
      if (rows.length > 0) {
        thresholdDays = parseInt(rows[0].value, 10);
      }
    } catch (err) {
      console.error('[StuckOrderSweep] Failed to read threshold setting, using default 14 days:', err);
    }

    console.log(`[StuckOrderSweep] Using threshold of ${thresholdDays} days.`);

    // 2. Query stuck DUAL_PAYMENT orders
    // We check the last transitioned time from order_status_history
    const stuckOrders = await db.query(
      `SELECT o.id, o.order_number, o.status, osh.created_at as transitioned_at
       FROM orders o
       JOIN (
         SELECT order_id, MAX(id) as max_id
         FROM order_status_history
         GROUP BY order_id
       ) latest_hist ON o.id = latest_hist.order_id
       JOIN order_status_history osh ON latest_hist.max_id = osh.id
       WHERE o.order_type = 'DUAL_PAYMENT'
         AND o.status NOT IN ('DELIVERED', 'CANCELLED', 'REFUNDED', 'ON_HOLD')
         AND osh.created_at < DATE_SUB(CURRENT_TIMESTAMP, INTERVAL ? DAY)`,
      [thresholdDays]
    );

    console.log(`[StuckOrderSweep] Found ${stuckOrders.length} stuck custom orders.`);

    let successCount = 0;
    for (const order of stuckOrders) {
      try {
        console.log(`[StuckOrderSweep] Flagging order ${order.order_number} (ID: ${order.id}) as ON_HOLD...`);
        await orderStateMachine.transition(order.id, 'ON_HOLD', {
          actorType: 'SYSTEM',
          note: `Stuck order sweep: automatically flagged to ON_HOLD after remaining in ${order.status} for > ${thresholdDays} days.`
        });
        successCount++;
      } catch (err) {
        console.error(`[StuckOrderSweep] Failed to transition order ${order.order_number}:`, err.message);
      }
    }

    console.log(`[StuckOrderSweep] Sweep complete. Successfully flagged ${successCount} orders.`);
    return { found: stuckOrders.length, flagged: successCount };
  }
}

module.exports = new StuckOrderSweepService();
