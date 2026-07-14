CREATE TABLE IF NOT EXISTS notification_templates (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  template_key VARCHAR(50) UNIQUE NOT NULL,
  channels VARCHAR(255) NOT NULL, -- e.g. "EMAIL,SMS"
  subject_template VARCHAR(255),
  body_template TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notification_logs (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  order_id BIGINT UNSIGNED,
  recipient VARCHAR(255) NOT NULL,
  channel VARCHAR(20) NOT NULL, -- "EMAIL", "SMS"
  status VARCHAR(20) NOT NULL, -- "SENT", "FAILED"
  sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  error_message TEXT,
  FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed initial basic templates
INSERT INTO notification_templates (template_key, channels, subject_template, body_template) VALUES
('ORDER_PLACED', 'EMAIL,SMS', 'Order Placed Successfully: {{orderNumber}}', 'Hi {{customerName}}, your order {{orderNumber}} of amount Rs.{{totalAmount}} has been placed.'),
('ORDER_PAID', 'EMAIL,SMS', 'Payment Received for Order {{orderNumber}}', 'Hi {{customerName}}, we have received your payment of Rs.{{totalAmount}} for order {{orderNumber}}.'),
('ADVANCE_PAID', 'EMAIL,SMS', 'Advance Paid: Order {{orderNumber}}', 'Hi {{customerName}}, your advance payment of Rs.{{advanceAmount}} for custom project order {{orderNumber}} has been captured.'),
('AWAITING_MATERIAL_DISPATCH', 'EMAIL,SMS', 'Action Required: Ship Material for Order {{orderNumber}}', 'Hi {{customerName}}, please dispatch your source material for custom project {{orderNumber}} to our hub.'),
('MATERIAL_RECEIVED', 'EMAIL,SMS', 'Material Received for Order {{orderNumber}}', 'Hi {{customerName}}, we have received your physical material for order {{orderNumber}} at our hub.'),
('IN_PRODUCTION', 'EMAIL,SMS', 'Order {{orderNumber}} is now In Production', 'Hi {{customerName}}, your custom design order {{orderNumber}} is now in production phase.'),
('READY_PENDING_FINAL_PAYMENT', 'EMAIL,SMS', 'Action Required: Order {{orderNumber}} is Ready', 'Hi {{customerName}}, your custom order {{orderNumber}} is ready! Please pay the balance amount of Rs.{{finalAmount}} to dispatch.'),
('FINAL_PAID', 'EMAIL,SMS', 'Final Payment Received for Order {{orderNumber}}', 'Hi {{customerName}}, we received your final balance payment of Rs.{{finalAmount}} for custom order {{orderNumber}}.'),
('PACKED', 'EMAIL,SMS', 'Order {{orderNumber}} is Packed', 'Hi {{customerName}}, your order {{orderNumber}} has been packed and is ready to ship.'),
('SHIPPED', 'EMAIL,SMS', 'Order {{orderNumber}} Shipped', 'Hi {{customerName}}, your order {{orderNumber}} has been shipped via {{courierName}}. Tracking AWB: {{awbCode}}.'),
('DELIVERED', 'EMAIL,SMS', 'Order {{orderNumber}} Delivered', 'Hi {{customerName}}, your order {{orderNumber}} has been successfully delivered. Thank you!'),
('CANCELLED', 'EMAIL,SMS', 'Order {{orderNumber}} Cancelled', 'Hi {{customerName}}, your order {{orderNumber}} has been cancelled.');
