# Working Status - VolOps

## What Has Been Implemented

### 1) Role model and auth sessions
- Roles implemented: `volunteer`, `site_manager`, `organization`.
- OTP login implemented for all 3 roles (email/phone, demo OTP returned by API).
- Server-side bearer session tokens issued after OTP verification.
- Role-based route protection added using middleware (`requireRole`).

### 2) Volunteer flow
- Volunteer OTP login.
- Profile capture + persistence: `name`, `age`, `gender`.
- Profile autofill on later sessions/logins.
- Volunteer check-in/check-out supports:
  - token/driveToken intake
  - photo capture
  - timer
  - geofence for event/site flow
- Volunteer APIs are now session-protected.

### 3) Organization flow
- Organization OTP login/signup.
- First-time signup captures organization `name` and `location`.
- Unique org code generation:
  - deterministic 10-digit code derived from org UUID
  - hash stored in DB (`orgCodeHash`)
- Organization sheet endpoint for a given date.
- Organization sheet reflects volunteer entries linked through drive + org code.
- Organization APIs are session-protected and org-scoped.

### 4) Site manager flow
- Site manager OTP login.
- Site manager verification requires manager name + org code (+ optional org name check).
- Drive registration form supports:
  - manager name
  - org name
  - org code
  - location
  - start time
  - end time
- Drive conflict lock implemented:
  - same organization
  - same normalized location
  - overlapping time window
  - blocked until existing drive is deleted.
- Delete drive endpoint for wrong entries.
- Drive list endpoint scoped to manager organization.
- Drive QR/check-in link generation.
- Site manager APIs are session-protected and org-scoped.

### 5) Frontend pages added/updated
- `public/volunteer.html` + `public/volunteer.js`
  - OTP login, profile save, auto-fill, protected API usage.
- `public/organization.html` + `public/organization.js`
  - org OTP login/signup, code display, day sheet load.
- `public/sitemanager.html` + `public/sitemanager.js`
  - manager OTP login, drive create/list/delete.
- Landing links updated in `public/index.html` to include org/site manager portals.

### 6) Data model updates
- `volunteers[]`
- `organizations[]` augmented with `location`, `orgCodeHash`, identity/login fields
- `drives[]`
- `siteManagers[]`
- `sessions[]` extended with `driveId`, `volunteerId`, age/gender capture

## How It Works (Current)

### Organization
1. Go to `/organization.html`.
2. Request OTP, verify OTP.
3. If first login, provide org name + location.
4. Receive organization code (displayed in portal).
5. Use this code for site manager registration and volunteer drive check-ins.
6. Load daily sheet by date.

### Site Manager
1. Go to `/sitemanager.html`.
2. Request OTP, verify with manager name + org name + org code.
3. Create drive with location/start/end.
4. If overlapping drive exists for same org + area + time, creation is blocked.
5. Share generated drive QR/link with volunteers.
6. Delete wrong drives to free slot.

### Volunteer
1. Go to `/volunteer.html`.
2. Login via OTP.
3. Save profile (name/age/gender) once.
4. On next login, profile is auto-filled.
5. Scan/paste drive token; enter org code for drive flow.
6. Check in -> timer starts; check out -> timer stops.
7. Entry appears in organization day sheet.

## What Remains / Next Work

### High priority
- Replace demo OTP with real providers (Twilio/SNS/email gateway).
- Secure session storage for production (JWT or DB-backed session store + rotation).
- Add explicit session expiry handling + refresh flow in UI.
- Add passwordless logout/invalidation endpoint on server.

### Product completeness
- Role-specific navigation guards for all legacy pages (including old dashboard).
- Organization-owned reports/export page using protected token flow (CSV/XLS download with auth).
- Site manager own profile view/edit.
- Better geofence behavior for drive entries (if drive geo coordinates are required).

### Reliability and security
- Input validation hardening and rate limits on OTP endpoints.
- Audit logging for create/delete drive operations.
- Unit/integration tests as automated test suite.

## Key Backend Endpoints (Current)
- Volunteer auth/profile:
  - `POST /api/volunteers/request-otp`
  - `POST /api/volunteers/verify-otp`
  - `GET /api/volunteers/:id` (volunteer token required)
  - `PUT /api/volunteers/:id/profile` (volunteer token required)
- Organization auth/sheet:
  - `POST /api/orgs/request-otp`
  - `POST /api/orgs/verify-otp`
  - `GET /api/orgs/:orgId/sheet?date=YYYY-MM-DD` (organization token required)
- Site manager auth/drives:
  - `POST /api/site-manager/request-otp`
  - `POST /api/site-manager/verify-otp`
  - `POST /api/site-manager/drives` (site_manager token required)
  - `GET /api/site-manager/drives` (site_manager token required)
  - `DELETE /api/site-manager/drives/:driveId` (site_manager token required)
- Volunteer runtime:
  - `POST /api/checkin` (volunteer token required)
  - `POST /api/sessions/:sessionId/location` (volunteer token required)
  - `POST /api/checkout` (volunteer token required)
- Public token resolution:
  - `GET /api/drives/token/:token`
  - `GET /api/events/token/:token`
