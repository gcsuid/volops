const express = require('express');
const fs = require('fs');
const path = require('path');

const projectRoot = path.join(__dirname, '..');
const app = express();

function loadDotEnvFile() {
  const envPath = path.join(projectRoot, '.env');
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

const { connectDB } = require('./config/db');
const volunteerRoutes = require('./routes/volunteer');
const organizationRoutes = require('./routes/organization');
const managerRoutes = require('./routes/manager');
const driveRoutes = require('./routes/drive');

app.use(express.json());

app.use('/api/volunteer', volunteerRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/drives', driveRoutes);

const clientDistPath = path.join(projectRoot, 'client', 'dist');
const hasClientBuild = fs.existsSync(path.join(clientDistPath, 'index.html'));

if (hasClientBuild) {
  app.use(express.static(clientDistPath));

  app.get(/^(?!\/api(?:\/|$)).*/, (req, res) => {
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
} else {
  app.get('/', (req, res) => {
    res.status(503).send('Frontend build not found. Run "npm run client:build" from the project root.');
  });
}

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`VolOps running at http://localhost:${PORT}`);
  });
}

startServer();

module.exports = app;
