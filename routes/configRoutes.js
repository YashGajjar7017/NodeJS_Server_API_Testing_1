const express = require('express');
const path = require('path');
const configService = require('../services/configService');

const router = express.Router();
let restartHandler = null;

function setRestartHandler(handler) {
  restartHandler = handler;
}

function shouldRestartConfig(current, updates) {
  const restartKeys = [
    'protocol',
    'host',
    'port',
    'ftpPort',
    'sslKeyPath',
    'sslCertPath',
    'sslCaPath',
    'requestClientCert',
    'ftpEnabled',
  ];
  return restartKeys.some((key) => updates[key] !== undefined && updates[key] !== current[key]);
}

router.get('/api/config', (req, res) => {
  res.json(configService.getConfig());
});

router.post('/api/config', express.json(), async (req, res) => {
  try {
    const updates = req.body || {};
    const currentConfig = configService.getConfig();
    const config = configService.updateConfig(updates);

    if (restartHandler && shouldRestartConfig(currentConfig, updates)) {
      await restartHandler();
    }

    res.json({ ok: true, config });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

router.get('/api/certificates', (req, res) => {
  const config = configService.getConfig();
  res.json({
    sslCertPath: config.sslCertPath || null,
    sslKeyPath: config.sslKeyPath || null,
    sslCaPath: config.sslCaPath || null,
  });
});

router.get('/certificate/download', (req, res) => {
  const type = req.query.type;
  const config = configService.getConfig();
  let filePath = null;

  if (type === 'cert') filePath = config.sslCertPath;
  else if (type === 'key') filePath = config.sslKeyPath;
  else if (type === 'ca') filePath = config.sslCaPath;
  else return res.status(400).json({ error: 'Invalid certificate type' });

  if (!filePath) {
    return res.status(404).json({ error: 'Certificate file not configured' });
  }

  return res.download(path.resolve(filePath));
});

module.exports = {
  router,
  setRestartHandler,
};
