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
const driveStartEl = document.getElementById('driveStart');
const driveEndEl = document.getElementById('driveEnd');

const driveLinkTextEl = document.getElementById('driveLinkText');
const driveQrEl = document.getElementById('driveQr');
const drivesBodyEl = document.getElementById('drivesBody');
const managerUniqueIdDisplayEl = document.getElementById('managerUniqueIdDisplay');
const managerMetaEl = document.getElementById('managerMeta');

const MANAGER_TOKEN_KEY = 'volopsSiteManagerAuthToken';
const MANAGER_ORG_CODE_KEY = 'volopsSiteManagerOrgCode';
const MANAGER_NAME_KEY = 'volopsSiteManagerName';
const MANAGER_UNIQUE_ID_KEY = 'volopsSiteManagerUniqueId';
const VOLUNTEER_TOKEN_KEY = 'volopsVolunteerAuthToken';
const ORG_TOKEN_KEY = 'volopsOrgAuthToken';

(function enforceRolePageAccess() {
  // Allow opening this onboarding page even if another role is logged in.
  // Strict redirects are enforced on role-protected pages like dashboard.
  localStorage.getItem(MANAGER_TOKEN_KEY);
})();

let managerAuthToken = localStorage.getItem(MANAGER_TOKEN_KEY);

function setBadge(text, ok = false) {
  managerLoginBadgeEl.textContent = text;
  managerLoginBadgeEl.style.background = ok ? '#e8f8f6' : '';
  managerLoginBadgeEl.style.color = ok ? '#0f766e' : '';
  managerLoginBadgeEl.style.borderColor = ok ? '#b9ece4' : '';
}

function setMode(mode) {
  managerLoginFieldsEl.style.display = mode === 'login' ? 'block' : 'none';
  managerSignupFieldsEl.style.display = mode === 'signup' ? 'block' : 'none';
}

async function authedFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (managerAuthToken) headers.Authorization = `Bearer ${managerAuthToken}`;
  return fetch(url, { ...options, headers });
}

