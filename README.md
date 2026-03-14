# Volunteer Management Website (VolOps)

## Run
1. Open terminal in `C:\Users\KIIT\Desktop\personal_project\volunteer-management-site`
2. Start server:
   ```powershell
   node server.js
   ```
3. Open `http://localhost:3000`

## Role Portals
- Volunteer: `/volunteer.html`
- Site Manager: `/sitemanager.html`
- Organization: `/organization.html`
- Organization dashboard/reports: use `/organization.html` (Supabase-only)

## New Onboarding Flow

### Volunteer
- If registered: login with `email + password`
- If not registered: sign up with `name, age, gender, email, password`
- Saved profile auto-fills for check-in on future logins

### Organization
- If registered: login with `companyId + password`
- If not registered: register with `company name, location, contact email, password`
- On registration, system returns:
  - `companyId` (for company identity)
  - `organization code` (for drive-day linkage by site manager + volunteers)

### Site Manager
- If registered: login with `company email + uniqueManagerId`
- If not registered: sign up with `email, name, companyId`
- On signup, system returns `uniqueManagerId` for future logins

## Role Guarding
- Each role page has page-load redirect guard.
- If wrong role session exists, user is redirected to the correct role page.
- Protected APIs return `401` for invalid/missing role session token.

## Demo Credentials

### How to load demo data
After running `supabase/schema.sql` in the Supabase SQL Editor, run
`supabase/seed.sql` in the same editor. It creates the accounts below and
pre-confirms them so you can log in immediately without any email verification.

### Volunteer (demo – ready to use)
| Field    | Value                       |
|----------|-----------------------------|
| Email    | `demo.volunteer@volops.dev` |
| Password | `Demo@Volops1`              |
| Name     | `Demo Volunteer`            |
| Vol ID   | `VOL-DEMO-001`              |

Login page: `/volunteer.html`

### Organization (registered)
- Company ID: `CMP-1001`
- Contact Email: `demo.org@volops.dev`
- Password: `demo123`
- Organization Code: `5674606646`
- Company Name: `Community Care Network`

### Site Manager (registered)
- Company Email: `demo.manager@volops.dev`
- Unique Manager ID: `MGR-1001`
- Name: `Demo Manager`

## Drive + Reflection Behavior
- Site manager creates drive with org code + location + start/end time.
- Duplicate overlap blocked for same organization + same area + overlapping time.
- Volunteer checks in via drive token + org code.
- Volunteer rows appear in organization day sheet for that date.

## Notes
- Supabase-only: operational data is stored in Supabase tables (see `supabase/schema.sql`).
- Camera and geolocation permissions are required for full volunteer check-in flow.
- QR scan/render uses CDN libraries.
