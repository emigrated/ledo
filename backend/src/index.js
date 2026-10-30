require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const cron = require('node-cron');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const recordRoutes = require('./routes/records');
const attachmentRoutes = require('./routes/attachments');
const adminRoutes = require('./routes/admin');
const customerRoutes = require('./routes/customer');
const productDataRoutes = require('./routes/product_data');
const optionsRoutes = require('./routes/options');
const changeRequestsRoutes = require('./routes/change_requests');
const maintenanceRoutes = require('./routes/maintenance');
const maintenancePublicRoutes = require('./routes/maintenance_public');
const districtsRoutes = require('./routes/districts');
const shareRoutes = require('./routes/share');
const ordersRoutes = require('./routes/orders');
const updatesRoutes = require('./routes/updates');
const dashboardRoutes = require('./routes/dashboard');
const { syncDistrictsFromAmap } = require('./routes/districts');
const { errorHandler } = require('./middleware/errorHandler');
const { logger } = require('./utils/logger');

const app = express();
app.set('trust proxy', 1);

const PORT = process.env.PORT || 3000;

app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" },
  crossOriginOpenerPolicy: { policy: "same-origin-allow-popups" },
  contentSecurityPolicy: false
}));
app.use(cors({
  origin: process.env.CORS_ORIGIN || '*',
  credentials: true
}));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5000
});
app.use(limiter);

// Body parsing
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Static files for uploads
app.use('/uploads', (req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
}, express.static(path.join(__dirname, '../uploads')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/records', recordRoutes);
app.use('/api/attachments', attachmentRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/customer', customerRoutes);
app.use('/api/product-data', productDataRoutes);
app.use('/api/options', optionsRoutes);
app.use('/api/change-requests', changeRequestsRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/maintenance-public', maintenancePublicRoutes);
app.use('/api/districts', districtsRoutes);
app.use('/api/share', shareRoutes);
app.use('/api/orders', ordersRoutes);
app.use('/api/updates', updatesRoutes);
app.use('/api/dashboard', dashboardRoutes);

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Error handling
app.use(errorHandler);

cron.schedule('0 2 */10 * *', async () => {
  logger.info('Starting scheduled districts sync from Amap...');
  try {
    await syncDistrictsFromAmap('100000', 'province', null);
    logger.info('Scheduled districts sync completed successfully');
  } catch (error) {
    logger.error('Scheduled districts sync failed:', error);
  }
}, {
  scheduled: true,
  timezone: 'Asia/Shanghai'
});
logger.info('Districts sync scheduled: every 10 days at 2:00 AM');

app.listen(PORT, '0.0.0.0', () => {
  logger.info('Server running on port ' + PORT + ' (0.0.0.0)');
});

module.exports = app;
