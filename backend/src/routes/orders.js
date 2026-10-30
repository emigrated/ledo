const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');

const router = express.Router();

router.use(authenticate);

// 查重：检查平台+订单编号是否已存在
router.get('/check-duplicate', async (req, res) => {
  try {
    const { 平台, 订单编号 } = req.query;
    
    if (!平台 || !订单编号) {
      return res.json({ exists: false });
    }

    const [existing] = await pool.execute(
      'SELECT id FROM orders WHERE `平台` = ? AND `订单编号` = ?',
      [平台, 订单编号]
    );

    res.json({ 
      exists: existing.length > 0,
      message: existing.length > 0 ? `该订单已存在！平台"${平台}"的订单编号"${订单编号}"已被录入。` : null
    });
  } catch (error) {
    console.error('查重失败:', error);
    res.status(500).json({ error: '查重失败: ' + error.message });
  }
});

// 根据平台+订单编号查询订单详情
router.get('/find-by-order', async (req, res) => {
  try {
    const { 平台, 订单编号 } = req.query;
    
    if (!平台 || !订单编号) {
      return res.json({ found: false });
    }

    const [existing] = await pool.execute(
      'SELECT * FROM orders WHERE `平台` = ? AND `订单编号` = ? LIMIT 1',
      [平台, 订单编号]
    );

    if (existing.length > 0) {
      res.json({ 
        found: true,
        order: existing[0]
      });
    } else {
      res.json({ found: false });
    }
  } catch (error) {
    console.error('查询订单失败:', error);
    res.status(500).json({ error: '查询订单失败: ' + error.message });
  }
});

// 提交订单
router.post('/', async (req, res) => {
  try {
    const {
      客户信息,
      平台,
      订单编号,
      品牌,
      型号,
      类型,
      颜色,
      规格,
      价格,
      购买件数,
      备注
    } = req.body;

    // 验证必填字段（除备注外全部必填）
    if (!客户信息 || !平台 || !订单编号 || !品牌 || !型号 || !类型 || !颜色 || !规格 || !价格 || !购买件数) {
      return res.status(400).json({ error: '除备注外所有字段均为必填项' });
    }

    // 查重：检查平台+订单编号是否已存在
    const [existing] = await pool.execute(
      'SELECT id FROM orders WHERE `平台` = ? AND `订单编号` = ?',
      [平台, 订单编号]
    );

    if (existing.length > 0) {
      return res.status(400).json({ 
        error: `该订单已存在！平台"${平台}"的订单编号"${订单编号}"已被录入。` 
      });
    }

    // 插入订单
    const [result] = await pool.execute(
      `INSERT INTO orders (\`客户信息\`, \`平台\`, \`订单编号\`, \`品牌\`, \`型号\`, \`类型\`, \`颜色\`, \`规格\`, \`价格\`, \`购买件数\`, \`备注\`)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [客户信息, 平台, 订单编号, 品牌, 型号, 类型, 颜色, 规格, 价格, 购买件数, 备注]
    );

    res.json({
      success: true,
      id: result.insertId,
      message: '订单录入成功'
    });
  } catch (error) {
    console.error('订单录入失败:', error);
    res.status(500).json({ error: '订单录入失败: ' + error.message });
  }
});

// 更新订单
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      客户信息,
      平台,
      订单编号,
      品牌,
      型号,
      类型,
      颜色,
      规格,
      价格,
      购买件数,
      备注
    } = req.body;

    // 验证必填字段
    if (!客户信息 || !平台 || !订单编号 || !品牌 || !型号 || !类型 || !颜色 || !规格 || !价格 || !购买件数) {
      return res.status(400).json({ error: '除备注外所有字段均为必填项' });
    }

    // 更新订单
    await pool.execute(
      `UPDATE orders SET \`客户信息\` = ?, \`平台\` = ?, \`订单编号\` = ?, \`品牌\` = ?, \`型号\` = ?, \`类型\` = ?, \`颜色\` = ?, \`规格\` = ?, \`价格\` = ?, \`购买件数\` = ?, \`备注\` = ? WHERE id = ?`,
      [客户信息, 平台, 订单编号, 品牌, 型号, 类型, 颜色, 规格, 价格, 购买件数, 备注, id]
    );

    res.json({
      success: true,
      message: '订单更新成功'
    });
  } catch (error) {
    console.error('订单更新失败:', error);
    res.status(500).json({ error: '订单更新失败: ' + error.message });
  }
});

// 删除订单
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM orders WHERE id = ?', [id]);
    res.json({
      success: true,
      message: '订单删除成功'
    });
  } catch (error) {
    console.error('订单删除失败:', error);
    res.status(500).json({ error: '订单删除失败: ' + error.message });
  }
});

// 获取订单列表
router.get('/', async (req, res) => {
  console.log('[Orders API] GET /api/orders called');
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const offset = (page - 1) * limit;
    const 客户信息 = req.query['客户信息'];
    const 订单编号 = req.query['订单编号'];
    const 品牌 = req.query['品牌'];

    let whereClause = '';
    const params = [];

    if (客户信息) {
      whereClause += ' WHERE `客户信息` LIKE ?';
      params.push(`%${客户信息}%`);
    }
    if (订单编号) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ' `订单编号` LIKE ?';
      params.push(`%${订单编号}%`);
    }
    if (品牌) {
      whereClause += (whereClause ? ' AND' : ' WHERE') + ' `品牌` = ?';
      params.push(品牌);
    }

    // 获取总数
    const [countResult] = await pool.query(
      `SELECT COUNT(*) as total FROM orders${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 获取数据 - 使用 query 而非 execute，避免 LIMIT/OFFSET 预处理语句问题
    const [orders] = await pool.query(
      `SELECT * FROM orders${whereClause} ORDER BY \`创建时间\` DESC LIMIT ${limit} OFFSET ${offset}`,
      params
    );

    res.json({
      orders,
      total,
      page,
      limit
    });
  } catch (error) {
    console.error('获取订单列表失败:', error);
    res.status(500).json({ error: '获取订单列表失败: ' + error.message });
  }
});

module.exports = router;
