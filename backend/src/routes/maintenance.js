const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const path = require('path');
const fs = require('fs');
const { authenticate } = require('../middleware/auth');





router.use(authenticate);

const uploadDir = path.join(__dirname, '../../uploads/maintenance');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const fieldMap = {
  '维修单号': 'id',
  '创建时间': 'created_at',
  '省份': 'province',
  '省份adcode': 'province_adcode',
  '城市': 'city',
  '城市adcode': 'city_adcode',
  '区县': 'district',
  '区县adcode': 'district_adcode',
  '镇街道': 'street',
  '镇街道adcode': 'street_adcode',
  '详细地址': 'address',
  '联系人': 'contact',
  '联系电话': 'phone',
  '品牌': 'brand',
  '型号': 'model',
  '类型': 'type',
  '颜色': 'color',
  '电池要求': 'battery_require',
  '设备条码': 'device_sn',
  '购买日期': 'purchase_date',
  '购买平台': 'purchase_platform',
  '订单编号': 'order_no',
  '保修状态': 'warranty_status',
  '返厂原因': 'return_reason',
  '故障描述': 'fault_desc',
  '备注': 'remark',
  '返厂快递': 'return_courier',
  '返厂单号': 'return_tracking_no',
  '寄回快递': 'send_back_courier',
  '寄回单号': 'send_back_tracking_no',
  '登记人': 'registrant',
  '状态': 'status',
  '报修平台': 'repair_platform',
  '支付凭证': 'payment_status',
  '支付凭证图片': 'payment_image',
  '支付驳回原因': 'payment_reject_reason',
  '完成时间': 'completion_time',
  '操作人': 'operator'
};

const dbFields = Object.values(fieldMap);

function toDbField(chinese) {
  return fieldMap[chinese] || chinese;
}

function toChineseField(english) {
  for (const [cn, en] of Object.entries(fieldMap)) {
    if (en === english) return cn;
  }
  return english;
}

function buildSearchWhere(search) {
  if (!search) return { clause: '', values: [] };
  const like = '%' + search + '%';
  const cols = dbFields.map(f => `\`${f}\``);
  const clause = 'WHERE CONCAT(' + cols.join(', ') + ') LIKE ?';
  return { clause, values: [like] };
}

function mapRowToChinese(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const cn = toChineseField(key);
    if (Buffer.isBuffer(value)) {
      result[cn] = value.toString('utf8');
    } else {
      result[cn] = value;
    }
  }
  return result;
}

function mapRowFromChinese(row) {
  if (!row) return row;
  const result = {};
  for (const [key, value] of Object.entries(row)) {
    const en = toDbField(key);
    if ((en === 'completion_time' || en === 'created_at' || en === 'updated_at') && value) {
      if (value instanceof Date) {
        result[en] = value.toISOString().slice(0, 19).replace('T', ' ');
      } else if (typeof value === 'string' && value.includes('T')) {
        result[en] = value.slice(0, 19).replace('T', ' ');
      } else {
        result[en] = value;
      }
    } else if (en === 'purchase_date' && value) {
      if (value instanceof Date) {
        result[en] = value.toISOString().slice(0, 10);
      } else if (typeof value === 'string' && value.includes('T')) {
        result[en] = value.slice(0, 10);
      } else {
        result[en] = value;
      }
    } else {
      result[en] = value;
    }
  }
  return result;
}

