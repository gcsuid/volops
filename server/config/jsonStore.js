const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

let db = { volunteers: [], organizations: [], site_managers: [], drives: [], registrations: [] };
const dataPath = path.join(__dirname, '..', '..', 'data', 'db.json');

function saveDb() {
  try {
    fs.mkdirSync(path.dirname(dataPath), { recursive: true });
    fs.writeFileSync(dataPath, JSON.stringify(db, null, 2));
  } catch (e) {
    console.error('[json-store] Failed to save:', e.message);
  }
}

function loadDb() {
  try {
    if (fs.existsSync(dataPath)) {
      const raw = fs.readFileSync(dataPath, 'utf8');
      db = JSON.parse(raw);
    }
  } catch (e) {
    db = { volunteers: [], organizations: [], site_managers: [], drives: [], registrations: [] };
  }
}

loadDb();

function findOne(collection, query) {
  const col = db[collection] || [];
  return col.find(item => {
    return Object.entries(query).every(([key, value]) => item[key] === value);
  });
}

function findById(collection, id) {
  const col = db[collection] || [];
  return col.find(item => item._id === id || item.id === id);
}

function find(collection, query = {}) {
  const col = db[collection] || [];
  if (Object.keys(query).length === 0) return col;
  return col.filter(item => {
    return Object.entries(query).every(([key, value]) => item[key] === value);
  });
}

function create(collection, data) {
  const col = db[collection] || [];
  const doc = {
    ...data,
    _id: data._id || crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  col.push(doc);
  db[collection] = col;
  saveDb();
  return doc;
}

function findOneAndUpdate(collection, query, updates) {
  const col = db[collection] || [];
  const index = col.findIndex(item => {
    return Object.entries(query).every(([key, value]) => item[key] === value);
  });
  if (index === -1) return null;
  col[index] = { ...col[index], ...updates, updatedAt: new Date().toISOString() };
  db[collection] = col;
  saveDb();
  return col[index];
}

function countDocuments(collection, query = {}) {
  const col = find(collection, query);
  return col.length;
}

function isMongoConnected() {
  return false;
}

module.exports = {
  findOne,
  findById,
  find,
  create,
  findOneAndUpdate,
  countDocuments,
  isMongoConnected,
  saveDb
};
