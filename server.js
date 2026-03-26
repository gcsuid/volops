const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const app = express();

// ─── Load .env file ────────────────────────────────────────────────────────────
function loadDotEnvFile() {
  const envPath = path.join(__dirname, '.env');
  if (!fs.existsSync(envPath)) return;
  const raw = fs.readFileSync(envPath, 'utf8');
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.replace(/^\uFEFF/, '').trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const sepIndex = trimmed.indexOf('=');
    if (sepIndex <= 0) continue;
    const key = trimmed.slice(0, sepIndex).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) continue;
    let value = trimmed.slice(sepIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}
loadDotEnvFile();

// ─── Configuration ─────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;

// TODO: Replace with your MongoDB connection string when ready to integrate.
// The driver (e.g. `mongodb` or `mongoose`) is not installed yet – add it then.
const MONGODB_URL = process.env.MONGODB_URL || '';

if (MONGODB_URL) {
  console.log('[db] MONGODB_URL is set. Integrate the MongoDB driver here when ready.');
} else {
  console.log('[db] No MONGODB_URL – using local JSON file store (data/).');
}

// ─── Middleware ────────────────────────────────────────────────────────────────
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// ─── Local JSON file store (swap out for MongoDB later) ────────────────────────
const DATA_DIR = path.join(__dirname, 'data');
const ORGS_FILE = path.join(DATA_DIR, 'orgs.json');
const DRIVES_FILE = path.join(DATA_DIR, 'drives.json');

function readJSON(file, fallback) {
  try {
    if (fs.existsSync(file)) return JSON.parse(fs.readFileSync(file, 'utf8'));
  } catch {}
  return fallback;
}

function writeJSON(file, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.writeFileSync(file, JSON.stringify(data, null, 2));
}

// ─── Session store (in-memory; replace with DB-backed sessions with MongoDB) ───
const sessions = new Map(); // token → { companyId, expiresAt }

// Periodically purge expired sessions to avoid unbounded memory growth
setInterval(() => {
  const now = Date.now();
  for (const [t, s] of sessions) {
    if (now > s.expiresAt) sessions.delete(t);
  }
}, 60 * 60 * 1000); // every hour

function generateToken() {
  return crypto.randomBytes(32).toString('hex');
}

function generateCompanyId() {
  return 'ORG-' + crypto.randomInt(100000, 999999);
}

