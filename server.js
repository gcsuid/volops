const express = require('express');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const app = express();

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

const PORT = process.env.PORT || 3000;
const SUPABASE_URL = process.env.SUPABASE_URL || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const apiHitCounts = {
  volunteerSignup: 0,
  organizationSignup: 0,
  siteManagerSignup: 0
};
const activeVolunteerSignups = new Set();

const missingSupabaseEnv = [];
if (!SUPABASE_URL) missingSupabaseEnv.push('SUPABASE_URL');
if (!SUPABASE_SERVICE_ROLE_KEY) missingSupabaseEnv.push('SUPABASE_SERVICE_ROLE_KEY');

let supabaseAdmin = null;
if (missingSupabaseEnv.length === 0) {
  supabaseAdmin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false }
  });
} else {
  console.warn(`[config] Supabase admin disabled. Missing env: ${missingSupabaseEnv.join(', ')}`);
}

function logApiHit(routeName, details = {}) {
  apiHitCounts[routeName] = (apiHitCounts[routeName] || 0) + 1;
  const requestId = `${routeName}-${Date.now()}-${apiHitCounts[routeName]}`;
  console.info(`[api] ${routeName} hit #${apiHitCounts[routeName]}`, { requestId, ...details });
  return requestId;
}

app.use(express.json({ limit: '15mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// ── Config Status Endpoint ────────────────────────────────────────────────────
// Lets clients know whether server-side signup is available
app.get('/api/config/status', (req, res) => {
  res.json({
    serverSignupAvailable: !!supabaseAdmin,
    missingConfig: missingSupabaseEnv.length > 0 ? missingSupabaseEnv : undefined
  });
});

// ── Supabase Admin Signup Endpoints ──────────────────────────────────────────
// These bypass email rate limits by using the service role key to create users
// with email_confirm: true so no confirmation email is sent.
// When the server config is missing, clients should fall back to client-side
// Supabase Auth signup.

app.post('/api/volunteer/signup', async (req, res) => {
  const rawEmail = String(req.body?.email || '').trim().toLowerCase();
  const requestId = logApiHit('volunteerSignup', {
    ip: req.ip,
    email: rawEmail,
    userAgent: req.get('user-agent') || ''
  });

  try {
    if (!supabaseAdmin) {
      console.warn(`[api] volunteerSignup ${requestId} rejected: server-side signup unavailable`);
      return res.status(503).json({
        error: 'Server-side signup is not available. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
        fallback: 'client'
      });
    }

    const { password, name, age, gender } = req.body;
    if (!rawEmail || !password || !name || !age || !gender) {
      console.warn(`[api] volunteerSignup ${requestId} rejected: missing fields`);
      return res.status(400).json({ error: 'All fields are required (email, password, name, age, gender).' });
    }

    if (activeVolunteerSignups.has(rawEmail)) {
      console.warn(`[api] volunteerSignup ${requestId} rejected: signup already in progress`, { email: rawEmail });
      return res.status(429).json({ error: 'A signup request is already in progress for this email. Please wait a moment and try again.' });
    }

    activeVolunteerSignups.add(rawEmail);

    const cleanAge = Number(age);
    if (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 120) {
      console.warn(`[api] volunteerSignup ${requestId} rejected: invalid age`, { age });
      return res.status(400).json({ error: 'Age must be a whole number between 1 and 120.' });
    }

    // 1. Create user via admin API (auto-confirmed, no email sent)
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: rawEmail,
      password,
      email_confirm: true
    });

    if (authError) {
      console.error(`[api] volunteerSignup ${requestId} auth error`, authError);
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
      email: rawEmail,
      age: cleanAge,
      gender
    }]).select().single();

    if (dbError) {
      console.error(`[api] volunteerSignup ${requestId} profile insert error`, dbError);
      return res.status(500).json({ error: dbError.message });
    }

    console.info(`[api] volunteerSignup ${requestId} succeeded`, { volunteerId: profile.id, volId: profile.vol_id });
    res.json({ profile });
  } catch (err) {
    console.error(`[api] volunteerSignup ${requestId} unhandled error`, err);
    res.status(500).json({ error: err.message || 'Internal server error' });
  } finally {
    if (rawEmail) activeVolunteerSignups.delete(rawEmail);
  }
});

app.post('/api/organization/signup', async (req, res) => {
  logApiHit('organizationSignup', {
    ip: req.ip,
    email: String(req.body?.email || '').trim().toLowerCase()
  });
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Server-side signup is not available. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
        fallback: 'client'
      });
    }

    const { email, password, name, location } = req.body;
    if (!email || !password || !name || !location) {
      return res.status(400).json({ error: 'All fields are required (email, password, name, location).' });
    }

    const companyId = `CMP-${crypto.randomInt(100000, 999999)}`;
    const orgCode = String(crypto.randomInt(1000000000, 9999999999));

    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authError) {
      return res.status(400).json({ error: authError.message });
    }

    const user = authData.user;

    const { data: org, error: dbError } = await supabaseAdmin.from('organizations').insert([{
      id: user.id,
      name,
      location,
      contact_email: email,
      company_id: companyId,
      identity_key: 'email:' + email,
      org_code: orgCode
    }]).select().single();

    if (dbError) {
      return res.status(500).json({ error: dbError.message });
    }

    res.json({ org });
  } catch (err) {
    res.status(500).json({ error: err.message || 'Internal server error' });
  }
});

app.post('/api/sitemanager/signup', async (req, res) => {
  logApiHit('siteManagerSignup', {
    ip: req.ip,
    email: String(req.body?.email || '').trim().toLowerCase()
  });
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Server-side signup is not available. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
        fallback: 'client'
      });
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

app.listen(PORT, () => {
  console.log(`Volunteer management app running at http://localhost:${PORT}`);
});
