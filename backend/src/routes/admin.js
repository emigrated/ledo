const express = require('express');
const { pool } = require('../config/database');
const { authenticate, authorize } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

router.use(authenticate);
router.use(authorize('admin'));

router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;

    const [users] = await pool.query(
      'SELECT id, name, phone, role, is_active, email_verified, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );

    const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');

    res.json({
      users,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('Admin get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/records', async (req, res) => {
  try {
    const { page = 1, limit = 20, status } = req.query;
    const offset = (page - 1) * limit;

    let query = 'SELECT r.*, u.name as user_name FROM records r JOIN users u ON r.user_id = u.id WHERE 1=1';
    const params = [];

    if (status) {
      query += ' AND r.status = ?';
      params.push(status);
    }

    query += ' ORDER BY r.created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(limit), offset);

    const [records] = await pool.query(query, params);

    res.json({ records });
  } catch (error) {
    logger.error('Admin get records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/records/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;

    await pool.execute(
      'UPDATE records SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?',
      ['approved', req.user.userId, new Date(), id]
    );

    logger.info(`Record approved: ${id} by admin ${req.user.userId}`);

    res.json({ message: 'Record approved' });
  } catch (error) {
    logger.error('Approve record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/records/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    await pool.execute(
      'UPDATE records SET status = ?, approved_by = ?, approved_at = ? WHERE id = ?',
      ['rejected', req.user.userId, new Date(), id]
    );

    logger.info(`Record rejected: ${id} by admin ${req.user.userId}`);

    res.json({ message: 'Record rejected' });
  } catch (error) {
    logger.error('Reject record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/audit-logs', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const offset = (page - 1) * limit;

    const [logs] = await pool.query(
      'SELECT al.*, u.name as username FROM audit_log al LEFT JOIN users u ON al.user_id = u.id ORDER BY al.created_at DESC LIMIT ? OFFSET ?',
      [parseInt(limit), offset]
    );

    res.json({ logs });
  } catch (error) {
    logger.error('Get audit logs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/phone-change-requests', async (req, res) => {
  try {
    const [requests] = await pool.execute(`
      SELECT pcr.*, u.name as user_name, u.id_card, a.name as processed_by_name
      FROM phone_change_requests pcr
      JOIN users u ON pcr.user_id = u.id
      LEFT JOIN users a ON pcr.processed_by = a.id
      ORDER BY pcr.requested_at DESC
    `);
    res.json({ requests });
  } catch (error) {
    logger.error('Get phone change requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/phone-change-requests/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    
    const [requests] = await pool.execute(
      'SELECT * FROM phone_change_requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ error: '申请不存在或已处理' });
    }
    
    const request = requests[0];
    
    await pool.execute(
      'UPDATE phone_change_requests SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?',
      ['approved', adminId, id]
    );
    
    await pool.execute(
      'UPDATE users SET phone = ? WHERE id = ?',
      [request.new_phone, request.user_id]
    );
    
    await pool.execute(
      'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [request.user_id, '手机号修改已通过', `您的手机号修改申请已通过审核，新手机号为 ${request.new_phone}，请使用新手机号登录`, 'approval', 'phone_change_request', id]
    );
    
    logger.info(`Phone change approved: user ${request.user_id}, new phone: ${request.new_phone}`);
    
    res.json({ message: '审核通过' });
  } catch (error) {
    logger.error('Approve phone change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/phone-change-requests/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const adminId = req.user.userId;
    
    const [requests] = await pool.execute(
      'SELECT * FROM phone_change_requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ error: '申请不存在或已处理' });
    }
    
    const request = requests[0];
    
    await pool.execute(
      'UPDATE phone_change_requests SET status = ?, processed_by = ?, processed_at = NOW() WHERE id = ?',
      ['rejected', adminId, id]
    );
    
    await pool.execute(
      'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
      [request.user_id, '手机号修改已拒绝', '您的手机号修改申请已被拒绝，请联系管理员了解原因', 'rejection', 'phone_change_request', id]
    );
    
    logger.info(`Phone change rejected: user ${request.user_id}`);
    
    res.json({ message: '已拒绝' });
  } catch (error) {
    logger.error('Reject phone change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
