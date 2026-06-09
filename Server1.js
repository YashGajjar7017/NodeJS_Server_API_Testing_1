const fs = require('fs');
const path = require('path');
const express = require('express');
const morgan = require('morgan');
const helmet = require('helmet');

const app = express();

const PORT = Number(process.env.PORT || 3000);
const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(__dirname, 'storage');
const MAX_FILENAME_LENGTH = 255;

// Security headers + basic logging; no auth as requested
app.use(helmet());
app.use(morgan('combined'));

function sanitizeFilename(filename) {
    if (!filename || typeof filename !== 'string') return null;
    if (filename.length > MAX_FILENAME_LENGTH) return null;

    // Only allow basenames (no path traversal)
    const base = path.basename(filename);

    // Reject if basename changes meaning or contains traversal characters
    if (base !== filename) return null;
    if (base.includes('..')) return null;
    if (base.includes('/') || base.includes('\\')) return null;
    if (base.trim() !== base) return null;

    return base;
}

function ensureStorageDir() {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeFilePath(filename) {
    const safeName = sanitizeFilename(filename);
    if (!safeName) return null;
    return path.join(UPLOAD_DIR, safeName);
}

app.get('/file', async (req, res) => {
    try {
        const name = req.query.name;
        const filePath = safeFilePath(name);
        if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

        ensureStorageDir();

        // If file doesn't exist
        if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File not found' });

        const stat = fs.statSync(filePath);

        res.setHeader('Content-Type', 'application/octet-stream');
        res.setHeader('Content-Length', String(stat.size));
        res.setHeader('Content-Disposition', `attachment; filename="${path.basename(filePath)}"`);

        const readStream = fs.createReadStream(filePath, { highWaterMark: 1024 * 1024 });
        readStream.on('error', () => res.status(500).end());
        readStream.pipe(res);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.post('/file', async (req, res) => {
    try {
        const name = req.query.name;
        const filePath = safeFilePath(name);
        if (!filePath) return res.status(400).json({ error: 'Invalid filename' });

        ensureStorageDir();

        // Create write stream and pipe request stream (chunked automatically)
        const tmpPath = `${filePath}.part`;

        // If client sets Content-Length we can validate, otherwise just stream.
        const contentLength = req.headers['content-length'] ? Number(req.headers['content-length']) : null;
        if (contentLength !== null && (!Number.isFinite(contentLength) || contentLength < 0)) {
            return res.status(400).json({ error: 'Invalid Content-Length' });
        }

        let received = 0;
        const writeStream = fs.createWriteStream(tmpPath);

        const abort = (code, message) => {
            try {
                req.destroy();
            } catch (_) { }
            try {
                writeStream.destroy();
            } catch (_) { }
            try {
                if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
            } catch (_) { }
            res.status(code).json({ error: message });
        };

        req.on('data', (chunk) => {
            received += chunk.length;
            if (contentLength !== null && received > contentLength) {
                abort(400, 'Received more data than Content-Length');
            }
        });

        req.on('aborted', () => abort(499, 'Client aborted'));
        req.on('error', () => abort(500, 'Request stream error'));
        writeStream.on('error', () => abort(500, 'Write stream error'));

        writeStream.on('finish', () => {
            if (contentLength !== null && received !== contentLength) {
                // Incomplete upload
                try {
                    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                } catch (_) { }
                return res.status(400).json({ error: 'Upload incomplete (size mismatch)' });
            }

            try {
                fs.renameSync(tmpPath, filePath);
            } catch (e) {
                try {
                    if (fs.existsSync(tmpPath)) fs.unlinkSync(tmpPath);
                } catch (_) { }
                return res.status(500).json({ error: 'Failed to finalize upload' });
            }

            res.status(201).json({ ok: true, filename: path.basename(filePath), bytes: received });
        });

        req.pipe(writeStream);
    } catch (err) {
        res.status(500).json({ error: 'Server error' });
    }
});

app.get('/health', (req, res) => {
    res.json({ ok: true });
});

app.listen(PORT, () => {
    // eslint-disable-next-line no-console
    console.log(`File server listening on port ${PORT}`);
    // eslint-disable-next-line no-console
    console.log(`Storage directory: ${UPLOAD_DIR}`);
});
