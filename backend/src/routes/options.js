const express = require('express');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

const router = express.Router();

const VALID_CATEGORIES = ['reason', 'status', 'courier', 'warehouse', 'platform', 'battery_require', 'repair_platform', 'return_reason'];
const CATEGORY_LABELS = {
  reason: '原因',
  status: '状态',
  courier: '快递',
  warehouse: '仓库',
  platform: '平台',
  battery_require: '电池要求',
  repair_platform: '报修平台',
  return_reason: '返厂原因'
};

router.get('/',
  async (req, res) => {
    try {
      const [records] = await pool.execute(
        'SELECT * FROM options ORDER BY category, value'
      );
      res.json({ records });
    } catch (error) {
      logger.error('Get options error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/by-category/:category',
  async (req, res) => {
    try {
      const { category } = req.params;
      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: '无效的类别' });
      }
      const [records] = await pool.execute(
        'SELECT * FROM options WHERE category = ? ORDER BY value',
        [category]
      );
      res.json({ records: records.map(r => r.value) });
    } catch (error) {
      logger.error('Get options by category error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/all',
  async (req, res) => {
    try {
      const result = {};
      console.log('VALID_CATEGORIES:', VALID_CATEGORIES);
      for (const category of VALID_CATEGORIES) {
        const [records] = await pool.execute(
          'SELECT value FROM options WHERE category = ? ORDER BY value',
          [category]
        );
        console.log('Category:', category, 'Records:', records.length);
        result[category === 'status' ? 'statuses' : category + 's'] = records.map(r => r.value);
      }
      console.log('Result:', JSON.stringify(result));
      res.json(result);
    } catch (error) {
      logger.error('Get all options error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/',
  async (req, res) => {
    try {
      const { category, value } = req.body;

      if (!category || !value) {
        return res.status(400).json({ error: '类别和值不能为空' });
      }

      if (!VALID_CATEGORIES.includes(category)) {
        return res.status(400).json({ error: '无效的类别' });
      }

      await pool.execute(
        'INSERT INTO options (category, value) VALUES (?, ?) ON DUPLICATE KEY UPDATE value = VALUES(value)',
        [category, value]
      );

      logger.info(`Option created: ${category} - ${value}`);

      res.status(201).json({
        message: '选项创建成功'
      });
    } catch (error) {
      logger.error('Create option error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/:id',
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM options WHERE id = ?', [id]);
      logger.info(`Option deleted: ${id}`);
      res.json({ message: '删除成功' });
    } catch (error) {
      logger.error('Delete option error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
console.log("VALID_CATEGORIES:", JSON.stringify(VALID_CATEGORIES));
