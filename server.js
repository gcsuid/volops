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
  try {
    if (!supabaseAdmin) {
      return res.status(503).json({
        error: 'Server-side signup is not available. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on the server.',
        fallback: 'client'
      });
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
