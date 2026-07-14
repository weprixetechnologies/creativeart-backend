const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '.env') });
if (process.env.NODE_ENV === 'production') {
  if (!process.env.MERCHANT_ID || !process.env.KEY || !process.env.KEY_INDEX) {
    console.error('CRITICAL ERROR: PhonePe MERCHANT_ID, KEY, or KEY_INDEX is missing in production environment.');
    process.exit(1);
  }
}
const authRoutes = require('./src/routes/auth.routes');
const storageRoutes = require('./src/routes/storage.routes');
const categoriesRoutes = require('./src/routes/categories.routes');
const adminCategoriesRoutes = require('./src/routes/admin/categories.routes');
const productsRoutes = require('./src/routes/products.routes');
const adminProductsRoutes = require('./src/routes/admin/products.routes');
const adminOrdersRoutes = require('./src/routes/admin/orders.routes');
const adminCouponsRoutes = require('./src/routes/admin/coupons.routes');
const cartRoutes = require('./src/routes/cart.routes');
const couponRoutes = require('./src/routes/coupon.routes');
const checkoutRoutes = require('./src/routes/checkout.routes');
const webhookRoutes = require('./src/routes/webhook.routes');
const addressRoutes = require('./src/routes/address.routes');
const orderRoutes = require('./src/routes/order.routes');
const officeAddressRoutes = require('./src/routes/office-address.routes');
const adminOfficeAddressesRoutes = require('./src/routes/admin/office-addresses.routes');
const adminSettingsRoutes = require('./src/routes/admin/settings.routes');
const adminDashboardRoutes = require('./src/routes/admin/dashboard.routes');
const adminUsersRoutes = require('./src/routes/admin/users.routes');
const adminNotificationsRoutes = require('./src/routes/admin/notifications.routes');
const wishlistRoutes = require('./src/routes/wishlist.routes');
const adminReviewsRoutes = require('./src/routes/admin/reviews.routes');
const affiliateRoutes = require('./src/routes/affiliate.routes');
const adminAffiliateRoutes = require('./src/routes/admin/affiliates.routes');
const errorMiddleware = require('./src/middlewares/error.middleware');
require('./src/jobs'); // Load and register background job handlers

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());

// // Trust proxy for accurate IP detection
app.set('trust proxy', true);

app.use((req, res, next) => {
  if (req.originalUrl.startsWith('/api/v1/webhooks/phonepe')) return next();
  express.json({ limit: '1000mb' })(req, res, next);
});
app.use(express.urlencoded({ limit: '1000mb', extended: true }));

// Health check route
app.get('/health', (req, res) => {
  res.json({ status: 'OK', timestamp: new Date().toISOString() });
});

// API version 1 health check
app.get('/api/v1/health', (req, res) => {
  res.json({ success: true, data: { status: 'OK', time: new Date().toISOString() } });
});

// Mount Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/storage', storageRoutes);
app.use('/api/v1/categories', categoriesRoutes);
app.use('/api/v1/admin/categories', adminCategoriesRoutes);
app.use('/api/v1/products', productsRoutes);
app.use('/api/v1/admin/products', adminProductsRoutes);
app.use('/api/v1/admin/orders', adminOrdersRoutes);
app.use('/api/v1/admin/coupons', adminCouponsRoutes);
app.use('/api/v1/cart', cartRoutes);
app.use('/api/v1/coupons', couponRoutes);
app.use('/api/v1/checkout', checkoutRoutes);
app.use('/api/v1/webhooks', webhookRoutes);
app.use('/api/v1/addresses', addressRoutes);
app.use('/api/v1/orders', orderRoutes);
app.use('/api/v1/office-addresses', officeAddressRoutes);
app.use('/api/v1/admin/office-addresses', adminOfficeAddressesRoutes);
app.use('/api/v1/admin/settings', adminSettingsRoutes);
app.use('/api/v1/admin/dashboard', adminDashboardRoutes);
app.use('/api/v1/admin/users', adminUsersRoutes);
app.use('/api/v1/admin/notifications', adminNotificationsRoutes);
app.use('/api/v1/wishlist', wishlistRoutes);
app.use('/api/v1/admin/reviews', adminReviewsRoutes);
app.use('/api/v1/affiliate', affiliateRoutes);
app.use('/api/v1/admin', adminAffiliateRoutes);

// Central error handler
app.use(errorMiddleware);

// Only start the server if this file is run directly (not required/imported in tests)
if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
    // Verify SMTP connectivity (non-blocking — logs a warning if unavailable)
    const EmailService = require('./src/services/email.service');
    EmailService.verify();
  });
}

module.exports = app;
