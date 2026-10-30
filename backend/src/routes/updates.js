const express = require('express');
const path = require('path');
const fs = require('fs');
const { logger } = require('../utils/logger');

const router = express.Router();

const UPDATE_DIR = process.env.UPDATE_PATH || path.join(__dirname, '../../uploads/updates');

if (!fs.existsSync(UPDATE_DIR)) {
  fs.mkdirSync(UPDATE_DIR, { recursive: true });
}

function readLatestManifest(platform) {
  const fileName = platform === 'mac' ? 'latest-mac.yml' : 'latest.yml';
  const filePath = path.join(UPDATE_DIR, fileName);
  if (!fs.existsSync(filePath)) return null;
  const content = fs.readFileSync(filePath, 'utf-8');
  return content;
}

router.get('/latest.yml', (req, res) => {
  const yml = readLatestManifest('win');
  if (!yml) return res.status(404).json({ error: 'No update available' });
  res.type('text/yaml').send(yml);
});

router.get('/latest-mac.yml', (req, res) => {
  const yml = readLatestManifest('mac');
  if (!yml) return res.status(404).json({ error: 'No update available' });
  res.type('text/yaml').send(yml);
});

router.get('/check', (req, res) => {
  const yml = readLatestManifest(req.query.platform === 'mac' ? 'mac' : 'win');
  if (!yml) return res.json({ hasUpdate: false });
  res.json({ hasUpdate: true, manifest: yml });
});

router.get(/^\/(.+)$/, (req, res) => {
  const filename = req.params[0];
  if (filename.includes('..') || filename.includes('/')) {
    return res.status(400).json({ error: 'Invalid filename' });
  }
  const filePath = path.join(UPDATE_DIR, filename);
  if (!fs.existsSync(filePath)) {
    return res.status(404).json({ error: 'File not found' });
  }
  res.download(filePath);
});

module.exports = router;
