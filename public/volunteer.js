const tokenInput = document.getElementById('tokenInput');
const orgCodeInput = document.getElementById('orgCodeInput');
const eventInfo = document.getElementById('eventInfo');
const statusBox = document.getElementById('status');
const timerEl = document.getElementById('timer');

const nameEl = document.getElementById('name');
const emailEl = document.getElementById('email');
const ageEl = document.getElementById('age');
const genderEl = document.getElementById('gender');
const activityEl = document.getElementById('activity');
const volIdBadgeEl = document.getElementById('volIdBadge');

const registeredYesBtn = document.getElementById('volunteerRegisteredYesBtn');
const registeredNoBtn = document.getElementById('volunteerRegisteredNoBtn');

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const loginBadgeEl = document.getElementById('loginBadge');
const loginFieldsEl = document.getElementById('volunteerLoginFields');
const signupFieldsEl = document.getElementById('volunteerSignupFields');

const authWrapperEl = document.getElementById('authWrapper');
const dashboardWrapperEl = document.getElementById('dashboardWrapper');

const loginEmailEl = document.getElementById('loginEmail');
const loginPasswordEl = document.getElementById('loginPassword');

const signupNameEl = document.getElementById('signupName');
const signupAgeEl = document.getElementById('signupAge');
const signupGenderEl = document.getElementById('signupGender');
const signupEmailEl = document.getElementById('signupEmail');
const signupPasswordEl = document.getElementById('signupPassword');

const cameraEl = document.getElementById('camera');
const canvasEl = document.getElementById('snapshotCanvas');
const photoPreview = document.getElementById('photoPreview');
const photoStatusEl = document.getElementById('photoStatus');
const checkInBtnEl = document.getElementById('checkInBtn');

const VOLUNTEER_ID_KEY = 'volopsVolunteerId';
const VOLUNTEER_TOKEN_KEY = 'volopsVolunteerAuthToken';
const ORG_TOKEN_KEY = 'volopsOrgAuthToken';
const MANAGER_TOKEN_KEY = 'volopsSiteManagerAuthToken';

(function enforceRolePageAccess() {
  // Allow opening this onboarding page even if another role is logged in.
  localStorage.getItem(VOLUNTEER_TOKEN_KEY);
})();

let activeEvent = null;
let activeDrive = null;
let activeSessionId = null;
let timeInMs = null;
let timerHandle = null;
let locationWatchId = null;
let photoDataUrl = '';
let currentVolunteer = null;
let volunteerAuthToken = localStorage.getItem(VOLUNTEER_TOKEN_KEY);

function setStatus(message, level = 'ok') {
  statusBox.innerHTML = `<div class="status ${escapeHtml(level)}">${escapeHtml(message)}</div>`;
}

function setLoginBadge(text, ok = false) {
  loginBadgeEl.textContent = text;
  loginBadgeEl.style.background = ok ? '#e8f8f6' : '';
  loginBadgeEl.style.color = ok ? '#0f766e' : '';
  loginBadgeEl.style.borderColor = ok ? '#b9ece4' : '';
}

function setMode(mode) {
  loginFieldsEl.style.display = mode === 'login' ? 'block' : 'none';
  signupFieldsEl.style.display = mode === 'signup' ? 'block' : 'none';
}

function updateCheckInBtn() {
  const photoReady = Boolean(photoDataUrl);
  checkInBtnEl.disabled = !photoReady;
  if (photoReady) {
    checkInBtnEl.title = '';
    if (photoStatusEl) {
      photoStatusEl.textContent = 'Selfie captured. Ready to check in.';
      photoStatusEl.style.color = '#059669';
    }
  } else {
    checkInBtnEl.title = 'Capture selfie first';
    if (photoStatusEl) {
      photoStatusEl.textContent = 'Selfie required before check-in.';
      photoStatusEl.style.color = '#e11d48';
    }
  }
}

async function authedFetch(url, options = {}) {
  const headers = { ...(options.headers || {}) };
  if (volunteerAuthToken) headers.Authorization = `Bearer ${volunteerAuthToken}`;
  return fetch(url, { ...options, headers });
}

