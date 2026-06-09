const fs = require('fs');
const path = require('path');

const MAX_FILENAME_LENGTH = 255;
const UPLOAD_DIR = process.env.UPLOAD_DIR
  ? path.resolve(process.env.UPLOAD_DIR)
  : path.join(__dirname, '..', 'storage');

function sanitizeFilename(filename) {
  if (!filename || typeof filename !== 'string') return null;
  if (filename.length > MAX_FILENAME_LENGTH) return null;

  const safeName = path.basename(filename);
  if (safeName !== filename) return null;
  if (safeName.includes('..')) return null;
  if (safeName.includes('/') || safeName.includes('\\')) return null;
  if (safeName.trim() !== safeName) return null;

  return safeName;
}

function ensureStorageDir() {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

function safeFilePath(filename) {
  const safeName = sanitizeFilename(filename);
  if (!safeName) return null;
  return path.join(UPLOAD_DIR, safeName);
}

function tempFilePath(filename) {
  const safeName = sanitizeFilename(filename);
  if (!safeName) return null;
  return path.join(UPLOAD_DIR, `${safeName}.part`);
}

function listFiles() {
  ensureStorageDir();
  return fs
    .readdirSync(UPLOAD_DIR)
    .filter((item) => {
      const fullPath = path.join(UPLOAD_DIR, item);
      return fs.statSync(fullPath).isFile() && !item.endsWith('.part');
    })
    .map((filename) => {
      const fullPath = path.join(UPLOAD_DIR, filename);
      const stat = fs.statSync(fullPath);
      return {
        filename,
        size: stat.size,
        modified: stat.mtime,
      };
    });
}

function fileExists(filename) {
  const filePath = safeFilePath(filename);
  return filePath && fs.existsSync(filePath);
}

function deleteFile(filename) {
  const filePath = safeFilePath(filename);
  if (!filePath || !fs.existsSync(filePath)) return false;
  fs.unlinkSync(filePath);
  return true;
}

function getStats() {
  ensureStorageDir();
  const files = listFiles();
  const totalSize = files.reduce((sum, file) => sum + file.size, 0);
  return {
    uploadDir: UPLOAD_DIR,
    count: files.length,
    totalSize,
    files,
  };
}

module.exports = {
  UPLOAD_DIR,
  ensureStorageDir,
  safeFilePath,
  tempFilePath,
  listFiles,
  fileExists,
  deleteFile,
  getStats,
};
