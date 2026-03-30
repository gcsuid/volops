const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

const projectRoot = path.join(__dirname, '..');
const dbPath = path.join(projectRoot, 'data', 'db.json');
const port = 3101;
const baseUrl = `http://127.0.0.1:${port}`;
const unique = Date.now();

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitForServer() {
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      const response = await fetch(`${baseUrl}/api/drives`);
      if (response.ok) return;
    } catch {}
    await sleep(250);
  }
  throw new Error('Server did not become ready in time');
}

async function request(method, route, body, token) {
  const response = await fetch(`${baseUrl}${route}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'x-session-token': token } : {})
    },
    body: body ? JSON.stringify(body) : undefined
  });

  const contentType = response.headers.get('content-type') || '';
  const data = contentType.includes('application/json') ? await response.json() : await response.text();

  if (!response.ok) {
    const detail = typeof data === 'string' ? data : data.error || JSON.stringify(data);
    throw new Error(`${method} ${route} failed: ${detail}`);
  }

  return data;
}

async function run() {
  const originalDb = fs.existsSync(dbPath) ? fs.readFileSync(dbPath, 'utf8') : null;
  const server = spawn(process.execPath, ['server.js'], {
    cwd: projectRoot,
    env: {
      ...process.env,
      PORT: String(port),
      MONGODB_URI: ''
    },
    stdio: ['ignore', 'pipe', 'pipe']
  });

  let serverOutput = '';
  server.stdout.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });
  server.stderr.on('data', (chunk) => {
    serverOutput += chunk.toString();
  });

  try {
    await waitForServer();

    const rootResponse = await fetch(baseUrl);
    if (![200, 503].includes(rootResponse.status)) {
      throw new Error(`GET / returned unexpected status ${rootResponse.status}`);
    }

    const org = await request('POST', '/api/organization/signup', {
      name: `Smoke Org ${unique}`,
      email: `org-${unique}@example.com`,
      location: 'Bhubaneswar',
      password: 'secret123'
    });

    const orgLogin = await request('POST', '/api/organization/login', {
      org_id: org.org_id,
      email: `org-${unique}@example.com`
    });

    const manager = await request('POST', '/api/manager/signup', {
      name: `Smoke Manager ${unique}`,
      email: `manager-${unique}@example.com`,
      org_id: org.org_id,
      password: 'secret123'
    });

    const managerLogin = await request('POST', '/api/manager/login', {
      email: `manager-${unique}@example.com`,
      org_id: org.org_id
    });

    const volunteer = await request('POST', '/api/volunteer/signup', {
      name: `Smoke Volunteer ${unique}`,
      email: `vol-${unique}@example.com`,
      age: '22',
      gender: 'Other',
      password: 'secret123'
    });

    const volunteerLogin = await request('POST', '/api/volunteer/login', {
      email: `vol-${unique}@example.com`
    });

    const drive = await request('POST', '/api/manager/drives', {
      name: `Smoke Drive ${unique}`,
      location: 'Unit Test Ground',
      description: 'Smoke test drive'
    }, managerLogin.token);

    const startedDrive = await request('POST', `/api/manager/drives/${drive.id}/start`, undefined, managerLogin.token);

    await request('GET', `/api/drives/${drive.id}/join?secret=${encodeURIComponent(startedDrive.qr_secret)}`);
    await request('POST', `/api/drives/${drive.id}/register`, {
      secret: startedDrive.qr_secret,
      vol_id: volunteer.vol_id
    });

    const checkIn = await request('POST', '/api/volunteer/checkin', {
      drive_id: drive.id
    }, volunteerLogin.token);

    if (!checkIn.checked_in_at) {
      throw new Error('Volunteer check-in did not return a timestamp');
    }

    const current = await request('GET', '/api/volunteer/current', undefined, volunteerLogin.token);
    if (!current.active) {
      throw new Error('Volunteer current drive should be active after check-in');
    }

    const checkOut = await request('POST', '/api/volunteer/checkout', {
      drive_id: drive.id
    }, volunteerLogin.token);

    if (typeof checkOut.duration_minutes !== 'number') {
      throw new Error('Volunteer checkout did not return a duration');
    }

    const managerVolunteers = await request('GET', `/api/manager/drives/${drive.id}/volunteers`, undefined, managerLogin.token);
    if (!Array.isArray(managerVolunteers) || managerVolunteers.length !== 1) {
      throw new Error('Manager volunteer list did not include the registered volunteer');
    }

    const stats = await request('GET', '/api/organization/stats', undefined, orgLogin.token);
    if (stats.total_drives < 1 || stats.total_volunteers < 1) {
      throw new Error('Organization stats did not reflect the smoke-test data');
    }

    const endedDrive = await request('POST', `/api/manager/drives/${drive.id}/end`, undefined, managerLogin.token);
    if (endedDrive.status !== 'ended') {
      throw new Error('Drive did not end cleanly');
    }

    console.log('Smoke test passed');
  } finally {
    server.kill();
    await sleep(500);

    if (originalDb === null) {
      if (fs.existsSync(dbPath)) {
        fs.unlinkSync(dbPath);
      }
    } else {
      fs.writeFileSync(dbPath, originalDb);
    }
  }
}

run().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
