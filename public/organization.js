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

const ORG_ID_KEY = 'volopsOrgId';
const ORG_CODE_KEY = 'volopsOrgCode';
const ORG_COMPANY_ID_KEY = 'volopsCompanyId';
const ORG_TOKEN_KEY = 'volopsOrgAuthToken';
const VOLUNTEER_TOKEN_KEY = 'volopsVolunteerAuthToken';
const MANAGER_TOKEN_KEY = 'volopsSiteManagerAuthToken';

(function enforceRolePageAccess() {
  // Allow opening this onboarding page even if another role is logged in.
  localStorage.getItem(ORG_TOKEN_KEY);
})();

let activeOrg = null;
let orgAuthToken = localStorage.getItem(ORG_TOKEN_KEY);

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

async function authedFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (orgAuthToken) headers.Authorization = `Bearer ${orgAuthToken}`;
  return fetch(url, { ...options, headers });
}

function formatDateForInput(date) {
  return new Date(date).toISOString().slice(0, 10);
}

function applyOrgSession(org, orgCode, authToken) {
  activeOrg = org;
  orgAuthToken = authToken || orgAuthToken;
  localStorage.setItem(ORG_ID_KEY, org.id);
  localStorage.setItem(ORG_CODE_KEY, orgCode);
  localStorage.setItem(ORG_COMPANY_ID_KEY, org.companyId || '');
  localStorage.setItem(ORG_TOKEN_KEY, orgAuthToken || '');

  orgCompanyIdDisplayEl.textContent = org.companyId || '-';
  orgCodeDisplayEl.textContent = orgCode || '-';
  orgMetaEl.textContent = `${org.name} • ${org.location}`;
  setBadge(`Logged in: ${org.name}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

async function loadSheet() {
  if (!activeOrg?.id || !orgAuthToken) return;
  const date = sheetDateEl.value || formatDateForInput(new Date());
  const r = await authedFetch(`/api/orgs/${encodeURIComponent(activeOrg.id)}/sheet?date=${encodeURIComponent(date)}`);
  const data = await r.json();
  if (!r.ok) {
    orgSheetBodyEl.innerHTML = `<tr><td colspan="7">${data.error || 'Failed to load sheet'}</td></tr>`;
    return;
  }
  if (!data.rows.length) {
    orgSheetBodyEl.innerHTML = '<tr><td colspan="7">No volunteer entries for this date.</td></tr>';
    return;
  }
  orgSheetBodyEl.innerHTML = data.rows.map((r0) => `
    <tr>
      <td>${r0.name}</td><td>${r0.age}</td><td>${r0.gender}</td><td>${r0.driveLocation}</td>
      <td>${new Date(r0.timeIn).toLocaleString()}</td>
      <td>${r0.timeOut ? new Date(r0.timeOut).toLocaleString() : ''}</td>
      <td>${r0.hoursDevoted}</td>
    </tr>
  `).join('');
}

document.getElementById('orgLoginBtn').addEventListener('click', async () => {
  const r = await fetch('/api/auth/organization/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ companyId: orgLoginCompanyIdEl.value.trim(), password: orgLoginPasswordEl.value })
  });
  const data = await r.json();
  if (!r.ok) {
    setBadge(data.error || 'Login failed', false);
    return;
  }
  applyOrgSession(data.organization, data.orgCode, data.authToken);
  await loadSheet();
});

document.getElementById('orgSignupBtn').addEventListener('click', async () => {
  const r = await fetch('/api/auth/organization/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      name: orgSignupNameEl.value.trim(),
      location: orgSignupLocationEl.value.trim(),
      contactEmail: orgSignupEmailEl.value.trim(),
      password: orgSignupPasswordEl.value
    })
  });
  const data = await r.json();
  if (!r.ok) {
    setBadge(data.error || 'Registration failed', false);
    return;
  }
  applyOrgSession(data.organization, data.orgCode, data.authToken);
  await loadSheet();
});

document.getElementById('orgLoadByDateBtn').addEventListener('click', loadSheet);

document.getElementById('orgLogoutBtn').addEventListener('click', () => {
  activeOrg = null;
  orgAuthToken = null;
  localStorage.removeItem(ORG_ID_KEY);
  localStorage.removeItem(ORG_CODE_KEY);
  localStorage.removeItem(ORG_COMPANY_ID_KEY);
  localStorage.removeItem(ORG_TOKEN_KEY);
  orgCompanyIdDisplayEl.textContent = '-';
  orgCodeDisplayEl.textContent = '-';
  orgMetaEl.textContent = '';
  orgSheetBodyEl.innerHTML = '';
  setBadge('Not Logged In', false);

  authWrapperEl.style.display = 'block';
  dashboardWrapperEl.style.display = 'none';
});

orgRegisteredYesBtn.addEventListener('click', () => setMode('login'));
orgRegisteredNoBtn.addEventListener('click', () => setMode('signup'));

(async () => {
  setMode('login');
  sheetDateEl.value = formatDateForInput(new Date());

  const orgId = localStorage.getItem(ORG_ID_KEY);
  const orgCode = localStorage.getItem(ORG_CODE_KEY);
  const companyId = localStorage.getItem(ORG_COMPANY_ID_KEY);
  if (orgId && orgCode && orgAuthToken) {
    const r = await authedFetch(`/api/orgs/${encodeURIComponent(orgId)}/sheet?date=${encodeURIComponent(sheetDateEl.value)}`);
    const data = await r.json();
    if (r.ok) {
      applyOrgSession({ ...data.organization, companyId }, orgCode, orgAuthToken);
      await loadSheet();
      return;
    }
  }
  setBadge('Not Logged In', false);
})();
