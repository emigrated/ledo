const express = require('express');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const router = express.Router();
const { validateProductPayload, checkDuplicate } = require('../utils/product_data_validator');

router.get('/', async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;
    const offset = (page - 1) * limit;

    const where = [];
    const params = [];
    for (const key of ['brand', 'model', 'type', 'color', 'spec']) {
      if (req.query[key]) {
        where.push(`\`${key}\` = ?`);
        params.push(req.query[key]);
      }
    }
    const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

    const [records] = await pool.query(
      `SELECT * FROM product_data ${whereSql} ORDER BY brand, model, type, color, spec, created_at DESC, id DESC LIMIT ? OFFSET ?`,
      [...params, limit, offset]
    );
    const [countResult] = await pool.query(`SELECT COUNT(*) as total FROM product_data ${whereSql}`, params);
    res.json({ records, total: countResult[0].total, page, limit });
  } catch (error) {
    logger.error('Get product data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/options', async (req, res) => {
  try {
    const [brands] = await pool.execute('SELECT DISTINCT brand FROM product_data WHERE brand IS NOT NULL AND brand != "" ORDER BY brand');
    const [models] = await pool.execute('SELECT DISTINCT model FROM product_data WHERE model IS NOT NULL AND model != "" ORDER BY model');
    const [types] = await pool.execute('SELECT DISTINCT type FROM product_data WHERE type IS NOT NULL AND type != "" ORDER BY type');
    const [colors] = await pool.execute('SELECT DISTINCT color FROM product_data WHERE color IS NOT NULL AND color != "" ORDER BY color');
    const [specs] = await pool.execute('SELECT DISTINCT spec FROM product_data WHERE spec IS NOT NULL AND spec != "" ORDER BY spec');
    const [prices] = await pool.execute('SELECT DISTINCT price FROM product_data WHERE price IS NOT NULL ORDER BY price');
    res.json({
      brands: brands.map(r => r.brand),
      models: models.map(r => r.model),
      types: types.map(r => r.type),
      colors: colors.map(r => r.color),
      specs: specs.map(r => r.spec),
      prices: prices.map(r => r.price)
    });
  } catch (error) {
    logger.error('Get product options error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/models', async (req, res) => {
  try {
    const brand = req.query.brand;
    if (!brand) return res.status(400).json({ error: 'brand is required' });
    const [models] = await pool.execute('SELECT DISTINCT model FROM product_data WHERE brand = ? AND model IS NOT NULL AND model != "" ORDER BY model', [brand]);
    res.json({ models: models.map(r => r.model) });
  } catch (error) {
    logger.error('Get models error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/models/:brand', async (req, res) => {
  try {
    const { brand } = req.params;
    const [models] = await pool.execute('SELECT DISTINCT model FROM product_data WHERE brand = ? AND model IS NOT NULL AND model != "" ORDER BY model', [brand]);
    res.json({ models: models.map(r => r.model) });
  } catch (error) {
    logger.error('Get models error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/types', async (req, res) => {
  try {
    const brand = req.query.brand, model = req.query.model;
    if (!brand || !model) return res.status(400).json({ error: 'brand and model required' });
    const [types] = await pool.execute('SELECT DISTINCT type FROM product_data WHERE brand = ? AND model = ? AND type IS NOT NULL AND type != "" ORDER BY type', [brand, model]);
    res.json({ types: types.map(r => r.type) });
  } catch (error) {
    logger.error('Get types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/types/:brand/:model', async (req, res) => {
  try {
    const { brand, model } = req.params;
    const [types] = await pool.execute('SELECT DISTINCT type FROM product_data WHERE brand = ? AND model = ? AND type IS NOT NULL AND type != "" ORDER BY type', [brand, model]);
    res.json({ types: types.map(r => r.type) });
  } catch (error) {
    logger.error('Get types error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/colors', async (req, res) => {
  try {
    const brand = req.query.brand, model = req.query.model, type = req.query.type;
    if (!brand || !model || !type) return res.status(400).json({ error: 'brand, model, type required' });
    const [colors] = await pool.execute('SELECT DISTINCT color FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color IS NOT NULL AND color != "" ORDER BY color', [brand, model, type]);
    res.json({ colors: colors.map(r => r.color) });
  } catch (error) {
    logger.error('Get colors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/colors/:brand/:model/:type', async (req, res) => {
  try {
    const { brand, model, type } = req.params;
    const [colors] = await pool.execute('SELECT DISTINCT color FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color IS NOT NULL AND color != "" ORDER BY color', [brand, model, type]);
    res.json({ colors: colors.map(r => r.color) });
  } catch (error) {
    logger.error('Get colors error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/specs', async (req, res) => {
  try {
    const brand = req.query.brand, model = req.query.model, type = req.query.type, color = req.query.color;
    if (!brand || !model || !type || !color) return res.status(400).json({ error: 'all fields required' });
    const [specs] = await pool.execute('SELECT DISTINCT spec FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color = ? AND spec IS NOT NULL AND spec != "" ORDER BY spec', [brand, model, type, color]);
    res.json({ specs: specs.map(r => r.spec) });
  } catch (error) {
    logger.error('Get specs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/specs/:brand/:model/:type/:color', async (req, res) => {
  try {
    const { brand, model, type, color } = req.params;
    const [specs] = await pool.execute('SELECT DISTINCT spec FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color = ? AND spec IS NOT NULL AND spec != "" ORDER BY spec', [brand, model, type, color]);
    res.json({ specs: specs.map(r => r.spec) });
  } catch (error) {
    logger.error('Get specs error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/price', async (req, res) => {
  try {
    const brand = req.query.brand, model = req.query.model, type = req.query.type, color = req.query.color, spec = req.query.spec;
    if (!brand || !model || !type || !color || !spec) return res.status(400).json({ error: 'all fields required' });
    const [result] = await pool.execute('SELECT DISTINCT price FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color = ? AND spec = ? AND price IS NOT NULL LIMIT 1', [brand, model, type, color, spec]);
    res.json({ price: result.length > 0 ? result[0].price : null });
  } catch (error) {
    logger.error('Get price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/price/:brand/:model/:type/:color/:spec', async (req, res) => {
  try {
    const { brand, model, type, color, spec } = req.params;
    const [result] = await pool.execute('SELECT DISTINCT price FROM product_data WHERE brand = ? AND model = ? AND type = ? AND color = ? AND spec = ? AND price IS NOT NULL LIMIT 1', [brand, model, type, color, spec]);
    res.json({ price: result.length > 0 ? result[0].price : null });
  } catch (error) {
    logger.error('Get price error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/', async (req, res) => {
  try {
    const payload = req.body || {};
    let validated;
    try { validated = validateProductPayload(payload); } catch (e) { return res.status(400).json({ error: e.message }); }
    const { brand, model, type, color, spec, price } = validated;
    await checkDuplicate(pool, brand, model, type, color, spec);
    const [result] = await pool.execute('INSERT INTO product_data (brand, model, type, color, spec, price) VALUES (?, ?, ?, ?, ?, ?)', [brand, model, type, color, spec, price]);
    logger.info('Product data created: ' + brand + ' - ' + (model || ''));
    res.status(201).json({ message: '产品数据创建成功', id: result.insertId });
  } catch (error) {
    if (error.message === '数据已存在，请勿重复录入') return res.status(400).json({ error: error.message });
    logger.error('Create product data error:', error);
    res.status(500).json({ error: 'Internal server error', detail: error.message });
  }
});

router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { brand, model, type, color, spec, price } = req.body;
    await pool.execute('UPDATE product_data SET brand = ?, model = ?, type = ?, color = ?, spec = ?, price = ? WHERE id = ?', [brand, model, type, color, spec, price, id]);
    logger.info('Product data updated: ' + id);
    res.json({ message: '更新成功' });
  } catch (error) {
    logger.error('Update product data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    await pool.execute('DELETE FROM product_data WHERE id = ?', [id]);
    logger.info('Product data deleted: ' + id);
    res.json({ message: '删除成功' });
  } catch (error) {
    logger.error('Delete product data error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
