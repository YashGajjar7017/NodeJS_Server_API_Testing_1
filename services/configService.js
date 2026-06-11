const env = process.env;

const config = {
  protocol: env.HTTPS === '1' || env.HTTPS === 'true' ? 'https' : 'http',
  useHttps: env.HTTPS === '1' || env.HTTPS === 'true',
  ftpEnabled: env.ENABLE_FTP === '1' || env.ENABLE_FTP === 'true',
  host: env.HOST || '0.0.0.0',
  port: Number(env.PORT || 3000),
  ftpPort: Number(env.FTP_PORT || 2121),
  sslKeyPath: env.SSL_KEY_PATH || '',
  sslCertPath: env.SSL_CERT_PATH || '',
  sslCaPath: env.SSL_CA_PATH || '',
  requestClientCert: env.SSL_REQUEST_CLIENT_CERT === 'true',
  vpnServer: env.VPN_SERVER || '',
  vpnPort: Number(env.VPN_PORT || 0),
  vpnProtocol: env.VPN_PROTOCOL || 'openvpn',
  vpnUsername: env.VPN_USERNAME || '',
  vpnPassword: env.VPN_PASSWORD || '',
};

function getConfig() {
  return { ...config };
}

function updateConfig(updates) {
  const next = { ...config };
  if (typeof updates.protocol === 'string') {
    const normalized = updates.protocol.toLowerCase();
    if (!['http', 'https', 'ftp'].includes(normalized)) {
      throw new Error('Invalid protocol. Must be http, https, or ftp.');
    }
    next.protocol = normalized;
    next.useHttps = normalized === 'https';
    next.ftpEnabled = normalized === 'ftp';
  }

  if (typeof updates.ftpEnabled === 'boolean') {
    next.ftpEnabled = updates.ftpEnabled;
  }

  if (typeof updates.host === 'string') {
    next.host = updates.host;
  }

  if (typeof updates.port === 'number' && Number.isInteger(updates.port) && updates.port > 0) {
    next.port = updates.port;
  }

  if (typeof updates.ftpPort === 'number' && Number.isInteger(updates.ftpPort) && updates.ftpPort > 0) {
    next.ftpPort = updates.ftpPort;
  }

  if (typeof updates.sslKeyPath === 'string') {
    next.sslKeyPath = updates.sslKeyPath;
  }

  if (typeof updates.sslCertPath === 'string') {
    next.sslCertPath = updates.sslCertPath;
  }

  if (typeof updates.sslCaPath === 'string') {
    next.sslCaPath = updates.sslCaPath;
  }

  if (typeof updates.requestClientCert === 'boolean') {
    next.requestClientCert = updates.requestClientCert;
  }

  if (typeof updates.vpnServer === 'string') {
    next.vpnServer = updates.vpnServer;
  }

  if (typeof updates.vpnPort === 'number' && Number.isInteger(updates.vpnPort) && updates.vpnPort >= 0) {
    next.vpnPort = updates.vpnPort;
  }

  if (typeof updates.vpnProtocol === 'string') {
    next.vpnProtocol = updates.vpnProtocol;
  }

  if (typeof updates.vpnUsername === 'string') {
    next.vpnUsername = updates.vpnUsername;
  }

  if (typeof updates.vpnPassword === 'string') {
    next.vpnPassword = updates.vpnPassword;
  }

  Object.assign(config, next);
  return getConfig();
}

module.exports = {
  getConfig,
  updateConfig,
};
