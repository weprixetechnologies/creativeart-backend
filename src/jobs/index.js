const localQueue = require('../utils/queue');
const InvoiceService = require('../services/invoice.service');
const StuckOrderSweepService = require('../services/stuck-order-sweep.service');
require('../services/affiliate.service');

// Register invoice generation handler
localQueue.registerHandler('invoice-generation', async (data) => {
  if (!data.orderId) {
    throw new Error('orderId is required for invoice-generation job.');
  }
  await InvoiceService.generateInvoice(data.orderId);
});

// Register stuck-order-sweep handler
localQueue.registerHandler('stuck-order-sweep', async () => {
  await StuckOrderSweepService.runSweep();
});

const NotificationService = require('../services/notification.service');

// Register notification handler
localQueue.registerHandler('notification', async (data) => {
  await NotificationService.sendNotification(data.orderId, data.event, data.customData);
});

module.exports = localQueue;