function formatClock(ms) {
  const s = Math.floor(ms / 1000);
  const hh = String(Math.floor(s / 3600)).padStart(2, '0');
  const mm = String(Math.floor((s % 3600) / 60)).padStart(2, '0');
  const ss = String(s % 60).padStart(2, '0');
  return `${hh}:${mm}:${ss}`;
}

function startTimer(timeInIso) {
  timeInMs = new Date(timeInIso).getTime();
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = setInterval(() => {
    timerEl.textContent = formatClock(Date.now() - timeInMs);
  }, 1000);
}

function stopTimer() {
  if (timerHandle) clearInterval(timerHandle);
  timerHandle = null;
}

function parseTokenFromText(text) {
  try {
    const maybeUrl = new URL(text);
    return maybeUrl.searchParams.get('token') || maybeUrl.searchParams.get('driveToken') || text;
  } catch {
    return text;
  }
}

function applyVolunteerToForm(volunteer) {
  currentVolunteer = volunteer;
  nameEl.value = volunteer.name || '';
  ageEl.value = volunteer.age || '';
  genderEl.value = volunteer.gender || '';
  emailEl.value = volunteer.email || '';
  if (volIdBadgeEl) volIdBadgeEl.textContent = volunteer.volId || volunteer.id || '-';
  const dashVolIdEl = document.getElementById('dashVolId');
  const dashVolNameEl = document.getElementById('dashVolName');
  if (dashVolIdEl) dashVolIdEl.textContent = volunteer.volId || volunteer.id || '-';
  if (dashVolNameEl) dashVolNameEl.textContent = volunteer.name || volunteer.email || '';
  setLoginBadge(`Logged in: ${volunteer.name || volunteer.email}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

async function hydrateVolunteerFromLocalStorage() {
  const volunteerId = localStorage.getItem(VOLUNTEER_ID_KEY);
  if (!volunteerId || !volunteerAuthToken) return;
  const r = await authedFetch(`/api/volunteers/${encodeURIComponent(volunteerId)}`);
  if (!r.ok) {
    localStorage.removeItem(VOLUNTEER_ID_KEY);
    localStorage.removeItem(VOLUNTEER_TOKEN_KEY);
    volunteerAuthToken = null;
    return;
  }
  const data = await r.json();
  applyVolunteerToForm(data.volunteer);
}

async function loadEvent(token) {
  const cleanToken = parseTokenFromText(token).trim();
  if (!cleanToken) return;
  tokenInput.value = cleanToken;
  activeEvent = null;
  activeDrive = null;

  // Try as short 6-char drive code first
  if (/^[A-Z0-9]{6}$/i.test(cleanToken)) {
    const codeRes = await fetch(`/api/drives/code/${encodeURIComponent(cleanToken.toUpperCase())}`);
    if (codeRes.ok) {
      const codeData = await codeRes.json();
      activeDrive = codeData;
      // Use the UUID token for actual check-in
      tokenInput.value = codeData.drive.token;
      const completedNote = codeData.drive.completedAt ? '<br /><span style="color:#e11d48">⚠ Drive completed.</span>' : '';
      eventInfo.innerHTML = `
        <strong>${escapeHtml(codeData.organization.name)}</strong><br />
        Drive Manager: ${escapeHtml(codeData.drive.managerName)}<br />
        Location: ${escapeHtml(codeData.drive.location)}<br />
        Start: ${new Date(codeData.drive.startsAt).toLocaleString()}<br />
        End: ${new Date(codeData.drive.endsAt).toLocaleString()}${completedNote}<br />
        Enter organization code for check-in.
      `;
      return;
    }
  }

  const driveRes = await fetch(`/api/drives/token/${encodeURIComponent(cleanToken)}`);
  if (driveRes.ok) {
    const driveData = await driveRes.json();
    activeDrive = driveData;
    const completedNote = driveData.drive.completedAt ? '<br /><span style="color:#e11d48">⚠ Drive completed by site manager.</span>' : '';
    eventInfo.innerHTML = `
      <strong>${escapeHtml(driveData.organization.name)}</strong><br />
      Drive Manager: ${escapeHtml(driveData.drive.managerName)}<br />
      Location: ${escapeHtml(driveData.drive.location)}<br />
      Start: ${new Date(driveData.drive.startsAt).toLocaleString()}<br />
      End: ${new Date(driveData.drive.endsAt).toLocaleString()}${completedNote}<br />
      Enter organization code for check-in.
    `;
    return;
  }

  const r = await fetch(`/api/events/token/${encodeURIComponent(cleanToken)}`);
  const data = await r.json();
  if (!r.ok) throw new Error(data.error || 'Unable to fetch event/drive from token');
  activeEvent = data;
  activityEl.value = data.event.activity || activityEl.value;
  eventInfo.innerHTML = `
    <strong>${escapeHtml(data.organization.name)}</strong><br />
    Event: ${escapeHtml(data.event.name)}<br />
    Location: ${escapeHtml(data.site.name)}, ${escapeHtml(data.site.address)}<br />
    Geofence Radius: ${escapeHtml(String(data.site.geofenceRadiusMeters))}m
  `;
}

async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition((pos) => resolve(pos.coords), (err) => reject(err), { enableHighAccuracy: true, timeout: 15000 });
  });
}

async function sendLocationHeartbeat(position) {
  if (!activeSessionId || !volunteerAuthToken) return;
  try {
    const r = await authedFetch(`/api/sessions/${activeSessionId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude: position.latitude, longitude: position.longitude })
    });
    const data = await r.json();
    if (r.ok && !data.withinGeofence) {
      setStatus(`Geofence warning: you are ${data.distanceMeters}m away (allowed ${data.radiusMeters}m).`, 'warn');
    }
  } catch {}
}

