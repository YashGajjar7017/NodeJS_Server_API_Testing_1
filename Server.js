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
const configRoutes = require('./routes/configRoutes');
const storageService = require('./services/storageService');
const configService = require('./services/configService');

const app = express();
const PORT = Number(process.env.PORT || 3000);
const HOST = process.env.HOST || '0.0.0.0';
const allowedOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  : ['*'];

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
app.use(configRoutes.router);
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
let serverInstance = null;
let currentHost = HOST;
let currentPort = PORT;

function createHttpsServer() {
  const config = configService.getConfig();
  const sslKeyPath = config.sslKeyPath;
  const sslCertPath = config.sslCertPath;
  const sslCaPath = config.sslCaPath;
  const requestClientCert = config.requestClientCert;

  if (!sslKeyPath || !sslCertPath) {
    throw new Error('SSL key and certificate paths must be configured for HTTPS');
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

function createServerInstance() {
  const config = configService.getConfig();
  return config.useHttps ? createHttpsServer() : http.createServer(app);
}

async function startServer() {
  const config = configService.getConfig();
  currentHost = config.host || HOST;
  currentPort = config.port || PORT;
  const server = createServerInstance();

  return new Promise((resolve, reject) => {
    server.listen(currentPort, currentHost, (err) => {
      if (err) {
        return reject(err);
      }

      serverInstance = server;
      const protocol = config.useHttps ? 'https' : 'http';
      // eslint-disable-next-line no-console
      console.log(`Storage app listening on ${protocol}://${currentHost}:${currentPort}`);
      if (config.useHttps) {
        // eslint-disable-next-line no-console
        console.log('SSL enabled. Certificates loaded from:', config.sslCertPath, config.sslKeyPath);
        if (config.sslCaPath) {
          // eslint-disable-next-line no-console
          console.log('CA certificate path:', config.sslCaPath);
        }
      }
      // eslint-disable-next-line no-console
      console.log(`Storage directory: ${storageService.UPLOAD_DIR}`);
      resolve(server);
    });
  });
}

async function restartServer() {
  if (serverInstance) {
    await new Promise((resolve, reject) => {
      serverInstance.close((err) => {
        if (err) return reject(err);
        resolve();
      });
    });
    serverInstance = null;
  }
  return startServer();
}

configRoutes.setRestartHandler(restartServer);

if (require.main === module) {
  startServer().catch((err) => {
    // eslint-disable-next-line no-console
    console.error('Unable to start server:', err);
    process.exit(1);
  });
}

module.exports = app;

