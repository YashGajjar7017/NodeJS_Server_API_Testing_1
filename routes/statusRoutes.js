const path = require('path');
const express = require('express');
const storageService = require('../services/storageService');
const configService = require('../services/configService');

const router = express.Router();
const startTime = new Date();
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  : ['*'];

function getStatus() {
  const stats = storageService.getStats();
  const config = configService.getConfig();
  return {
    ok: true,
    uptimeMs: Date.now() - startTime.getTime(),
    startedAt: startTime.toISOString(),
    storageDir: stats.uploadDir,
    fileCount: stats.count,
    totalSize: stats.totalSize,
    hosted: true,
    protocol: config.protocol,
    port: config.port,
    host: config.host,
    sslEnabled: config.useHttps,
    sslKeyPath: config.sslKeyPath || null,
    sslCertPath: config.sslCertPath || null,
    sslCaPath: config.sslCaPath || null,
    requestClientCert: config.requestClientCert,
    vpnServer: config.vpnServer || null,
    vpnPort: config.vpnPort || null,
    vpnProtocol: config.vpnProtocol || null,
    vpnUsername: config.vpnUsername || null,
    allowedOrigins,
    ftpEnabled: config.ftpEnabled,
    ftpPort: config.ftpPort,
    protocols: {
      http: config.protocol === 'http',
      https: config.protocol === 'https',
      ftp: config.protocol === 'ftp',
    },
  };
}

router.get('/api/status', (req, res) => {
  res.json(getStatus());
});

router.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'status.html'));
});

router.get('/dashboard/files', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'files.html'));
});

router.get('/dashboard/connection', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'connection.html'));
});

router.get('/dashboard/certificates', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'certificates.html'));
});

router.get('/status', (req, res) => {
  res.redirect('/dashboard');
});

router.get('/', (req, res) => {
  res.redirect('/dashboard');
});

module.exports = router;
