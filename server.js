const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();

function loadDotEnvFile() {
  const envPath = path.join(__dirname, '.env');
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
const BASE_URL = process.env.BASE_URL || `http://localhost:${PORT}`;

const { connectDB } = require('./config/db');

const volunteerRoutes = require('./routes/volunteer');
const organizationRoutes = require('./routes/organization');
const managerRoutes = require('./routes/manager');
const driveRoutes = require('./routes/drive');

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/volunteer', volunteerRoutes);
app.use('/api/organization', organizationRoutes);
app.use('/api/manager', managerRoutes);
app.use('/api/drives', driveRoutes);

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

async function startServer() {
  await connectDB();

  app.listen(PORT, () => {
    console.log(`VolOps running at http://localhost:${PORT}`);
  });
}

startServer();
