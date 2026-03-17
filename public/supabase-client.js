// Initialize the Supabase client
const SUPABASE_URL = 'https://fbvqkyyhzegxtikqrskt.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImZidnFreXloemVneHRpa3Fyc2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzMwNDY5MTcsImV4cCI6MjA4ODYyMjkxN30.ZR5sf-gYu4A1cN4epGRaU3ik_xOF8erHxX4csRXr2c8';

function isValidHttpUrl(value) {
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:';
  } catch (_) {
    return false;
  }
}

if (!isValidHttpUrl(SUPABASE_URL)) {
  console.error('[supabase] Invalid SUPABASE_URL', SUPABASE_URL);
}

if (!SUPABASE_ANON_KEY || SUPABASE_ANON_KEY.split('.').length !== 3) {
  console.error('[supabase] Invalid SUPABASE_ANON_KEY format');
}

console.info('[supabase] Initializing client', {
  url: SUPABASE_URL,
  anonKeyPrefix: SUPABASE_ANON_KEY.slice(0, 12)
});

// Create a single supabase client for interacting with your database
window.supabase = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const authInFlight = new Map();
let authCallCount = 0;

function maskAuthPayload(payload) {
  return {
    email: payload?.email || '',
    hasPassword: Boolean(payload?.password)
  };
}

function buildAuthKey(methodName, payload) {
  const email = String(payload?.email || '').trim().toLowerCase();
  return `${methodName}:${email}`;
}

function wrapAuthMethod(methodName) {
  const original = window.supabase.auth[methodName].bind(window.supabase.auth);

  window.supabase.auth[methodName] = async function wrappedAuthMethod(payload) {
    authCallCount += 1;
    const key = buildAuthKey(methodName, payload);
    console.info(`[supabase auth] call #${authCallCount} ${methodName}`, maskAuthPayload(payload));

    if (authInFlight.has(key)) {
      console.warn(`[supabase auth] deduped in-flight ${methodName}`, { email: payload?.email || '' });
      return authInFlight.get(key);
    }

    const request = original(payload).finally(() => {
      authInFlight.delete(key);
    });

    authInFlight.set(key, request);
    return request;
  };
}

wrapAuthMethod('signInWithPassword');
wrapAuthMethod('signUp');

document.addEventListener('DOMContentLoaded', () => {
  const guardedButtons = [
    'volunteerLoginBtn',
    'volunteerSignupBtn',
    'orgLoginBtn',
    'orgSignupBtn',
    'managerLoginBtn',
    'managerSignupBtn'
  ];

  guardedButtons.forEach((buttonId) => {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', (event) => {
      const cooldownUntil = Number(button.dataset.cooldownUntil || 0);
      if (cooldownUntil > Date.now()) {
        console.warn(`[auth ui] blocked duplicate click on ${buttonId}`);
        event.preventDefault();
        event.stopImmediatePropagation();
        return;
      }

      button.dataset.cooldownUntil = String(Date.now() + 3000);
      button.dataset.originalText = button.dataset.originalText || button.textContent;
      button.disabled = true;
      button.textContent = 'Please wait...';

      window.setTimeout(() => {
        if (Number(button.dataset.cooldownUntil || 0) <= Date.now()) {
          button.disabled = false;
          button.textContent = button.dataset.originalText || button.textContent;
        }
      }, 3000);
    }, true);
  });
});
