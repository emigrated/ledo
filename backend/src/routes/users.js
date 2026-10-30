const express = require('express');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  try {
    const [users] = await pool.execute(
      'SELECT id, name, role FROM users WHERE id != ?',
      [req.user.userId]
    );
    res.json({ users });
  } catch (error) {
    logger.error('Get users error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    let user = null;
    
    // 先查 users 表
    const [users] = await pool.execute(
      'SELECT id, name, phone, id_card, role, bio, is_active, email_verified, created_at, last_login_at FROM users WHERE id = ?',
      [req.user.userId]
    );
    
    if (users.length > 0) {
      user = users[0];
    } else {
      // 再查 admins 表
      const [admins] = await pool.execute(
        'SELECT id, name, phone, id_card, role, created_at, updated_at FROM admins WHERE id = ?',
        [req.user.userId]
      );
      if (admins.length > 0) {
        user = { ...admins[0], is_active: true, bio: '' };
      }
    }

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const [settings] = await pool.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.userId]
    );

    res.json({
      ...user,
      settings: settings.length > 0 ? settings[0] : {
        font_size: 'medium',
        theme: 'light',
        notifications_enabled: true
      }
    });
  } catch (error) {
    logger.error('Get profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/me', async (req, res) => {
  try {
    const { name, bio } = req.body;
    const params = [];
    const updates = [];

    if (name !== undefined) {
      updates.push('name = ?');
      params.push(name);
    }
    if (bio !== undefined) {
      updates.push('bio = ?');
      params.push(bio);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    params.push(req.user.userId);
    await pool.execute(
      `UPDATE users SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    logger.info(`Profile updated for user ${req.user.userId}`);

    res.json({ message: 'Profile updated' });
  } catch (error) {
    logger.error('Update profile error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/settings', async (req, res) => {
  try {
    const [settings] = await pool.execute(
      'SELECT * FROM user_settings WHERE user_id = ?',
      [req.user.userId]
    );

    if (settings.length === 0) {
      await pool.execute(
        'INSERT INTO user_settings (user_id, font_size, theme, notifications_enabled) VALUES (?, 100, ?, ?)',
        [req.user.userId, 'light', 1]
      );
      return res.json({
        font_size: 100,
        theme: 'light',
        notifications_enabled: true
      });
    }

    res.json({
      font_size: settings[0].font_size || 100,
      theme: settings[0].theme || 'light',
      notifications_enabled: settings[0].notifications_enabled === 1
    });
  } catch (error) {
    logger.error('Get settings error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.put('/settings', async (req, res) => {
  try {
    const { font_size, theme, notifications_enabled } = req.body;
    const userId = req.user.userId;

    logger.info(`Update settings request: userId=${userId}, font_size=${font_size}, theme=${theme}, notifications_enabled=${notifications_enabled}`);

    // Use default values if not provided
    const finalFontSize = font_size !== undefined ? font_size : 100;
    const finalTheme = theme !== undefined ? theme : 'light';
    const finalNotifications = notifications_enabled !== undefined ? (notifications_enabled ? 1 : 0) : 1;

    logger.info(`Final values: font_size=${finalFontSize}, theme=${finalTheme}, notifications_enabled=${finalNotifications}`);
    
    // Always update all fields for simplicity
    await pool.execute(
      `INSERT INTO user_settings (user_id, font_size, theme, notifications_enabled) 
       VALUES (?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE 
         font_size = VALUES(font_size),
         theme = VALUES(theme),
         notifications_enabled = VALUES(notifications_enabled)`,
      [userId, finalFontSize, finalTheme, finalNotifications]
    );

    logger.info(`Settings updated for user ${userId}`);

    res.json({ message: 'Settings updated' });
  } catch (error) {
    logger.error('Update settings error:', error.message, error.stack);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.post('/phone-change-request', async (req, res) => {
  try {
    const { new_phone } = req.body;
    const userId = req.user.userId;
    
    if (!new_phone || new_phone.length !== 11) {
      return res.status(400).json({ error: '请输入11位手机号码' });
    }
    
    const [existing] = await pool.execute(
      'SELECT * FROM users WHERE phone = ? AND id != ?',
      [new_phone, userId]
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: '该手机号已被使用' });
    }
    
    const [existingRequest] = await pool.execute(
      "SELECT * FROM phone_change_requests WHERE user_id = ? AND status = 'pending'",
      [userId]
    );
    if (existingRequest.length > 0) {
      return res.status(400).json({ error: '您有待处理的手机号修改申请，请等待审核完成' });
    }
    
    const [userInfo] = await pool.execute(
      'SELECT phone FROM users WHERE id = ?',
      [userId]
    );
    const oldPhone = userInfo[0]?.phone || '';
    
    await pool.execute(
      'INSERT INTO phone_change_requests (user_id, old_phone, new_phone, status) VALUES (?, ?, ?, ?)',
      [userId, oldPhone, new_phone, 'pending']
    );
    
    const [admins] = await pool.execute("SELECT id FROM admins");
    for (const admin of admins) {
      await pool.execute(
        'INSERT INTO notifications (user_id, title, content, type, related_type, related_id) VALUES (?, ?, ?, ?, ?, ?)',
        [admin.id, '手机号修改申请', `用户 ${oldPhone} 申请修改手机号为 ${new_phone}`, 'system', 'phone_change_request', userId]
      );
    }
    
    logger.info(`Phone change request from user ${userId}: ${oldPhone} -> ${new_phone}`);
    
    res.json({ message: '申请已提交，请等待管理员审核' });
  } catch (error) {
    logger.error('Phone change request error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.get('/phone-change-request', async (req, res) => {
  try {
    const userId = req.user.userId;
    const [requests] = await pool.execute(
      'SELECT * FROM phone_change_requests WHERE user_id = ? ORDER BY requested_at DESC',
      [userId]
    );
    res.json({ requests });
  } catch (error) {
    logger.error('Get phone change requests error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
