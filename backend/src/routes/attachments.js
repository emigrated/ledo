const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const { pool } = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { logger } = require('../utils/logger');

const router = express.Router();

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
    const uniqueName = `${uuidv4()}_${file.originalname}`;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 100 * 1024 * 1024
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'video/mp4', 'video/quicktime', 'video/x-msvideo'
    ];
    
    if (allowedTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid file type'));
    }
  }
});

router.use(authenticate);

router.post('/records/:recordId/attachments', upload.single('file'), async (req, res) => {
  try {
    const { recordId } = req.params;
    
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const [records] = await pool.execute(
      'SELECT * FROM records WHERE id = ?',
      [recordId]
    );

    if (records.length === 0) {
      return res.status(404).json({ error: 'Record not found' });
    }

    const record = records[0];
    
    if (req.user.role !== 'admin' && record.user_id !== req.user.userId) {
      return fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Forbidden' });
    }

    // 将绝对路径转换为相对路径，以便前端正确访问
    let relativePath = req.file.path;
    if (relativePath.startsWith('/app/')) {
      relativePath = relativePath.substring(4);
    }
    if (!relativePath.startsWith('/')) {
      relativePath = '/' + relativePath;
    }

    const [result] = await pool.execute(
      'INSERT INTO attachments (record_id, filename, original_name, mime_type, file_size, file_path, uploaded_by) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [
        recordId,
        req.file.filename,
        req.file.originalname,
        req.file.mimetype,
        req.file.size,
        relativePath,
        req.user.userId
      ]
    );

    logger.info(`Attachment uploaded: ${result.insertId} for record ${recordId}`);

    res.status(201).json({
      message: 'File uploaded',
      attachment: {
        id: result.insertId,
        filename: req.file.filename,
        originalName: req.file.originalname,
        mimeType: req.file.mimetype,
        fileSize: req.file.size
      }
    });
  } catch (error) {
    logger.error('Upload error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    const [attachments] = await pool.execute(
      'SELECT * FROM attachments WHERE id = ?',
      [id]
    );

    if (attachments.length === 0) {
      return res.status(404).json({ error: 'Attachment not found' });
    }

    const attachment = attachments[0];
    
    if (req.user.role !== 'admin' && attachment.uploaded_by !== req.user.userId) {
      return res.status(403).json({ error: 'Forbidden' });
    }

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

module.exports = router;
