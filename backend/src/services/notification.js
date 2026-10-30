const { logger } = require('../utils/logger');

// Simple stub for notification service. In production, hook to real mail service.
async function sendEmail(to, subject, body) {
  logger.info(`Notification would be sent to ${to} - ${subject}`);
  // Simulate async operation
  return Promise.resolve(true);
}

module.exports = {
  sendEmail
};
