const pool = require('../config/database');
const { v4: uuidv4 } = require('uuid');
const { logger } = require('../utils/logger');

async function logAudit(userId, action, entity_type, entity_id, details) {
  const payload = {
    user_id: userId || null,
    action,
    entity_type,
    entity_id,
    details: details ? String(details) : null,
  };
  try {
    await pool.execute(
      'INSERT INTO audit_log (user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?)',
      [payload.user_id, payload.action, payload.entity_type, payload.entity_id, payload.details, null]
    );
  } catch (e) {
    logger.error('Failed to write audit log', e);
  }
}

module.exports = { logAudit };