function startGeofenceTracking() {
  if (!navigator.geolocation) return;
  if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId = navigator.geolocation.watchPosition(
    (p) => sendLocationHeartbeat({ latitude: p.coords.latitude, longitude: p.coords.longitude }),
    () => setStatus('Unable to verify location continuously. Keep location enabled.', 'warn'),
    { enableHighAccuracy: true, timeout: 20000, maximumAge: 10000 }
  );
}

function stopGeofenceTracking() {
  if (locationWatchId) navigator.geolocation.clearWatch(locationWatchId);
  locationWatchId = null;
}

function stopCameraStream() {
  const stream = cameraEl.srcObject;
  if (!stream) return;
  stream.getTracks().forEach((track) => track.stop());
  cameraEl.srcObject = null;
}

registeredYesBtn.addEventListener('click', () => setMode('login'));
registeredNoBtn.addEventListener('click', () => setMode('signup'));

document.getElementById('volunteerLoginBtn').addEventListener('click', async () => {
  try {
    const r = await fetch('/api/auth/volunteer/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginEmailEl.value.trim(), password: loginPasswordEl.value })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Login failed');
    volunteerAuthToken = data.authToken;
    localStorage.setItem(VOLUNTEER_TOKEN_KEY, data.authToken);
    localStorage.setItem(VOLUNTEER_ID_KEY, data.volunteer.id);
    applyVolunteerToForm(data.volunteer);
    setStatus('Login successful.');
  } catch (e) {
    setStatus(e.message, 'warn');
  }
});

document.getElementById('volunteerSignupBtn').addEventListener('click', async () => {
  try {
    const r = await fetch('/api/auth/volunteer/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: signupEmailEl.value.trim(),
        password: signupPasswordEl.value,
        name: signupNameEl.value.trim(),
        age: Number(signupAgeEl.value),
        gender: signupGenderEl.value
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Signup failed');
    volunteerAuthToken = data.authToken;
    localStorage.setItem(VOLUNTEER_TOKEN_KEY, data.authToken);
    localStorage.setItem(VOLUNTEER_ID_KEY, data.volunteer.id);
    applyVolunteerToForm(data.volunteer);
    setStatus('Signup successful.');
  } catch (e) {
    setStatus(e.message, 'warn');
  }
});

function doLogout() {
  currentVolunteer = null;
  volunteerAuthToken = null;
  localStorage.removeItem(VOLUNTEER_TOKEN_KEY);
  localStorage.removeItem(VOLUNTEER_ID_KEY);
  nameEl.value = '';
  emailEl.value = '';
  ageEl.value = '';
  genderEl.value = '';
  if (volIdBadgeEl) volIdBadgeEl.textContent = '-';
  setLoginBadge('Not Logged In', false);
  setStatus('Logged out.');

  authWrapperEl.style.display = 'block';
  dashboardWrapperEl.style.display = 'none';
}

document.getElementById('logoutBtn').addEventListener('click', doLogout);

const dashLogoutBtnEl = document.getElementById('dashLogoutBtn');
if (dashLogoutBtnEl) dashLogoutBtnEl.addEventListener('click', doLogout);

document.getElementById('loadEventBtn').addEventListener('click', async () => {
  try { await loadEvent(tokenInput.value); setStatus('Token loaded.'); } catch (e) { setStatus(e.message, 'warn'); }
});

document.getElementById('startCamBtn').addEventListener('click', async () => {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
    cameraEl.srcObject = stream;
    setStatus('Camera started. Point camera at yourself and capture selfie.');
  } catch { setStatus('Camera access failed.', 'warn'); }
});

