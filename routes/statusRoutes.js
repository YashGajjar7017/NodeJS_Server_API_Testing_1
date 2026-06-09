const path = require('path');
const express = require('express');
const storageService = require('../services/storageService');

const router = express.Router();
const startTime = new Date();

router.get('/api/status', (req, res) => {
  const stats = storageService.getStats();
  res.json({
    ok: true,
    uptimeMs: Date.now() - startTime.getTime(),
    startedAt: startTime.toISOString(),
    storageDir: stats.uploadDir,
    fileCount: stats.count,
    totalSize: stats.totalSize,
    hosted: true,
  });
});

router.get('/status', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
});

router.get('/', (req, res) => {
  res.redirect('/status');
});

module.exports = router;
