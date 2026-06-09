const fs = require('fs');
const path = require('path');
const http = require('http');
const https = require('https');
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const dotenv = require('dotenv');

dotenv.config();

const fileRoutes = require('./routes/fileRoutes');
const statusRoutes = require('./routes/statusRoutes');
const storageService = require('./services/storageService');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  : ['*'];
const sslEnabled = process.env.HTTPS === '1' || process.env.HTTPS === 'true';
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;
const sslCaPath = process.env.SSL_CA_PATH;
const requestClientCert = process.env.SSL_REQUEST_CLIENT_CERT === 'true';

function buildCorsOptions() {
  if (allowedOrigins.includes('*')) {
    return {
      origin: true,
      credentials: true,
      methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
    };
  }

  return {
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
      } else {
        callback(new Error(`CORS origin denied: ${origin}`));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  };
}

function createHttpsServer() {
  if (!sslKeyPath || !sslCertPath) {
    throw new Error('SSL_KEY_PATH and SSL_CERT_PATH must be set when HTTPS is enabled');
  }

  const httpsOptions = {
    key: fs.readFileSync(path.resolve(sslKeyPath)),
    cert: fs.readFileSync(path.resolve(sslCertPath)),
  };

  if (sslCaPath) {
    httpsOptions.ca = fs.readFileSync(path.resolve(sslCaPath));
    httpsOptions.requestCert = requestClientCert;
    httpsOptions.rejectUnauthorized = requestClientCert;
  }

  return https.createServer(httpsOptions, app);
}

app.use(helmet());
app.use(morgan('combined'));
app.use(cors(buildCorsOptions()));
app.options('*', cors(buildCorsOptions()));
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: false, limit: '20mb' }));
app.use(express.static(path.join(__dirname, 'public')));

app.use(fileRoutes);
app.use(statusRoutes);

app.use((req, res) => {
  res.status(404).json({ error: 'Not found' });
});

app.use((err, req, res, next) => {
  // eslint-disable-next-line no-console
  console.error(err);
  if (err instanceof Error && err.message.startsWith('CORS')) {
    return res.status(403).json({ error: err.message });
  }
  res.status(500).json({ error: 'Internal server error' });
});

storageService.ensureStorageDir();

function startServer() {
  const server = sslEnabled ? createHttpsServer() : http.createServer(app);
  server.listen(PORT, HOST, () => {
    // eslint-disable-next-line no-console
    console.log(`Storage app listening on ${sslEnabled ? 'https' : 'http'}://${HOST}:${PORT}`);
    if (sslEnabled) {
      // eslint-disable-next-line no-console
      console.log('SSL enabled. Certificates loaded from:', sslCertPath, sslKeyPath);
      if (sslCaPath) {
        // eslint-disable-next-line no-console
        console.log('CA certificate path:', sslCaPath);
      }
    }
    // eslint-disable-next-line no-console
    console.log(`Storage directory: ${storageService.UPLOAD_DIR}`);
  });
}

if (require.main === module) {
  startServer();
}

module.exports = app;