document.getElementById('captureBtn').addEventListener('click', () => {
  if (!cameraEl.srcObject) return setStatus('Start camera first.', 'warn');
  const w = cameraEl.videoWidth || 640;
  const h = cameraEl.videoHeight || 480;
  canvasEl.width = w; canvasEl.height = h;
  canvasEl.getContext('2d').drawImage(cameraEl, 0, 0, w, h);
  photoDataUrl = canvasEl.toDataURL('image/jpeg', 0.85);
  photoPreview.src = photoDataUrl;
  photoPreview.style.display = 'block';
  stopCameraStream();
  updateCheckInBtn();
  setStatus('Selfie captured. Camera stopped. You can now check in.');
});

checkInBtnEl.addEventListener('click', async () => {
  try {
    if (!currentVolunteer?.id || !volunteerAuthToken) throw new Error('Login first');
    if (!activeEvent && !activeDrive) throw new Error('Load event/drive token or drive code first');
    if (!nameEl.value.trim()) throw new Error('Name is required');
    if (activeDrive && !orgCodeInput.value.trim()) throw new Error('Organization code required for drive');
    if (!photoDataUrl) throw new Error('Selfie required. Please capture your photo before checking in.');

    const coords = await getCurrentLocation();
    const r = await authedFetch('/api/checkin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        token: activeEvent ? tokenInput.value.trim() : undefined,
        driveToken: activeDrive ? tokenInput.value.trim() : undefined,
        orgCode: orgCodeInput.value.trim(),
        volunteerId: currentVolunteer.id,
        name: nameEl.value,
        email: emailEl.value,
        age: Number(ageEl.value),
        gender: genderEl.value,
        activity: activityEl.value,
        photoDataUrl,
        latitude: coords.latitude,
        longitude: coords.longitude
      })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Check-in failed');
    activeSessionId = data.sessionId;
    startTimer(data.timeIn);
    startGeofenceTracking();
    setStatus('Checked in successfully. Timer started.');
  } catch (e) { setStatus(e.message, 'warn'); }
});

document.getElementById('checkOutBtn').addEventListener('click', async () => {
  try {
    if (!activeSessionId || !volunteerAuthToken) throw new Error('No active check-in found');
    const coords = await getCurrentLocation();
    const r = await authedFetch('/api/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeSessionId, latitude: coords.latitude, longitude: coords.longitude })
    });
    const data = await r.json();
    if (!r.ok) throw new Error(data.error || 'Check-out failed');
    stopTimer();
    stopGeofenceTracking();
    activeSessionId = null;
    setStatus(`Checked out. Hours devoted: ${data.hoursDevoted}`);
  } catch (e) { setStatus(e.message, 'warn'); }
});

function startQrScanner() {
  const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 });
  scanner.render(async (decodedText) => {
    try { await loadEvent(decodedText); setStatus('QR scanned successfully.'); }
    catch (e) { setStatus(e.message, 'warn'); }
  });
}

const params = new URLSearchParams(window.location.search);
const startupToken = params.get('driveToken') || params.get('token');
if (startupToken) {
  tokenInput.value = startupToken;
  loadEvent(startupToken).catch((e) => setStatus(e.message, 'warn'));
}

setMode('login');
updateCheckInBtn();
hydrateVolunteerFromLocalStorage().then(() => {
  if (!currentVolunteer) setLoginBadge('Not Logged In', false);
});
startQrScanner();
