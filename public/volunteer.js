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

let activeDrive = null;
let activeSessionId = null;
let timeInMs = null;
let timerHandle = null;
let locationWatchId = null;
let photoDataUrl = '';
let currentVolunteer = null;
const saveProfileBtn = document.getElementById('saveProfileBtn');

function isNoRowsFound(error) {
  const msg = String(error?.message || '');
  const code = String(error?.code || '');
  return code === 'PGRST116' || msg.toLowerCase().includes('no rows');
}

function createLocalVolunteerProfile({ id, email }) {
  return {
    id,
    vol_id: '',
    name: '',
    email: email || '',
    age: null,
    gender: ''
  };
}

async function upsertVolunteerProfile(profile) {
  const cleanName = String(profile.name || '').trim();
  const cleanEmail = String(profile.email || '').trim();
  const cleanGender = String(profile.gender || '').trim();
  const cleanAge = Number(profile.age);

  if (!cleanName) throw new Error('Name is required');
  if (!cleanEmail) throw new Error('Email is required');
  if (!Number.isInteger(cleanAge) || cleanAge < 1 || cleanAge > 120) throw new Error('Age must be 1-120');
  if (!cleanGender) throw new Error('Gender is required');

  // If vol_id is missing, generate one client-side (unique constraint enforced in DB).
  // Collision chance is low; if collision occurs, Supabase returns a unique violation error.
  const volId = profile.vol_id && String(profile.vol_id).trim()
    ? String(profile.vol_id).trim()
    : `VOL-${Math.floor(100000 + Math.random() * 900000)}`;

  const { data, error } = await supabase
    .from('volunteers')
    .upsert([{
      id: profile.id,
      vol_id: volId,
      name: cleanName,
      email: cleanEmail.toLowerCase(),
      age: cleanAge,
      gender: cleanGender
    }], { onConflict: 'id' })
    .select()
    .single();

  if (error) throw error;
  return data;
}

function escapeHtml(v) {
  return String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

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

  if (mode === 'login') {
    registeredYesBtn.classList.remove('btn-secondary');
    registeredNoBtn.classList.add('btn-secondary');
  } else {
    registeredNoBtn.classList.remove('btn-secondary');
    registeredYesBtn.classList.add('btn-secondary');
  }
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
  if (volIdBadgeEl) volIdBadgeEl.textContent = volunteer.vol_id || '-';

  const dashVolIdEl = document.getElementById('dashVolId');
  const dashVolNameEl = document.getElementById('dashVolName');
  if (dashVolIdEl) dashVolIdEl.textContent = volunteer.vol_id || '-';
  if (dashVolNameEl) dashVolNameEl.textContent = volunteer.name || volunteer.email || '';

  setLoginBadge(`Logged in: ${volunteer.name || volunteer.email}`, true);

  authWrapperEl.style.display = 'none';
  dashboardWrapperEl.style.display = 'block';
}

async function fetchVolunteerProfile(userId) {
  const { data, error } = await supabase.from('volunteers').select('*').eq('id', userId).single();
  if (data) {
    applyVolunteerToForm(data);
    return data;
  }
  if (error && !isNoRowsFound(error)) throw error;
  return null;
}

async function loadEvent(token) {
  setStatus('Loading drive...');
  const cleanToken = parseTokenFromText(token).trim();
  if (!cleanToken) return;
  tokenInput.value = cleanToken;
  activeDrive = null;

  try {
    // Try to load by drive_code first length is usually 6
    let query = supabase.from('drives').select('*, organizations(name)');
    if (cleanToken.length === 6) {
      query = query.eq('drive_code', cleanToken.toUpperCase());
    } else {
      query = query.eq('token', cleanToken);
    }

    const { data: drive, error } = await query.single();
    if (error || !drive) throw new Error('Drive not found.');

    activeDrive = drive;

    eventInfo.innerHTML = `
      <strong>${escapeHtml(drive.organizations?.name || 'Organization')}</strong><br />
      Location: ${escapeHtml(drive.location)}<br />
      Start: ${new Date(drive.starts_at).toLocaleString()}<br />
      End: ${new Date(drive.ends_at).toLocaleString()}<br />
      Enter organization code for check-in.
    `;
    setStatus('Drive loaded successfully.');
  } catch (err) {
    setStatus(err.message, 'warn');
  }
}

