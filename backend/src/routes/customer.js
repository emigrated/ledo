const express = require('express');
const { body, validationResult } = require('express-validator');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// 将数据库记录转换为前端可用的格式
const formatRecord = (record) => {
  if (!record) return record;
  
  const formatted = { ...record };
  
  // 将结算字段（int）转换为前端可识别的字符串
  if (typeof formatted.结算 === 'number') {
    formatted.结算 = formatted.结算 === 1 ? '已结算' : '未结算';
  }
  
  return formatted;
};

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = process.env.UPLOAD_PATH || './uploads';
    const date = new Date();
    const subPath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const fullPath = path.join(uploadPath, file.mimetype.split('/')[0], subPath);
    
    if (!fs.existsSync(fullPath)) {
      fs.mkdirSync(fullPath, { recursive: true });
    }
    
    cb(null, fullPath);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    const baseName = path.basename(file.originalname, ext).replace(/[^\x00-\x7F]/g, '') || 'file';
    const date = new Date();
    const subPath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const relativeDir = `image/${subPath}`;
    const uniqueName = `${uuidv4()}_${baseName}${ext}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 500 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf', 'video/mp4', 'video/webm', 'video/ogg', 'video/quicktime'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

const settlementUpload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowedTypes = ['image/jpeg', 'image/png', 'image/gif'];
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type. Only jpg, jpeg, png, gif are allowed.'));
    }
  }
});

router.get('/check-duplicate', async (req, res) => {
  try {
    const { 平台, 订单编号 } = req.query;
    if (!平台 || !订单编号) {
      return res.json({ exists: false });
    }
    const [existing] = await pool.execute(
      'SELECT 登记人 FROM customer WHERE 平台 = ? AND 订单编号 = ? LIMIT 1',
      [平台, 订单编号]
    );
    if (existing.length > 0) {
      return res.json({ exists: true, 登记人: existing[0].登记人 });
    }
    res.json({ exists: false });
  } catch (error) {
    logger.error('Check duplicate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/check-courier', async (req, res) => {
  try {
    const { 快递, 单号 } = req.query;
    if (!快递 || !单号) {
      return res.json({ exists: false });
    }
    const [existing] = await pool.execute(
      'SELECT 登记人 FROM customer WHERE 快递 = ? AND 单号 = ? LIMIT 1',
      [快递, 单号]
    );
    if (existing.length > 0) {
      return res.json({ exists: true, 登记人: existing[0].登记人 });
    }
    res.json({ exists: false });
  } catch (error) {
    logger.error('Check courier duplicate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    const [attachments] = await pool.execute(
      'SELECT id, original_name, mime_type, file_size, file_path, status, uploaded_at FROM attachments WHERE customer_id = ?',
      [id]
    );
    res.json({ attachments });
  } catch (error) {
    logger.error('Get attachments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  try {
    logger.info('Upload attachment request received');
    logger.info('Request body:', req.body);
    logger.info('Request files:', req.file ? 'File exists' : 'No file');
    logger.info('Content-Type:', req.headers['content-type']);
    
    const { id } = req.params;
    // 管理员上传的附件直接生效，不再挂「待审核」
    const status = (req.user && req.user.role === 'admin') ? 'approved' : (req.body.status || 'approved');
    
    if (!req.file) {
      logger.error('No file uploaded');
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const [records] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [id]);
    if (records.length === 0) {
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Record not found' });
    }
    
    const filePath = req.file.path.replace(/\\/g, '/');
    logger.info('File path:', filePath);
    
    const [result] = await pool.execute(
      'INSERT INTO attachments (customer_id, filename, original_name, mime_type, file_size, file_path, status, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
      [id, req.file.filename, req.file.originalname, req.file.mimetype, req.file.size, filePath, status, req.user.userId]
    );
    
    logger.info(`Attachment uploaded: ${result.insertId} for customer ${id} with status ${status}`);
    
    res.status(201).json({
      message: 'File uploaded',
      attachment: {
        id: result.insertId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size,
        status: status
      }
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/attachments/:id', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [attachments] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [id]);
    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    const attachment = attachments[0];
    if (fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }
    
    await pool.execute('DELETE FROM attachments WHERE id = ?', [id]);
    
    logger.info(`Attachment deleted: ${id}`);
    
    res.json({ message: 'Attachment deleted' });
  } catch (error) {
    logger.error('Delete attachment error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员审核附件
router.put('/attachments/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'
    
    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status' });
    }
    
    const [attachments] = await pool.execute('SELECT * FROM attachments WHERE id = ?', [id]);
    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }
    
    await pool.execute('UPDATE attachments SET status = ? WHERE id = ?', [status, id]);
    
    logger.info(`Attachment status updated: ${id} to ${status}`);
    
    res.json({ 
      message: 'Attachment status updated',
      attachment: {
        id,
        status
      }
    });
  } catch (error) {
    logger.error('Update attachment status error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const [records] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    res.json(records[0]);
  } catch (error) {
    logger.error('Get customer record error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/',
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;
      const { 平台, 订单编号 } = req.query;
      
      let dataQuery = 'SELECT * FROM customer';
      let countQuery = 'SELECT COUNT(*) as total FROM customer';
      const params = [];
      const conditions = [];
      
      if (平台 && 平台 !== '') {
        conditions.push('平台 = ?');
        params.push(平台);
      }
      
      if (订单编号 && 订单编号 !== '') {
        conditions.push('订单编号 LIKE ?');
        params.push(`%${订单编号}%`);
      }
      
      if (conditions.length > 0) {
        const whereClause = ' WHERE ' + conditions.join(' AND ');
        dataQuery += whereClause;
        countQuery += whereClause;
      }
      
      dataQuery += ' ORDER BY 创建时间 DESC LIMIT ? OFFSET ?';
      
      const [records] = await pool.query(dataQuery, [...params, limit, offset]);
      const [countResult] = await pool.query(countQuery, params);
      res.json({ records: records.map(formatRecord), total: countResult[0].total, page, limit });
    } catch (error) {
      logger.error('Get customer records error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/search-options', async (req, res) => {
  try {
    const { 平台 } = req.query;
    
    let query = 'SELECT DISTINCT 订单编号 FROM customer WHERE 订单编号 IS NOT NULL AND 订单编号 != ""';
    const params = [];
    
    if (平台 && 平台 !== '') {
      query += ' AND 平台 = ?';
      params.push(平台);
    }
    
    query += ' ORDER BY 创建时间 DESC LIMIT 100';
    
    const [orders] = await pool.execute(query, params);
    res.json({ orderNumbers: orders.map(o => o.订单编号) });
  } catch (error) {
    logger.error('Get search options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/',
  body('订单编号').notEmpty(),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', details: errors.array() });
      }

      const {
        订单编号,
        客户信息,
        购买日期,
        品牌,
        型号,
        类型,
        颜色,
        规格,
        原因,
        状态,
        快递,
        单号,
        备注,
        价格,
        仓库,
        平台,
        运费,
        登记人,
        购买件数,
        退货件数,
        结算
      } = req.body;

      const normalize = (v) => (v === undefined || v === '') ? null : v;

      if (平台 && 订单编号) {
        const [existing] = await pool.execute(
          'SELECT 登记人 FROM customer WHERE 平台 = ? AND 订单编号 = ? LIMIT 1',
          [平台, 订单编号]
        );
        if (existing.length > 0) {
          return res.status(400).json({ error: `该订单已被${existing[0].登记人}登记过了，无需再次登记` });
        }
      }

      if (快递 && 单号) {
        const [existingCourier] = await pool.execute(
          'SELECT 登记人 FROM customer WHERE 快递 = ? AND 单号 = ? LIMIT 1',
          [快递, 单号]
        );
        if (existingCourier.length > 0) {
          return res.status(400).json({ error: '请注意，该快递单号已登记，客户虚假退货，请立即反馈' });
        }
      }

      const [result] = await pool.execute(
        `INSERT INTO customer (
          订单编号, 客户信息, 购买日期, 品牌, 型号, 类型, 颜色, 规格,
          原因, 状态, 快递, 单号, 备注, 价格, 仓库, 平台, 运费, 登记人, 购买件数, 退货件数, 结算, 创建时间
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
        [
          normalize(订单编号), normalize(客户信息), normalize(购买日期), normalize(品牌), normalize(型号), normalize(类型), normalize(颜色), normalize(规格),
          normalize(原因), normalize(状态) || '待处理', normalize(快递), normalize(单号), normalize(备注), normalize(价格), normalize(仓库), normalize(平台), normalize(运费) || 0, normalize(登记人), normalize(购买件数), normalize(退货件数), normalize(结算) || 0
        ]
      );

      logger.info(`Customer record created: ${订单编号}`);

      res.status(201).json({
        message: '退货登记成功',
        id: result.insertId
      });
    } catch (error) {
      logger.error('Create customer record error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      const {
        订单编号,
        客户信息,
        购买日期,
        品牌,
        型号,
        类型,
        颜色,
        规格,
        原因,
        状态,
        快递,
        单号,
        备注,
        价格,
        仓库,
        平台,
        运费,
        登记人,
        购买件数,
        退货件数,
        结算
      } = req.body;

      await pool.execute(
        `UPDATE customer SET
          订单编号 = ?, 客户信息 = ?, 购买日期 = ?, 品牌 = ?, 型号 = ?, 类型 = ?, 颜色 = ?, 规格 = ?,
          原因 = ?, 状态 = ?, 快递 = ?, 单号 = ?, 备注 = ?, 价格 = ?, 仓库 = ?, 平台 = ?, 运费 = ?,
          登记人 = ?, 购买件数 = ?, 退货件数 = ?, 结算 = ?
        WHERE ID = ?`,
        [
          订单编号, 客户信息, 购买日期, 品牌, 型号, 类型, 颜色, 规格,
          原因, 状态, 快递, 单号, 备注, 价格, 仓库, 平台, 运费,
          登记人, 购买件数, 退货件数, 结算, id
        ]
      );

      logger.info(`Customer record updated: ${id}`);

      res.json({ message: '更新成功' });
    } catch (error) {
      logger.error('Update customer record error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      
      const [attachments] = await pool.execute(
        'SELECT file_path FROM attachments WHERE customer_id = ?',
        [id]
      );
      
      for (const att of attachments) {
        if (att.file_path && fs.existsSync(att.file_path)) {
          fs.unlinkSync(att.file_path);
        }
      }
      
      if (attachments.length > 0) {
        await pool.execute('DELETE FROM attachments WHERE customer_id = ?', [id]);
      }
      
      await pool.execute('DELETE FROM customer WHERE ID = ?', [id]);
      logger.info(`Customer record deleted: ${id}`);
      res.json({ message: '删除成功' });
    } catch (error) {
      logger.error('Delete customer record error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/:id/change-request', async (req, res) => {
  try {
    const { id } = req.params;
    const changes = req.body || {};
    
    const IMMUTABLE_FIELDS = ['订单编号', '登记人', 'ID', '创建时间'];
    for (const field of IMMUTABLE_FIELDS) {
      if (changes[field] !== undefined) {
        return res.status(400).json({ error: `字段"${field}"不允许修改` });
      }
    }
    
    const [records] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const [existingChanges] = await pool.execute(
      'SELECT id FROM change_requests WHERE registration_id = ? AND status = ?',
      [id, 'pending']
    );
    
    const isAdmin = !!(req.user && req.user.role === 'admin');
    
    // 管理员直接修改，不受「已有待审核申请」限制
    if (!isAdmin && existingChanges.length > 0) {
      return res.status(400).json({ error: '已存在待审核的修改申请' });
    }
    
    const proposedChanges = JSON.stringify(changes);
    
    const currentRecord = records[0];
    const allowedFields = [
      '订单编号', '客户信息', '购买日期', '品牌', '型号', '类型', '颜色', 
      '规格', '原因', '状态', '快递', '单号', '备注', '价格', '仓库', 
      '平台', '运费', '购买件数', '退货件数'
    ];
    const originalData = {};
    for (const field of allowedFields) {
      if (currentRecord[field] !== undefined) {
        originalData[field] = currentRecord[field];
      }
    }
    const originalDataStr = JSON.stringify(originalData);
    
    // ===== 管理员：直接生效，不入审核队列，但仍写一条已通过的修改记录 =====
    if (isAdmin) {
      const sets = [];
      const values = [];
      const changeDetails = [];
      
      for (const [key, raw] of Object.entries(changes)) {
        if (!allowedFields.includes(key) || IMMUTABLE_FIELDS.includes(key)) continue;
        const newValue = (raw === undefined || raw === null || raw === '') ? null : raw;
        const oldRaw = currentRecord[key];
        const oldStr = (oldRaw === undefined || oldRaw === null) ? '' : String(oldRaw).trim();
        const newStr = newValue === null ? '' : String(newValue).trim();
        if (oldStr === newStr) continue;
        changeDetails.push(`${key}: ${oldStr || '空'} → ${newStr || '空'}`);
        sets.push('`' + key + '` = ?');
        values.push(newValue);
      }
      
      if (sets.length === 0) {
        return res.status(400).json({ error: '没有实际改动' });
      }
      
      await pool.execute(
        `UPDATE customer SET ${sets.join(', ')} WHERE ID = ?`,
        [...values, id]
      );
      
      const [updatedRows] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [id]);
      const updatedRecord = updatedRows[0] || {};
      
      const [result] = await pool.execute(
        'INSERT INTO change_requests (registration_id, applicant_id, proposed_changes, original_data, status, reviewed_by, reviewed_at) VALUES (?, ?, ?, ?, ?, ?, NOW())',
        [id, null, proposedChanges, originalDataStr, 'approved', req.user.userId]
      );
      
      try {
        await pool.execute(
          'INSERT INTO customer_history (registration_id, field_name, old_value, new_value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [id, 'multiple', JSON.stringify({ changes: changeDetails.join(', '), status: 'admin_direct' }), JSON.stringify(updatedRecord), req.user.userId]
        );
      } catch (e) {
        logger.error('Failed to insert admin direct change history:', e);
      }
      
      try {
        await pool.execute(
          'UPDATE attachments SET status = ? WHERE customer_id = ? AND status = ?',
          ['approved', id, 'pending']
        );
      } catch (e) {
        logger.error('Failed to approve pending attachments:', e);
      }
      
      logger.info(`Admin ${req.user.userId} directly updated registration ${id}: ${changeDetails.join('; ')}`);
      
      return res.json({
        message: '修改已生效',
        directModified: true,
        changeRequestId: result.insertId,
        changes: changeDetails
      });
    }
    
    const [result] = await pool.execute(
      'INSERT INTO change_requests (registration_id, applicant_id, proposed_changes, original_data, status) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.userId, proposedChanges, originalDataStr, 'pending']
    );
    
    logger.info(`Change request created for registration ${id} by user ${req.user.userId}`);
    
    res.status(201).json({
      message: '修改申请已提交，等待审核',
      changeRequestId: result.insertId
    });
  } catch (error) {
    logger.error('Create change request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/change-requests', async (req, res) => {
  try {
    const { id } = req.params;
    const [requests] = await pool.execute(
      'SELECT cr.*, u.name as applicant_name FROM change_requests cr LEFT JOIN users u ON cr.applicant_id = u.id WHERE cr.registration_id = ? ORDER BY cr.created_at DESC',
      [id]
    );
    res.json({ changeRequests: requests });
  } catch (error) {
    logger.error('Get change requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/settlement-change', settlementUpload.single('settlement_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const settlement_new_status = req.body.settlement_status || req.body.settlement_new_status;
    const userId = req.user ? req.user.userId : null;

    let settlement_image_url = null;
    if (req.file) {
      const date = new Date();
      const subPath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      settlement_image_url = `/uploads/image/${subPath}/${req.file.filename}`;
    }

    const [records] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const customer = records[0];
    const settlement_old_status = customer.结算 || '未结算';
    
    if (settlement_old_status === '已结算') {
      return res.status(400).json({ error: '该记录已完成结算，无法重复操作' });
    }
    
    const specialReasons = ['无理由', '中途拦截'];
    const isSpecialReason = customer.原因 && specialReasons.includes(customer.原因);
    
    if (!isSpecialReason && settlement_new_status === '已结算' && !settlement_image_url) {
      return res.status(400).json({ error: '请上传结算凭证图片' });
    }
    logger.info('Debug:', { id, userId, settlement_new_status, settlement_old_status, settlement_image_url, isSpecialReason });
    
    const [result] = await pool.execute(
      `INSERT INTO change_requests (
        registration_id, applicant_id, proposed_changes, original_data, status,
        settlement_old_status, settlement_new_status, settlement_image_url, settlement_change_type
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, 
        userId || null, 
        JSON.stringify({ 结算: settlement_new_status }), 
        JSON.stringify({ 结算: settlement_old_status }),
        'pending',
        settlement_old_status,
        settlement_new_status,
        settlement_image_url || null,
        isSpecialReason ? 'admin_direct' : 'normal'
      ]
    );

    const changeRequestId = result.insertId;
    
    logger.info(`Settlement change request created for registration ${id} by user ${userId}`);
    
    res.status(201).json({
      message: isSpecialReason ? '结算状态已更新' : '结算申请已提交，等待审核',
      changeRequestId: changeRequestId
    });
  } catch (error) {
    logger.error('Create settlement change error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/settlement-direct', async (req, res) => {
  try {
    const { id } = req.params;
    const { settlement_status, confirmed } = req.body;
    const userId = req.user ? req.user.userId : null;
    
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ error: '只有管理员可以执行此操作' });
    }
    
    if (!confirmed) {
      return res.status(400).json({ error: '请确认是否修改结算状态' });
    }
    
    const [records] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const customer = records[0];
    // 将数据库中的 int 值转换为字符串用于比较
    const settlement_old_status = customer.结算 === 1 ? '已结算' : '未结算';
    
    if (settlement_old_status === settlement_status) {
      return res.status(400).json({ error: '结算状态未改变' });
    }
    
    // 将字符串转换为 int 值用于数据库更新
    const settlementValue = settlement_status === '已结算' ? 1 : 0;
    await pool.execute(
      'UPDATE customer SET 结算 = ?, 结算状态 = ?, 结算金额 = NULL WHERE ID = ?',
      [settlementValue, settlement_status, id]
    );
    
    logger.info(`Settlement directly updated for registration ${id} by admin ${userId}: ${settlement_old_status} -> ${settlement_status}`);
    
    res.json({
      message: '结算状态已更新',
      settlement_status: settlement_status
    });
  } catch (error) {
    logger.error('Direct settlement update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


router.post('/:id/settlement-amount', settlementUpload.single('settlement_image'), async (req, res) => {
  try {
    const { id } = req.params;
    const amount = req.body.amount;
    
    if (amount === undefined || amount === null || isNaN(Number(amount))) {
      return res.status(400).json({ error: '请输入有效的运费金额' });
    }
    
    const numAmount = parseFloat(Number(amount).toFixed(2));
    if (numAmount < 0) {
      return res.status(400).json({ error: '金额不能为负数' });
    }
    
    const isAdmin = req.user && req.user.role === 'admin';
    
    // 结算凭证改为选填：管理员可先只录金额（页面显示红底待分发），凭证随后批量补齐
    // 普通用户仍走审核流，必须带图
    if (!req.file && !isAdmin) {
      return res.status(400).json({ error: '请上传结算凭证图片' });
    }
    
    const [records] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const record = records[0];
    
    let settlementProofUrl = null;
    if (req.file) {
      const date = new Date();
      const subPath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
      settlementProofUrl = `/uploads/image/${subPath}/${req.file.filename}`;
    }
    
    if (isAdmin) {
      // 管理员：直接更新记录
      await pool.execute(
        'UPDATE customer SET 结算金额 = ?, settlement_proof_url = COALESCE(?, settlement_proof_url), 结算 = 0, 结算状态 = \'未结算\' WHERE ID = ?',
        [numAmount, settlementProofUrl, id]
      );
      
      logger.info(`Settlement amount updated for registration ${id}: ${numAmount}`);
      
      res.json({
        message: '运费金额已录入',
        id: id,
        结算金额: numAmount,
        settlement_proof_url: settlementProofUrl
      });
    } else {
      // 普通用户：创建待审核的 change_request
      const [existingPending] = await pool.execute(
        "SELECT id FROM change_requests WHERE registration_id = ? AND status = 'pending' AND settlement_new_status IS NOT NULL",
        [id]
      );
      if (existingPending.length > 0) {
        return res.status(400).json({ error: '该记录已存在待审核的结算申请' });
      }
      
      const userId = req.user ? req.user.userId : null;
      
      const [crResult] = await pool.execute(
        "INSERT INTO change_requests (registration_id, applicant_id, proposed_changes, original_data, status, settlement_old_status, settlement_new_status, settlement_image_url, settlement_change_type) VALUES (?, ?, ?, ?, 'pending', ?, '已结算', ?, 'normal')",
        [id, userId, JSON.stringify({ 结算金额: numAmount }), JSON.stringify(record), record.结算状态 || '未结算', settlementProofUrl]
      );
      
      const changeRequestId = crResult.insertId;
      
      // 通知所有管理员
      try {
        const [admins] = await pool.execute("SELECT id FROM admins");
        const orderNo = record.订单编号 || '';
        for (const adminUser of admins) {
          await pool.execute(
            "INSERT INTO notifications (user_id, type, title, content, related_type, related_id) VALUES (?, 'approval', ?, ?, 'settlement', ?)",
            [adminUser.id, `结算审核申请：${orderNo}`, `用户提交了结算申请，金额：${numAmount}元，请审核`, changeRequestId]
          );
        }
      } catch (notifErr) {
        logger.error('Failed to notify admins:', notifErr);
      }
      
      logger.info(`Settlement change request created for registration ${id} by user ${userId}: ${numAmount}`);
      
      res.status(201).json({
        message: '结算申请已提交，等待审核',
        changeRequestId: changeRequestId
      });
    }
  } catch (error) {
    logger.error('Settlement amount update error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 批量分发结算凭证：上传一次凭证，写入多条记录的 settlement_proof_url
router.post('/batch-settlement-proof', settlementUpload.single('settlement_image'), async (req, res) => {
  try {
    const isAdmin = req.user && req.user.role === 'admin';
    if (!isAdmin) {
      return res.status(403).json({ error: '仅管理员可执行批量分发' });
    }

    let ids;
    try {
      ids = JSON.parse(req.body.ids || '[]');
    } catch (e) {
      return res.status(400).json({ error: 'ids 参数格式错误' });
    }
    ids = (Array.isArray(ids) ? ids : []).map(v => parseInt(v, 10)).filter(v => !isNaN(v));
    if (ids.length === 0) {
      return res.status(400).json({ error: '请选择要分发的记录' });
    }
    if (!req.file) {
      return res.status(400).json({ error: '请上传结算凭证图片' });
    }

    const date = new Date();
    const subPath = `${date.getFullYear()}/${String(date.getMonth() + 1).padStart(2, '0')}/${String(date.getDate()).padStart(2, '0')}`;
    const settlementProofUrl = `/uploads/image/${subPath}/${req.file.filename}`;

    const placeholders = ids.map(() => '?').join(',');

    // 只处理已录入金额的记录，避免把凭证写到空单上
    const [targets] = await pool.execute(
      `SELECT ID FROM customer WHERE ID IN (${placeholders}) AND 结算金额 IS NOT NULL`,
      ids
    );
    const validIds = targets.map(r => r.ID);
    if (validIds.length === 0) {
      return res.status(400).json({ error: '所选记录均未录入结算金额' });
    }

    const validPh = validIds.map(() => '?').join(',');
    await pool.execute(
      `UPDATE customer SET settlement_proof_url = ?, 结算 = 0, 结算状态 = '未结算' WHERE ID IN (${validPh})`,
      [settlementProofUrl, ...validIds]
    );

    // 写分发痕迹，便于日后追溯这张凭证发给了哪些单
    try {
      for (const rid of validIds) {
        await pool.execute(
          'INSERT INTO settlement_records (registration_id, image_url, image_name, image_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [rid, settlementProofUrl, req.file.originalname, req.file.mimetype, 'distributed', req.user?.userId || null]
        );
      }
    } catch (logErr) {
      logger.error('Failed to write settlement_records:', logErr);
    }

    logger.info(`Batch settlement proof distributed to ${validIds.length} records by user ${req.user?.userId}`);

    res.json({
      message: `已分发到 ${validIds.length} 条记录`,
      count: validIds.length,
      ids: validIds,
      settlement_proof_url: settlementProofUrl
    });
  } catch (error) {
    logger.error('Batch settlement proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/settlement-cancel', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [records] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    // Clear settlement amount, proof URL, and reset to unsettled
    await pool.execute(
      "UPDATE customer SET 结算金额 = NULL, settlement_proof_url = NULL, 结算 = 0, 结算状态 = '未结算' WHERE ID = ?",
      [id]
    );
    
    // Cancel all pending settlement change_requests for this record
    await pool.execute(
      "UPDATE change_requests SET status = 'rejected', rejection_reason = '已被管理员清除结算' WHERE registration_id = ? AND status = 'pending' AND settlement_new_status IS NOT NULL",
      [id]
    );
    
    logger.info(`Settlement cancelled for registration ${id}`);
    
    res.json({
      message: '结算已取消',
      id: id
    });
  } catch (error) {
    logger.error('Settlement cancel error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员直接清除结算凭证（保留结算金额，同时清理所有关联的 change_request 凭证）
router.delete('/:id/settlement-proof', async (req, res) => {
  try {
    const { id } = req.params;
    
    const [records] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [id]);
    if (records.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const record = records[0];
    
    // 删除客户记录上的物理文件（若该凭证被其他记录共享则保留文件，只清字段）
    if (record.settlement_proof_url) {
      const [shared] = await pool.execute(
        'SELECT COUNT(*) as cnt FROM customer WHERE settlement_proof_url = ? AND ID <> ?',
        [record.settlement_proof_url, id]
      );
      if (shared[0].cnt > 0) {
        logger.info(`Settlement proof ${record.settlement_proof_url} still used by ${shared[0].cnt} other record(s), file kept`);
      } else {
        const filePath = path.join(__dirname, '..', '..', record.settlement_proof_url);
        try {
          if (fs.existsSync(filePath)) {
            fs.unlinkSync(filePath);
            logger.info(`Deleted settlement proof file: ${filePath}`);
          }
        } catch (fileErr) {
          logger.error('Failed to delete settlement proof file:', fileErr);
        }
      }
    }
    
    // 也清理 pending change_requests 中的图片文件
    const [pendingCRs] = await pool.execute(
      "SELECT * FROM change_requests WHERE registration_id = ? AND settlement_new_status IS NOT NULL AND settlement_image_url IS NOT NULL",
      [id]
    );
    for (const cr of pendingCRs) {
      if (cr.settlement_image_url) {
        const crFilePath = path.join(__dirname, '..', '..', cr.settlement_image_url);
        try {
          if (fs.existsSync(crFilePath)) {
            fs.unlinkSync(crFilePath);
            logger.info(`Deleted change_request settlement image: ${crFilePath}`);
          }
        } catch (fileErr) {
          logger.error('Failed to delete change_request settlement image:', fileErr);
        }
      }
    }
    await pool.execute(
      "UPDATE change_requests SET settlement_image_url = NULL WHERE registration_id = ? AND settlement_new_status IS NOT NULL",
      [id]
    );
    
    // 清除客户记录上的 settlement_proof_url
    await pool.execute(
      'UPDATE customer SET settlement_proof_url = NULL WHERE ID = ?',
      [id]
    );
    
    logger.info(`Settlement proof cleared for registration ${id}`);
    
    res.json({ message: '结算凭证已清除' });
  } catch (error) {
    logger.error('Clear settlement proof error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


module.exports = router;