const express = require('express');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const IMMUTABLE_FIELDS = ['订单编号', '登记人', 'ID', '创建时间'];

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [crResult] = await pool.execute(
      "SELECT COUNT(*) as total FROM change_requests WHERE status = 'pending'"
    );
    const [maintResult] = await pool.execute(
      "SELECT COUNT(*) as total FROM maintenance_change_requests WHERE status = 'pending'"
    );
    const total = (crResult[0]?.total || 0) + (maintResult[0]?.total || 0);
    res.json({ total });
  } catch (error) {
    logger.error('Get pending count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/:id/attachments', async (req, res) => {
  try {
    const { id } = req.params;
    const [attachments] = await pool.execute(
      'SELECT id, original_name, mime_type, file_size, file_path, status, uploaded_at FROM attachments WHERE change_request_id = ?',
      [id]
    );
    res.json({ attachments });
  } catch (error) {
    logger.error('Get change request attachments error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/', async (req, res) => {
  try {
    const { status, limit = 20, offset = 0 } = req.query;
    
    let whereClause = '';
    const params = [];
    
    if (status) {
      whereClause = 'WHERE cr.status = ?';
      params.push(status);
    }
    
    const [countResult] = await pool.execute(
      `SELECT COUNT(*) as total FROM change_requests cr ${whereClause}`,
      params
    );
    
    const limitNum = parseInt(limit) || 20;
    const offsetNum = parseInt(offset) || 0;
    
    let sql = `SELECT cr.*, c.订单编号, c.登记人, c.客户信息, c.购买日期, c.品牌, c.型号, c.类型, c.颜色, c.规格, c.原因, c.状态, c.快递, c.单号, c.备注, c.价格, c.仓库, c.平台, c.运费, c.购买件数, c.退货件数, u.name as applicant_name 
       FROM change_requests cr 
       LEFT JOIN customer c ON cr.registration_id = c.ID 
       LEFT JOIN users u ON cr.applicant_id = u.id 
       ${whereClause}
       ORDER BY cr.created_at DESC 
       LIMIT ${limitNum} OFFSET ${offsetNum}`;
    
    const [requests] = await pool.execute(sql, params);
    
    res.json({ 
      changeRequests: requests, 
      total: countResult[0].total 
    });
  } catch (error) {
    logger.error('Get change requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/change-request', async (req, res) => {
  try {
    const { id } = req.params;
    const changes = req.body;
    
    if (!changes || Object.keys(changes).length === 0) {
      return res.status(400).json({ error: '没有修改内容' });
    }
    
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
    
    const existingChanges = await pool.execute(
      'SELECT id FROM change_requests WHERE registration_id = ? AND status = ?',
      [id, 'pending']
    );
    
    if (existingChanges[0].length > 0) {
      return res.status(400).json({ error: '已存在待审核的修改申请' });
    }
    
    const proposedChanges = JSON.stringify(changes);
    
    const [currentRecord] = await pool.execute(
      'SELECT * FROM customer WHERE ID = ?',
      [id]
    );
    
    const originalData = currentRecord.length > 0 ? JSON.stringify(currentRecord[0]) : '{}';
    
    const [result] = await pool.execute(
      'INSERT INTO change_requests (registration_id, applicant_id, proposed_changes, original_data, status) VALUES (?, ?, ?, ?, ?)',
      [id, req.user.userId, proposedChanges, originalData, 'pending']
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

router.get('/pending', async (req, res) => {
  try {
    const [requests] = await pool.execute(
      `SELECT cr.*, c.订单编号, c.登记人, c.客户信息, c.购买日期, c.品牌, c.型号, c.类型, c.颜色, c.规格, c.原因, c.状态, c.快递, c.单号, c.备注, c.价格, c.仓库, c.平台, c.运费, c.购买件数, c.退货件数, u.name as applicant_name 
       FROM change_requests cr 
       LEFT JOIN customer c ON cr.registration_id = c.ID 
       LEFT JOIN users u ON cr.applicant_id = u.id 
       WHERE cr.status = 'pending' 
       ORDER BY cr.created_at DESC`
    );
    res.json({ changeRequests: requests });
  } catch (error) {
    logger.error('Get pending change requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    let notifications;
    if (req.user.role === 'admin') {
      const [adminNotifications] = await pool.execute(
        "SELECT n.*, u.name as from_user_name, u.phone as from_user_phone FROM notifications n LEFT JOIN users u ON n.related_id = u.id WHERE n.type IN ('bug', 'issue', 'suggestion') ORDER BY n.created_at DESC LIMIT 100"
      );
      notifications = adminNotifications;
    } else {
      const [userNotifications] = await pool.execute(
        "SELECT * FROM notifications WHERE user_id = ? AND type NOT IN ('bug', 'issue', 'suggestion') ORDER BY created_at DESC LIMIT 50",
        [userId]
      );
      notifications = userNotifications;
    }
    
    // 为维修相关的通知附加附件信息
    for (const notif of notifications) {
      if (notif.related_type === 'maintenance_change_request' && notif.related_id) {
        try {
          const [attachments] = await pool.execute(
            'SELECT ma.* FROM maintenance_attachments ma ' +
            'INNER JOIN maintenance_change_requests mcr ON ma.maintenance_id = mcr.maintenance_id ' +
            'WHERE mcr.id = ? AND ma.status = "pending" ' +
            'ORDER BY ma.uploaded_at DESC',
            [notif.related_id]
          );
          notif.attachments = attachments;
          notif.attachment_count = attachments.length;
        } catch (e) {
          console.error('获取通知附件失败:', e.message);
          notif.attachments = [];
          notif.attachment_count = 0;
        }
      }
    }
    
    res.json({ notifications });
  } catch (error) {
    logger.error('Get notifications error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/notifications/unread-count', async (req, res) => {
  try {
    const userId = req.user.userId;
    
    let count;
    if (req.user.role === 'admin') {
      const [result] = await pool.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE is_read = FALSE AND (type IN ('bug', 'issue', 'suggestion') OR related_type = 'payment_review')"
      );
      count = result[0].count;
    } else {
      const [result] = await pool.execute(
        "SELECT COUNT(*) as count FROM notifications WHERE user_id = ? AND is_read = FALSE AND type NOT IN ('bug', 'issue', 'suggestion')",
        [userId]
      );
      count = result[0].count;
    }
    res.json({ unreadCount: count });
  } catch (error) {
    logger.error('Get unread count error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notifications/:id/read', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      'UPDATE notifications SET is_read = TRUE WHERE id = ? AND user_id = ?',
      [id, req.user.userId]
    );
    res.json({ message: '已标记为已读' });
  } catch (error) {
    logger.error('Mark as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/notifications/read-all', async (req, res) => {
    try {
    if (req.user.role === 'admin') {
      await pool.execute('UPDATE notifications SET is_read = TRUE');
    } else {
      await pool.execute(
        'UPDATE notifications SET is_read = TRUE WHERE user_id = ?',
        [req.user.userId]
      );
    }
    res.json({ message: '已全部标记为已读' });
  } catch (error) {
    logger.error('Mark all as read error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/feedback', async (req, res) => {
  try {
    const { title, content, type = 'bug' } = req.body;
    
    if (!title || !content) {
      return res.status(400).json({ error: '请填写标题和内容' });
    }
    
    const [admins] = await pool.execute("SELECT id FROM admins");
    
    if (admins.length > 0) {
      const typeLabels = {
        bug: 'BUG反馈',
        issue: '问题反馈',
        suggestion: '建议反馈'
      };
      
      for (const admin of admins) {
        await pool.execute(
          'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
          [
            admin.id,
            `${typeLabels[type] || '反馈'}: ${title}`,
            content,
            type,
            'feedback',
            req.user.userId
          ]
        );
      }
    }
    
    res.json({ message: '感谢您的反馈，我们会尽快处理' });
  } catch (error) {
    logger.error('Submit feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/:id/approve', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [requests] = await pool.execute(
      'SELECT * FROM change_requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ error: '没有待审核的修改申请' });
    }
    
    const request = requests[0];
    const proposedChanges = JSON.parse(request.proposed_changes);
    
    const [oldCustomer] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [request.registration_id]);
    const customer = oldCustomer[0];
    const orderNo = customer['订单编号'] || '';
    
    const allowedFields = [
      '订单编号', '客户信息', '购买日期', '品牌', '型号', '类型', '颜色', 
      '规格', '原因', '状态', '快递', '单号', '备注', '价格', 
      '仓库', '平台', '运费', '购买件数', '退货件数'
    ];
    
    const updates = [];
    const values = [];
    const changeDetails = [];
    
    for (const [key, value] of Object.entries(proposedChanges)) {
      if (allowedFields.includes(key) && !IMMUTABLE_FIELDS.includes(key)) {
        const oldValue = customer[key] || '空';
        if (String(oldValue) !== String(value)) {
          changeDetails.push(`${key}: ${oldValue} → ${value}`);
        }
        updates.push(`${key} = ?`);
        values.push(value);
      }
    }
    
    if (request.settlement_new_status && request.settlement_new_status !== request.settlement_old_status) {
      changeDetails.push(`结算: ${request.settlement_old_status || '空'} → ${request.settlement_new_status}`);
    }
    
    if (updates.length > 0) {
      values.push(request.registration_id);
      await pool.execute(
        `UPDATE customer SET ${updates.join(', ')} WHERE ID = ?`,
        values
      );
    }
    
    if (request.settlement_new_status && request.settlement_new_status !== request.settlement_old_status) {
      // 解析 proposed_changes 中的结算金额
      let settlementAmount = null;
      try {
        const proposed = JSON.parse(request.proposed_changes);
        if (proposed.结算金额) {
          settlementAmount = proposed.结算金额;
        }
      } catch (e) {
        logger.error('Failed to parse proposed_changes for settlement amount:', e);
      }
      
      if (settlementAmount) {
        // 新版审核流程：有金额的结算
        if (request.settlement_image_url) {
          await pool.execute(
            'UPDATE customer SET 结算金额 = ?, settlement_proof_url = ?, 结算 = 0, 结算状态 = ? WHERE ID = ?',
            [settlementAmount, request.settlement_image_url, '未结算', request.registration_id]
          );
        } else {
          await pool.execute(
            'UPDATE customer SET 结算金额 = ?, 结算 = 0, 结算状态 = ? WHERE ID = ?',
            [settlementAmount, '未结算', request.registration_id]
          );
        }
      } else {
        // 旧版结算变更（无金额，仅变更状态）
        const settlementValue = request.settlement_new_status === '已结算' ? 1 : 0;
        await pool.execute(
          'UPDATE customer SET 结算 = ?, 结算状态 = ? WHERE ID = ?',
          [settlementValue, request.settlement_new_status, request.registration_id]
        );
        
        if (request.settlement_image_url) {
          await pool.execute(
            'UPDATE customer SET settlement_proof_url = ? WHERE ID = ?',
            [request.settlement_image_url, request.registration_id]
          );
        }
      }
    }
    
    await pool.execute(
      'UPDATE change_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['approved', req.user.userId, id]
    );

    // 更新该 change_request 相关的附件状态为 approved
    await pool.execute(
      'UPDATE attachments SET status = ? WHERE change_request_id = ?',
      ['approved', id]
    );
    
    try {
      await pool.execute(
        'UPDATE attachments SET status = ? WHERE customer_id = ? AND status = ? AND change_request_id IS NULL',
        ['approved', request.registration_id, 'pending']
      );
    } catch (e) {
      logger.error('Failed to update pending attachments:', e);
    }
    
    try {
      await pool.execute(
        'INSERT INTO settlement_records (registration_id, image_url, image_name, image_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
        [request.registration_id, '', '', 'image/jpeg', 'approved', request.applicant_id || null]
      );
    } catch (e) {
      logger.error('Failed to insert settlement record:', e);
    }
    
    try {
    const [admins] = await pool.execute("SELECT id FROM admins");
      for (const adminUser of admins) {
        await pool.execute(
          'INSERT INTO notifications (user_id, type, title, content, related_id) VALUES (?, ?, ?, ?, ?)',
          [adminUser.id, 'approval', '修改申请已通过', `订单编号 ${orderNo} 的修改申请已通过审核`, id]
        );
      }
    } catch (e) {
      logger.error('Failed to insert admin notifications:', e);
    }
    
    try {
      if (request.applicant_id) {
        const [existingNotif] = await pool.execute(
          'SELECT id FROM notifications WHERE user_id = ? AND related_id = ? AND type = ?',
          [request.applicant_id, id, 'system']
        );
        if (existingNotif.length > 0) {
          await pool.execute('DELETE FROM notifications WHERE id = ?', [existingNotif[0].id]);
        }
      }
    } catch (e) {
      logger.error('Failed to handle existing notification:', e);
    }
    
    // 结算审核的通知内容
    if (request.settlement_new_status && request.settlement_new_status !== request.settlement_old_status) {
      try {
        if (request.applicant_id) {
          // 检查是否有结算金额（新版审核流程）
          let settlementAmount = null;
          try {
            const proposed = JSON.parse(request.proposed_changes);
            if (proposed.结算金额) {
              settlementAmount = proposed.结算金额;
            }
          } catch (e) {}
          
          if (settlementAmount) {
            const title = `结算审核通过：【订单编号：${orderNo}】`;
            const content = `您的结算申请已通过审核，结算金额：${settlementAmount}元`;
            await pool.execute(
              'INSERT INTO notifications (user_id, type, title, content, related_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
              [request.applicant_id, 'approval', title, content, id]
            );
          } else {
            const title = `结算审核通过：【订单编号：${orderNo}】`;
            const content = `您的结算申请已通过审核`;
            await pool.execute(
              'INSERT INTO notifications (user_id, type, title, content, related_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
              [request.applicant_id, 'approval', title, content, id]
            );
          }
        }
      } catch (e) {
        logger.error('Failed to insert settlement approval notification:', e);
      }
    }
    
    if (changeDetails.length > 0) {
      try {
        if (request.applicant_id) {
          const title = `修改审核通过：【订单编号：${orderNo}】`;
          const content = `您的退货登记修改申请已通过审核。修改内容: ${changeDetails.join('; ')}`;
          await pool.execute(
            'INSERT INTO notifications (user_id, type, title, content, related_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [request.applicant_id, 'approval', title, content, id]
          );
        }
        
        const [updatedCustomer] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [request.registration_id]);
        
        await pool.execute(
          'INSERT INTO customer_history (registration_id, field_name, old_value, new_value, changed_by, changed_at) VALUES (?, ?, ?, ?, ?, NOW())',
          [request.registration_id, 'multiple', JSON.stringify({ changes: changeDetails.join(', '), status: 'approved' }), JSON.stringify(updatedCustomer[0]), req.user.userId]
        );
      } catch (e) {
        logger.error('Failed to insert user notification or history:', e);
      }
    }
    
    logger.info(`Change request ${id} approved by admin ${req.user.userId}`);
    
    res.json({ message: '审核通过' });
  } catch (error) {
    logger.error('Approve change request error:', error);
    res.status(500).json({ error: `Internal server error: ${error.message || 'Unknown error'}` });
  }
});

router.post('/:id/reject', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    
    if (!reason || reason.trim() === '') {
      return res.status(400).json({ error: '请填写拒绝原因' });
    }
    
    const [requests] = await pool.execute(
      'SELECT * FROM change_requests WHERE id = ? AND status = ?',
      [id, 'pending']
    );
    
    if (requests.length === 0) {
      return res.status(404).json({ error: '没有待审核的修改申请' });
    }
    
    const request = requests[0];
    
    await pool.execute(
      'UPDATE change_requests SET status = ?, rejection_reason = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
      ['rejected', reason, req.user.userId, id]
    );
    
    const [customer] = await pool.execute(
      'SELECT 登记人, 订单编号 FROM customer WHERE ID = ?',
      [request.registration_id]
    );
    
    const orderNo = customer.length > 0 ? (customer[0].订单编号 || '') : '';
    
    if (customer.length > 0 && customer[0].登记人) {
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE name = ?',
        [customer[0].登记人]
      );
      
      if (users.length > 0) {
        // 检查是否是结算审核拒绝
        const isSettlementRejection = request.settlement_new_status ? true : false;
        const title = orderNo ? `修改审核被拒绝：【订单编号：${orderNo}】` : '修改审核被拒绝';
        const content = isSettlementRejection
          ? `您的结算申请被拒绝，原因：${reason}`
          : `您的退货登记修改申请被拒绝，原因：${reason}`;
        
        await pool.execute(
          'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
          [
            users[0].id,
            title,
            content,
            'rejection',
            'change_request',
            id
          ]
        );
      }
    }
    
    logger.info(`Change request ${id} rejected by admin ${req.user.userId}`);
    
    res.json({ message: '已拒绝' });
  } catch (error) {
    logger.error('Reject change request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/batch-approve', authorize('admin'), async (req, res) => {
  try {
    const { ids } = req.body;
    
    if (!ids || !Array.isArray(ids) || ids.length === 0) {
      return res.status(400).json({ error: '请选择要审核的记录' });
    }
    
    let approvedCount = 0;
    
    for (const id of ids) {
      const [requests] = await pool.execute(
        'SELECT * FROM change_requests WHERE id = ? AND status = ?',
        [id, 'pending']
      );
      
      if (requests.length === 0) continue;
      
      const request = requests[0];
      const proposedChanges = JSON.parse(request.proposed_changes);
      
      const [oldCustomer] = await pool.execute('SELECT * FROM customer WHERE ID = ?', [request.registration_id]);
      const customer = oldCustomer[0];
      const orderNo = customer['订单编号'] || '';
      
      const allowedFields = [
        '订单编号', '客户信息', '购买日期', '品牌', '型号', '类型', '颜色', 
        '规格', '原因', '状态', '快递', '单号', '备注', '价格', 
        '仓库', '平台', '运费', '购买件数', '退货件数'
      ];
      
      const updates = [];
      const values = [];
      const changeDetails = [];
      
      for (const [key, value] of Object.entries(proposedChanges)) {
        if (allowedFields.includes(key) && !IMMUTABLE_FIELDS.includes(key)) {
          const oldValue = customer[key] || '空';
          if (String(oldValue) !== String(value)) {
            changeDetails.push(`${key}: ${oldValue} → ${value}`);
          }
          updates.push(`${key} = ?`);
          values.push(value);
        }
      }
      
      if (request.settlement_new_status && request.settlement_new_status !== request.settlement_old_status) {
        changeDetails.push(`结算: ${request.settlement_old_status || '空'} → ${request.settlement_new_status}`);
      }
      
      if (updates.length > 0) {
        values.push(request.registration_id);
        await pool.execute(
          `UPDATE customer SET ${updates.join(', ')} WHERE ID = ?`,
          values
        );
      }

      if (changeDetails.length > 0 && request.applicant_id) {
        try {
          const title = `修改审核通过：【订单编号：${orderNo}】`;
          const content = `您的退货登记修改申请已通过审核。修改内容: ${changeDetails.join('; ')}`;
          await pool.execute(
            'INSERT INTO notifications (user_id, type, title, content, related_id, created_at) VALUES (?, ?, ?, ?, ?, NOW())',
            [request.applicant_id, 'approval', title, content, id]
          );
        } catch (e) {
          logger.error('Failed to insert notification:', e);
        }
      }

      if (request.settlement_new_status && request.settlement_new_status !== request.settlement_old_status) {
        // 将结算状态转换为整数：未结算=0, 已结算=1
        const settlementValue = request.settlement_new_status === '已结算' ? 1 : 0;
        await pool.execute(
          'UPDATE customer SET 结算 = ?, 结算状态 = ? WHERE ID = ?',
          [settlementValue, request.settlement_new_status, request.registration_id]
        );
        
        if (request.settlement_image_url) {
          await pool.execute(
            'UPDATE customer SET settlement_proof_url = ? WHERE ID = ?',
            [request.settlement_image_url, request.registration_id]
          );
        }
      }
      
      await pool.execute(
        'UPDATE change_requests SET status = ?, reviewed_by = ?, reviewed_at = NOW() WHERE id = ?',
        ['approved', req.user.userId, id]
      );
      
      await pool.execute(
        'UPDATE attachments SET status = ? WHERE change_request_id = ?',
        ['approved', id]
      );
      
      try {
        await pool.execute(
          'UPDATE attachments SET status = ? WHERE customer_id = ? AND status = ? AND change_request_id IS NULL',
          ['approved', request.registration_id, 'pending']
        );
      } catch (e) {
        logger.error('Failed to update pending attachments:', e);
      }
      
      try {
        await pool.execute(
          'INSERT INTO settlement_records (registration_id, image_url, image_name, image_type, status, created_by) VALUES (?, ?, ?, ?, ?, ?)',
          [request.registration_id, '', '', 'image/jpeg', 'approved', request.applicant_id || null]
        );
      } catch (e) {
        logger.error('Failed to insert settlement record:', e);
      }
      
      approvedCount++;
    }
    
    logger.info(`Batch approved ${approvedCount} change requests by admin ${req.user.userId}`);
    
    res.json({ message: `批量审核完成，已通过 ${approvedCount} 条` });
  } catch (error) {
    logger.error('Batch approve error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员获取用户反馈列表
router.get('/feedback/admin', authorize('admin'), async (req, res) => {
  try {
    const [feedbacks] = await pool.execute(
      "SELECT n.*, u.name as submitter_name, u.phone as submitter_phone " +
      "FROM notifications n " +
      "LEFT JOIN users u ON n.related_id = u.id " +
      "WHERE n.related_type = 'feedback' AND n.type IN ('bug', 'issue', 'suggestion') " +
      "ORDER BY n.created_at DESC"
    );
    res.json({ feedbacks });
  } catch (error) {
    logger.error('Get admin feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// 管理员标记反馈为已处理
router.put('/feedback/:id/resolve', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute(
      "UPDATE notifications SET is_read = 1 WHERE id = ? AND related_type = 'feedback'",
      [id]
    );
    res.json({ message: '已标记为已处理' });
  } catch (error) {
    logger.error('Resolve feedback error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// 获取所有已驳回的结算 change_requests 对应的 registration_id
router.get('/settlement-rejected', async (req, res) => {
  try {
    // 找到所有已驳回的结算申请，排除那些又有新的待审核申请的记录
    const [rejected] = await pool.execute(
      "SELECT cr.registration_id FROM change_requests cr WHERE cr.settlement_new_status IS NOT NULL AND cr.status = 'rejected' AND NOT EXISTS (SELECT 1 FROM change_requests cr2 WHERE cr2.registration_id = cr.registration_id AND cr2.settlement_new_status IS NOT NULL AND cr2.status = 'pending') ORDER BY cr.created_at DESC"
    );
    const rejectedIds = rejected.map(r => r.registration_id);
    res.json({ rejectedIds });
  } catch (error) {
    logger.error('Get rejected settlement IDs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});


// 管理员直接删除 change_request
router.delete('/:id', authorize('admin'), async (req, res) => {
  try {
    const { id } = req.params;
    
    const [requests] = await pool.execute('SELECT * FROM change_requests WHERE id = ?', [id]);
    if (requests.length === 0) {
      return res.status(404).json({ error: '修改记录不存在' });
    }
    
    await pool.execute('DELETE FROM change_requests WHERE id = ?', [id]);
    
    logger.info(`Change request ${id} deleted by admin ${req.user.userId}`);
    res.json({ message: '修改记录已删除' });
  } catch (error) {
    logger.error('Delete change request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;