async function getCurrentLocation() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('Geolocation not supported'));
    navigator.geolocation.getCurrentPosition((pos) => resolve(pos.coords), (err) => reject(err), { enableHighAccuracy: true, timeout: 15000 });
  });
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
    const { data, error } = await supabase.auth.signInWithPassword({
      email: loginEmailEl.value.trim(),
      password: loginPasswordEl.value
    });
    if (error) throw error;
    const profile = await fetchVolunteerProfile(data.user.id);
    if (!profile) {
      // Auth is valid but the profile row is missing (or RLS blocked insert previously).
      // Let the user proceed and save their profile from the dashboard panel.
      const local = createLocalVolunteerProfile({ id: data.user.id, email: data.user.email || loginEmailEl.value.trim() });
      applyVolunteerToForm(local);
      setStatus('Logged in, but your volunteer profile is missing. Please fill your details and click “Save Profile”.', 'warn');
    } else {
      setStatus('Login successful.');
    }
  } catch (e) {
    setStatus(e.message, 'warn');
  }
});

document.getElementById('volunteerSignupBtn').addEventListener('click', async () => {
  try {
    const email = signupEmailEl.value.trim();
    const name = signupNameEl.value.trim();
    const age = Number(signupAgeEl.value);
    const gender = signupGenderEl.value;
    const password = signupPasswordEl.value;

    if (!name || !age || !gender || !email || !password) throw new Error("All fields are required");

    let profile = null;

    // 1. Try server-side signup first (bypasses email rate limits)
    const response = await fetch('/api/volunteer/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, name, age, gender })
    });

    if (response.ok) {
      // Server-side signup succeeded
      const result = await response.json();
      profile = result.profile;

      // Sign in client-side to establish Supabase session
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });
      if (signInError) throw signInError;

    } else if (response.status === 503) {
      // Server-side signup unavailable — fall back to client-side Supabase Auth
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({ email, password });
      if (signUpError) throw signUpError;

      // If email confirmation is required, the session may not be available yet
      let userId = signUpData.session?.user?.id || signUpData.user?.id;
      if (!userId) {
        throw new Error('Signup submitted. Please check your email to confirm, then log in.');
      }

      // If session was not returned by signUp, sign in explicitly
      if (!signUpData.session) {
        const { data: authData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });
        if (signInError) throw signInError;
        userId = authData.user.id;
      }

      // Create volunteer profile record
      profile = await upsertVolunteerProfile({
        id: userId,
        name,
        email,
        age,
        gender
      });

    } else {
      // Other server error
      const result = await response.json();
      throw new Error(result.error || 'Signup failed');
    }

    if (profile) {
      applyVolunteerToForm(profile);
      setStatus('Signup successful.');
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user?.id) {
        const fetched = await fetchVolunteerProfile(session.user.id);
        if (fetched) {
          setStatus('Signup successful.');
        } else {
          const local = createLocalVolunteerProfile({ id: session.user.id, email });
          applyVolunteerToForm(local);
          setStatus('Signup completed, but profile was not created. Please click “Save Profile”.', 'warn');
        }
      }
    }
  } catch (e) {
    setStatus(e.message, 'warn');
  }
});

saveProfileBtn?.addEventListener('click', async () => {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const userId = session?.user?.id || currentVolunteer?.id;
    if (!userId) throw new Error('Please login first');

    const saved = await upsertVolunteerProfile({
      id: userId,
      vol_id: currentVolunteer?.vol_id || '',
      name: nameEl.value,
      email: emailEl.value,
      age: ageEl.value,
      gender: genderEl.value
    });
    applyVolunteerToForm(saved);
    setStatus('Profile saved.');
  } catch (e) {
    setStatus(e.message, 'warn');
  }
});

