const orgLoginBadgeEl = document.getElementById('orgLoginBadge');
const orgRegisteredYesBtn = document.getElementById('orgRegisteredYesBtn');
const orgRegisteredNoBtn = document.getElementById('orgRegisteredNoBtn');
const orgLoginFieldsEl = document.getElementById('orgLoginFields');
const orgSignupFieldsEl = document.getElementById('orgSignupFields');

const orgLoginCompanyIdEl = document.getElementById('orgLoginCompanyId');
const orgLoginPasswordEl = document.getElementById('orgLoginPassword');

const authWrapperEl = document.getElementById('authWrapper');
const dashboardWrapperEl = document.getElementById('dashboardWrapper');

const orgSignupNameEl = document.getElementById('orgSignupName');
const orgSignupLocationEl = document.getElementById('orgSignupLocation');
const orgSignupEmailEl = document.getElementById('orgSignupEmail');
const orgSignupPasswordEl = document.getElementById('orgSignupPassword');

const orgCompanyIdDisplayEl = document.getElementById('orgCompanyIdDisplay');
const orgCodeDisplayEl = document.getElementById('orgCodeDisplay');
const orgMetaEl = document.getElementById('orgMeta');

const sheetDateEl = document.getElementById('sheetDate');
const orgSheetBodyEl = document.getElementById('orgSheetBody');
const orgDrivesBodyEl = document.getElementById('orgDrivesBody');

let activeOrg = null;

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function setBadge(text, ok = false) {
  orgLoginBadgeEl.textContent = text;
  orgLoginBadgeEl.style.background = ok ? '#e8f8f6' : '';
  orgLoginBadgeEl.style.color = ok ? '#0f766e' : '';
  orgLoginBadgeEl.style.borderColor = ok ? '#b9ece4' : '';
}

function setMode(mode) {
  orgLoginFieldsEl.style.display = mode === 'login' ? 'block' : 'none';
  orgSignupFieldsEl.style.display = mode === 'signup' ? 'block' : 'none';
}

function formatDateForInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function applyOrgSession(org) {
  activeOrg = org;

  orgCompanyIdDisplayEl.textContent = org.company_id || '-';
  orgCodeDisplayEl.textContent = org.org_code || '-';
  orgMetaEl.textContent = `${org.name} • ${org.location}`;
  setBadge(`Logged in: ${org.name}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

async function fetchOrgProfile(userId) {
  const { data, error } = await supabase.from('organizations').select('*').eq('id', userId).single();
  if (data) applyOrgSession(data);
  return data;
}

function driveStatusLabel(d) {
  // Rough estimate logic for now
  const now = Date.now();
  if (now < new Date(d.starts_at).getTime()) return '<span style="color:#d97706">Upcoming</span>';
  if (now > new Date(d.ends_at).getTime()) return '<span style="color:#6b7280">Ended</span>';
  return '<span style="color:#2563eb">Active</span>';
}

async function loadDrives() {
  if (!activeOrg?.id) return;
  const { data: drives, error } = await supabase.from('drives').select('*').eq('org_id', activeOrg.id).order('starts_at', { ascending: false });

  if (error || !orgDrivesBodyEl) return;
  if (!drives || !drives.length) {
    orgDrivesBodyEl.innerHTML = '<tr><td colspan="6">No drives registered under this organisation.</td></tr>';
    return;
  }

  // For simplicity MVP we will omit volunteerCount right now (would require join or rpc)
  orgDrivesBodyEl.innerHTML = drives.map((d) => `
    <tr>
      <td>${escapeHtml(d.location)}<br /><span class="small" style="color:#6b7280">${escapeHtml(d.drive_code || '')}</span></td>
      <td>Manager</td>
      <td>${new Date(d.starts_at).toLocaleString()}</td>
      <td>${new Date(d.ends_at).toLocaleString()}</td>
      <td>${driveStatusLabel(d)}</td>
      <td>-</td>
    </tr>
  `).join('');
}

async function loadSheet() {
  if (!activeOrg?.id) return;
  const dateStr = sheetDateEl.value || formatDateForInput(new Date());

  const startOfDay = new Date(`${dateStr}T00:00:00.000Z`).toISOString();
  const endOfDay = new Date(`${dateStr}T23:59:59.999Z`).toISOString();

  // We need to fetch sessions belonging to this org's drives
  // In Supabase we do an inner join
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(`
      id, time_in, time_out, hours_devoted,
      volunteers ( name, age, gender ),
      drives!inner ( id, location, org_id )
    `)
    .eq('drives.org_id', activeOrg.id)
    .gte('time_in', startOfDay)
    .lte('time_in', endOfDay)
    .order('time_in', { ascending: true });

  if (error) {
    orgSheetBodyEl.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message) || 'Failed to load sheet'}</td></tr>`;
    return;
  }

  if (!sessions || !sessions.length) {
    orgSheetBodyEl.innerHTML = '<tr><td colspan="8">No volunteer entries for this date.</td></tr>';
    return;
  }

  orgSheetBodyEl.innerHTML = sessions.map((s) => `
    <tr>
      <td>${escapeHtml(s.volunteers?.name)}</td><td>${escapeHtml(String(s.volunteers?.age || ''))}</td><td>${escapeHtml(s.volunteers?.gender)}</td><td>${escapeHtml(s.drives?.location)}</td>
      <td>${new Date(s.time_in).toLocaleString()}</td>
      <td>${s.time_out ? new Date(s.time_out).toLocaleString() : '<em>Active</em>'}</td>
      <td>${escapeHtml(s.hours_devoted)}</td>
      <td><button class="btn-secondary delete-session" data-id="${escapeHtml(s.id)}" style="font-size:0.8em">Remove</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-session').forEach((btn) => {
    btn.addEventListener('click', async () => {
      if (!confirm('Remove this volunteer session? This cannot be undone.')) return;
      const sid = btn.getAttribute('data-id');
      const { error: delError } = await supabase.from('sessions').delete().eq('id', sid);
      if (delError) { alert(delError.message); return; }
      await loadSheet();
    });
  });
}

document.getElementById('orgLoginBtn').addEventListener('click', async () => {
  try {
    const companyId = orgLoginCompanyIdEl.value.trim().toUpperCase();
    const password = orgLoginPasswordEl.value;

    if (!companyId || !password) throw new Error("Company ID and Password are required");

    // 1. Look up the email associated with this company ID (Supabase Auth requires email to sign in)
    const { data: orgData, error: lookupError } = await supabase.from('organizations').select('contact_email').eq('company_id', companyId).single();
    if (lookupError || !orgData) throw new Error("Invalid Company ID");

    // 2. Sign in using the located email
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: orgData.contact_email,
      password: password
    });

    if (authError) throw authError;

    await fetchOrgProfile(authData.user.id);
    await loadSheet();
    await loadDrives();
  } catch (err) {
    setBadge(err.message || 'Login failed', false);
  }
});

document.getElementById('orgSignupBtn').addEventListener('click', async () => {
  try {
    const name = orgSignupNameEl.value.trim();
    const location = orgSignupLocationEl.value.trim();
    const email = orgSignupEmailEl.value.trim();
    const password = orgSignupPasswordEl.value;

    if (!name || !location || !email || !password) throw new Error("All fields are required");

    // 1. Sign up user via Supabase Auth
    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });
    if (authError) throw authError;

    const user = authData.user;
    if (!user) throw new Error("Signup failed");

    // 2. Generate unique identifiers
    const companyId = `CMP-${Math.floor(100000 + Math.random() * 900000)}`;
    const orgCode = String(Math.floor(1000000000 + Math.random() * 9000000000)); // 10 digit code

    // 3. Insert specific org settings into the custom table
    // (Note: Supabase user ids are UUIDs, so we map them 1:1)
    const { data: org, error: dbError } = await supabase.from('organizations').insert([{
      id: user.id,
      name,
      location,
      contact_email: email,
      company_id: companyId,
      identity_key: 'email:' + email, // legacy support for older queries if needed
      org_code: orgCode
    }]).select().single();

    if (dbError) throw dbError;

    applyOrgSession(org);
    await loadSheet();
    await loadDrives();
  } catch (err) {
    setBadge(err.message || 'Registration failed', false);
  }
});

document.getElementById('orgLoadByDateBtn').addEventListener('click', loadSheet);

document.getElementById('orgExportCsvBtn')?.addEventListener('click', () => {
  alert("Export CSV requires building an exporter function for Supabase Edge Functions or parsing client side. Future update required.");
});

document.getElementById('orgExportXlsBtn')?.addEventListener('click', () => {
  alert("Export XLS requires building an exporter function for Supabase Edge Functions or parsing client side. Future update required.");
});

async function doLogout() {
  await supabase.auth.signOut();
  activeOrg = null;
  orgCompanyIdDisplayEl.textContent = '-';
  orgCodeDisplayEl.textContent = '-';
  orgMetaEl.textContent = '';
  orgSheetBodyEl.innerHTML = '';
  if (orgDrivesBodyEl) orgDrivesBodyEl.innerHTML = '';
  setBadge('Not Logged In', false);

  authWrapperEl.style.display = 'block';
  dashboardWrapperEl.style.display = 'none';
}

document.getElementById('orgLogoutBtn').addEventListener('click', doLogout);
orgRegisteredYesBtn.addEventListener('click', () => setMode('login'));
orgRegisteredNoBtn.addEventListener('click', () => setMode('signup'));

async function initAuth() {
  setMode('login');
  sheetDateEl.value = formatDateForInput(new Date());

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const org = await fetchOrgProfile(session.user.id);
    if (org) {
      await loadSheet();
      await loadDrives();
    } else {
      // A volunteer or site manager must be logged in in this browser session. Let's sign out.
      await supabase.auth.signOut();
    }
  }

  // Subscribe to auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      if (!activeOrg) {
        const org = await fetchOrgProfile(session.user.id);
        if (org) { await loadSheet(); await loadDrives(); }
      }
    } else if (event === 'SIGNED_OUT') {
      doLogout();
    }
  });
}

initAuth();
