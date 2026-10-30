const express = require('express');
const router = express.Router();
const { pool } = require('../config/database');
const crypto = require('crypto');

// 创建分享记录
router.post('/return/:id', async (req, res) => {
  try {
    const customerId = req.params.id;
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 天有效期

    // 删除旧的分享记录（如果有）
    await pool.execute('DELETE FROM share_records WHERE customer_id = ? AND type = "return"', [customerId]);

    // 创建新的分享记录
    await pool.execute(
      'INSERT INTO share_records (customer_id, type, token, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      [customerId, 'return', token, expiresAt, new Date()]
    );

    res.json({
      success: true,
      token: token,
      expiresAt: expiresAt.toISOString()
    });
  } catch (error) {
    console.error('创建分享记录失败:', error);
    res.status(500).json({ error: '创建分享记录失败' });
  }
});

// 验证分享链接并获取记录
router.get('/return/:token', async (req, res) => {
  try {
    const token = req.params.token;

    // 查询分享记录
    const [rows] = await pool.execute(
      `SELECT sr.customer_id, sr.expires_at, sr.created_at,
              c.ID, c.\`订单编号\`, c.\`客户信息\`, c.\`购买日期\`,
              c.\`品牌\`, c.\`型号\`, c.\`类型\`, c.\`颜色\`, c.\`规格\`,
              c.\`原因\`, c.\`状态\`, c.\`快递\`, c.\`单号\`,
              c.\`价格\`, c.\`仓库\`, c.\`平台\`, c.\`运费\`,
              c.\`购买件数\`, c.\`退货件数\`, c.\`备注\`, c.\`创建时间\`
       FROM share_records sr
       JOIN customer c ON sr.customer_id = c.ID
       WHERE sr.token = ? AND sr.type = 'return'`,
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '分享链接无效或已过期' });
    }

    const record = rows[0];
    const expiresAt = new Date(record.expires_at);
    const now = new Date();

    // 检查是否过期
    if (now > expiresAt) {
      return res.status(403).json({ 
        error: '分享链接已过期',
        expired: true,
        expiresAt: expiresAt.toISOString()
      });
    }

    // 返回记录数据
    const safeRecord = {
      ID: record.ID,
      order_number: record['订单编号'],
      customer_info: record['客户信息'],
      purchase_date: record['购买日期'],
      brand: record['品牌'],
      model: record['型号'],
      type: record['类型'],
      color: record['颜色'],
      spec: record['规格'],
      reason: record['原因'],
      status: record['状态'],
      courier: record['快递'],
      tracking_number: record['单号'],
      price: record['价格'],
      warehouse: record['仓库'],
      platform: record['平台'],
      shipping_fee: record['运费'],
      quantity: record['购买件数'],
      return_quantity: record['退货件数'],
      remarks: record['备注'],
      created_at: record['创建时间'],
      expiresAt: record.expires_at
    };

    // 获取附件列表
    try {
      const [attachments] = await pool.execute(
        `SELECT id, file_path, original_name, mime_type, file_size, uploaded_at
         FROM attachments
         WHERE customer_id = ?
         ORDER BY uploaded_at DESC`,
        [record.ID]
      );
      
      safeRecord.attachments = attachments.map(att => ({
        id: att.id,
        file_path: att.file_path,
        original_name: att.original_name,
        mime_type: att.mime_type,
        file_size: att.file_size,
        created_at: att.uploaded_at
      }));
    } catch (error) {
      console.error('获取附件失败:', error);
      safeRecord.attachments = [];
    }

    res.json({
      success: true,
      record: safeRecord,
      expiresAt: record.expires_at
    });
  } catch (error) {
    console.error('获取分享记录失败:', error);
    res.status(500).json({ error: '获取分享记录失败' });
  }
});

// 获取分享记录详情（包含倒计时）
router.get('/return/:token/info', async (req, res) => {
  try {
    const token = req.params.token;

    const [rows] = await pool.execute(
      'SELECT customer_id, expires_at, created_at FROM share_records WHERE token = ? AND type = "return"',
      [token]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '分享链接无效' });
    }

    const share = rows[0];
    const expiresAt = new Date(share.expires_at);
    const now = new Date();
    const timeLeft = Math.max(0, expiresAt - now);

    res.json({
      success: true,
      customerId: share.customer_id,
      expiresAt: share.expires_at,
      createdAt: share.created_at,
      timeLeft: timeLeft,
      expired: now > expiresAt
    });
  } catch (error) {
    console.error('获取分享信息失败:', error);
    res.status(500).json({ error: '获取分享信息失败' });
  }
});

module.exports = router;