function generateDriveId() {
  return 'DRV-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

// ─── Auth middleware ───────────────────────────────────────────────────────────
function requireAuth(req, res, next) {
  const token = req.headers['x-session-token'];
  const session = token && sessions.get(token);
  if (!session || Date.now() > session.expiresAt) {
    return res.status(401).json({ error: 'Unauthorized. Please log in.' });
  }
  req.companyId = session.companyId;
  next();
}

// ─── Sample drives seeded on first signup ─────────────────────────────────────
function seedSampleDrives(companyId) {
  const drives = readJSON(DRIVES_FILE, []);

  const samples = [
    {
      id: generateDriveId(),
      companyId,
      name: 'Food Bank Collection Drive',
      date: '2025-02-10',
      location: 'Downtown Community Centre',
      attendees: [
        { name: 'Priya Sharma', email: 'priya@example.com', phone: '9876543210', checkInTime: '09:15 AM' },
        { name: 'Rahul Mehta', email: 'rahul@example.com', phone: '9123456789', checkInTime: '09:30 AM' },
        { name: 'Anjali Singh', email: 'anjali@example.com', phone: '9988776655', checkInTime: '10:00 AM' }
      ]
    },
    {
      id: generateDriveId(),
      companyId,
      name: 'Tree Plantation Drive',
      date: '2025-03-05',
      location: 'City Park, Sector 7',
      attendees: [
        { name: 'Karan Patel', email: 'karan@example.com', phone: '9001234567', checkInTime: '07:45 AM' },
        { name: 'Meena Iyer', email: 'meena@example.com', phone: '9012345678', checkInTime: '08:00 AM' }
      ]
    },
    {
      id: generateDriveId(),
      companyId,
      name: 'Blood Donation Camp',
      date: '2025-03-22',
      location: 'General Hospital Auditorium',
      attendees: [
        { name: 'Suresh Nair', email: 'suresh@example.com', phone: '9111222333', checkInTime: '10:30 AM' },
        { name: 'Divya Reddy', email: 'divya@example.com', phone: '9222333444', checkInTime: '11:00 AM' },
        { name: 'Arjun Das', email: 'arjun@example.com', phone: '9333444555', checkInTime: '11:15 AM' },
        { name: 'Nisha Thomas', email: 'nisha@example.com', phone: '9444555666', checkInTime: '12:00 PM' }
      ]
    }
  ];

  drives.push(...samples);
  writeJSON(DRIVES_FILE, drives);
}

// ─── API: Organisation Signup ──────────────────────────────────────────────────
app.post('/api/org/signup', (req, res) => {
  const { email, pocName } = req.body;
  if (!email || !pocName) {
    return res.status(400).json({ error: 'Email and POC name are required.' });
  }

  const orgs = readJSON(ORGS_FILE, []);
  if (orgs.find(o => o.email.toLowerCase() === email.toLowerCase())) {
    return res.status(400).json({ error: 'An organisation with this email already exists.' });
  }

  const companyId = generateCompanyId();
  const org = { companyId, email, pocName, createdAt: new Date().toISOString() };
  orgs.push(org);
  writeJSON(ORGS_FILE, orgs);

  seedSampleDrives(companyId);

  const token = generateToken();
  sessions.set(token, { companyId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

  res.json({ companyId, pocName, token });
});

// ─── API: Organisation Login ───────────────────────────────────────────────────
app.post('/api/org/login', (req, res) => {
  const { companyId } = req.body;
  if (!companyId) {
    return res.status(400).json({ error: 'Company ID is required.' });
  }

  const orgs = readJSON(ORGS_FILE, []);
  const org = orgs.find(o => o.companyId === companyId.trim().toUpperCase());
  if (!org) {
    return res.status(401).json({ error: 'Invalid Company ID. Please check and try again.' });
  }

  const token = generateToken();
  sessions.set(token, { companyId: org.companyId, expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 });

  res.json({ companyId: org.companyId, pocName: org.pocName, token });
});

// ─── API: Organisation Profile ─────────────────────────────────────────────────
app.get('/api/org/me', requireAuth, (req, res) => {
  const orgs = readJSON(ORGS_FILE, []);
  const org = orgs.find(o => o.companyId === req.companyId);
  if (!org) return res.status(404).json({ error: 'Organisation not found.' });
  res.json({ companyId: org.companyId, pocName: org.pocName, email: org.email });
});

// ─── API: List Drives ──────────────────────────────────────────────────────────
app.get('/api/org/drives', requireAuth, (req, res) => {
  const drives = readJSON(DRIVES_FILE, []);
  const orgDrives = drives
    .filter(d => d.companyId === req.companyId)
    .map(d => ({
      id: d.id,
      name: d.name,
      date: d.date,
      location: d.location,
      attendeeCount: (d.attendees || []).length
    }));
  res.json(orgDrives);
});

// ─── API: Get Drive Detail ─────────────────────────────────────────────────────
app.get('/api/org/drives/:driveId', requireAuth, (req, res) => {
  const drives = readJSON(DRIVES_FILE, []);
  const drive = drives.find(d => d.id === req.params.driveId && d.companyId === req.companyId);
  if (!drive) return res.status(404).json({ error: 'Drive not found.' });
  res.json(drive);
});

// ─── API: Download Drive Data as CSV ──────────────────────────────────────────
app.get('/api/org/drives/:driveId/download', requireAuth, (req, res) => {
  const drives = readJSON(DRIVES_FILE, []);
  const drive = drives.find(d => d.id === req.params.driveId && d.companyId === req.companyId);
  if (!drive) return res.status(404).json({ error: 'Drive not found.' });

  const lines = ['Name,Email,Phone,CheckInTime'];
  for (const a of drive.attendees || []) {
    const safe = v => `"${String(v || '').replace(/"/g, '""')}"`;
    lines.push([safe(a.name), safe(a.email), safe(a.phone), safe(a.checkInTime)].join(','));
  }

  const filename = drive.name.replace(/[^a-z0-9]/gi, '_') + '.csv';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(lines.join('\n'));
});

// ─── Serve SPA ─────────────────────────────────────────────────────────────────
app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`VolOps running at http://localhost:${PORT}`);
});
