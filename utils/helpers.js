function escHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(date) {
  if (!date) return null;
  return new Date(date).toISOString();
}

function formatDateLocal(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });
}

function formatDateShort(date) {
  if (!date) return '—';
  return new Date(date).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short'
  });
}

function successResponse(res, data, statusCode = 200) {
  return res.status(statusCode).json(data);
}

function errorResponse(res, message, statusCode = 400) {
  return res.status(statusCode).json({ error: message });
}

module.exports = {
  escHtml,
  formatDate,
  formatDateLocal,
  formatDateShort,
  successResponse,
  errorResponse
};
