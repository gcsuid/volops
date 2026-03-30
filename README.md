# VolOps - Volunteer Operations Platform

A platform for volunteer-based organisations to manage drives and volunteers efficiently.

## Quick Start

### Prerequisites
- Node.js 18+
- MongoDB (optional - falls back to local JSON store)

### Installation

```bash
# Install backend dependencies
npm install

# Install frontend dependencies
cd client && npm install && cd ..
```

### Running

```bash
# Start backend (port 3000)
npm start

# Start frontend (port 5173) - in separate terminal
cd client && npm run dev
```

### Environment Variables

Create `.env` from `.env.example`:

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/volops
BASE_URL=http://localhost:3000
```

---

## Architecture

```
volops/
├── server.js              # Express entry point
├── config/               # DB & JSON store config
├── models/               # Mongoose schemas
├── routes/               # API endpoints
├── middleware/           # Auth middleware
├── utils/                # Helpers & generators
├── public/               # Dashboard pages (HTML)
└── client/               # React frontend (Vite)
    └── src/
        ├── components/   # UI components
        ├── api/          # API client
        └── App.tsx       # Auth pages
```

---

## User Roles

| Role | Signup | Login | Dashboard |
|------|--------|-------|----------|
| **Volunteer** | Name, Email, Age, Gender, Password | Volunteer ID + Password | View registered drives |
| **Site Manager** | Name, Email, Organisation ID | Manager ID + Password | Create/manage drives, QR codes |
| **Organisation** | Name, Email, Location, Password | Org ID + Email | View all drives, download CSV |

---

## API Endpoints

### Volunteer
- `POST /api/volunteer/signup` - Create volunteer account
- `POST /api/volunteer/login` - Login with ID + password
- `GET /api/volunteer/drives` - Get registered drives

### Site Manager
- `POST /api/manager/signup` - Register with Org ID
- `POST /api/manager/login` - Login with ID + password
- `GET /api/manager/drives` - List manager's drives
- `POST /api/manager/drives` - Create new drive (draft)
- `POST /api/manager/drives/:id/start` - Start drive, generate QR
- `POST /api/manager/drives/:id/end` - End drive

### Organisation
- `POST /api/organization/signup` - Register organisation
- `POST /api/organization/login` - Login with Org ID + Email
- `GET /api/org/drives` - List all drives
- `GET /api/org/drives/:id/attendees` - Get attendees
- `GET /api/org/drives/:id/download` - Download CSV

### Drive (Public)
- `GET /api/drives/:id` - Get drive info
- `GET /api/drives/:id/join?secret=` - Verify QR code
- `POST /api/drives/:id/register` - Register volunteer

---

## Drive Workflow

1. **Organisation** registers and gets an Org ID
2. **Site Manager** registers using Org ID, gets Manager ID
3. **Manager** creates a drive (draft status)
4. **Manager** starts the drive → QR code generated
5. **Volunteer** signs up, scans QR → registered for drive
6. **Manager** ends drive when done
7. **Organisation** views all drives and downloads attendee data

---

## Data Storage

- **With MongoDB**: Uses Mongoose models, set `MONGODB_URI` in `.env`
- **Without MongoDB**: Falls back to `data/db.json` (local JSON store)

---

## Tech Stack

- **Backend**: Express.js, Mongoose, JSON Store fallback
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Icons**: Lucide React
