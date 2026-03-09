const managerLoginBadgeEl = document.getElementById('managerLoginBadge');
const managerRegisteredYesBtn = document.getElementById('managerRegisteredYesBtn');
const managerRegisteredNoBtn = document.getElementById('managerRegisteredNoBtn');
const managerLoginFieldsEl = document.getElementById('managerLoginFields');
const managerSignupFieldsEl = document.getElementById('managerSignupFields');

const managerLoginEmailEl = document.getElementById('managerLoginEmail');
const managerLoginUniqueIdEl = document.getElementById('managerLoginUniqueId');

const authWrapperEl = document.getElementById('authWrapper');
const dashboardWrapperEl = document.getElementById('dashboardWrapper');

const managerSignupEmailEl = document.getElementById('managerSignupEmail');
const managerSignupNameEl = document.getElementById('managerSignupName');
const managerSignupCompanyIdEl = document.getElementById('managerSignupCompanyId');

const managerNameEl = document.getElementById('managerName');
const managerOrgNameEl = document.getElementById('managerOrgName');
const managerOrgCodeEl = document.getElementById('managerOrgCode');
const driveLocationEl = document.getElementById('driveLocation');

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const driveStartEl = document.getElementById('driveStart');
const driveEndEl = document.getElementById('driveEnd');

const driveLinkTextEl = document.getElementById('driveLinkText');
const driveCodeTextEl = document.getElementById('driveCodeText');
const driveQrEl = document.getElementById('driveQr');
const drivesBodyEl = document.getElementById('drivesBody');
const managerUniqueIdDisplayEl = document.getElementById('managerUniqueIdDisplay');
const managerMetaEl = document.getElementById('managerMeta');

let activeManager = null;
let activeOrg = null;

function setBadge(text, ok = false) {
  managerLoginBadgeEl.textContent = text;
  managerLoginBadgeEl.style.background = ok ? '#e8f8f6' : '';
  managerLoginBadgeEl.style.color = ok ? '#0f766e' : '';
  managerLoginBadgeEl.style.borderColor = ok ? '#b9ece4' : '';
}

function setMode(mode) {
  managerLoginFieldsEl.style.display = mode === 'login' ? 'block' : 'none';
  managerSignupFieldsEl.style.display = mode === 'signup' ? 'block' : 'none';

  if (mode === 'login') {
    managerRegisteredYesBtn.classList.remove('btn-secondary');
    managerRegisteredNoBtn.classList.add('btn-secondary');
  } else {
    managerRegisteredNoBtn.classList.remove('btn-secondary');
    managerRegisteredYesBtn.classList.add('btn-secondary');
  }
}