// 获取待审核支付凭证列表（必须在 /:id 之前注册）
router.get('/payment-reviews/pending', async (req, res) => {
  const sql = `
    SELECT id, order_no, contact, phone, brand, model, type, color, 
           status, payment_status, payment_image, registrant, created_at, updated_at
    FROM maintenance 
    WHERE status = '待审核' AND payment_status IS NOT NULL
    ORDER BY updated_at DESC
  `;
  try {
    const [rows] = await pool.query(sql);
    res.json({ paymentReviews: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.get('/', async (req, res) => {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;
  const search = req.query.search ? String(req.query.search) : '';
  
  const { clause, values: searchValues } = buildSearchWhere(search);
  const sqlList = `SELECT * FROM maintenance ${clause} ORDER BY 
    CASE 
      WHEN payment_status = '已驳回' THEN 1
      WHEN status = '待处理' THEN 2
      WHEN status = '维修中' THEN 3
      WHEN status = '待审核' THEN 4
      WHEN status = '预登记' THEN 5
      WHEN status = '已完成' THEN 6
      ELSE 7
    END,
    CASE WHEN status = '已完成' THEN completion_time ELSE created_at END DESC
  LIMIT ? OFFSET ?`;
  const dataValues = [...searchValues, limit, offset];
  const sqlCount = `SELECT COUNT(*) as total FROM maintenance ${clause}`;
  const countValues = [...searchValues];

  try {
    await pool.query('SET NAMES utf8mb4');
    const [rows] = await pool.query(sqlList, dataValues);
    const [countRows] = await pool.query(sqlCount, countValues);
    const total = countRows[0]?.total ?? 0;
    const data = rows.map(mapRowToChinese);
    res.json({ page, limit, total, data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.get('/check-courier', async (req, res) => {
  try {
    const { 返厂快递, 返厂单号 } = req.query;
    if (!返厂快递 || !返厂单号) {
      return res.json({ exists: false });
    }
    const [existing] = await pool.execute(
      'SELECT id, registrant FROM maintenance WHERE return_courier = ? AND return_tracking_no = ? LIMIT 1',
      [返厂快递, 返厂单号]
    );
    if (existing.length > 0) {
      return res.json({ exists: true, 维修单号: existing[0].id, 登记人: existing[0].registrant });
    }
    res.json({ exists: false });
  } catch (error) {
    console.error('Check maintenance courier duplicate error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id', async (req, res) => {
  const id = req.params.id;
  const sql = 'SELECT * FROM maintenance WHERE id = ?';
  try {
    const [rows] = await pool.query(sql, [id]);
    if (rows.length === 0) return res.status(404).json({ error: 'Not found' });
    res.json(mapRowToChinese(rows[0]));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.post('/', async (req, res) => {
  const body = req.body || {};
  const dbData = mapRowFromChinese(body);
  
  // 如果没有提供维修单号，自动生成
  if (!dbData.id) {
    const timestamp = Date.now().toString().slice(-6);
    const random = Math.floor(Math.random() * 1000).toString().padStart(3, '0');
    dbData.id = `WX${timestamp}${random}`;
  }
  
  // 新登记记录状态默认为"待处理"
  if (!dbData.status) {
    dbData.status = '待处理';
  }
  
  // 关联用户ID
  if (req.user && req.user.userId) {
    dbData.user_id = req.user.userId;
  }
  
  const columns = [];
  const placeholders = [];
  const values = [];

  for (const [key, value] of Object.entries(dbData)) {
    if (value !== undefined && value !== null && value !== '') {
      columns.push('`' + key + '`');
      placeholders.push('?');
      values.push(value);
    }
  }

  if (columns.length === 0) {
    return res.status(400).json({ error: 'No valid fields provided' });
  }

  const sql = `INSERT INTO maintenance (${columns.join(', ')}) VALUES (${placeholders.join(', ')})`;

  try {
    if (dbData.return_courier && dbData.return_tracking_no) {
      const [dup] = await pool.execute(
        'SELECT id, registrant FROM maintenance WHERE return_courier = ? AND return_tracking_no = ? LIMIT 1',
        [dbData.return_courier, dbData.return_tracking_no]
      );
      if (dup.length > 0) {
        return res.status(409).json({
          error: `该返厂快递单号已登记（维修单号 ${dup[0].id}，登记人 ${dup[0].registrant || '未知'}），请勿重复登记`
        });
      }
    }
    const [result] = await pool.query(sql, values);

    let created = null;
    const [rows] = await pool.query('SELECT * FROM maintenance WHERE id = ?', [dbData.id]);
    created = rows[0] ? mapRowToChinese(rows[0]) : null;

    if (created) {
      res.status(201).json(created);
    } else {
      res.status(201).json({ insertedId: result.insertId, id: dbData.id });
    }
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.put('/:id', async (req, res) => {
  const id = req.params.id;
  const body = req.body || {};
  const dbData = mapRowFromChinese(body);

  if (dbData.status === '已完成') {
    dbData.completion_time = new Date();
    dbData.operator = req.user?.name || '未知';
  }
  
  const setClauses = [];
  const values = [];

  for (const [key, value] of Object.entries(dbData)) {
    if (value !== undefined) {
      setClauses.push('`' + key + '` = ?');
      values.push(value);
    }
  }

  if (setClauses.length === 0) {
    return res.status(400).json({ error: 'No fields provided to update' });
  }

  const sql = `UPDATE maintenance SET ${setClauses.join(', ')} WHERE id = ?`;
  values.push(id);

  try {
    console.log('=== UPDATE maintenance ===');
    console.log('ID:', id);
    console.log('SQL:', sql);
    console.log('Values:', values);

    if (dbData.return_courier && dbData.return_tracking_no) {
      const [dup] = await pool.execute(
        'SELECT id, registrant FROM maintenance WHERE return_courier = ? AND return_tracking_no = ? AND id != ? LIMIT 1',
        [dbData.return_courier, dbData.return_tracking_no, id]
      );
      if (dup.length > 0) {
        return res.status(409).json({
          error: `该返厂快递单号已登记（维修单号 ${dup[0].id}，登记人 ${dup[0].registrant || '未知'}），请勿重复登记`
        });
      }
    }
    
    const [result] = await pool.query(sql, values);
    console.log('Result:', result);

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }

    const [rows] = await pool.query('SELECT * FROM maintenance WHERE id = ?', [id]);
    res.json(mapRowToChinese(rows[0]));
  } catch (err) {
    console.error('=== DATABASE ERROR ===');
    console.error('SQL:', sql);
    console.error('Values:', values);
    console.error('Error code:', err.code);
    console.error('Error number:', err.errno);
    console.error('Error:', err.sqlMessage || err.message);
    res.status(500).json({ error: 'Database error', detail: err.message, sqlError: err.code });
  }
});

router.delete('/:id', async (req, res) => {
  const id = req.params.id;
  try {
    // 1. 查询该记录是否存在
    const [rows] = await pool.query('SELECT id FROM maintenance WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }

    // 2. 删除关联的物理附件文件
    const [attachments] = await pool.query('SELECT file_path FROM maintenance_attachments WHERE maintenance_id = ?', [id]);
    for (const att of attachments) {
      if (att.file_path) {
        try {
          const fullPath = path.resolve(uploadDir, path.basename(att.file_path));
          if (fs.existsSync(fullPath)) {
            fs.unlinkSync(fullPath);
          }
        } catch (fileErr) {
          console.error(`删除附件文件失败: ${att.file_path}`, fileErr.message);
        }
      }
    }

    // 3. 删除关联数据（事务）
    await pool.query('START TRANSACTION');
    
    // 删除附件记录
    await pool.query('DELETE FROM maintenance_attachments WHERE maintenance_id = ?', [id]);
    
    // 删除修改申请记录
    await pool.query('DELETE FROM maintenance_change_requests WHERE maintenance_id = ?', [id]);
    
    // 删除相关通知
    await pool.query('DELETE FROM notifications WHERE related_type IN ("maintenance", "payment_review", "change_request") AND related_id = ?', [id]);
    
    // 删除维修记录本身
    await pool.query('DELETE FROM maintenance WHERE id = ?', [id]);
    
    await pool.query('COMMIT');

    res.status(204).end();
  } catch (err) {
    await pool.query('ROLLBACK').catch(() => {});
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Attachment upload configuration
const multer = require('multer');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    // 修复中文文件名编码
    const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
    cb(null, uniqueSuffix + '-' + originalName);
  }
});
const upload = multer({ storage: storage });

// Get attachments for a maintenance record
router.get('/:id/attachments', async (req, res) => {
  const maintenanceId = req.params.id;
  const sql = 'SELECT * FROM maintenance_attachments WHERE maintenance_id = ? ORDER BY uploaded_at DESC';
  try {
    const [rows] = await pool.query(sql, [maintenanceId]);
    res.json({ attachments: rows });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Upload attachment
router.post('/:id/attachments', upload.single('file'), async (req, res) => {
  const maintenanceId = req.params.id;
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }
  
  const fileType = req.body.file_type || 'attachment';
  const status = req.body.status || 'pending';
  const uploadedBy = req.body.uploaded_by || 'unknown';
  
  const sql = `
    INSERT INTO maintenance_attachments 
    (maintenance_id, filename, original_name, mime_type, file_size, file_path, file_type, status, uploaded_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `;
  
  try {
    const relativePath = '/uploads/maintenance/' + req.file.filename;
    const [result] = await pool.query(sql, [
      maintenanceId,
      req.file.filename,
      req.file.originalname,
      req.file.mimetype,
      req.file.size,
      relativePath,
      fileType,
      status,
      uploadedBy
    ]);
    
    const [rows] = await pool.query('SELECT * FROM maintenance_attachments WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Delete attachment
router.delete('/attachments/:id', async (req, res) => {
  const id = req.params.id;
  
  try {
    const [rows] = await pool.query('SELECT * FROM maintenance_attachments WHERE id = ?', [id]);
    if (rows.length === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const attachment = rows[0];
    // Delete file from disk
    if (attachment.file_path && fs.existsSync(attachment.file_path)) {
      fs.unlinkSync(attachment.file_path);
    }
    
    await pool.query('DELETE FROM maintenance_attachments WHERE id = ?', [id]);
    res.status(204).end();
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Upload payment proof image
const paymentUploadDir = path.join(__dirname, '../../uploads/payment');
if (!fs.existsSync(paymentUploadDir)) {
  fs.mkdirSync(paymentUploadDir, { recursive: true });
}

const paymentUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, paymentUploadDir),
    filename: (req, file, cb) => {
      const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
      const originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      cb(null, uniqueSuffix + '-' + originalName);
    }
  }),
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

router.post('/:id/payment', paymentUpload.single('file'), async (req, res) => {
  const maintenanceId = req.params.id;
  const { payment_status } = req.body;
  
  try {
    let paymentImage = null;
    if (req.file) {
      paymentImage = '/uploads/payment/' + req.file.filename;
    }
    
    // 获取当前记录状态
    const [rows] = await pool.query('SELECT status FROM maintenance WHERE id = ?', [maintenanceId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const currentStatus = rows[0].status;
    
    const updates = [];
    const values = [];
    
    if (payment_status) {
      updates.push('payment_status = ?');
      values.push(payment_status);
    }
    
    if (paymentImage) {
      updates.push('payment_image = ?');
      values.push(paymentImage);
    }
    
    // 选择"无费用"或上传凭证后，状态变为"待审核"（等待管理员审核），清空驳回原因
    if (currentStatus === '待处理' && (payment_status === '无费用' || paymentImage)) {
      updates.push('status = ?');
      values.push('待审核');
      updates.push('payment_reject_reason = NULL');
      updates.push('\`待审核时间\` = NOW()');
    }

    // 选择"拒维修"时，状态强制变为"待处理"
    if (payment_status === '拒维修') {
      updates.push('status = ?');
      values.push('待处理');
      updates.push('payment_reject_reason = NULL');
    }
    
    if (updates.length > 0) {
      values.push(maintenanceId);
      const sql = `UPDATE maintenance SET ${updates.join(', ')} WHERE id = ?`;
      await pool.query(sql, values);
    }
    
    res.json({ success: true, payment_status, payment_image: paymentImage });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// 管理员审核支付凭证
router.post('/:id/payment-approve', async (req, res) => {
  const maintenanceId = req.params.id;
  const { action, rejectReason } = req.body; // 'approved' 或 'rejected'
  
  try {
    const [rows] = await pool.query('SELECT status, payment_status, user_id FROM maintenance WHERE id = ?', [maintenanceId]);
    if (rows.length === 0) {
      return res.status(404).json({ error: '记录不存在' });
    }
    
    const currentStatus = rows[0].status;
    const userId = rows[0].user_id;
    
    if (action === 'approved') {
      // 审核通过，状态变为"维修中"（表示已确认可以开始维修）
      await pool.query('UPDATE maintenance SET status = ?, payment_reject_reason = NULL, 维修中时间 = NOW() WHERE id = ?', ['维修中', maintenanceId]);
      
      // 通知用户审核通过
      if (userId) {
        try {
          await pool.query(
            'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, '维修支付凭证审核通过', `维修单号 ${maintenanceId} 的支付凭证已审核通过`, 'approval', 'payment_review', maintenanceId]
          );
        } catch (notifErr) {
          console.error('Failed to create payment approval notification:', notifErr.message);
        }
      }
    } else if (action === 'rejected') {
      // 审核驳回，状态回到"待处理"，设置支付状态为已驳回，保存驳回原因
      await pool.query('UPDATE maintenance SET status = ?, payment_status = ?, payment_image = NULL, payment_reject_reason = ? WHERE id = ?', ['待处理', '已驳回', rejectReason || '', maintenanceId]);
      
      // 通知用户审核驳回（包含驳回原因）
      if (userId) {
        try {
          const rejectContent = rejectReason 
            ? `维修单号 ${maintenanceId} 的支付凭证已被驳回。驳回原因：${rejectReason}`
            : `维修单号 ${maintenanceId} 的支付凭证已被驳回，请重新提交`;
          await pool.query(
            'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
            [userId, '维修支付凭证审核驳回', rejectContent, 'rejection', 'payment_review', maintenanceId]
          );
        } catch (notifErr) {
          console.error('Failed to create payment rejection notification:', notifErr.message);
        }
      }
    }
    
    res.json({ success: true, message: action === 'approved' ? '审核通过' : '已驳回' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

router.get('/change-requests/pending', async (req, res) => {
  const sql = `
    SELECT mcr.*, 
           m.order_no, m.province, m.city, m.district, m.address, m.contact, m.phone,
           m.brand, m.model, m.type, m.color, m.device_sn, m.purchase_date,
           m.purchase_platform, m.warranty_status, m.return_reason, m.fault_desc,
           m.return_courier, m.return_tracking_no, m.send_back_courier, m.send_back_tracking_no,
           m.registrant, m.status, m.repair_platform, m.payment_status,
           u.name as requested_by_name
    FROM maintenance_change_requests mcr
    LEFT JOIN maintenance m ON mcr.maintenance_id = m.id
    LEFT JOIN users u ON mcr.requested_by = u.id
    WHERE mcr.status = 'pending'
    ORDER BY mcr.requested_at DESC
  `;
  try {
    const [rows] = await pool.query(sql);
    const result = rows.map(row => {
      if (row.changed_fields) {
        const changed = typeof row.changed_fields === 'string' ? JSON.parse(row.changed_fields) : row.changed_fields;
        row.proposed_changes = changed;
      }
      return row;
    });
    res.json({ changeRequests: result });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Get change requests for a maintenance record
router.get('/:id/change-requests', async (req, res) => {
  const maintenanceId = req.params.id;
  const sql = 'SELECT * FROM maintenance_change_requests WHERE maintenance_id = ? ORDER BY requested_at DESC';
  try {
    const [rows] = await pool.query(sql, [maintenanceId]);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Submit change request
router.post('/:id/change-request', async (req, res) => {
  const maintenanceId = req.params.id;
  const changedFields = req.body;
  
  const sql = `
    INSERT INTO maintenance_change_requests 
    (maintenance_id, changed_fields, change_reason, requested_by, status)
    VALUES (?, ?, ?, ?, 'pending')
  `;
  
  try {
    await pool.query('SET NAMES utf8mb4');
    
    const userId = req.headers['x-user-id'] || req.body.requested_by || null;
    
    const [result] = await pool.query(sql, [
      maintenanceId,
      JSON.stringify(changedFields || {}),
      '',
      userId
    ]);
    
    const [maintenanceRows] = await pool.query(
      'SELECT order_no FROM maintenance WHERE id = ?', 
      [maintenanceId]
    );
    const orderNo = maintenanceRows[0]?.order_no || maintenanceId;
    
    let changeSummary = [];
    if (changedFields && typeof changedFields === 'object') {
      for (const [key, value] of Object.entries(changedFields)) {
        if (key === 'requested_by') continue;
        if (value && typeof value === 'object' && value.old !== undefined) {
          changeSummary.push(`${key}: ${value.old || '(空)'} → ${value.new || '(空)'}`);
        } else if (value && typeof value === 'object' && value.new !== undefined) {
          changeSummary.push(`${key}: ${value.new}`);
        } else {
          changeSummary.push(`${key}: ${value}`);
        }
      }
    }
    const changeText = changeSummary.length > 0 ? `修改内容: ${changeSummary.join('; ')}` : '';
    
    const [admins] = await pool.query("SELECT id FROM admins");
    for (const admin of admins) {
      try {
        const title = '维修记录修改待审核';
        const content = `维修单号 ${orderNo} 有新的修改申请需要审核${changeText ? '。' + changeText : ''}`;
        await pool.query(
          'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
          [admin.id, title, content, 'system', 'maintenance_change_request', result.insertId]
        );
      } catch (notifErr) {
        console.error('Failed to create notification:', notifErr.message);
      }
    }
    
    const [rows] = await pool.query('SELECT * FROM maintenance_change_requests WHERE id = ?', [result.insertId]);
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

// Approve/reject change request (for admin)
router.put('/change-requests/:id', async (req, res) => {
  const id = req.params.id;
  const { status, processed_by } = req.body;
  
  if (!['approved', 'rejected'].includes(status)) {
    return res.status(400).json({ error: 'Invalid status' });
  }
  
  const sql = `
    UPDATE maintenance_change_requests 
    SET status = ?, processed_by = ?, processed_at = NOW()
    WHERE id = ?
  `;
  
  try {
    const [result] = await pool.query(sql, [status, processed_by, id]);
    if (result.affectedRows === 0) {
      return res.status(404).json({ error: 'Not found' });
    }
    
    const [crRows] = await pool.query('SELECT * FROM maintenance_change_requests WHERE id = ?', [id]);
    
    // If approved, update the maintenance record and attachments
    if (status === 'approved' && crRows.length > 0) {
      const cr = crRows[0];
      const changedFields = typeof cr.changed_fields === 'string' ? JSON.parse(cr.changed_fields) : cr.changed_fields;
      
      if (changedFields && typeof changedFields === 'object') {
        const setClauses = [];
        const values = [];
        for (const [key, value] of Object.entries(changedFields)) {
          if (key === 'requested_by') continue;
          const dbField = fieldMap[key];
          if (dbField) {
            setClauses.push('`' + dbField + '` = ?');
            let fieldValue = value;
            if (value && typeof value === 'object' && value.new !== undefined) {
              fieldValue = value.new;
            }
            values.push(fieldValue);
          }
        }
        
        if (setClauses.length > 0) {
          const updateSql = `UPDATE maintenance SET ${setClauses.join(', ')} WHERE id = ?`;
          values.push(cr.maintenance_id);
          await pool.query(updateSql, values);
        }
      }
      
      await pool.query(
        'UPDATE maintenance_attachments SET status = ? WHERE maintenance_id = ? AND status = ?',
        ['approved', cr.maintenance_id, 'pending']
      );
      
      if (cr.requested_by) {
        const title = '维修记录修改已通过';
        let changeDetails = [];
        if (changedFields && typeof changedFields === 'object') {
          for (const [key, value] of Object.entries(changedFields)) {
            if (key === 'requested_by') continue;
            if (value && typeof value === 'object' && value.old !== undefined) {
              changeDetails.push(`${key}: ${value.old || '(空)'} → ${value.new || '(空)'}`);
            } else if (value && typeof value === 'object' && value.new !== undefined) {
              changeDetails.push(`${key}: ${value.new}`);
            } else {
              changeDetails.push(`${key}: ${value}`);
            }
          }
        }
        const content = changeDetails.length > 0 
          ? `您的维修记录修改申请已通过审核。修改内容: ${changeDetails.join('; ')}`
          : `您的维修记录修改申请已通过审核`;
        try {
          await pool.query(
            'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
            [cr.requested_by, title, content, 'approval', 'maintenance_change_request', id]
          );
        } catch (notifErr) {
          console.error('Failed to create approval notification:', notifErr.message);
        }
      }
    }
    
    if (status === 'rejected' && crRows[0]?.requested_by) {
      const cr = crRows[0];
      await pool.query(
        'UPDATE maintenance_attachments SET status = ? WHERE maintenance_id = ? AND status = ?',
        ['rejected', cr.maintenance_id, 'pending']
      );
      
      const title = '维修记录修改已拒绝';
      const content = `您的维修记录修改申请已被拒绝，请联系管理员了解原因`;
      try {
        await pool.query(
          'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
          [crRows[0].requested_by, title, content, 'rejection', 'maintenance_change_request', id]
        );
      } catch (notifErr) {
        console.error('Failed to create rejection notification:', notifErr.message);
      }
    }
    
    const [rows] = await pool.query('SELECT * FROM maintenance_change_requests WHERE id = ?', [id]);
    res.json(rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Database error', detail: err.message });
  }
});

module.exports = router;

