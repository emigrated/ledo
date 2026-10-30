const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { body, validationResult } = require('express-validator');
const { pool } = require('../config/database');
const { logger } = require('../utils/logger');
const { authenticate, authorize } = require('../middleware/auth');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

router.post('/register',
  body('name').isLength({ min: 1, max: 50 }),
  body('id_card').isLength({ min: 15, max: 18 }),
  body('phone').isLength({ min: 11, max: 11 }),
  body('password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({ error: 'Validation error', details: errors.array() });
      }

      const { name, id_card, phone, password } = req.body;
      
      const [existing] = await pool.execute(
        'SELECT id FROM users WHERE id_card = ? OR phone = ?',
        [id_card, phone]
      );
      
      if (existing.length > 0) {
        return res.status(409).json({ error: 'User already exists' });
      }

      const passwordHash = await bcrypt.hash(password, 12);
      
      const [result] = await pool.execute(
        'INSERT INTO users (name, id_card, phone, password_hash, role) VALUES (?, ?, ?, ?, ?)',
        [name, id_card, phone, passwordHash, 'user']
      );

      logger.info(`User registered: ${phone}`);
      
      res.status(201).json({ 
        message: 'Registration successful', 
        userId: result.insertId 
      });
    } catch (error) {
      logger.error('Registration error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/login',
  body('phone').isLength({ min: 11, max: 11 }),
  body('password').notEmpty(),
  async (req, res) => {
    try {
      const { phone, password } = req.body;
      
      // 先查 users 表
      const [users] = await pool.execute(
        'SELECT * FROM users WHERE phone = ?',
        [phone]
      );
      
      let user = null;
      let isAdmin = false;
      
      if (users.length > 0) {
        user = users[0];
      } else {
        // 再查 admins 表
        const [admins] = await pool.execute(
          'SELECT * FROM admins WHERE phone = ?',
          [phone]
        );
        if (admins.length > 0) {
          user = admins[0];
          isAdmin = true;
        }
      }
      
      if (!user) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }
      
      // 检查账号是否激活
      if (!user.is_active) {
        return res.status(403).json({ error: '账号未开通，请联系管理员' });
      }

      const match = await bcrypt.compare(password, user.password_hash);
      
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      // 更新最后登录时间
      const table = isAdmin ? 'admins' : 'users';
      await pool.execute(
        `UPDATE ${table} SET last_login_at = NOW() WHERE id = ?`,
        [user.id]
      );

      const accessToken = jwt.sign(
        { userId: user.id, name: user.name, role: isAdmin ? 'admin' : user.role },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      logger.info(`User logged in: ${phone}`);
      
      res.json({
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: user.role
        }
      });
    } catch (error) {
      logger.error('Login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/logout', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
    }
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    logger.error('Logout error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/refresh', async (req, res) => {
  try {
    const { refreshToken } = req.body;
    
    if (!refreshToken) {
      return res.status(400).json({ error: 'Refresh token is required' });
    }
    
    // Verify refresh token
    let decoded;
    try {
      decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
    } catch (err) {
      return res.status(401).json({ error: 'Invalid or expired refresh token' });
    }
    
    // Get user from database to ensure they still exist and are active
    const [users] = await pool.execute(
      'SELECT id, name, phone, role, is_active FROM users WHERE id = ?',
      [decoded.userId]
    );
    
    let user = users[0];
    let isAdmin = false;
    
    // If not found in users table, check admins table
    if (!user || user.length === 0) {
      const [admins] = await pool.execute(
        'SELECT id, name, phone, role, is_active FROM admins WHERE id = ?',
        [decoded.userId]
      );
      if (admins.length > 0) {
        user = admins[0];
        isAdmin = true;
      }
    }
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    // Generate new access token
    const accessToken = jwt.sign(
      { userId: user.id, name: user.name, role: isAdmin ? 'admin' : user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );
    
    // Generate new refresh token
    const newRefreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );
    
    res.json({
      token: accessToken,
      refreshToken: newRefreshToken
    });
  } catch (error) {
    logger.error('Refresh token error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/admin/login',
  body('phone').isLength({ min: 11, max: 11 }),
  body('password').notEmpty(),
  async (req, res) => {
    try {
      const { phone, password } = req.body;
      
      const [admins] = await pool.execute(
        'SELECT * FROM admins WHERE phone = ?',
        [phone]
      );
      
      if (admins.length === 0) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const user = admins[0];

      const match = await bcrypt.compare(password, user.password_hash);
      
      if (!match) {
        return res.status(401).json({ error: 'Invalid credentials' });
      }

      const accessToken = jwt.sign(
        { userId: user.id, name: user.name, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId: user.id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      await pool.execute(
        'UPDATE admins SET last_login_at = NOW() WHERE id = ?',
        [user.id]
      );

      logger.info(`Admin logged in: ${phone}`);
      
      res.json({
        token: accessToken,
        refreshToken,
        user: {
          id: user.id,
          name: user.name,
          phone: user.phone,
          role: 'admin'
        }
      });
    } catch (error) {
      logger.error('Admin login error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/reset-password',
  body('phone').isLength({ min: 11, max: 11 }),
  body('name').notEmpty(),
  body('id_card').isLength({ min: 15, max: 18 }),
  async (req, res) => {
    try {
      const { phone, name, id_card } = req.body;
      
      const [users] = await pool.execute(
        'SELECT id FROM users WHERE phone = ? AND name = ? AND id_card = ?',
        [phone, name, id_card]
      );
      
      if (users.length === 0) {
        return res.status(401).json({ error: '身份验证失败，信息不匹配' });
      }

      res.json({ message: '身份验证成功，请设置新密码' });
    } catch (error) {
      logger.error('Reset password verify error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/reset-password/confirm',
  body('phone').isLength({ min: 11, max: 11 }),
  body('new_password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const { phone, new_password } = req.body;
      
      const passwordHash = await bcrypt.hash(new_password, 12);
      
      const [result] = await pool.execute(
        'UPDATE users SET password_hash = ? WHERE phone = ?',
        [passwordHash, phone]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '用户不存在' });
      }

      logger.info(`Password reset for: ${phone}`);
      res.json({ message: '密码重置成功' });
    } catch (error) {
      logger.error('Reset password confirm error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/admin/reset-password',
  body('phone').isLength({ min: 11, max: 11 }),
  body('name').notEmpty(),
  body('id_card').isLength({ min: 15, max: 18 }),
  async (req, res) => {
    try {
      const { phone, name, id_card } = req.body;
      
      const [admins] = await pool.execute(
        'SELECT id FROM admins WHERE phone = ? AND name = ? AND id_card = ?',
        [phone, name, id_card]
      );
      
      if (admins.length === 0) {
        return res.status(401).json({ error: '身份验证失败，信息不匹配' });
      }

      res.json({ message: '身份验证成功，请设置新密码' });
    } catch (error) {
      logger.error('Admin reset password verify error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/admin/reset-password/confirm',
  body('phone').isLength({ min: 11, max: 11 }),
  body('new_password').isLength({ min: 6 }),
  async (req, res) => {
    try {
      const { phone, new_password } = req.body;
      
      const passwordHash = await bcrypt.hash(new_password, 12);
      
      const [result] = await pool.execute(
        'UPDATE admins SET password_hash = ? WHERE phone = ?',
        [passwordHash, phone]
      );
      
      if (result.affectedRows === 0) {
        return res.status(404).json({ error: '管理员不存在' });
      }

      logger.info(`Admin password reset for: ${phone}`);
      res.json({ message: '密码重置成功' });
    } catch (error) {
      logger.error('Admin reset password confirm error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/admin/users', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const page = parseInt(req.query.page) || 1;
      const limit = parseInt(req.query.limit) || 20;
      const offset = (page - 1) * limit;

      const [users] = await pool.query(
        'SELECT id, name, id_card, phone, role, is_active, created_at, last_login_at FROM users ORDER BY created_at DESC LIMIT ? OFFSET ?',
        [limit, offset]
      );
      const [countResult] = await pool.query('SELECT COUNT(*) as total FROM users');
      res.json({ users, total: countResult[0].total, page, limit });
    } catch (error) {
      logger.error('Get users error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/admin/user/:id/activate', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute(
        'UPDATE users SET is_active = 1 WHERE id = ?',
        [id]
      );
      logger.info(`User activated: ${id}`);
      res.json({ message: '用户已开通' });
    } catch (error) {
      logger.error('Activate user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.post('/admin/user/:id/deactivate', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute(
        'UPDATE users SET is_active = 0 WHERE id = ?',
        [id]
      );
      logger.info(`User deactivated: ${id}`);
      res.json({ message: '用户已禁用' });
    } catch (error) {
      logger.error('Deactivate user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/admin/user/:id', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute(
        'DELETE FROM users WHERE id = ?',
        [id]
      );
      logger.info(`User deleted: ${id}`);
      res.json({ message: '用户已删除' });
    } catch (error) {
      logger.error('Delete user error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.get('/debug/user/:phone', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { phone } = req.params;
      const [users] = await pool.execute(
        'SELECT id, phone, role, is_active, created_at, last_login_at FROM users WHERE phone = ?',
        [phone]
      );
      res.json({ users });
    } catch (error) {
      logger.error('Debug user error:', error);
      res.status(500).json({ error: error.message });
    }
  }
);


router.get('/admin/admins', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const [admins] = await pool.execute(
        'SELECT id, name, phone, id_card, role, is_active, last_login_at, created_at, updated_at FROM admins ORDER BY created_at DESC'
      );
      res.json({ admins });
    } catch (error) {
      logger.error('Get admins error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);


router.post('/admin/admin/:id/deactivate', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const [admin] = await pool.execute('SELECT is_active FROM admins WHERE id = ?', [id]);
      if (admin.length === 0) return res.status(404).json({ error: '管理员不存在' });
      const newStatus = admin[0].is_active ? 0 : 1;
      await pool.execute('UPDATE admins SET is_active = ? WHERE id = ?', [newStatus, id]);
      logger.info('Admin ' + (newStatus ? 'activated' : 'deactivated') + ': ' + id);
      res.json({ message: newStatus ? '管理员已启用' : '管理员已禁用' });
    } catch (error) {
      logger.error('Toggle admin active error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.put('/admin/admin/:id', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      const { name, phone, id_card } = req.body;
      if (!name && !phone && !id_card) {
        return res.status(400).json({ error: '请提供要修改的字段' });
      }
      const updates = [];
      const params = [];
      if (name !== undefined) { updates.push('name = ?'); params.push(name); }
      if (phone !== undefined) { updates.push('phone = ?'); params.push(phone); }
      if (id_card !== undefined) { updates.push('id_card = ?'); params.push(id_card); }
      params.push(id);
      await pool.execute('UPDATE admins SET ' + updates.join(', ') + ' WHERE id = ?', params);
      logger.info('Admin updated: ' + id);
      res.json({ message: '管理员信息已更新' });
    } catch (error) {
      logger.error('Update admin error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

router.delete('/admin/admin/:id', authenticate, authorize('admin'),
  async (req, res) => {
    try {
      const { id } = req.params;
      await pool.execute('DELETE FROM admins WHERE id = ?', [id]);
      logger.info('Admin deleted: ' + id);
      res.json({ message: '管理员已删除' });
    } catch (error) {
      logger.error('Delete admin error:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
);

module.exports = router;
