const fs = require('fs');
const path = require('path');
const express = require('express');
const storageService = require('../services/storageService');

const router = express.Router();

function parsePositiveInt(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function validateFilename(req, res) {
  const name = req.query.name;
  if (!name) return res.status(400).json({ error: 'Missing file name' });
  const filePath = storageService.safeFilePath(name);
  if (!filePath) return res.status(400).json({ error: 'Invalid file name' });
  return filePath;
}

router.get('/file', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  storageService.ensureStorageDir();
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  const stat = fs.statSync(filePath);
  res.setHeader('Content-Type', 'application/octet-stream');
  res.setHeader('Content-Length', String(stat.size));
  res.setHeader('Content-Disposition', `attachment; filename="${req.query.name}"`);

  const stream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
  stream.on('error', () => res.status(500).end());
  stream.pipe(res);
});

router.get('/file/content', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  storageService.ensureStorageDir();
  if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

  try {
    const content = fs.readFileSync(filePath, 'utf8');
    const stat = fs.statSync(filePath);
    res.json({ filename: req.query.name, content, size: stat.size, modified: stat.mtime });
  } catch (err) {
    res.status(500).json({ error: 'Unable to read file content' });
  }
});

router.post('/file/save', express.json(), (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  if (!req.body || typeof req.body.content !== 'string') {
    return res.status(400).json({ error: 'Missing content to save' });
  }

  storageService.ensureStorageDir();

  try {
    fs.writeFileSync(filePath, req.body.content, 'utf8');
    const stat = fs.statSync(filePath);
    res.json({ ok: true, filename: req.query.name, size: stat.size, modified: stat.mtime });
  } catch (err) {
    res.status(500).json({ error: 'Unable to save file content' });
  }
});

router.post('/file', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  storageService.ensureStorageDir();
  const tmpPath = storageService.tempFilePath(req.query.name);
  const mode = (req.query.mode || 'overwrite').toString().toLowerCase();
  const overwrite = mode !== 'append';

  if (overwrite && fs.existsSync(tmpPath)) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }

  let inputData;
  if (req.is('application/json') && req.body && typeof req.body === 'object') {
    if (req.body.data !== undefined) {
      inputData = Buffer.from(String(req.body.data), 'utf8');
    } else {
      return res.status(400).json({ error: 'Missing json.data for JSON upload' });
    }
  }

  if (inputData) {
    try {
      fs.writeFileSync(tmpPath, inputData, { flag: overwrite ? 'w' : 'a' });
      if (overwrite) fs.renameSync(tmpPath, filePath);
      return res.status(201).json({ ok: true, filename: req.query.name, bytes: inputData.length, mode: overwrite ? 'overwrite' : 'append' });
    } catch (err) {
      return res.status(500).json({ error: 'Write failure' });
    }
  }

  const writeStream = fs.createWriteStream(tmpPath, { flags: overwrite ? 'w' : 'a' });
  let received = 0;
  const contentLength = req.headers['content-length'] ? Number(req.headers['content-length']) : null;

  req.on('data', (chunk) => {
    received += chunk.length;
    if (contentLength !== null && received > contentLength) {
      writeStream.destroy();
      res.status(400).json({ error: 'Too much data sent' });
    }
  });

  req.on('error', () => {
    writeStream.destroy();
    res.status(500).json({ error: 'Upload stream error' });
  });

  writeStream.on('error', () => {
    res.status(500).json({ error: 'Write stream error' });
  });

  writeStream.on('finish', () => {
    if (overwrite) {
      try {
        fs.renameSync(tmpPath, filePath);
      } catch (err) {
        return res.status(500).json({ error: 'Failed finalize upload' });
      }
    }
    res.status(201).json({ ok: true, filename: req.query.name, bytes: received, mode: overwrite ? 'overwrite' : 'append' });
  });

  req.pipe(writeStream);
});

router.post('/file/append', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  storageService.ensureStorageDir();
  const writeStream = fs.createWriteStream(filePath, { flags: 'a' });
  let received = 0;
  const contentLength = req.headers['content-length'] ? Number(req.headers['content-length']) : null;

  req.on('data', (chunk) => {
    received += chunk.length;
    if (contentLength !== null && received > contentLength) {
      writeStream.destroy();
      res.status(400).json({ error: 'Too much data sent' });
    }
  });

  req.on('error', () => {
    writeStream.destroy();
    res.status(500).json({ error: 'Upload stream error' });
  });

  writeStream.on('error', () => {
    res.status(500).json({ error: 'Write stream error' });
  });

  writeStream.on('finish', () => {
    res.status(201).json({ ok: true, filename: req.query.name, bytes: received, mode: 'append' });
  });

  req.pipe(writeStream);
});

router.post('/file/chunk', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  storageService.ensureStorageDir();
  const tmpPath = storageService.tempFilePath(req.query.name);
  const partIndex = parsePositiveInt(req.query.part);
  const totalParts = parsePositiveInt(req.query.total);
  const overwrite = (req.query.mode || 'overwrite').toString().toLowerCase() !== 'append';

  if (overwrite && partIndex === 1 && fs.existsSync(tmpPath)) {
    try { fs.unlinkSync(tmpPath); } catch (_) {}
  }

  const writeStream = fs.createWriteStream(tmpPath, { flags: 'a' });
  let received = 0;
  const contentLength = req.headers['content-length'] ? Number(req.headers['content-length']) : null;

  req.on('data', (chunk) => {
    received += chunk.length;
    if (contentLength !== null && received > contentLength) {
      writeStream.destroy();
      res.status(400).json({ error: 'Too much data sent' });
    }
  });

  req.on('error', () => {
    writeStream.destroy();
    res.status(500).json({ error: 'Chunk upload stream error' });
  });

  writeStream.on('error', () => {
    res.status(500).json({ error: 'Chunk write error' });
  });

  writeStream.on('finish', () => {
    if (totalParts && partIndex === totalParts) {
      try {
        fs.renameSync(tmpPath, filePath);
      } catch (err) {
        return res.status(500).json({ error: 'Failed finalizing chunked upload' });
      }
    }

    res.status(200).json({
      ok: true,
      filename: req.query.name,
      part: partIndex || null,
      totalParts: totalParts || null,
      bytes: received,
      ready: totalParts ? partIndex === totalParts : true,
    });
  });

  req.pipe(writeStream);
});

router.get('/files', (req, res) => {
  try {
    const files = storageService.listFiles();
    res.json({ files });
  } catch (err) {
    res.status(500).json({ error: 'Could not read storage directory' });
  }
});

router.get('/storage', (req, res) => {
  try {
    const stats = storageService.getStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: 'Could not read storage status' });
  }
});

router.delete('/file', (req, res) => {
  const filePath = validateFilename(req, res);
  if (!filePath) return;

  if (!storageService.deleteFile(req.query.name)) {
    return res.status(404).json({ error: 'File not found or invalid name' });
  }

  res.json({ ok: true, filename: req.query.name });
});

module.exports = router;
