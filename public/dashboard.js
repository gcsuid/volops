const siteOrgId = document.getElementById('siteOrgId');
const eventSiteId = document.getElementById('eventSiteId');
const reportSiteFilter = document.getElementById('reportSiteFilter');

const activeBody = document.getElementById('activeBody');
const alertBody = document.getElementById('alertBody');
const reportBody = document.getElementById('reportBody');
const siteSummaryBody = document.getElementById('siteSummaryBody');
const activitySummaryBody = document.getElementById('activitySummaryBody');

const ORG_ID_KEY = 'volopsOrgId';
const ORG_TOKEN_KEY = 'volopsOrgAuthToken';
const VOLUNTEER_TOKEN_KEY = 'volopsVolunteerAuthToken';
const MANAGER_TOKEN_KEY = 'volopsSiteManagerAuthToken';

(function enforceRolePageAccess() {
  const orgToken = localStorage.getItem(ORG_TOKEN_KEY);
  if (orgToken) return;
  if (localStorage.getItem(VOLUNTEER_TOKEN_KEY)) {
    window.location.replace('/volunteer.html');
    return;
  }
  if (localStorage.getItem(MANAGER_TOKEN_KEY)) {
    window.location.replace('/sitemanager.html');
    return;
  }
  window.location.replace('/organization.html');
})();

let cache = { organizations: [], sites: [], events: [] };
let orgAuthToken = localStorage.getItem(ORG_TOKEN_KEY);
let orgId = localStorage.getItem(ORG_ID_KEY);

async function authedFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (orgAuthToken) headers.Authorization = `Bearer ${orgAuthToken}`;
  return fetch(url, { ...options, headers });
}

function optionsHtml(items, valueKey, labelBuilder, includeAll = false) {
  const opts = [];
  if (includeAll) opts.push('<option value="">All Sites</option>');
  for (const item of items) {
    opts.push(`<option value="${item[valueKey]}">${labelBuilder(item)}</option>`);
  }
  return opts.join('');
}

async function bootstrap() {
  const r = await fetch('/api/bootstrap');
  cache = await r.json();

  if (orgId) {
    cache.organizations = cache.organizations.filter((o) => o.id === orgId);
    cache.sites = cache.sites.filter((s) => s.orgId === orgId);
    cache.events = cache.events.filter((e) => {
      const site = cache.sites.find((s) => s.id === e.siteId);
      return Boolean(site);
    });
  }

  siteOrgId.innerHTML = optionsHtml(cache.organizations, 'id', (o) => o.name);
  eventSiteId.innerHTML = optionsHtml(cache.sites, 'id', (s) => `${s.name} (${s.address})`);
  reportSiteFilter.innerHTML = optionsHtml(cache.sites, 'id', (s) => s.name, true);
}

async function createOrganization() {
  const name = document.getElementById('orgName').value.trim();
  if (!name) return;

  const r = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });

  if (r.ok) await bootstrap();
}

async function createSite() {
  const payload = {
    orgId: siteOrgId.value,
    name: document.getElementById('siteName').value,
    address: document.getElementById('siteAddress').value,
    latitude: Number(document.getElementById('siteLat').value),
    longitude: Number(document.getElementById('siteLng').value),
    geofenceRadiusMeters: Number(document.getElementById('siteRadius').value)
  };

  const r = await authedFetch('/api/sites', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });

  if (r.ok) await bootstrap();
}

async function createEvent() {
  const payload = {
    siteId: eventSiteId.value,
    name: document.getElementById('eventName').value,
    activity: document.getElementById('eventActivity').value,
    startsAt: document.getElementById('eventStart').value || null
  };

  const r = await authedFetch('/api/events', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  const data = await r.json();
  if (!r.ok) return;

  const qrContainer = document.getElementById('qrContainer');
  qrContainer.innerHTML = '';
  new QRCode(qrContainer, {
    text: data.checkinUrl,
    width: 180,
    height: 180
  });

  document.getElementById('eventLink').innerHTML = `Share this link/QR for check-in:<br /><a href="${data.checkinUrl}" target="_blank">${data.checkinUrl}</a>`;
}

async function loadActive() {
  const r = await authedFetch('/api/dashboard/active');
  const data = await r.json();
  if (!r.ok) return;

  activeBody.innerHTML = data.activeVolunteers.map((v) => `
    <tr>
      <td>${v.name}</td>
      <td>${v.orgName}</td>
      <td>${v.siteName}</td>
      <td>${v.activity || ''}</td>
      <td>${new Date(v.timeIn).toLocaleString()}</td>
      <td>${v.geofenceStatus}</td>
    </tr>
  `).join('');

  alertBody.innerHTML = data.geofenceAlerts.map((a) => `
    <tr>
      <td>${a.volunteerName}</td>
      <td>${a.distanceMeters}</td>
      <td>${new Date(a.at).toLocaleString()}</td>
    </tr>
  `).join('');
}

async function loadReports() {
  const siteId = reportSiteFilter.value;
  const activity = document.getElementById('reportActivityFilter').value.trim();
  const qs = new URLSearchParams();
  if (siteId) qs.set('siteId', siteId);
  if (activity) qs.set('activity', activity);

  const r = await authedFetch(`/api/reports?${qs.toString()}`);
  const data = await r.json();
  if (!r.ok) return;

  reportBody.innerHTML = data.rows.map((row) => `
    <tr>
      <td>${row.name}</td>
      <td>${row.siteName}</td>
      <td>${new Date(row.timeIn).toLocaleString()}</td>
      <td>${row.timeOut ? new Date(row.timeOut).toLocaleString() : ''}</td>
      <td>${row.hoursDevoted}</td>
    </tr>
  `).join('');

  siteSummaryBody.innerHTML = data.siteSummary.map((s) => `
    <tr><td>${s.siteName}</td><td>${s.volunteers}</td><td>${s.totalHours}</td></tr>
  `).join('');

  activitySummaryBody.innerHTML = data.activitySummary.map((s) => `
    <tr><td>${s.activity}</td><td>${s.volunteers}</td><td>${s.totalHours}</td></tr>
  `).join('');
}

document.getElementById('addOrgBtn').addEventListener('click', createOrganization);
document.getElementById('addSiteBtn').addEventListener('click', createSite);
document.getElementById('createEventBtn').addEventListener('click', createEvent);
document.getElementById('loadReportsBtn').addEventListener('click', loadReports);

(async () => {
  await bootstrap();
  await loadActive();
  await loadReports();
  setInterval(loadActive, 15000);
})();