function applyManagerSession(data) {
  managerAuthToken = data.authToken;
  localStorage.setItem(MANAGER_TOKEN_KEY, data.authToken);
  localStorage.setItem(MANAGER_NAME_KEY, data.manager.managerName || '');
  localStorage.setItem(MANAGER_UNIQUE_ID_KEY, data.manager.uniqueManagerId || '');

  managerNameEl.value = data.manager.managerName || managerNameEl.value;
  managerOrgNameEl.value = data.organization.name || managerOrgNameEl.value;
  managerUniqueIdDisplayEl.textContent = data.manager.uniqueManagerId || '-';
  managerMetaEl.textContent = `${data.manager.email || ''} • ${data.organization.name}`;
  setBadge(`Logged in: ${data.manager.managerName}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

document.getElementById('managerLoginBtn').addEventListener('click', async () => {
  const r = await fetch('/api/auth/site-manager/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: managerLoginEmailEl.value.trim(),
      uniqueManagerId: managerLoginUniqueIdEl.value.trim()
    })
  });
  const data = await r.json();
  if (!r.ok) {
    setBadge(data.error || 'Login failed', false);
    return;
  }
  applyManagerSession(data);
  await loadDrives();
});

document.getElementById('managerSignupBtn').addEventListener('click', async () => {
  const r = await fetch('/api/auth/site-manager/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      email: managerSignupEmailEl.value.trim(),
      managerName: managerSignupNameEl.value.trim(),
      companyId: managerSignupCompanyIdEl.value.trim()
    })
  });
  const data = await r.json();
  if (!r.ok) {
    setBadge(data.error || 'Signup failed', false);
    return;
  }
  managerLoginEmailEl.value = data.manager.email || '';
  managerLoginUniqueIdEl.value = data.manager.uniqueManagerId || '';
  applyManagerSession(data);
  setMode('login');
  await loadDrives();
});

document.getElementById('managerLogoutBtn').addEventListener('click', () => {
  managerAuthToken = null;
  localStorage.removeItem(MANAGER_TOKEN_KEY);
  localStorage.removeItem(MANAGER_ORG_CODE_KEY);
  localStorage.removeItem(MANAGER_NAME_KEY);
  localStorage.removeItem(MANAGER_UNIQUE_ID_KEY);
  managerUniqueIdDisplayEl.textContent = '-';
  managerMetaEl.textContent = '';
  setBadge('Not Logged In', false);

  authWrapperEl.style.display = 'block';
  dashboardWrapperEl.style.display = 'none';
});

async function createDrive() {
  if (!managerAuthToken) {
    driveLinkTextEl.textContent = 'Login as site manager first.';
    return;
  }
  const payload = {
    managerName: managerNameEl.value.trim(),
    organizationName: managerOrgNameEl.value.trim(),
    orgCode: managerOrgCodeEl.value.trim(),
    location: driveLocationEl.value.trim(),
    startsAt: driveStartEl.value,
    endsAt: driveEndEl.value
  };
  const r = await authedFetch('/api/site-manager/drives', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) {
    driveLinkTextEl.textContent = data.error || 'Failed to create drive';
    return;
  }
  localStorage.setItem(MANAGER_ORG_CODE_KEY, managerOrgCodeEl.value.trim());
  driveLinkTextEl.innerHTML = `Drive registered. Share check-in URL:<br /><a href="${data.checkinUrl}" target="_blank">${data.checkinUrl}</a>`;
  driveQrEl.innerHTML = '';
  new QRCode(driveQrEl, { text: data.checkinUrl, width: 180, height: 180 });
  await loadDrives();
}

async function loadDrives() {
  if (!managerAuthToken) {
    drivesBodyEl.innerHTML = '<tr><td colspan="5">Login as site manager first.</td></tr>';
    return;
  }
  const orgCode = managerOrgCodeEl.value.trim() || localStorage.getItem(MANAGER_ORG_CODE_KEY) || '';
  if (!orgCode) {
    drivesBodyEl.innerHTML = '<tr><td colspan="5">Enter organization code to load drives.</td></tr>';
    return;
  }
  managerOrgCodeEl.value = orgCode;

  const r = await authedFetch(`/api/site-manager/drives?orgCode=${encodeURIComponent(orgCode)}`);
  const data = await r.json();
  if (!r.ok) {
    drivesBodyEl.innerHTML = `<tr><td colspan="5">${data.error || 'Failed to load drives'}</td></tr>`;
    return;
  }
  if (!data.drives.length) {
    drivesBodyEl.innerHTML = '<tr><td colspan="5">No drives registered.</td></tr>';
    return;
  }
  drivesBodyEl.innerHTML = data.drives.map((d) => `
    <tr>
      <td>${d.location}</td>
      <td>${new Date(d.startsAt).toLocaleString()}</td>
      <td>${new Date(d.endsAt).toLocaleString()}</td>
      <td>${d.managerName}</td>
      <td><button data-id="${d.id}" class="btn-secondary delete-drive">Delete</button></td>
    </tr>
  `).join('');

  document.querySelectorAll('.delete-drive').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      await authedFetch(`/api/site-manager/drives/${encodeURIComponent(id)}`, { method: 'DELETE' });
      await loadDrives();
    });
  });
}

document.getElementById('createDriveBtn').addEventListener('click', createDrive);
document.getElementById('loadDrivesBtn').addEventListener('click', loadDrives);
managerRegisteredYesBtn.addEventListener('click', () => setMode('login'));
managerRegisteredNoBtn.addEventListener('click', () => setMode('signup'));

setMode('login');
if (managerAuthToken) {
  setBadge('Logged in session found', true);
  managerNameEl.value = localStorage.getItem(MANAGER_NAME_KEY) || managerNameEl.value;
  managerUniqueIdDisplayEl.textContent = localStorage.getItem(MANAGER_UNIQUE_ID_KEY) || '-';
} else {
  setBadge('Not Logged In', false);
}
