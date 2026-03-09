const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3000;

// Supabase Admin client (uses service role key to bypass email rate limits)
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
let supabaseAdmin = null;
if (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
}

const dataDir = path.join(__dirname, 'data');
const dataFile = path.join(dataDir, 'db.json');
const otpChallenges = new Map();
const orgOtpChallenges = new Map();
const siteManagerOtpChallenges = new Map();
const authSessions = new Map();
const DUMMY_TEST_OTP = '111111';
const DUMMY_IDENTIFIERS = new Set([
  'demo.volunteer@volops.dev',
  '+15550000001',
  'demo.org@volops.dev',
  '+15550000002',
  'demo.manager@volops.dev',
  '+15550000003'
]);

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

function seedData() {
  const defaultOrgCode = deriveOrganizationCode('org-1');
  const defaultCompanyId = 'CMP-1001';
  return {
    organizations: [
      {
        id: 'org-1',
        name: 'Community Care Network',
        location: 'Springfield',
        companyId: defaultCompanyId,
        identityKey: normalizeIdentity('email', 'demo.org@volops.dev'),
        loginMethod: 'email',
        email: 'demo.org@volops.dev',
        contactEmail: 'demo.org@volops.dev',
        passwordHash: hashPassword('demo123'),
        phone: '',
        orgCodeHash: hashText(defaultOrgCode),
        createdAt: new Date().toISOString()
      }
    ],
    sites: [
      {
        id: 'site-1',
        orgId: 'org-1',
        name: 'Downtown Food Hub',
        address: '12 Main St, Springfield',
        latitude: 40.7128,
        longitude: -74.006,
        geofenceRadiusMeters: 180
      }
    ],
    events: [],
    drives: [],
    sessions: [],
    geofenceAlerts: [],
    volunteers: [
      {
        id: 'vol-test-1',
        volId: 'VOL-100001',
        identityKey: normalizeIdentity('email', 'demo.volunteer@volops.dev'),
        loginMethod: 'email',
        email: 'demo.volunteer@volops.dev',
        passwordHash: hashPassword('demo123'),
        phone: '',
        name: 'Demo Volunteer',
        age: 22,
        gender: 'Male',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
    ],
    siteManagers: [
      {
        id: 'mgr-test-1',
        orgId: 'org-1',
        managerName: 'Demo Manager',
        identityKey: normalizeIdentity('email', 'demo.manager@volops.dev'),
        loginMethod: 'email',
        email: 'demo.manager@volops.dev',
        uniqueManagerId: 'MGR-1001',
        phone: '',
        createdAt: new Date().toISOString()
      }
    ]
  };
}

function ensureDataStore() {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(dataFile)) {
    fs.writeFileSync(dataFile, JSON.stringify(seedData(), null, 2), 'utf8');
  }
}

function readDb() {
  ensureDataStore();
  const db = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
  let changed = false;
  if (!Array.isArray(db.volunteers)) {
    db.volunteers = [];
    changed = true;
  }
  if (!Array.isArray(db.drives)) {
    db.drives = [];
    changed = true;
  }
  if (!Array.isArray(db.siteManagers)) {
    db.siteManagers = [];
    changed = true;
  }
  for (const org of db.organizations) {
    if (!org.location) {
      org.location = '';
      changed = true;
    }
    if (org.id === 'org-1') {
      if (!org.identityKey) {
        org.identityKey = normalizeIdentity('email', 'demo.org@volops.dev');
        changed = true;
      }
      if (!org.loginMethod) {
        org.loginMethod = 'email';
        changed = true;
      }
      if (!org.email) {
        org.email = 'demo.org@volops.dev';
        changed = true;
      }
      if (!org.contactEmail) {
        org.contactEmail = 'demo.org@volops.dev';
        changed = true;
      }
      if (!org.companyId) {
        org.companyId = 'CMP-1001';
        changed = true;
      }
      if (!org.passwordHash) {
        org.passwordHash = hashPassword('demo123');
        changed = true;
      }
      if (!org.location) {
        org.location = 'Springfield';
        changed = true;
      }
    }
    if (!org.orgCodeHash) {
      const code = deriveOrganizationCode(org.id);
      org.orgCodeHash = hashText(code);
      changed = true;
    }
  }
  for (const v of db.volunteers) {
    if (!v.passwordHash) {
      v.passwordHash = v.email === 'demo.volunteer@volops.dev' ? hashPassword('demo123') : '';
      changed = true;
    }
    if (!v.volId) {
      v.volId = v.id === 'vol-test-1' ? 'VOL-100001' : generateUniqueVolId(db);
      changed = true;
    }
  }
  for (const m of db.siteManagers) {
    if (!m.uniqueManagerId) {
      m.uniqueManagerId = m.email === 'demo.manager@volops.dev' ? 'MGR-1001' : generateUniqueManagerId(db);
      changed = true;
    }
  }
  if (changed) writeDb(db);
  return db;
}

function writeDb(db) {
  fs.writeFileSync(dataFile, JSON.stringify(db, null, 2), 'utf8');
}

function haversineDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const toRad = (v) => (v * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function escapeCsv(v) {
  const value = (v ?? '').toString();
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formatDurationHours(ms) {
  if (!ms || ms < 0) return '0.00';
  return (ms / (1000 * 60 * 60)).toFixed(2);
}

function findEventByToken(db, token) {
  return db.events.find((e) => e.token === token);
}

function enrichSession(db, session) {
  const event = db.events.find((e) => e.id === session.eventId);
  const drive = db.drives.find((d) => d.id === session.driveId);
  const site = event ? db.sites.find((s) => s.id === event.siteId) : null;
  const org = drive
    ? db.organizations.find((o) => o.id === drive.orgId)
    : site ? db.organizations.find((o) => o.id === site.orgId) : null;
  const endMs = session.timeOut ? new Date(session.timeOut).getTime() : Date.now();
  const startMs = new Date(session.timeIn).getTime();
  return {
    ...session,
    eventName: event?.name || (drive ? 'Site Manager Drive' : ''),
    activity: session.activity || event?.activity || 'General Drive',
    siteName: site?.name || drive?.location || '',
    siteAddress: site?.address || drive?.location || '',
    orgName: org?.name || '',
    hoursDevoted: formatDurationHours(endMs - startMs)
  };
}

function normalizeIdentity(method, identifier) {
  return `${method}:${String(identifier || '').trim().toLowerCase()}`;
}

function hashText(value) {
  return crypto.createHash('sha256').update(String(value || '')).digest('hex');
}

function hashPassword(password) {
  return hashText(`pw:${String(password || '')}`);
}

function verifyPassword(password, hash) {
  return hashPassword(password) === hash;
}

function generateUniqueCompanyId(db) {
  let id = '';
  do {
    id = `CMP-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (db.organizations.some((o) => o.companyId === id));
  return id;
}

function generateUniqueManagerId(db) {
  let id = '';
  do {
    id = `MGR-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (db.siteManagers.some((m) => m.uniqueManagerId === id));
  return id;
}

function generateUniqueVolId(db) {
  let id = '';
  do {
    id = `VOL-${Math.floor(100000 + Math.random() * 900000)}`;
  } while (db.volunteers.some((v) => v.volId === id));
  return id;
}

function generateDriveCode(db) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  do {
    code = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
  } while (db.drives.some((d) => !d.deletedAt && d.driveCode === code));
  return code;
}

function deriveOrganizationCode(orgId) {
  const hashHex = hashText(`volops:${orgId}`);
  const big = BigInt(`0x${hashHex.slice(0, 13)}`);
  return String(big % 10000000000n).padStart(10, '0');
}

function findOrganizationByCode(db, code) {
  const codeHash = hashText(String(code || '').trim());
  return db.organizations.find((o) => o.orgCodeHash === codeHash) || null;
}

function normalizeLocationText(value) {
  return String(value || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function hasDriveConflict(existingDrive, startsAt, endsAt, locationText) {
  if (existingDrive.deletedAt) return false;
  if (normalizeLocationText(existingDrive.location) !== normalizeLocationText(locationText)) return false;
  const aStart = new Date(existingDrive.startsAt).getTime();
  const aEnd = new Date(existingDrive.endsAt).getTime();
  const bStart = new Date(startsAt).getTime();
  const bEnd = new Date(endsAt).getTime();
  return bStart < aEnd && aStart < bEnd;
}

function isValidOtpTarget(method, identifier) {
  if (method === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(identifier || '').trim());
  if (method === 'phone') return /^\+?[0-9]{8,15}$/.test(String(identifier || '').trim());
  return false;
}

function isDummyIdentifier(identifier) {
  return DUMMY_IDENTIFIERS.has(String(identifier || '').trim().toLowerCase());
}

function createAuthSession(role, payload) {
  const token = crypto.randomUUID();
  authSessions.set(token, {
    role,
    ...payload,
    expiresAt: Date.now() + (12 * 60 * 60 * 1000)
  });
  return token;
}

function readAuthSession(req) {
  const authHeader = req.headers.authorization || '';
  const [scheme, token] = authHeader.split(' ');
  if (scheme !== 'Bearer' || !token) return null;
  const session = authSessions.get(token);
  if (!session) return null;
  if (Date.now() > session.expiresAt) {
    authSessions.delete(token);
    return null;
  }
  return { token, ...session };
}

function requireRole(role) {
  return (req, res, next) => {
    const session = readAuthSession(req);
    if (!session || session.role !== role) {
      return res.status(401).json({ error: `${role} authentication required` });
    }
    req.auth = session;
    next();
  };
}

app.get('/api/bootstrap', (req, res) => {
  const db = readDb();
  res.json({ organizations: db.organizations, sites: db.sites, events: db.events });
});

app.post('/api/volunteers/request-otp', (req, res) => {
  const { method, identifier } = req.body || {};
  if (!method || !identifier) return res.status(400).json({ error: 'method and identifier are required' });
  if (!['email', 'phone'].includes(method)) return res.status(400).json({ error: 'method must be email or phone' });
  if (!isValidOtpTarget(method, identifier)) return res.status(400).json({ error: `Invalid ${method} format` });

  const otp = isDummyIdentifier(identifier) ? DUMMY_TEST_OTP : String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = crypto.randomUUID();
  otpChallenges.set(challengeId, {
    identityKey: normalizeIdentity(method, identifier),
    method,
    identifier: String(identifier).trim(),
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  // Demo OTP response. Replace with real email/SMS provider integration in production.
  res.json({ challengeId, expiresInSeconds: 300, demoOtp: otp });
});

app.post('/api/volunteers/verify-otp', (req, res) => {
  const { challengeId, otp } = req.body || {};
  if (!challengeId || !otp) return res.status(400).json({ error: 'challengeId and otp are required' });

  const challenge = otpChallenges.get(challengeId);
  if (!challenge) return res.status(404).json({ error: 'OTP challenge not found' });
  if (Date.now() > challenge.expiresAt) {
    otpChallenges.delete(challengeId);
    return res.status(400).json({ error: 'OTP expired. Request a new code.' });
  }
  if (String(otp).trim() !== challenge.otp) return res.status(400).json({ error: 'Invalid OTP' });

  const db = readDb();
  let volunteer = db.volunteers.find((v) => v.identityKey === challenge.identityKey);

  if (!volunteer) {
    const volId = generateUniqueVolId(db);
    volunteer = {
      id: crypto.randomUUID(),
      volId,
      identityKey: challenge.identityKey,
      loginMethod: challenge.method,
      email: challenge.method === 'email' ? challenge.identifier : '',
      phone: challenge.method === 'phone' ? challenge.identifier : '',
      name: '',
      age: null,
      gender: '',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    db.volunteers.push(volunteer);
    writeDb(db);
  }

  otpChallenges.delete(challengeId);
  const authToken = createAuthSession('volunteer', { volunteerId: volunteer.id });

  res.json({
    authToken,
    volunteer: {
      id: volunteer.id,
      volId: volunteer.volId || '',
      loginMethod: volunteer.loginMethod,
      email: volunteer.email,
      phone: volunteer.phone,
      name: volunteer.name,
      age: volunteer.age,
      gender: volunteer.gender
    },
    profileComplete: Boolean(volunteer.name && volunteer.age && volunteer.gender)
  });
});

app.post('/api/auth/volunteer/signup', (req, res) => {
  const { email, password, name, age, gender } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(name || '').trim();
  const cleanGender = String(gender || '').trim();
  const cleanAge = Number(age);
  if (!cleanEmail || !password || !cleanName || !cleanGender) {
    return res.status(400).json({ error: 'email, password, name, age and gender are required' });
  }
  if (!isValidOtpTarget('email', cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });
  if (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 120) return res.status(400).json({ error: 'Age must be 1-120' });

  const db = readDb();
  if (db.volunteers.some((v) => (v.email || '').toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Volunteer already registered. Please login.' });
  }

  const volId = generateUniqueVolId(db);
  const volunteer = {
    id: crypto.randomUUID(),
    volId,
    identityKey: normalizeIdentity('email', cleanEmail),
    loginMethod: 'email',
    email: cleanEmail,
    passwordHash: hashPassword(password),
    phone: '',
    name: cleanName,
    age: cleanAge,
    gender: cleanGender,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
  db.volunteers.push(volunteer);
  writeDb(db);

  const authToken = createAuthSession('volunteer', { volunteerId: volunteer.id });
  res.status(201).json({
    authToken,
    volunteer: {
      id: volunteer.id,
      volId: volunteer.volId,
      loginMethod: volunteer.loginMethod,
      email: volunteer.email,
      name: volunteer.name,
      age: volunteer.age,
      gender: volunteer.gender
    },
    profileComplete: true
  });
});

app.post('/api/auth/volunteer/login', (req, res) => {
  const { email, password } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  if (!cleanEmail || !password) return res.status(400).json({ error: 'email and password are required' });

  const db = readDb();
  const volunteer = db.volunteers.find((v) => (v.email || '').toLowerCase() === cleanEmail);
  if (!volunteer || !volunteer.passwordHash || !verifyPassword(password, volunteer.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const authToken = createAuthSession('volunteer', { volunteerId: volunteer.id });
  res.json({
    authToken,
    volunteer: {
      id: volunteer.id,
      volId: volunteer.volId || '',
      loginMethod: volunteer.loginMethod,
      email: volunteer.email,
      name: volunteer.name,
      age: volunteer.age,
      gender: volunteer.gender
    },
    profileComplete: Boolean(volunteer.name && volunteer.age && volunteer.gender)
  });
});

app.get('/api/volunteers/:id', requireRole('volunteer'), (req, res) => {
  if (req.auth.volunteerId !== req.params.id) return res.status(403).json({ error: 'Access denied' });
  const db = readDb();
  const volunteer = db.volunteers.find((v) => v.id === req.params.id);
  if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });
  res.json({
    volunteer: {
      id: volunteer.id,
      volId: volunteer.volId || '',
      loginMethod: volunteer.loginMethod,
      email: volunteer.email,
      phone: volunteer.phone,
      name: volunteer.name,
      age: volunteer.age,
      gender: volunteer.gender
    },
    profileComplete: Boolean(volunteer.name && volunteer.age && volunteer.gender)
  });
});

app.put('/api/volunteers/:id/profile', requireRole('volunteer'), (req, res) => {
  if (req.auth.volunteerId !== req.params.id) return res.status(403).json({ error: 'Access denied' });
  const { name, age, gender } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanGender = String(gender || '').trim();
  const cleanAge = Number(age);

  if (!cleanName) return res.status(400).json({ error: 'Name is required' });
  if (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 120) return res.status(400).json({ error: 'Age must be a valid number between 1 and 120' });
  if (!cleanGender) return res.status(400).json({ error: 'Gender is required' });

  const db = readDb();
  const volunteer = db.volunteers.find((v) => v.id === req.params.id);
  if (!volunteer) return res.status(404).json({ error: 'Volunteer not found' });

  volunteer.name = cleanName;
  volunteer.age = cleanAge;
  volunteer.gender = cleanGender;
  volunteer.updatedAt = new Date().toISOString();
  writeDb(db);

  res.json({
    volunteer: {
      id: volunteer.id,
      loginMethod: volunteer.loginMethod,
      email: volunteer.email,
      phone: volunteer.phone,
      name: volunteer.name,
      age: volunteer.age,
      gender: volunteer.gender
    },
    profileComplete: true
  });
});

app.post('/api/organizations', (req, res) => {
  const { name } = req.body || {};
  if (!name) return res.status(400).json({ error: 'Organization name is required' });

  const db = readDb();
  const id = crypto.randomUUID();
  const orgCode = deriveOrganizationCode(id);
  const org = {
    id,
    name: name.trim(),
    location: '',
    orgCodeHash: hashText(orgCode)
  };
  db.organizations.push(org);
  writeDb(db);
  res.status(201).json({ ...org, orgCode });
});

app.post('/api/orgs/request-otp', (req, res) => {
  const { method, identifier } = req.body || {};
  if (!method || !identifier) return res.status(400).json({ error: 'method and identifier are required' });
  if (!['email', 'phone'].includes(method)) return res.status(400).json({ error: 'method must be email or phone' });
  if (!isValidOtpTarget(method, identifier)) return res.status(400).json({ error: `Invalid ${method} format` });

  const otp = isDummyIdentifier(identifier) ? DUMMY_TEST_OTP : String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = crypto.randomUUID();
  orgOtpChallenges.set(challengeId, {
    identityKey: normalizeIdentity(method, identifier),
    method,
    identifier: String(identifier).trim(),
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });

  res.json({ challengeId, expiresInSeconds: 300, demoOtp: otp });
});

app.post('/api/orgs/verify-otp', (req, res) => {
  const { challengeId, otp, name, location } = req.body || {};
  if (!challengeId || !otp) return res.status(400).json({ error: 'challengeId and otp are required' });
  const challenge = orgOtpChallenges.get(challengeId);
  if (!challenge) return res.status(404).json({ error: 'OTP challenge not found' });
  if (Date.now() > challenge.expiresAt) {
    orgOtpChallenges.delete(challengeId);
    return res.status(400).json({ error: 'OTP expired. Request again.' });
  }
  if (String(otp).trim() !== challenge.otp) return res.status(400).json({ error: 'Invalid OTP' });

  const db = readDb();
  let organization = db.organizations.find((o) => o.identityKey === challenge.identityKey);

  if (!organization) {
    const cleanName = String(name || '').trim();
    const cleanLocation = String(location || '').trim();
    if (!cleanName || !cleanLocation) {
      return res.status(400).json({ error: 'New organization requires name and location' });
    }
    const id = crypto.randomUUID();
    const orgCode = deriveOrganizationCode(id);
    organization = {
      id,
      name: cleanName,
      location: cleanLocation,
      identityKey: challenge.identityKey,
      loginMethod: challenge.method,
      email: challenge.method === 'email' ? challenge.identifier : '',
      phone: challenge.method === 'phone' ? challenge.identifier : '',
      orgCodeHash: hashText(orgCode),
      createdAt: new Date().toISOString()
    };
    db.organizations.push(organization);
    writeDb(db);
  }

  orgOtpChallenges.delete(challengeId);
  const authToken = createAuthSession('organization', { orgId: organization.id });

  const orgCode = deriveOrganizationCode(organization.id);
  res.json({
    authToken,
    organization: {
      id: organization.id,
      name: organization.name,
      location: organization.location,
      loginMethod: organization.loginMethod || '',
      email: organization.email || '',
      phone: organization.phone || ''
    },
    orgCode
  });
});

app.post('/api/auth/organization/signup', (req, res) => {
  const { name, location, contactEmail, password } = req.body || {};
  const cleanName = String(name || '').trim();
  const cleanLocation = String(location || '').trim();
  const cleanEmail = String(contactEmail || '').trim().toLowerCase();
  if (!cleanName || !cleanLocation || !cleanEmail || !password) {
    return res.status(400).json({ error: 'name, location, contactEmail and password are required' });
  }
  if (!isValidOtpTarget('email', cleanEmail)) return res.status(400).json({ error: 'Invalid contact email' });

  const db = readDb();
  if (db.organizations.some((o) => (o.contactEmail || o.email || '').toLowerCase() === cleanEmail)) {
    return res.status(409).json({ error: 'Organization already registered. Please login.' });
  }

  const id = crypto.randomUUID();
  const companyId = generateUniqueCompanyId(db);
  const orgCode = deriveOrganizationCode(id);
  const organization = {
    id,
    name: cleanName,
    location: cleanLocation,
    companyId,
    contactEmail: cleanEmail,
    email: cleanEmail,
    passwordHash: hashPassword(password),
    identityKey: normalizeIdentity('email', cleanEmail),
    loginMethod: 'email',
    phone: '',
    orgCodeHash: hashText(orgCode),
    createdAt: new Date().toISOString()
  };
  db.organizations.push(organization);
  writeDb(db);

  const authToken = createAuthSession('organization', { orgId: organization.id });
  res.status(201).json({
    authToken,
    organization: {
      id: organization.id,
      name: organization.name,
      location: organization.location,
      companyId: organization.companyId,
      contactEmail: organization.contactEmail
    },
    orgCode
  });
});

app.post('/api/auth/organization/login', (req, res) => {
  const { companyId, password } = req.body || {};
  const cleanCompanyId = String(companyId || '').trim().toUpperCase();
  if (!cleanCompanyId || !password) return res.status(400).json({ error: 'companyId and password are required' });

  const db = readDb();
  const organization = db.organizations.find((o) => (o.companyId || '').toUpperCase() === cleanCompanyId);
  if (!organization || !organization.passwordHash || !verifyPassword(password, organization.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const authToken = createAuthSession('organization', { orgId: organization.id });
  const orgCode = deriveOrganizationCode(organization.id);
  res.json({
    authToken,
    organization: {
      id: organization.id,
      name: organization.name,
      location: organization.location,
      companyId: organization.companyId,
      contactEmail: organization.contactEmail || organization.email || ''
    },
    orgCode
  });
});

app.get('/api/orgs/:orgId/sheet', requireRole('organization'), (req, res) => {
  if (req.auth.orgId !== req.params.orgId) return res.status(403).json({ error: 'Access denied' });
  const db = readDb();
  const org = db.organizations.find((o) => o.id === req.params.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const date = String(req.query.date || new Date().toISOString().slice(0, 10));
  const start = new Date(`${date}T00:00:00.000Z`).getTime();
  const end = new Date(`${date}T23:59:59.999Z`).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return res.status(400).json({ error: 'Invalid date' });

  const drives = db.drives.filter((d) => !d.deletedAt && d.orgId === org.id);
  const rows = [];
  for (const drive of drives) {
    const sessions = db.sessions.filter((s) => s.driveId === drive.id);
    for (const s of sessions) {
      const tin = new Date(s.timeIn).getTime();
      if (tin < start || tin > end) continue;
      rows.push({
        sessionId: s.id,
        driveId: drive.id,
        driveLocation: drive.location,
        driveStartsAt: drive.startsAt,
        driveEndsAt: drive.endsAt,
        name: s.name,
        age: s.age ?? '',
        gender: s.gender ?? '',
        timeIn: s.timeIn,
        timeOut: s.timeOut || '',
        hoursDevoted: enrichSession(db, s).hoursDevoted
      });
    }
  }

  rows.sort((a, b) => new Date(a.timeIn).getTime() - new Date(b.timeIn).getTime());
  res.json({ organization: { id: org.id, name: org.name, location: org.location }, date, rows });
});

// Org: get all drives under org
app.get('/api/orgs/:orgId/drives', requireRole('organization'), (req, res) => {
  if (req.auth.orgId !== req.params.orgId) return res.status(403).json({ error: 'Access denied' });
  const db = readDb();
  const org = db.organizations.find((o) => o.id === req.params.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const drives = db.drives
    .filter((d) => !d.deletedAt && d.orgId === org.id)
    .sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime())
    .map((d) => ({
      ...d,
      volunteerCount: db.sessions.filter((s) => s.driveId === d.id).length
    }));
  res.json({ drives });
});

// Org: delete (override) a specific volunteer session
app.delete('/api/orgs/:orgId/sessions/:sessionId', requireRole('organization'), (req, res) => {
  if (req.auth.orgId !== req.params.orgId) return res.status(403).json({ error: 'Access denied' });
  const db = readDb();
  const org = db.organizations.find((o) => o.id === req.params.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  const sessionIdx = db.sessions.findIndex((s) => s.id === req.params.sessionId);
  if (sessionIdx === -1) return res.status(404).json({ error: 'Session not found' });

  const session = db.sessions[sessionIdx];
  // Verify session belongs to this org via its drive
  const drive = session.driveId ? db.drives.find((d) => d.id === session.driveId) : null;
  const event = session.eventId ? db.events.find((e) => e.id === session.eventId) : null;
  const site = event ? db.sites.find((s) => s.id === event.siteId) : null;
  const sessionOrgId = drive ? drive.orgId : (site ? site.orgId : null);
  if (sessionOrgId !== org.id) return res.status(403).json({ error: 'Session does not belong to this organization' });

  db.sessions.splice(sessionIdx, 1);
  writeDb(db);
  res.json({ deleted: true });
});

app.post('/api/site-manager/request-otp', (req, res) => {
  const { method, identifier } = req.body || {};
  if (!method || !identifier) return res.status(400).json({ error: 'method and identifier are required' });
  if (!['email', 'phone'].includes(method)) return res.status(400).json({ error: 'method must be email or phone' });
  if (!isValidOtpTarget(method, identifier)) return res.status(400).json({ error: `Invalid ${method} format` });

  const otp = isDummyIdentifier(identifier) ? DUMMY_TEST_OTP : String(Math.floor(100000 + Math.random() * 900000));
  const challengeId = crypto.randomUUID();
  siteManagerOtpChallenges.set(challengeId, {
    identityKey: normalizeIdentity(method, identifier),
    method,
    identifier: String(identifier).trim(),
    otp,
    expiresAt: Date.now() + 5 * 60 * 1000
  });
  res.json({ challengeId, expiresInSeconds: 300, demoOtp: otp });
});

app.post('/api/site-manager/verify-otp', (req, res) => {
  const { challengeId, otp, managerName, organizationName, orgCode } = req.body || {};
  if (!challengeId || !otp) return res.status(400).json({ error: 'challengeId and otp are required' });
  if (!managerName || !orgCode) return res.status(400).json({ error: 'managerName and orgCode are required' });

  const challenge = siteManagerOtpChallenges.get(challengeId);
  if (!challenge) return res.status(404).json({ error: 'OTP challenge not found' });
  if (Date.now() > challenge.expiresAt) {
    siteManagerOtpChallenges.delete(challengeId);
    return res.status(400).json({ error: 'OTP expired. Request again.' });
  }
  if (String(otp).trim() !== challenge.otp) return res.status(400).json({ error: 'Invalid OTP' });

  const db = readDb();
  const organization = findOrganizationByCode(db, orgCode);
  if (!organization) return res.status(404).json({ error: 'Invalid organization code' });
  if (organizationName && String(organizationName).trim().toLowerCase() !== organization.name.toLowerCase()) {
    return res.status(400).json({ error: 'Organization name does not match code' });
  }

  let manager = db.siteManagers.find((m) => m.identityKey === challenge.identityKey && m.orgId === organization.id);
  if (!manager) {
    manager = {
      id: crypto.randomUUID(),
      orgId: organization.id,
      managerName: String(managerName).trim(),
      identityKey: challenge.identityKey,
      loginMethod: challenge.method,
      email: challenge.method === 'email' ? challenge.identifier : '',
      phone: challenge.method === 'phone' ? challenge.identifier : '',
      createdAt: new Date().toISOString()
    };
    db.siteManagers.push(manager);
    writeDb(db);
  }

  siteManagerOtpChallenges.delete(challengeId);
  const authToken = createAuthSession('site_manager', { managerId: manager.id, orgId: organization.id });
  res.json({
    authToken,
    manager: {
      id: manager.id,
      managerName: manager.managerName,
      orgId: manager.orgId
    },
    organization: {
      id: organization.id,
      name: organization.name
    }
  });
});

app.post('/api/auth/site-manager/signup', (req, res) => {
  const { email, managerName, companyId } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanName = String(managerName || '').trim();
  const cleanCompanyId = String(companyId || '').trim().toUpperCase();
  if (!cleanEmail || !cleanName || !cleanCompanyId) {
    return res.status(400).json({ error: 'email, managerName and companyId are required' });
  }
  if (!isValidOtpTarget('email', cleanEmail)) return res.status(400).json({ error: 'Invalid email format' });

  const db = readDb();
  const organization = db.organizations.find((o) => (o.companyId || '').toUpperCase() === cleanCompanyId);
  if (!organization) return res.status(404).json({ error: 'Invalid companyId' });
  if (db.siteManagers.some((m) => (m.email || '').toLowerCase() === cleanEmail && m.orgId === organization.id)) {
    return res.status(409).json({ error: 'Site manager already registered for this company. Please login.' });
  }

  const uniqueManagerId = generateUniqueManagerId(db);
  const manager = {
    id: crypto.randomUUID(),
    orgId: organization.id,
    managerName: cleanName,
    identityKey: normalizeIdentity('email', cleanEmail),
    loginMethod: 'email',
    email: cleanEmail,
    uniqueManagerId,
    phone: '',
    createdAt: new Date().toISOString()
  };
  db.siteManagers.push(manager);
  writeDb(db);

  const authToken = createAuthSession('site_manager', { managerId: manager.id, orgId: organization.id });
  res.status(201).json({
    authToken,
    manager: {
      id: manager.id,
      managerName: manager.managerName,
      email: manager.email,
      uniqueManagerId: manager.uniqueManagerId
    },
    organization: {
      id: organization.id,
      name: organization.name,
      companyId: organization.companyId
    }
  });
});

app.post('/api/auth/site-manager/login', (req, res) => {
  const { email, uniqueManagerId } = req.body || {};
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanUniqueId = String(uniqueManagerId || '').trim().toUpperCase();
  if (!cleanEmail || !cleanUniqueId) return res.status(400).json({ error: 'email and uniqueManagerId are required' });

  const db = readDb();
  const manager = db.siteManagers.find((m) =>
    (m.email || '').toLowerCase() === cleanEmail &&
    (m.uniqueManagerId || '').toUpperCase() === cleanUniqueId
  );
  if (!manager) return res.status(401).json({ error: 'Invalid credentials' });

  const organization = db.organizations.find((o) => o.id === manager.orgId);
  if (!organization) return res.status(404).json({ error: 'Organization not found' });

  const authToken = createAuthSession('site_manager', { managerId: manager.id, orgId: organization.id });
  res.json({
    authToken,
    manager: {
      id: manager.id,
      managerName: manager.managerName,
      email: manager.email,
      uniqueManagerId: manager.uniqueManagerId
    },
    organization: {
      id: organization.id,
      name: organization.name,
      companyId: organization.companyId
    }
  });
});

app.post('/api/site-manager/drives', requireRole('site_manager'), (req, res) => {
  const { managerName, organizationName, orgCode, location, startsAt, endsAt } = req.body || {};
  if (!managerName || !orgCode || !location || !startsAt || !endsAt) {
    return res.status(400).json({ error: 'managerName, orgCode, location, startsAt and endsAt are required' });
  }

  const startsMs = new Date(startsAt).getTime();
  const endsMs = new Date(endsAt).getTime();
  if (Number.isNaN(startsMs) || Number.isNaN(endsMs) || startsMs >= endsMs) {
    return res.status(400).json({ error: 'Invalid start/end time window' });
  }

  const db = readDb();
  const organization = findOrganizationByCode(db, orgCode);
  if (!organization) return res.status(404).json({ error: 'Invalid organization code' });
  if (req.auth.orgId !== organization.id) return res.status(403).json({ error: 'Access denied for this organization' });
  if (organizationName && String(organizationName).trim().toLowerCase() !== organization.name.toLowerCase()) {
    return res.status(400).json({ error: 'Organization name does not match code' });
  }

  const conflict = db.drives.find((d) =>
    d.orgId === organization.id && hasDriveConflict(d, startsAt, endsAt, location)
  );
  if (conflict) {
    return res.status(409).json({ error: 'A drive already exists for this organization in the same area/time. Delete the wrong one first.' });
  }

  const token = crypto.randomUUID();
  const driveCode = generateDriveCode(db);
  const drive = {
    id: crypto.randomUUID(),
    managerName: String(managerName).trim(),
    orgId: organization.id,
    orgName: organization.name,
    orgCodeHash: organization.orgCodeHash,
    location: String(location).trim(),
    startsAt: new Date(startsAt).toISOString(),
    endsAt: new Date(endsAt).toISOString(),
    token,
    driveCode,
    completedAt: null,
    createdAt: new Date().toISOString(),
    deletedAt: null
  };
  db.drives.push(drive);
  writeDb(db);

  const checkinUrl = `${req.protocol}://${req.get('host')}/volunteer.html?driveToken=${token}`;
  res.status(201).json({ drive, checkinUrl });
});

app.delete('/api/site-manager/drives/:driveId', requireRole('site_manager'), (req, res) => {
  const db = readDb();
  const drive = db.drives.find((d) => d.id === req.params.driveId);
  if (!drive) return res.status(404).json({ error: 'Drive not found' });
  if (req.auth.orgId !== drive.orgId) return res.status(403).json({ error: 'Access denied for this drive' });
  drive.deletedAt = new Date().toISOString();
  writeDb(db);
  res.json({ deleted: true });
});

app.post('/api/site-manager/drives/:driveId/complete', requireRole('site_manager'), (req, res) => {
  const db = readDb();
  const drive = db.drives.find((d) => d.id === req.params.driveId);
  if (!drive) return res.status(404).json({ error: 'Drive not found' });
  if (req.auth.orgId !== drive.orgId) return res.status(403).json({ error: 'Access denied for this drive' });
  if (drive.deletedAt) return res.status(400).json({ error: 'Drive is already deleted' });
  if (drive.completedAt) return res.status(400).json({ error: 'Drive is already completed' });
  drive.completedAt = new Date().toISOString();
  // Auto-checkout all still-active sessions for this drive
  for (const s of db.sessions) {
    if (s.driveId === drive.id && !s.timeOut) {
      s.timeOut = drive.completedAt;
    }
  }
  writeDb(db);
  res.json({ completed: true, completedAt: drive.completedAt });
});

app.get('/api/site-manager/drives', requireRole('site_manager'), (req, res) => {
  const { orgCode } = req.query;
  const db = readDb();
  let rows = db.drives.filter((d) => !d.deletedAt);
  if (orgCode) {
    const org = findOrganizationByCode(db, orgCode);
    if (!org) return res.status(404).json({ error: 'Invalid organization code' });
    if (req.auth.orgId !== org.id) return res.status(403).json({ error: 'Access denied for this organization' });
    rows = rows.filter((d) => d.orgId === org.id);
  } else {
    rows = rows.filter((d) => d.orgId === req.auth.orgId);
  }
  rows = rows.sort((a, b) => new Date(b.startsAt).getTime() - new Date(a.startsAt).getTime());
  const drivesWithCount = rows.map((d) => ({
    ...d,
    volunteerCount: db.sessions.filter((s) => s.driveId === d.id).length
  }));
  res.json({ drives: drivesWithCount });
});

app.get('/api/drives/token/:token', (req, res) => {
  const db = readDb();
  const drive = db.drives.find((d) => d.token === req.params.token && !d.deletedAt);
  if (!drive) return res.status(404).json({ error: 'Invalid or deleted drive token' });
  const org = db.organizations.find((o) => o.id === drive.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({
    drive: {
      id: drive.id,
      driveCode: drive.driveCode || '',
      managerName: drive.managerName,
      location: drive.location,
      startsAt: drive.startsAt,
      endsAt: drive.endsAt,
      completedAt: drive.completedAt || null
    },
    organization: {
      id: org.id,
      name: org.name
    }
  });
});

// Look up drive by short driveCode (public endpoint for volunteer entry)
app.get('/api/drives/code/:driveCode', (req, res) => {
  const db = readDb();
  const code = String(req.params.driveCode || '').trim().toUpperCase();
  const drive = db.drives.find((d) => !d.deletedAt && (d.driveCode || '').toUpperCase() === code);
  if (!drive) return res.status(404).json({ error: 'Invalid drive code' });
  const org = db.organizations.find((o) => o.id === drive.orgId);
  if (!org) return res.status(404).json({ error: 'Organization not found' });

  res.json({
    drive: {
      id: drive.id,
      driveCode: drive.driveCode || '',
      token: drive.token,
      managerName: drive.managerName,
      location: drive.location,
      startsAt: drive.startsAt,
      endsAt: drive.endsAt,
      completedAt: drive.completedAt || null
    },
    organization: {
      id: org.id,
      name: org.name
    }
  });
});

app.post('/api/sites', requireRole('organization'), (req, res) => {
  const { orgId, name, address, latitude, longitude, geofenceRadiusMeters } = req.body || {};
  if (!orgId || !name || !address) return res.status(400).json({ error: 'orgId, name and address are required' });
  if (req.auth.orgId !== orgId) return res.status(403).json({ error: 'Access denied for this organization' });

  const db = readDb();
  if (!db.organizations.find((o) => o.id === orgId)) {
    return res.status(404).json({ error: 'Organization not found' });
  }

  const site = {
    id: crypto.randomUUID(),
    orgId,
    name: name.trim(),
    address: address.trim(),
    latitude: Number(latitude),
    longitude: Number(longitude),
    geofenceRadiusMeters: Number(geofenceRadiusMeters) || 150
  };

  if (Number.isNaN(site.latitude) || Number.isNaN(site.longitude)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  db.sites.push(site);
  writeDb(db);
  res.status(201).json(site);
});

app.post('/api/events', requireRole('organization'), (req, res) => {
  const { siteId, name, activity, startsAt } = req.body || {};
  if (!siteId || !name) return res.status(400).json({ error: 'siteId and event name are required' });

  const db = readDb();
  const site = db.sites.find((s) => s.id === siteId);
  if (!site) return res.status(404).json({ error: 'Site not found' });
  if (req.auth.orgId !== site.orgId) return res.status(403).json({ error: 'Access denied for this site' });

  const token = crypto.randomUUID();
  const event = {
    id: crypto.randomUUID(),
    siteId,
    name: name.trim(),
    activity: (activity || '').trim(),
    startsAt: startsAt || null,
    token,
    createdAt: new Date().toISOString()
  };

  db.events.push(event);
  writeDb(db);

  const checkinUrl = `${req.protocol}://${req.get('host')}/volunteer.html?token=${token}`;
  res.status(201).json({ event, token, checkinUrl });
});

app.get('/api/events/token/:token', (req, res) => {
  const db = readDb();
  const event = findEventByToken(db, req.params.token);
  if (!event) return res.status(404).json({ error: 'Invalid or expired QR token' });

  const site = db.sites.find((s) => s.id === event.siteId);
  const org = site ? db.organizations.find((o) => o.id === site.orgId) : null;

  res.json({
    event: {
      id: event.id,
      name: event.name,
      activity: event.activity,
      startsAt: event.startsAt
    },
    site,
    organization: org
  });
});

app.post('/api/checkin', requireRole('volunteer'), (req, res) => {
  const { token, driveToken, orgCode, volunteerId, name, email, activity, photoDataUrl, age, gender, latitude, longitude } = req.body || {};
  if (!name) return res.status(400).json({ error: 'volunteer name is required' });
  if (!token && !driveToken) return res.status(400).json({ error: 'token or driveToken is required' });

  const db = readDb();
  const event = token ? findEventByToken(db, token) : null;
  const drive = driveToken ? db.drives.find((d) => d.token === driveToken && !d.deletedAt) : null;
  if (!event && !drive) return res.status(404).json({ error: 'Invalid QR token' });
  const resolvedVolunteerId = req.auth.volunteerId || volunteerId;
  const volunteer = resolvedVolunteerId ? db.volunteers.find((v) => v.id === resolvedVolunteerId) : null;
  if (!volunteer) return res.status(404).json({ error: 'Volunteer not found for current session' });
  const existingActiveSession = db.sessions.find((s) => s.volunteerId === volunteer.id && !s.timeOut);
  if (existingActiveSession) {
    return res.status(409).json({
      error: 'You are already checked in. Please check out before checking in again.'
    });
  }

  // Drive time-window and completion enforcement
  if (drive) {
    if (drive.completedAt) {
      return res.status(403).json({ error: 'This drive has already been completed by the site manager.' });
    }
    const now = Date.now();
    const driveStart = new Date(drive.startsAt).getTime();
    const driveEnd = new Date(drive.endsAt).getTime();
    if (now < driveStart) {
      return res.status(403).json({ error: `Check-in is not open yet. Drive starts at ${new Date(drive.startsAt).toLocaleString()}.` });
    }
    if (now > driveEnd) {
      return res.status(403).json({ error: `Check-in is closed. Drive ended at ${new Date(drive.endsAt).toLocaleString()}.` });
    }
  }

  const site = event ? db.sites.find((s) => s.id === event.siteId) : null;
  const driveOrg = drive ? db.organizations.find((o) => o.id === drive.orgId) : null;
  if (event && !site) return res.status(404).json({ error: 'Event site not found' });
  if (drive && !driveOrg) return res.status(404).json({ error: 'Drive organization not found' });
  if (drive) {
    const orgFromCode = findOrganizationByCode(db, orgCode);
    if (!orgFromCode || orgFromCode.id !== drive.orgId) {
      return res.status(400).json({ error: 'Organization code is invalid for this drive' });
    }
  }

  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required for check-in' });
  }

  let distance = 0;
  let withinGeofence = true;
  if (site) {
    distance = haversineDistanceMeters(lat, lng, site.latitude, site.longitude);
    withinGeofence = distance <= site.geofenceRadiusMeters;
    if (!withinGeofence) {
      return res.status(403).json({
        error: `You are outside the geofence for this site (${Math.round(distance)}m away)`
      });
    }
  }

  const session = {
    id: crypto.randomUUID(),
    eventId: event?.id || null,
    driveId: drive?.id || null,
    token: token || null,
    driveToken: driveToken || null,
    volunteerId: volunteer.id,
    name: name.trim(),
    email: (email || '').trim(),
    age: Number.isNaN(Number(age)) ? (volunteer?.age ?? null) : Number(age),
    gender: String(gender || volunteer?.gender || '').trim(),
    activity: (activity || event?.activity || '').trim(),
    photoDataUrl: photoDataUrl || '',
    timeIn: new Date().toISOString(),
    timeOut: null,
    checkInLocation: { latitude: lat, longitude: lng },
    lastLocation: { latitude: lat, longitude: lng, at: new Date().toISOString() },
    geofenceStatus: 'inside'
  };

  db.sessions.push(session);
  writeDb(db);

  res.status(201).json({
    sessionId: session.id,
    timeIn: session.timeIn,
    geofence: {
      withinGeofence,
      distanceMeters: Math.round(distance),
      radiusMeters: site ? site.geofenceRadiusMeters : 0
    }
  });
});

app.post('/api/sessions/:sessionId/location', requireRole('volunteer'), (req, res) => {
  const { latitude, longitude } = req.body || {};
  const lat = Number(latitude);
  const lng = Number(longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng)) {
    return res.status(400).json({ error: 'Valid latitude and longitude are required' });
  }

  const db = readDb();
  const session = db.sessions.find((s) => s.id === req.params.sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.volunteerId !== req.auth.volunteerId) return res.status(403).json({ error: 'Access denied for this session' });
  if (session.timeOut) return res.status(400).json({ error: 'Session already checked out' });

  const event = db.events.find((e) => e.id === session.eventId);
  const site = event ? db.sites.find((s) => s.id === event.siteId) : null;
  if (!site) return res.json({ withinGeofence: true, distanceMeters: 0, radiusMeters: 0 });

  const distance = haversineDistanceMeters(lat, lng, site.latitude, site.longitude);
  const withinGeofence = distance <= site.geofenceRadiusMeters;

  session.lastLocation = { latitude: lat, longitude: lng, at: new Date().toISOString() };
  session.geofenceStatus = withinGeofence ? 'inside' : 'outside';

  if (!withinGeofence) {
    db.geofenceAlerts.push({
      id: crypto.randomUUID(),
      sessionId: session.id,
      volunteerName: session.name,
      siteId: site.id,
      distanceMeters: Math.round(distance),
      at: new Date().toISOString()
    });
  }

  writeDb(db);

  res.json({
    withinGeofence,
    distanceMeters: Math.round(distance),
    radiusMeters: site.geofenceRadiusMeters
  });
});

app.post('/api/checkout', requireRole('volunteer'), (req, res) => {
  const { sessionId, latitude, longitude } = req.body || {};
  if (!sessionId) return res.status(400).json({ error: 'sessionId is required' });

  const db = readDb();
  const session = db.sessions.find((s) => s.id === sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.volunteerId !== req.auth.volunteerId) return res.status(403).json({ error: 'Access denied for this session' });
  if (session.timeOut) return res.status(400).json({ error: 'Already checked out' });

  session.timeOut = new Date().toISOString();
  if (!Number.isNaN(Number(latitude)) && !Number.isNaN(Number(longitude))) {
    session.checkoutLocation = { latitude: Number(latitude), longitude: Number(longitude) };
  }

  writeDb(db);

  const durationMs = new Date(session.timeOut).getTime() - new Date(session.timeIn).getTime();
  res.json({
    sessionId: session.id,
    timeOut: session.timeOut,
    hoursDevoted: formatDurationHours(durationMs)
  });
});

app.get('/api/dashboard/active', requireRole('organization'), (req, res) => {
  const db = readDb();
  const orgId = req.auth.orgId;
  const active = db.sessions
    .filter((s) => {
      if (s.timeOut) return false;
      const event = db.events.find((e) => e.id === s.eventId);
      const drive = db.drives.find((d) => d.id === s.driveId);
      if (drive) return drive.orgId === orgId;
      const site = event ? db.sites.find((si) => si.id === event.siteId) : null;
      return site ? site.orgId === orgId : false;
    })
    .map((s) => enrichSession(db, s))
    .sort((a, b) => new Date(b.timeIn).getTime() - new Date(a.timeIn).getTime());

  const geofenceAlerts = db.geofenceAlerts
    .filter((a) => {
      const session = db.sessions.find((s) => s.id === a.sessionId);
      const event = session ? db.events.find((e) => e.id === session.eventId) : null;
      const site = event ? db.sites.find((si) => si.id === event.siteId) : null;
      return site ? site.orgId === orgId : false;
    })
    .slice(-50)
    .reverse();

  res.json({ activeVolunteers: active, geofenceAlerts });
});

app.get('/api/reports', requireRole('organization'), (req, res) => {
  const { siteId, activity, from, to } = req.query;
  const db = readDb();
  const orgId = req.auth.orgId;

  const filtered = db.sessions
    .filter((s) => {
      const event = db.events.find((e) => e.id === s.eventId);
      const drive = db.drives.find((d) => d.id === s.driveId);
      if (!event && !drive) return false;
      if (drive && drive.orgId !== orgId) return false;
      if (event) {
        const eventSite = db.sites.find((es) => es.id === event.siteId);
        if (!eventSite || eventSite.orgId !== orgId) return false;
      }

      if (siteId && event && event.siteId !== siteId) return false;
      if (activity && (s.activity || '').toLowerCase() !== String(activity).toLowerCase()) return false;

      const inDate = new Date(s.timeIn);
      if (from && inDate < new Date(from)) return false;
      if (to && inDate > new Date(to)) return false;

      return true;
    })
    .map((s) => enrichSession(db, s))
    .sort((a, b) => new Date(b.timeIn).getTime() - new Date(a.timeIn).getTime());

  const siteSummaryMap = {};
  const activitySummaryMap = {};

  for (const row of filtered) {
    const siteKey = row.siteName || 'Unknown Site';
    const activityKey = row.activity || 'Unspecified Activity';
    const sessionHours = Number(row.hoursDevoted);

    if (!siteSummaryMap[siteKey]) siteSummaryMap[siteKey] = { siteName: siteKey, volunteers: 0, totalHours: 0 };
    if (!activitySummaryMap[activityKey]) activitySummaryMap[activityKey] = { activity: activityKey, volunteers: 0, totalHours: 0 };

    siteSummaryMap[siteKey].volunteers += 1;
    siteSummaryMap[siteKey].totalHours += sessionHours;

    activitySummaryMap[activityKey].volunteers += 1;
    activitySummaryMap[activityKey].totalHours += sessionHours;
  }

  const siteSummary = Object.values(siteSummaryMap).map((s) => ({
    ...s,
    totalHours: s.totalHours.toFixed(2)
  }));

  const activitySummary = Object.values(activitySummaryMap).map((s) => ({
    ...s,
    totalHours: s.totalHours.toFixed(2)
  }));

  res.json({ rows: filtered, siteSummary, activitySummary });
});

function reportRowsToCsv(rows) {
  const headers = ['Name', 'Place', 'Time In', 'Time Out', 'Hours Devoted', 'Organization', 'Activity', 'Email'];
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push([
      escapeCsv(r.name),
      escapeCsv(r.siteName),
      escapeCsv(r.timeIn),
      escapeCsv(r.timeOut || ''),
      escapeCsv(r.hoursDevoted),
      escapeCsv(r.orgName),
      escapeCsv(r.activity),
      escapeCsv(r.email)
    ].join(','));
  }
  return lines.join('\n');
}

app.get('/api/reports/export.csv', requireRole('organization'), (req, res) => {
  const db = readDb();
  const orgId = req.auth.orgId;
  const rows = db.sessions
    .filter((s) => {
      const event = db.events.find((e) => e.id === s.eventId);
      const drive = db.drives.find((d) => d.id === s.driveId);
      if (drive) return drive.orgId === orgId;
      const site = event ? db.sites.find((si) => si.id === event.siteId) : null;
      return site ? site.orgId === orgId : false;
    })
    .map((s) => enrichSession(db, s));
  const csv = reportRowsToCsv(rows);

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="volunteer-report-${Date.now()}.csv"`);
  res.send(csv);
});

app.get('/api/reports/export.xlsx', requireRole('organization'), (req, res) => {
  const db = readDb();
  const orgId = req.auth.orgId;
  const rows = db.sessions
    .filter((s) => {
      const event = db.events.find((e) => e.id === s.eventId);
      const drive = db.drives.find((d) => d.id === s.driveId);
      if (drive) return drive.orgId === orgId;
      const site = event ? db.sites.find((si) => si.id === event.siteId) : null;
      return site ? site.orgId === orgId : false;
    })
    .map((s) => enrichSession(db, s));

  let tableRows = '';
  for (const r of rows) {
    tableRows += `<tr><td>${r.name}</td><td>${r.siteName}</td><td>${r.timeIn}</td><td>${r.timeOut || ''}</td><td>${r.hoursDevoted}</td><td>${r.orgName}</td><td>${r.activity}</td><td>${r.email}</td></tr>`;
  }

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body><table border="1"><tr><th>Name</th><th>Place</th><th>Time In</th><th>Time Out</th><th>Hours Devoted</th><th>Organization</th><th>Activity</th><th>Email</th></tr>${tableRows}</table></body></html>`;

  res.setHeader('Content-Type', 'application/vnd.ms-excel; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="volunteer-report-${Date.now()}.xls"`);
  res.send(html);
});

// ── Supabase Admin Signup Endpoints ──────────────────────────────────────────
// These bypass email rate limits by using the service role key to create users
// with email_confirm: true so no confirmation email is sent.

app.post('/api/volunteer/signup', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Server-side signup is not available. Please contact support.' });
    }

    const { email, password, name, age, gender } = req.body;
    if (!email || !password || !name || !age || !gender) {
      return res.status(400).json({ error: 'All fields are required (email, password, name, age, gender).' });
    }

    // 1. Create user via admin API (auto-confirmed, no email sent)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;

    // 2. Generate volunteer ID
    const volId = `VOL-${crypto.randomInt(100000, 999999)}`;

    // 3. Create volunteer profile record
    const { data: profile, error: dbError } = await supabaseAdmin.from('volunteers').insert([{
      id: user.id,
      vol_id: volId,
      name,
      email,
      age: Number(age),
      gender
    }]).select().single();

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ profile });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/sitemanager/signup', async (req, res) => {
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({ error: 'Server-side signup is not available. Please contact support.' });
    }

    const { email, name, companyId } = req.body;
    if (!email || !name || !companyId) {
      return res.status(400).json({ error: 'All fields are required (email, name, companyId).' });
    }

    // 1. Verify the organization exists
    const { data: orgData, error: orgError } = await supabaseAdmin.from('organizations')
      .select('id, name, org_code')
      .eq('company_id', companyId.toUpperCase())
      .single();

    if (orgError || !orgData) {
      return res.status(400).json({ error: 'Invalid Company ID. Ensure the organization has registered.' });
    }

    // 2. Generate unique manager ID (also used as password)
    const uniqueId = `MGR-${crypto.randomInt(100000, 999999)}`;

    // 3. Create user via admin API (auto-confirmed, no email sent)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password: uniqueId,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;

    // 4. Create site manager profile record
    const { data: manager, error: dbError } = await supabaseAdmin.from('site_managers').insert([{
      id: user.id,
      org_id: orgData.id,
      name,
      email,
      unique_manager_id: uniqueId
    }]).select().single();

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ manager, org: orgData });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

ensureDataStore();
app.listen(PORT, () => {
  console.log(`Volunteer management app running at http://localhost:${PORT}`);
});