async function doLogout() {
  await supabase.auth.signOut();
  currentVolunteer = null;
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
document.getElementById('dashLogoutBtn')?.addEventListener('click', doLogout);

document.getElementById('loadEventBtn').addEventListener('click', async () => {
  try { await loadEvent(tokenInput.value); } catch (e) { setStatus(e.message, 'warn'); }
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
    if (!currentVolunteer?.id) throw new Error('Login first');
    if (!activeDrive) throw new Error('Load drive token or drive code first');
    if (!nameEl.value.trim()) throw new Error('Name is required');
    if (!orgCodeInput.value.trim()) throw new Error('Organization code required');
    if (!photoDataUrl) throw new Error('Selfie required.');

    // Very simple org check for now: does the org have this code?
    const { data: org, error: orgError } = await supabase.from('organizations').select('org_code').eq('id', activeDrive.org_id).single();
    if (orgError || org.org_code !== orgCodeInput.value.trim()) throw new Error('Invalid organization code');

    const coords = await getCurrentLocation();

    // Insert session into Supabase
    const { data: session, error } = await supabase.from('sessions').insert([{
      volunteer_id: currentVolunteer.id,
      drive_id: activeDrive.id,
      check_in_lat: coords.latitude,
      check_in_lng: coords.longitude,
      photo_url: 'selfie_data_placeholder' // In a real app, upload photoDataUrl to Supabase Storage and stash URL here
    }]).select('id, time_in').single();

    if (error) throw error;

    activeSessionId = session.id;
    startTimer(session.time_in);
    setStatus('Checked in successfully. Timer started.');
  } catch (e) { setStatus(e.message, 'warn'); }
});

document.getElementById('checkOutBtn').addEventListener('click', async () => {
  try {
    if (!activeSessionId) throw new Error('No active check-in found');
    const coords = await getCurrentLocation();

    // In a real query, we would calculate hours devoted here or via db trigger
    // Let's do a quick calculation on client side for MVP just to populate the field
    const timeOut = new Date().toISOString();

    const { data: session, error: selError } = await supabase.from('sessions').select('time_in').eq('id', activeSessionId).single();
    if (selError) throw selError;

    const msDiff = new Date(timeOut).getTime() - new Date(session.time_in).getTime();
    const hoursDevoted = (msDiff / (1000 * 60 * 60)).toFixed(2);

    const { error } = await supabase.from('sessions').update({
      time_out: timeOut,
      check_out_lat: coords.latitude,
      check_out_lng: coords.longitude,
      hours_devoted: hoursDevoted
    }).eq('id', activeSessionId);

    if (error) throw error;

    stopTimer();
    activeSessionId = null;
    setStatus(`Checked out. Hours devoted: ${hoursDevoted}`);
  } catch (e) { setStatus(e.message, 'warn'); }
});

function startQrScanner() {
  const scanner = new Html5QrcodeScanner('reader', { fps: 10, qrbox: 220 });
  scanner.render(async (decodedText) => {
    try { await loadEvent(decodedText); setStatus('QR scanned successfully.'); }
    catch (e) { setStatus(e.message, 'warn'); }
  });
}

// Initial setup
async function initAuth() {
  setMode('login');
  updateCheckInBtn();

  const { data: { session } } = await supabase.auth.getSession();
  if (session?.user) {
    await fetchVolunteerProfile(session.user.id);
  }

  // Subscribe to auth changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session) {
      if (!currentVolunteer) await fetchVolunteerProfile(session.user.id);
    } else if (event === 'SIGNED_OUT') {
      doLogout();
    }
  });

  const params = new URLSearchParams(window.location.search);
  const startupToken = params.get('driveToken') || params.get('token');
  if (startupToken) {
    loadEvent(startupToken).catch((e) => setStatus(e.message, 'warn'));
  }
}

initAuth();
startQrScanner();