function applyManagerSession(manager, org) {
  activeManager = manager;
  activeOrg = org;

  managerNameEl.value = manager.name || managerNameEl.value;
  managerOrgNameEl.value = org?.name || managerOrgNameEl.value;
  if (org?.org_code) managerOrgCodeEl.value = org.org_code;

  managerUniqueIdDisplayEl.textContent = manager.unique_manager_id || '-';
  managerMetaEl.textContent = `${manager.email || ''} • ${org?.name || 'Unknown Org'}`;
  setBadge(`Logged in: ${manager.name}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

async function fetchManagerProfile(userId) {
  const { data: manager, error } = await supabase.from('site_managers').select('*').eq('id', userId).single();
  if (manager && manager.org_id) {
    const { data: org } = await supabase.from('organizations').select('*').eq('id', manager.org_id).single();
    applyManagerSession(manager, org);
  }
  return manager;
}

document.getElementById('managerLoginBtn').addEventListener('click', async () => {
  try {
    const email = managerLoginEmailEl.value.trim();
    const uniqueId = managerLoginUniqueIdEl.value.trim();

    if (!email || !uniqueId) throw new Error("Email and Unique Manager ID are required");

    // We emulate a password for Supabase Auth since we previously used "Unique Manager ID" as a sort of password 
    // Wait, let's look up the user first, or just try log in with Unique ID as pwd
    // We didn't setup a password field for managers in the original UI, let's use the uniqueId as their password.

    // In a real migration we'd enforce a proper password field. For now, since they used a dummy server, 
    // let's assume they created the account with Unique_ID as password
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
      email: email,
      password: uniqueId
    });

    if (authError) throw authError;

    await fetchManagerProfile(authData.user.id);
    await loadDrives();
  } catch (err) {
    setBadge(err.message || 'Login failed', false);
  }
});

document.getElementById('managerSignupBtn').addEventListener('click', async () => {
  try {
    const email = managerSignupEmailEl.value.trim();
    const name = managerSignupNameEl.value.trim();
    const companyId = managerSignupCompanyIdEl.value.trim().toUpperCase();

    if (!email || !name || !companyId) throw new Error("All fields are required");

    let manager = null;
    let org = null;

    // 1. Try server-side signup first (bypasses email rate limits)
    const response = await fetch('/api/sitemanager/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, name, companyId })
    });

    if (response.ok) {
      // Server-side signup succeeded
      const result = await response.json();
      manager = result.manager;
      org = result.org;

      // Sign in client-side using the generated unique manager ID as password
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password: manager.unique_manager_id
      });
      if (signInError) throw signInError;

    } else if (response.status === 503) {
      // Server-side signup unavailable — fall back to client-side Supabase Auth

      // Verify the organization exists
      const { data: orgData, error: orgError } = await supabase.from('organizations')
        .select('id, name, org_code')
        .eq('company_id', companyId)
        .single();

      if (orgError || !orgData) {
        throw new Error('Invalid Company ID. Ensure the organization has registered.');
      }
      org = orgData;

      // Generate unique manager ID (also used as password)
      const uniqueId = 'MGR-' + String(Math.floor(100000 + Math.random() * 900000));

      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email,
        password: uniqueId
      });
      if (signUpError) throw signUpError;

      let userId = signUpData.session?.user?.id || signUpData.user?.id;
      if (!userId) {
        throw new Error('Signup submitted. Please check your email to confirm, then log in.');
      }

      // If session was not returned by signUp, sign in explicitly
      if (!signUpData.session) {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({
          email,
          password: uniqueId
        });
        if (signInError) throw signInError;
        userId = authData.user.id;
      }

      // Create site manager profile record
      const { data: mgrData, error: dbError } = await supabase.from('site_managers').insert([{
        id: userId, org_id: orgData.id, name, email, unique_manager_id: uniqueId
      }]).select().single();
      if (dbError) throw dbError;
      manager = mgrData;

    } else {
      // Other server error
      const result = await response.json();
      throw new Error(result.error || 'Signup failed');
    }

    applyManagerSession(manager, org);
    await loadDrives();
  } catch (err) {
    setBadge(err.message || 'Signup failed', false);
  }
});


async function createDrive() {
  try {
    if (!activeManager) throw new Error('Login as site manager first.');

    const location = driveLocationEl.value.trim();
    const startsAt = driveStartEl.value;
    const endsAt = driveEndEl.value;

    if (!location || !startsAt || !endsAt) throw new Error('Location, start, and end times are required.');

    // Generate a shorter 6 character drive code
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let driveCode = Array.from({ length: 6 }, () => chars[Math.floor(Math.random() * chars.length)]).join('');

    const { data: drive, error } = await supabase.from('drives').insert([{
      org_id: activeOrg.id,
      manager_id: activeManager.id,
      drive_code: driveCode,
      location: location,
      starts_at: new Date(startsAt).toISOString(),
      ends_at: new Date(endsAt).toISOString()
    }]).select().single();

    if (error) throw error;

    // Build check-in URL
    const checkinUrl = `${window.location.origin}/volunteer.html?driveToken=${drive.token}`;
    driveLinkTextEl.innerHTML = `Drive registered. Share check-in URL:<br /><a href="${escapeHtml(checkinUrl)}" target="_blank">${escapeHtml(checkinUrl)}</a>`;
    driveCodeTextEl.innerHTML = `<strong>Drive Code:</strong> <span style="font-size:1.3em;font-weight:700;letter-spacing:2px;color:#0f766e">${escapeHtml(drive.drive_code)}</span> <span class="small">(volunteers can also enter this code manually)</span>`;

    driveQrEl.innerHTML = '';
    new QRCode(driveQrEl, { text: checkinUrl, width: 180, height: 180 });
    await loadDrives();

  } catch (err) {
    driveLinkTextEl.textContent = err.message || 'Failed to create drive';
    if (driveCodeTextEl) driveCodeTextEl.textContent = '';
  }
}

function driveStatus(d) {
  const now = Date.now();
  if (now < new Date(d.starts_at).getTime()) return '<span style="color:#d97706">Upcoming</span>';
  if (now > new Date(d.ends_at).getTime()) return '<span style="color:#6b7280">Ended</span>';
  return '<span style="color:#2563eb">Active</span>';
}


async function loadDrives() {
  if (!activeManager || !activeOrg) {
    drivesBodyEl.innerHTML = '<tr><td colspan="8">Login as site manager first.</td></tr>';
    return;
  }

  const { data: drives, error } = await supabase
    .from('drives')
    .select('*')
    .eq('manager_id', activeManager.id)
    .order('starts_at', { ascending: false });

  if (error) {
    drivesBodyEl.innerHTML = `<tr><td colspan="8">${escapeHtml(error.message) || 'Failed to load drives'}</td></tr>`;
    return;
  }

  if (!drives || !drives.length) {
    drivesBodyEl.innerHTML = '<tr><td colspan="8">No drives registered by you.</td></tr>';
    return;
  }

  // Notice we use innerHTML on drivesBodyEl so we must delegate event listeners
  drivesBodyEl.innerHTML = drives.map((d) => `
    <tr>
      <td><strong>${escapeHtml(d.drive_code || '-')}</strong></td>
      <td>${escapeHtml(d.location)}</td>
      <td>${new Date(d.starts_at).toLocaleString()}</td>
      <td>${new Date(d.ends_at).toLocaleString()}</td>
      <td>${escapeHtml(activeManager.name)}</td>
      <td>${driveStatus(d)}</td>
      <td>-</td>
      <td>
         <button data-id="${escapeHtml(d.id)}" class="btn-secondary delete-drive">Delete</button>
      </td>
    </tr>
  `).join('');

}

// Event Delegation for dynamically inserted buttons
drivesBodyEl.addEventListener('click', async (e) => {
  if (e.target.classList.contains('delete-drive')) {
    const id = e.target.getAttribute('data-id');
    if (!confirm("Are you sure you want to delete this drive?")) return;
    const { error } = await supabase.from('drives').delete().eq('id', id);
    if (error) alert(error.message);
    await loadDrives();
  }
});

async function doLogout() {
  await supabase.auth.signOut();
  activeManager = null;
  activeOrg = null;
  managerUniqueIdDisplayEl.textContent = '-';
  managerMetaEl.textContent = '';
  setBadge('Not Logged In', false);

  authWrapperEl.style.display = 'block';
  dashboardWrapperEl.style.display = 'none';
}

document.getElementById('managerLogoutBtn').addEventListener('click', doLogout);
managerRegisteredYesBtn.addEventListener('click', () => setMode('login'));
managerRegisteredNoBtn.addEventListener('click', () => setMode('signup'));
document.getElementById('createDriveBtn').addEventListener('click', createDrive);
document.getElementById('loadDrivesBtn').addEventListener('click', loadDrives);

async function initAuth() {
  setMode('login');

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    const mgr = await fetchManagerProfile(session.user.id);
    if (mgr) {
      await loadDrives();
    } else {
      await supabase.auth.signOut();
    }
  }

  // Subscribe to auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      if (!activeManager) {
        const mgr = await fetchManagerProfile(session.user.id);
        if (mgr) await loadDrives();
      }
    } else if (event === 'SIGNED_OUT') {
      doLogout();
    }
  });
}

initAuth();
