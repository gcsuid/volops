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
# Build frontend (for production)
cd client && npm run build && cd ..

# Start backend (port 3000) - serves frontend from client/dist
npm start
```

For development with hot reload:
```bash
# Terminal 1: Start backend
npm start

# Terminal 2: Start frontend dev server
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
└── client/               # React frontend (Vite)
    └── src/
        ├── api/          # API client
        ├── components/   # UI components
        └── pages/        # Dashboard pages
            ├── VolunteerDashboard.tsx
            ├── ManagerDashboard.tsx
            └── OrganizationDashboard.tsx
```

---

## User Roles

| Role | Signup | Login | Dashboard |
|------|--------|-------|----------|
| **Volunteer** | Name, Email, Age, Gender, Password | Email only | View drives, clock in/out, past activity |
| **Site Manager** | Name, Email, Organisation ID, Password | Email + Org ID | Create/manage drives, QR codes, view volunteers |
| **Organisation** | Name, Email, Location, Phone, Password | Email + Org ID | View all drives, manage managers, download CSV |

---

## API Endpoints

### Volunteer
- `POST /api/volunteer/signup` - Create volunteer account
- `POST /api/volunteer/login` - Login with email
- `GET /api/volunteer/me` - Get profile (auth required)
- `GET /api/volunteer/drives` - Get registered drives with check-in/out times
- `GET /api/volunteer/current` - Get currently active check-in
- `POST /api/volunteer/checkin` - Clock in to a drive
- `POST /api/volunteer/checkout` - Clock out from a drive

### Site Manager
- `POST /api/manager/signup` - Register with Org ID
- `POST /api/manager/login` - Login with email + org_id
- `GET /api/manager/me` - Get profile (auth required)
- `GET /api/manager/drives` - List manager's drives
- `GET /api/manager/drives/:id/volunteers` - List checked-in volunteers
- `POST /api/manager/drives` - Create new drive (draft)
- `POST /api/manager/drives/:id/start` - Start drive, generate QR
- `POST /api/manager/drives/:id/end` - End drive (auto clock-out all volunteers)
- `GET /api/manager/stats` - Get drive statistics

### Organisation
- `POST /api/organization/signup` - Register organisation
- `POST /api/organization/login` - Login with email + org_id
- `GET /api/organization/me` - Get profile (auth required)
- `GET /api/organization/managers` - List all managers
- `GET /api/organization/drives` - List all drives across managers
- `GET /api/organization/drives/:id/download` - Download CSV of attendees
- `GET /api/organization/stats` - Get overall statistics

### Drive (Public)
- `GET /api/drives` - List all drives
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
6. **Volunteer** clocks in when arriving at drive location
7. **Volunteer** clocks out when leaving → duration calculated
8. **Manager** ends drive when done → all unchecked volunteers auto clocked out
9. **Organisation** views all drives and downloads attendee data as CSV

---

## Clock-in/Clock-out System

- Volunteers can check in to active drives
- System tracks check-in and check-out timestamps
- Duration is automatically calculated when checking out
- Managers can end a drive, which auto clock-outs all checked-in volunteers
- Volunteers can see their past drives with total hours contributed

---

## Data Storage

- **With MongoDB**: Uses Mongoose models, set `MONGODB_URI` in `.env`
- **Without MongoDB**: Falls back to `data/db.json` (local JSON store)

---

## Tech Stack

- **Backend**: Express.js, Mongoose, JSON Store fallback
- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Icons**: Lucide React
