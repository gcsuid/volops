const crypto = require('crypto');

function generateId(prefix) {
  return `${prefix}-${crypto.randomInt(100000, 999999)}`;
}

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateOrgCode() {
  return crypto.randomInt(1000000000, 9999999999).toString();
}

function generateQrSecret() {
  return crypto.randomBytes(16).toString('hex');
}

function generatePassword() {
  return crypto.randomInt(100000, 999999).toString();
}

module.exports = {
  generateId,
  generateToken,
  generateOrgCode,
  generateQrSecret,
  generatePassword
};
