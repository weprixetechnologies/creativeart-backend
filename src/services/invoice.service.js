const fs = require('fs');
const path = require('path');
const OrderModel = require('../models/order.model');
const db = require('../config/db');
const { NotFoundError } = require('../utils/errors');

class InvoiceService {
  async generateInvoice(orderId) {
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    const items = await OrderModel.getOrderItems(orderId);
    const itemIds = items.map(item => item.id);
    const customValues = await OrderModel.getCustomValuesForItems(itemIds);

    // Group custom values by order_item_id
    const valuesByItemId = {};
    customValues.forEach(val => {
      if (!valuesByItemId[val.order_item_id]) {
        valuesByItemId[val.order_item_id] = [];
      }
      valuesByItemId[val.order_item_id].push({
        label: val.field_label_snapshot,
        value: val.value
      });
    });

    // Fetch user info
    const [userRows] = await db.query(
      "SELECT name, email FROM users WHERE id = ?",
      [order.user_id]
    );
    const user = userRows || { name: 'Customer', email: '' };

    // Fetch address info
    let addressText = 'N/A';
    if (order.address_id) {
      const [addrRows] = await db.query(
        "SELECT * FROM addresses WHERE id = ?",
        [order.address_id]
      );
      if (addrRows) {
        const a = addrRows;
        addressText = `${a.contact_name} (${a.contact_phone})\n${a.line1}${a.line2 ? ', ' + a.line2 : ''}\n${a.city}, ${a.state} - ${a.pincode}\n${a.country}`;
      }
    }

    // Build plain text invoice content
    let text = `======================================================================
                        CREATIVE ART - INVOICE
======================================================================
Invoice Number: INV-${order.order_number.replace('ORD-', '')}
Order Number:   ${order.order_number}
Order Date:     ${order.created_at || new Date().toISOString()}
Order Type:     ${order.order_type}
Order Status:   ${order.status}
----------------------------------------------------------------------
Customer Name:  ${user.name}
Customer Email: ${user.email}
----------------------------------------------------------------------
Shipping Address:
${addressText}
======================================================================
ITEMS:
----------------------------------------------------------------------
`;

    items.forEach((item, index) => {
      const variantSkuText = item.variant_sku ? ` (SKU: ${item.variant_sku})` : '';
      text += `${index + 1}. ${item.product_name_snapshot}${variantSkuText}
   Qty: ${item.qty} | Unit Price: Rs. ${parseFloat(item.unit_price).toFixed(2)} | Total: Rs. ${parseFloat(item.line_total).toFixed(2)}\n`;
      
      const itemCustoms = valuesByItemId[item.id] || [];
      if (itemCustoms.length > 0) {
        text += `   Customization choices:\n`;
        itemCustoms.forEach(c => {
          text += `    - ${c.label}: ${c.value}\n`;
        });
      }
      text += `----------------------------------------------------------------------\n`;
    });

    const sub = parseFloat(order.subtotal).toFixed(2);
    const disc = parseFloat(order.discount_amount).toFixed(2);
    const tax = parseFloat(order.tax_amount).toFixed(2);
    const ship = parseFloat(order.shipping_amount).toFixed(2);
    const tot = parseFloat(order.total_amount).toFixed(2);

    text += `Subtotal:         Rs. ${sub}
Discount:         Rs. ${disc}
Tax (GST):        Rs. ${tax}
Shipping:         Rs. ${ship}
----------------------------------------------------------------------
Total Paid/Due:   Rs. ${tot}
======================================================================
Thank you for shopping with Creative Art!
For support, contact support@creativeart.com
======================================================================`;

    // Ensure storage directory exists
    const storageDir = path.resolve(__dirname, '../../storage/invoices');
    if (!fs.existsSync(storageDir)) {
      fs.mkdirSync(storageDir, { recursive: true });
    }

    const filePath = path.join(storageDir, `invoice-${order.order_number}.pdf`);
    fs.writeFileSync(filePath, text, 'utf8');

    return filePath;
  }

  async getInvoicePath(orderId, userId, userRole) {
    const order = await OrderModel.findById(orderId);
    if (!order) {
      throw new NotFoundError('Order not found.');
    }

    // Verify ownership
    if (userRole !== 'ADMIN' && Number(order.user_id) !== Number(userId)) {
      throw new NotFoundError('Order not found.'); // mask auth issue as NotFound
    }

    const storageDir = path.resolve(__dirname, '../../storage/invoices');
    const filePath = path.join(storageDir, `invoice-${order.order_number}.pdf`);

    // Generate inline if file not found
    if (!fs.existsSync(filePath)) {
      await this.generateInvoice(orderId);
    }

    return filePath;
  }
}

module.exports = new InvoiceService();
