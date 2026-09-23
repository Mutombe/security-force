# Security Force

A clickable React demo of a consent-based trust network for the private security workforce. Every guard gets one Workforce ID and a Security Professional Passport that follows them from employer to employer.

```bash
npm install
npm run dev      # http://localhost:5190
npm run build
```

## Demo accounts (password `demo1234`)

| Who | Sign in with | Notes |
|---|---|---|
| Company owner | `rufaro@gemak.co.zw` | GEMAK Security Services |
| Consultant | `tariro@complyzw.co.zw` | Member of 3 companies: shows the workspace picker |
| Supervisor | `kelvin@gemak.co.zw` | Limited role: see permission gating |
| Other companies | `themba@jpsecurity.co.zw` (JP Security), `grace@sentinel.co.zw` (Sentinel Security Technology), `peter@vssecurity.co.zw` (VS Security) | |
| Guard | Workforce ID `SG-00048392`, `SG-00049925`, `SG-00051207` | SMS code shown in a toast (Autofill) |
| Client | `facilities@hararecity.co.zw`, `security@zcb.co.zw` | |
| Regulator | `inspector@psra.gov.zw` | |

Every login screen, and every create, edit and delete action, opens in a modal. That includes sign-in, company registration and password reset.

Company logos live in `public/logos/` and the Security Force brand marks in `public/brand/`. Companies can also upload their own logo under Settings → Company profile.

## What's in it

- **Companies**
  - Overview with coverage gaps, compliance alerts, overdue requests and the company's standing in the network.
  - Workforce table: filters, bulk actions, CSV export.
  - Sites and coverage.
  - Recruitment board: drag and drop, with network matching for each applicant.
  - Verification requests with deadlines.
  - Guard responses, team and roles, API keys, webhooks, attendance import, and the audit trail.
- **Guards**
  - Passport with the machine-readable zone.
  - Live badge: rotating 6-digit code and QR.
  - Consent requests: the guard can narrow what is shared.
  - Share codes, revoking access, responding to records, escalating to the regulator.
  - A log of who looked at their record.
- **Clients:** their sites and expected guards, a gate check using Workforce ID, live code and site, and check history.
- **Regulator:** network oversight, company approval and suspension, rulings on escalated disputes, the registry, and the full audit trail.
- **Detail pages for everything:** guards, companies, sites, records, verification requests, guard responses, applicants and team members each have their own page and URL. Names are real links throughout the app, so they open in a new tab too.
- **Appearance:** light and dark themes. The default follows the device; override it under the account menu (or the header toggle on the landing page).
- **Across the app**
  - Command palette (Ctrl/Cmd+K) and a notification centre.
  - Skeleton loading screens.
  - Instant ("optimistic") saves with toasts and Undo, and rollback when a save fails.
  - Idle lock, active session management, generated avatars and photo upload.
  - A dedicated mobile layout: bottom tab bar, bottom sheets, and tables shown as cards.

## The session database

All data lives in `sessionStorage` (`securityforce.db.v3`). It survives page reloads and is cleared when the tab closes. To open **Session database**, use the sidebar or the account menu. From there you can:
- look at every table
- export JSON
- reset the demo
- set the simulated network to **Normal**, **Slow** or **Flaky** (about a third of saves fail and roll back)
- change the idle-lock time

## Code map

- `src/store.jsx`: session database, sign-in, the `act()` helper for instant saves (with rollback and undo), toasts, notifications
- `src/access.js`: roles and permissions, what each viewer can see (grants, consent), compliance and deadline checks
- `src/ui.jsx`: UI kit (buttons, modals, drawers, menus, data table, skeletons, toasts, avatars)
- `src/modals.jsx`: shared create/edit modals (hire wizard, records, separation, attendance, reassignment, verification request)
- `src/auth.jsx`: every sign-in modal
- `src/App.jsx`: shell, navigation, command palette, notifications, landing page
- `src/views/**`: screens, grouped by role
