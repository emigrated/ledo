const express = require('express');
const fs = require('fs');
const path = require('path');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');
const { logAudit } = require('../utils/audit');
const notificationService = require('../services/notification');

const uploadPath = process.env.UPLOAD_PATH || './uploads';

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, status, category, search, query, from, to } = req.query;
    const offset = (page - 1) * limit;

    let sql = 'SELECT r.*, u.name as user_name FROM records r JOIN users u ON r.user_id = u.id WHERE 1=1';
    let countQuery = 'SELECT COUNT(*) as total FROM records r JOIN users u ON r.user_id = u.id WHERE 1=1';
    const params = [];
    const countParams = [];

    if (req.user.role !== 'admin') {
      sql += ' AND r.user_id = ?';
      countQuery += ' AND r.user_id = ?';
      params.push(req.user.userId);
      countParams.push(req.user.userId);
    }

    if (status) {
      sql += ' AND r.status = ?';
      countQuery += ' AND r.status = ?';
      params.push(status);
      countParams.push(status);
    }

    if (category) {
      sql += ' AND r.category = ?';
      countQuery += ' AND r.category = ?';
      params.push(category);
      countParams.push(category);
    }

    if (search) {
      sql += ' AND (r.title LIKE ? OR r.content LIKE ?)';
      countQuery += ' AND (r.title LIKE ? OR r.content LIKE ?)';
      params.push(`%${search}%`, `%${search}%`);
      countParams.push(`%${search}%`, `%${search}%`);
    }

    if (query) {
      sql += ' AND MATCH (r.title, r.content) AGAINST (? IN NATURAL LANGUAGE MODE)';
      countQuery += ' AND MATCH (r.title, r.content) AGAINST (? IN NATURAL LANGUAGE MODE)';
      const q = query;
      params.push(q);
      countParams.push(q);
    }

    if (from) {
      sql += ' AND r.created_at >= ?';
      countQuery += ' AND r.created_at >= ?';
      params.push(from);
      countParams.push(from);
    }
    if (to) {
      sql += ' AND r.created_at <= ?';
      countQuery += ' AND r.created_at <= ?';
      params.push(to);
      countParams.push(to);
    }

    sql += ' ORDER BY r.created_at DESC';
    countQuery += '';

    const [allRecords] = await pool.execute(sql, params);
    const [countResult] = await pool.execute(countQuery, countParams);

    const start = offset;
    const end = offset + parseInt(limit);
    const records = allRecords.slice(start, end);

    res.json({
      records,
      total: countResult[0].total,
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error('Get records error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Export records - CSV (and future formats)
router.get('/export/csv', async (req, res) => {
  try {
    const { status, category, from, to, query, page = 1, limit = 1000 } = req.query;
    const offset = 0;
    let sql = `SELECT r.id, r.title, r.content, r.category, r.status, r.created_at, u.name as user_name
               FROM records r JOIN users u ON r.user_id = u.id WHERE 1=1`;
    const params = [];
    if (req.user?.role !== 'admin') {
      sql += ' AND r.user_id = ?';
      params.push(req.user.userId);
    }
    if (status) {
      sql += ' AND r.status = ?';
      params.push(status);
    }
    if (category) {
      sql += ' AND r.category = ?';
      params.push(category);
    }
    if (from) {
      sql += ' AND r.created_at >= ?';
      params.push(from);
    }
    if (to) {
      sql += ' AND r.created_at <= ?';
      params.push(to);
    }
    if (query) {
      const q = `%${query}%`;
      sql += ' AND (r.title LIKE ? OR r.content LIKE ?)';
      params.push(q, q);
    }
    sql += ' ORDER BY r.created_at DESC';

    const [rows] = await pool.execute(sql, params);
    // Build CSV
    const header = ['id','title','content','category','status','created_at','user_name'];
    const csv = [header.join(',')].concat(rows.map(r => [r.id, r.title, r.content.replace(/,/g,';'), r.category, r.status, r.created_at, r.user_name].join(','))).join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="records.csv"');
    res.send(csv);
  } catch (error) {
    logger.error('Export CSV error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/',
  body('title').isLength({ min: 1, max: 200 }),
  body('content').optional(),
  body('category').optional(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', details: errors.array() });
      }

      const { title, content, category } = req.body;
      
      const [result] = await pool.execute(
        'INSERT INTO records (user_id, title, content, category, status) VALUES (?, ?, ?, ?, ?)',
        [req.user.userId, title, content || '', category || 'general', 'draft']
      );

      logger.info(`Record created: ${result.insertId} by user ${req.user.userId}`);

      // Send a notification email to the user about new record
      try {
        await notificationService.sendEmail(req.user.email, 'Record Created', `Your record "${title}" has been created.`);
      } catch (notifErr) {
        logger.warn('Notification failed after record creation:', notifErr);
      }

      // Audit log for record creation
      await logAudit(req.user.userId, 'create', 'record', result.insertId, JSON.stringify({ title, category }));

      res.status(201).json({
        message: 'Record created',
        record: { id: result.insertId, title, content, category, status: 'draft' }
      });
    } catch (error) {
      logger.error('Create record error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [records] = await pool.execute(
      'SELECT * FROM records WHERE id = ?',
      [id]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = records[0];
    
    if (req.user.role !== 'admin' && record.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const [attachments] = await pool.execute(
      'SELECT * FROM attachments WHERE record_id = ?',
      [id]
    );

    res.json({ ...record, attachments });
  } catch (error) {
    logger.error('Get record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/:id',
  body('title').optional().isLength({ min: 1, max: 200 }),
  body('content').optional(),
  body('category').optional(),
  body('status').optional().isIn(['draft', 'submitted', 'approved', 'rejected']),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { title, content, category, status } = req.body;

      const [existing] = await pool.execute(
        'SELECT * FROM records WHERE id = ?',
        [id]
      );

      if (existing.length === 0) {
        return res.status(404).json({ error: 'Record not found' });
      }

      const record = existing[0];
      
    if (req.user.role !== 'admin' && record.user_id !== req.user.userId) {
        return res.status(403).json({ error: 'Forbidden' });
      }

      const updates = [];
      const params = [];

      if (title) { updates.push('title = ?'); params.push(title); }
      if (content !== undefined) { updates.push('content = ?'); params.push(content); }
      if (category) { updates.push('category = ?'); params.push(category); }
      if (status) { updates.push('status = ?'); params.push(status); }

      if (updates.length > 0) {
        params.push(id);
        await pool.execute(
          `UPDATE records SET ${updates.join(', ')} WHERE id = ?`,
          params
        );
      }

      logger.info(`Record updated: ${id}`);

      const [updated] = await pool.execute('SELECT * FROM records WHERE id = ?', [id]);
      res.json({ message: 'Record updated', record: updated[0] });
    } catch (error) {
      logger.error('Update record error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { id } = req.params;

    const [existing] = await connection.execute(
      'SELECT * FROM records WHERE id = ?',
      [id]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = existing[0];
    
    if (req.user.role !== 'admin' && record.user_id !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    await connection.beginTransaction();

    // 查询该记录的所有附件
    const [attachments] = await connection.execute(
      'SELECT * FROM attachments WHERE record_id = ?',
      [id]
    );

    // 删除物理文件
    for (const att of attachments) {
      const fullPath = path.join(uploadPath, att.file_path.replace(/^uploads\//, ''));
      if (fs.existsSync(fullPath)) {
        fs.unlinkSync(fullPath);
        logger.info(`Deleted attachment file: ${fullPath}`);
      }
    }

    // 删除附件数据库记录
    if (attachments.length > 0) {
      await connection.execute('DELETE FROM attachments WHERE record_id = ?', [id]);
      logger.info(`Deleted ${attachments.length} attachment records for record ${id}`);
    }

    // 删除记录
    await connection.execute('DELETE FROM records WHERE id = ?', [id]);

    await connection.commit();

    logger.info(`Record deleted: ${id}`);

    res.json({ message: 'Record deleted', deletedAttachments: attachments.length });
  } catch (error) {
    await connection.rollback();
    logger.error('Delete record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    connection.release();
  }
});

module.exports = router;
