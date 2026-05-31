# SM Payroll System — Project Report

> **Version:** 2.0 (Production-Ready)
> **Last Updated:** June 2026
> **Owner:** Suresh Kumar (aeromenclothingllp@gmail.com)
> **Branch:** ralph-loop-rkx40

---

## 1. Project Overview

SM Payroll System ek **full-stack, production-grade Payroll SaaS application** hai jo Indian SMBs ke liye banaya gaya hai. Yeh ek single platform pe HR, Payroll, Attendance, Sales, Finance aur Employee Self-Service sab kuch manage karta hai.

### Kya Problem Solve Karta Hai

| Problem | Solution |
|---|---|
| Manual salary calculation mein galtiyan | Automatic payroll run — TDS, PF, ESIC, PT sab calculate |
| Attendance fraud (buddy punching) | Face biometric + GPS geofencing + Wi-Fi BSSID verification |
| Paper-based leave/loan process | Digital workflow with multi-step approval chain |
| Alag-alag Excel files mein data | Single database — sab connected, real-time |
| Indian compliance (PF, ESIC, Form-16) | Automated statutory exports — PF ECR, ESIC, Form-16 HTML |

---

## 2. Technology Stack

### Frontend
| Technology | Version | Use |
|---|---|---|
| **React** | 18.x | UI framework |
| **TypeScript** | 5.x (strict mode) | Type safety |
| **Vite** | 5.x | Build tool + dev server |
| **Zustand** | 4.x | State management (38 stores) |
| **TailwindCSS** | 3.x | Styling |
| **React Router** | 6.x | Client-side routing |
| **Recharts** | 2.x | Charts & analytics |
| **face-api.js** | 0.22 | Face recognition |
| **React Leaflet** | 4.x | GPS map rendering |
| **XLSX** | 0.18 | Excel export |
| **jsPDF** | 2.x | PDF generation |
| **Framer Motion** | 12.x | Animations |
| **i18next** | 23.x | Multi-language (Hindi/English) |
| **Capacitor** | 8.x | Android APK build |

### Backend
| Technology | Version | Use |
|---|---|---|
| **Node.js** | 20.x | Runtime |
| **Express** | 4.x | HTTP server |
| **Sequelize** | 6.x | ORM |
| **SQLite** | 5.x | Database (development) |
| **PostgreSQL** | 15.x | Database (production — Render) |
| **JWT** | jsonwebtoken 9.x | Authentication |
| **bcrypt** | 6.x | Password hashing |
| **Nodemailer** | 8.x | Email delivery |
| **node-cron** | 4.x | Scheduled jobs |
| **multer-s3** | 3.x | File uploads to S3/R2 |
| **helmet** | 8.x | HTTP security headers |
| **Decimal.js** | 10.x | Precise financial calculations |
| **Worker Threads** | Node built-in | Async payroll computation |

---

## 3. Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     FRONTEND (React)                     │
│  src/pages/  ──  src/store/  ──  src/components/        │
│  22+ page modules   38 Zustand    Reusable UI            │
│                     stores                               │
└────────────────────────┬────────────────────────────────┘
                         │ HTTPS / REST API
                         │ JWT Bearer Token
┌────────────────────────▼────────────────────────────────┐
│                    BACKEND (Express)                     │
│  server/index.js  →  16 Route files                     │
│  authMiddleware   →  requireRole RBAC                   │
│  requireCompanyScope  →  Multi-tenant isolation         │
└────────┬───────────────────────────────┬────────────────┘
         │                               │
┌────────▼──────────┐         ┌─────────▼──────────┐
│  SQLite (dev)     │         │  Worker Threads     │
│  PostgreSQL (prod)│         │  payrollWorker.js   │
│  Sequelize ORM    │         │  reportWorker.js    │
│  32 tables        │         │  (Async processing) │
└───────────────────┘         └────────────────────┘
```

### Multi-Tenancy
- Har company ka data `companyId` se isolate hota hai
- JWT token mein `companyId` hota hai — server kabhi client-supplied companyId trust nahi karta
- SUPER_ADMIN cross-company access ke liye HMAC-SHA256 signed token required

---

## 4. User Roles & Permissions

| Role | Kya Kar Sakta Hai |
|---|---|
| **SUPER_ADMIN** | Sab kuch — all companies, all data, all settings |
| **ADMIN** | Company data manage, payroll, employees, reports |
| **ACCOUNT_ADMIN** | Financial data (salary, bank details), TDS, loans |
| **MANAGER** | Team attendance, leaves approve, production entry |
| **EMPLOYEE** | Apna attendance punch, ESS portal, apne payslips |

### Permission-Based Access Control
- 50+ granular permissions (VIEW_PAYROLL, GENERATE_PAYROLL, MANAGE_LOANS, etc.)
- Har role ke permissions admin se customize kar sakte hain
- Data scope: `ALL` / `TEAM` / `OWN` — manager sirf apni team dekh sakta hai
- Frontend routes `ProtectedRoute` se guard kiye hain
- Backend routes `requireRole()` middleware se guard kiye hain

---

## 5. Features — Module by Module

---

### 5.1 Employee Management

**Kya kar sakta hai:**
- Employee create, edit, soft-delete (INACTIVE), restore (Trash Management)
- Employee fields: personal info, designation, department, shift assignment, work group
- Financial data (salary, bank details) — sirf ACCOUNT_ADMIN/SUPER_ADMIN access
- KYC documents upload: Aadhar, PAN, photos (stored locally, 10MB/file)
- Emergency/relative contact information
- Password management with strength validation (min 8 chars, 1 number, 1 letter)
- Biometric enrollment (face descriptor + fingerprint credential)
- Leave balance tracking (CASUAL, SICK, PAID, UNPAID)
- Loan limit configuration per employee
- Custom fields support
- Bulk employee import via CSV
- Employee code uniqueness validation
- Data masking: salary/bank details employees ko nahi dikhta (role-based)

**Statutory Configuration per Employee:**
- PF: UAN number, rate (default 12%), cap toggle
- ESIC: IP number, rate (default 0.75%)
- PT: State-wise slab ya custom amount
- TDS: PAN-linked, **Old Regime / New Regime selection**, 80C (up to ₹1.5L), 80D (up to ₹25,000), manual % override

---

### 5.2 Attendance Management

**Punch Methods:**
| Method | Description |
|---|---|
| Face Biometric | Camera se face scan → server-side 1:N matching |
| Face Kiosk | Tablet/mobile kiosk mode — 3-frame liveness detection, voice feedback |
| PIN Punch | 4-digit PIN fallback |
| GPS Punch | Location verify karke punch (Haversine distance) |
| Admin Manual Punch | Admin kisi bhi employee ka time manually set kar sakta hai |
| Photo Upload | Image ke saath punch |

**Features:**
- Check-in / Check-out tracking with timestamps
- Break time tracking (start/end multiple breaks per day)
- Late calculation — grace time per shift
- Overtime calculation — auto from check-out time
- Shift management (multiple shifts per company)
- Holiday calendar (NATIONAL / FESTIVAL / OPTIONAL)
- Auto-absent cron — raat 11:59 pe jo punch nahi, automatically ABSENT mark
- GPS geofencing — allowed zones define, punch only within radius
- Wi-Fi BSSID binding — specific routers se hi punch allowed
- Attendance regularization requests
- Admin override with reason and audit trail
- Work group based attendance view
- Sandwich rule for holiday pay calculation
- Offline queue — network nahi toh locally save, reconnect pe sync

---

### 5.3 Payroll Processing

**Payroll Run (Async Worker):**
1. `POST /api/run` → `payrollWorker.js` spawn karta hai background mein
2. Frontend polls `GET /api/payroll/job/:jobId` every 3 seconds
3. Progress indicator — full-screen overlay with step-by-step status

**Salary Calculation Engine:**
- Salary types: MONTHLY, DAILY, HOURLY
- Paid days = normal days + half days + holiday base days
- Overtime earnings = hourly rate × OT hours × multiplier
- Production earnings — from approved production entries
- Night shift allowance (configurable)
- Perfect attendance bonus (configurable)

**Statutory Deductions:**
- **PF:** 12% of basic (capped at ₹1,800 or configurable)
- **ESIC:** 0.75% of gross (only if gross ≤ threshold)
- **PT:** State-wise slab from StatutoryRule table
- **TDS — New Regime:** ₹0–₹3L nil, ₹3L–₹7L 5% (rebate up to ₹7L), ₹7L–₹10L 10%, etc. + 4% cess
- **TDS — Old Regime:** Standard deduction ₹50,000 + 80C + 80D; ₹0–₹2.5L nil, ₹2.5L–₹5L 5% (rebate up to ₹5L), ₹5L–₹10L 20%, above ₹10L 30% + 4% cess
- No PAN = flat 20% TDS

**Loan EMI Deductions:**
- EMI cap = 50% of gross (configurable)
- Multiple loans supported, proportional scaling
- **Loan.balance automatically updated** after each payroll run within same DB transaction

**Advance Salary Deductions:**
- Monthly installment-based recovery
- Cap shared with loan deduction cap

**Payroll State Machine:**
```
DRAFT → SIMULATION → FINAL_APPROVED → LOCKED → PAID
```
- Each step requires permission
- State changes trigger audit log
- Error revert — agar backend reject kare toh UI automatically pehli state pe wapis

**Bulk Actions:**
- Select all → bulk simulate / approve / lock
- Per-slip actions via dropdown

**Exports:**
- **PF ECR CSV** — EPFO portal ke liye
- **ESIC CSV** — ESIC portal ke liye
- **Form-16 HTML** — employee annual tax statement
- **Excel export** — payroll summary

**Payslip:**
- Professional PDF-printable layout
- Company header, employee details, earnings breakdown, deductions, net pay
- Email delivery via SMTP
- WhatsApp share
- Production breakdown, work log

---

### 5.4 Leave Management

**Features:**
- Leave types: CASUAL, SICK, PAID, UNPAID
- Apply, approve, reject, cancel
- Half-day leave support
- Auto daysCount calculation from dates
- Leave balance deduction on approval, restore on rejection
- Multi-step workflow (configurable via WorkflowConfig)
- Optimistic locking — concurrent approval prevent karta hai
- Stale leave alerts (pending > 15 days)

---

### 5.5 Loan Management

**Loan Lifecycle:**
```
REQUESTED → CHECKED → ACTIVE → CLOSED (ya REJECTED)
```

**Features:**
- Multiple loan types
- Configurable tenure (months) and EMI amount
- **Loan limit per employee** (FIXED or SALARY_MULTIPLE)
- Loan ledger — har payment ka record
- Skip month request (employee request, manager approve)
- Early settlement request with discount
- Multi-step workflow approval (L1 Checker → L2 Approver)
- Loan summary modal with salary analysis
- WhatsApp notification on approval/rejection
- Automatic EMI deduction during payroll lock

---

### 5.6 Production Tracking

**Features:**
- Daily production entry per employee
- Production items catalog with per-unit rates
- itemId → item rate snapshot at entry time
- Status flow: PENDING → APPROVED → REJECTED
- Bulk upload (CSV with partial success — 207 Multi-Status)
- Production analytics — employee summary, item summary, chart data
- Production earnings auto-included in payroll run
- Per-department production view

---

### 5.7 Expense Management

**Maker-Checker Workflow:**
1. Any user creates expense → status: PENDING
2. ADMIN/ACCOUNT_ADMIN approves/rejects → status: APPROVED/REJECTED
3. Full audit trail stored with every status change

**Features:**
- Categories: S_ADVANCE, TEA, TRANSPORT, MAINTENANCE, OTHER
- Receipt upload to AWS S3/Cloudflare R2 (private ACL)
- Signed URL download (15-minute expiry)
- Legacy URL backward compatibility
- Monthly expense summary & stats
- Department-wise finance report

---

### 5.8 Full & Final (FnF) Settlement

**Calculations:**
- **Gratuity:** (15 × Basic × Years) / 26 — only if ≥ 5 years service
- **Notice Period Pay:** (Basic/26) × notice days
- **Leave Encashment:** (Basic/26) × pending leave days
- Other deductions configurable

**Validation:**
- separationDate ≥ joiningDate (server-side enforced)
- Max 3 months future date
- Status: DRAFT → APPROVED

---

### 5.9 Finance Dashboard

**Features:**
- Advance Salary management (request, approve, installment-based recovery)
- FnF Settlement wizard
- Department-wise finance report
- Cost Center mapping
- Expense dashboard with maker-checker workflow

---

### 5.10 Client & Sales CRM

**Client Management:**
- Client/party database (RETAIL, WHOLESALE, DISTRIBUTOR, INSTITUTION)
- GPS location tagging (set on first visit)
- Credit limit & outstanding amount tracking
- Assigned salesman management
- Bulk import via CSV (ORM-based, SQL injection proof)
- Export to CSV

**Visit Tracking (GPS Check-in/Check-out):**
- Check-in with GPS verification (distance from client)
- Duration tracking
- Outcome recording (ORDER_PLACED, NO_ORDER, FOLLOW_UP, etc.)
- Order amount and collection amount per visit
- Photos attached to visit
- Visit history, statistics per salesman

**Sales Tasks:**
- Task assignment with priority (high/medium/low) and due date
- Status: todo → in-progress → done / canceled

**Salesman Dashboard:**
- Today's visits count, total clients, orders, collections
- Overdue client alerts
- Average visit duration
- GPS-based check-in enforcement

---

### 5.11 Employee Self-Service (ESS)

**Kya kar sakta hai employee apne aap:**
- Profile view (safe fields only — salary/bank nahi dikhta)
- Last 24 months ke payslips download karo
- Leave apply karo (approval workflow me jayega)
- Loan request karo (limit enforce hoti hai)
- Last 30 days ki attendance dekho

**Access:** Mobile-friendly ESS Dashboard, PWA installable

---

### 5.12 Reports

**Custom Report Builder:**
- Column selection (employee info, payroll, attendance, statutory)
- Filter configuration
- Preview (5 rows)
- Background CSV generation (async worker)
- Job status polling
- Save/update/delete templates (company-scoped)

**Scheduled Reports:**
- Daily / Weekly / Monthly frequency
- Recipients email list
- **Actual email delivery** (SMTP) after generation
- CSV attachment with content inline
- Enable/disable toggle
- Schedule management (create, update, delete)

**Standard Reports:**
- PF ECR CSV
- ESIC CSV
- Form-16 HTML
- Payroll disbursement report
- Department finance report
- Statutory compliance reports

---

### 5.13 Statutory Compliance

**Features:**
- Statutory rules per company with effective date
- PF rate, PF capped amount, ESIC rate, ESIC threshold, PT slabs
- Calculators:
  - **PF/ESI Calculator** — dynamic rates from rules
  - **CTC Calculator** — full salary structure breakdown
  - **TDS Calculator** — Old Regime & New Regime comparison, recommendation
- Form-16 HTML generator per employee per year
- Statutory reports page

---

### 5.14 Analytics Dashboard

**Role-Based Dashboards:**
| Role | Dashboard |
|---|---|
| SUPER_ADMIN / ADMIN | AdminDashboard — full KPIs, charts |
| MANAGER | ManagerDashboard — team view |
| EMPLOYEE | EmployeeDashboard — personal stats |

**Admin Dashboard KPIs:**
- Total staff / active staff count
- Today's attendance % + present/absent count
- Monthly production total with MoM % change
- Outstanding loan balance + active loans count
- Pending leaves / pending production / pending loans
- Net payroll this month + slips generated
- 7-day attendance trend chart (single aggregated DB query)
- Production by department chart
- Payroll distribution (Basic / Production / Overtime)

---

### 5.15 Security

**Authentication:**
- JWT (Access token: 15 min, Refresh token: 7 days)
- Bcrypt password hashing (10 rounds)
- Brute force protection: 3 failed attempts → 15-min lockout
- Account lockout with security alert notification
- Auto token refresh (background)
- Session management (list active sessions, remote revoke)

**Authorization:**
- RBAC with 50+ granular permissions
- Company scope enforcement (JWT-based, tamper-proof)
- SUPER_ADMIN cross-company access requires HMAC-SHA256 signed token

**API Security:**
- Rate limiting (login + write operations)
- Helmet.js HTTP security headers
- CSP (Content Security Policy) enforced
- CORS restricted to allowed origins (env var based)
- SQL injection prevention (ORM + column whitelist on bulk inserts)
- Path traversal prevention on file downloads (DB-stored filenames)
- Input validation at API boundaries

**IP Restrictions:**
- Company-scoped IP whitelist/blacklist
- Payroll generation restricted to office IP

**Audit Trail:**
- Every significant action logged (AuditLog table)
- Failed login attempts logged
- Failed audit log POSTs queued in localStorage for retry
- Security alerts store for admin monitoring

**Data Security:**
- S3 uploads private ACL (not publicly accessible)
- Signed URL downloads (15-minute expiry)
- ESS returns safe fields only (no salary/bank data)
- Financial field access requires ACCOUNT_ADMIN/SUPER_ADMIN (returns 403 if unauthorized)

---

### 5.16 Settings & Configuration

**General Settings:**
- Company profile (name, address, GST, PAN, logo)
- Departments management (CRUD)
- Shifts management (start/end time, grace minutes)
- Work groups with color and icon
- Salary types (MONTHLY, DAILY, HOURLY, PER_UNIT)
- Attendance actions (custom punch types)
- Punch locations (GPS zones)
- Holiday calendar management

**Statutory Settings:**
- PF/ESIC/PT rules with effective dates
- Per-company slab configuration

**Payroll Config (per company):**
- Sandwich rule enable/disable
- Zero presence rule
- OT cap, OT multiplier
- Late marks penalty
- Attendance bonus amount
- EMI cap percentage
- Night shift allowance

**Role & Access:**
- Per-role permission matrix
- Data scope (ALL / TEAM / OWN)

**Workflow Config:**
- Multi-step approval chains for loans, leaves, expenses
- Role assignment per step

**Overtime Policy:**
- Weekly/daily cap hours
- OT multiplier per policy
- Effective from date

**Notification Settings:**
- SMTP email configuration
- WhatsApp Business API (WABA token, phone number ID)

**Theme:**
- Dark mode (default), light mode, custom accent colors
- Layout customization

**Security Settings:**
- Session list (active sessions across devices)
- Remote session revoke
- IP restriction management
- Logout password protection

**Custom Fields:**
- Per-employee dynamic fields
- Config page for field definitions

---

### 5.17 Admin Tools

**Bulk Import:**
- Employee CSV import with field mapping
- Client CSV import

**Audit Logs:**
- Full audit trail with filters (action, user, entity, date range)
- Pagination (up to 500 per page)
- Clear old logs (configurable days)

**Database Backup:**
- Manual backup trigger
- Scheduled auto-backup
- Download backup file
- Delete old backups

**Trash Management:**
- Real INACTIVE employee list from DB
- One-click restore (ACTIVE status)
- Permanent delete (SUPER_ADMIN only, requires type "DELETE name")
- Days since deletion tracking

**Data Consistency Checker:**
- Store-level checks: negative salary, orphaned slips, zero salary employees, duplicate codes, missing checkout, stale leaves, excessive loans, zero EMI
- DB-level checks: orphaned attendance records, orphaned salary slips, negative loan balance, duplicate codes, net > gross
- Auto-fix buttons for fixable issues (orphan cleanup, loan balance floor)

**Data Seeding:**
- Sample data generation for testing

**Draft Manager:**
- Manage draft payroll/documents

**Server Status:**
- Health check (DB connection, uptime)
- Deep health check (all table counts)
- Error log viewer
- Live route listing

---

### 5.18 Mobile & PWA

**Progressive Web App:**
- Installable on any device (iOS/Android/Desktop)
- Offline attendance queue — records locally, syncs when online
- Service worker background sync
- Wake lock (screen stays on for kiosk mode)

**Android APK (Capacitor):**
- Native Android app build possible (`npm run android:build`)
- Background geolocation support
- Camera access for face scan
- Wi-Fi BSSID reading for punch verification

**Mobile-Optimized Pages:**
- Mobile Dashboard (employee quick view)
- Quick Check-In page
- ESS Dashboard
- Face Kiosk (full-screen tablet mode)

---

## 6. Database Schema — 32 Tables

| Table | Records What |
|---|---|
| Companies | Multi-company support |
| Employees | Staff with all financial & statutory data |
| Departments | Company org structure |
| Shifts | Work timing definitions |
| WorkGroups | Team groupings |
| SalaryTypes | Pay basis (monthly/daily/hourly) |
| AttendanceActions | Custom punch type labels |
| PunchLocations | GPS zones for punch validation |
| SystemSettings | Per-company config key-value |
| SystemKeys | Integration credentials (masked) |
| Attendance | Daily punch records with breaks |
| Production | Daily production entries |
| ProductionItems | Item catalog with rates |
| Leaves | Leave requests & approvals |
| Loans | Loan records with ledger |
| LoanLedgers | Per-payment history |
| SalarySlips | Monthly payroll slips |
| Expenses | Company expenses with receipts |
| Biometric | Face descriptor + fingerprint data |
| AdvanceSalary | Advance salary requests |
| Holidays | Company holiday calendar |
| AuditLog | All action history |
| Clients | Sales client/party database |
| ClientVisits | GPS-verified visit records |
| SalesTasks | Salesman task assignments |
| UserSessions | Active JWT sessions |
| IPRestrictions | Company-scoped IP whitelist |
| CustomReportTemplate | Saved report templates |
| ScheduledReport | Auto-report schedules |
| ReportJob | Async job status tracking |
| StatutoryRule | PF/ESIC/PT rules per company |
| FnFSettlement | Full & Final settlement records |
| OvertimePolicy | OT rules per company |

---

## 7. API Endpoints — Summary

| Module | Endpoints |
|---|---|
| Auth | Login, Refresh, Logout, Verify, Session management |
| Employees | CRUD, face verify, document upload/download, restore, permanent delete |
| Attendance | CRUD, break tracking, admin punch, location verify, auto-absent |
| Payroll | Run (async), state machine, exports (PF/ESIC/Form-16), payslip email |
| Leaves | CRUD, approve, reject |
| Loans | CRUD, approve, reject, pay EMI, ledger, skip month |
| Production | CRUD, bulk upload, items catalog, analytics |
| Finance | Advance salary, FnF settlement |
| Expenses | CRUD, status update (maker-checker) |
| Clients | CRUD, bulk import, export CSV, GPS location set |
| Visits | Check-in, check-out, active visit, salesman stats |
| Sales Tasks | CRUD |
| ESS | Me, payslips, leaves, loans, attendance |
| Reports | Templates (CRUD), schedules (CRUD), generate, job status |
| Analytics | Dashboard KPIs |
| Calculators | PF/ESI, CTC, TDS |
| Admin | Departments, shifts, work groups, salary types, holidays, biometrics, expenses, advance salary, audit logs, sessions, IP restrictions, backup, WhatsApp config, statutory rules, consistency report, DB fixes |
| Upload | Receipt upload (S3), signed URL download |
| Notifications | Send payslip email |

**Total: ~120+ REST API endpoints**

---

## 8. Background Jobs (Cron)

| Schedule | Job | Details |
|---|---|---|
| `00:00` daily | Scheduled Reports | reportWorker.js spawn → CSV generate → email recipients |
| `23:59` daily | Auto-Absent | Sab jo punch nahi kiya → ABSENT mark (all companies) |
| `*/5 min` | nextRun updater | ScheduledReport.nextRun timestamps advance karna |

---

## 9. Security Summary

| Aspect | Implementation |
|---|---|
| Auth | JWT HS256, 15-min expiry, refresh token |
| Passwords | bcrypt 10 rounds |
| Brute Force | 3 attempts → 15 min lockout |
| CORS | Explicit allowlist (env var based) |
| Rate Limiting | Login + write APIs |
| Headers | Helmet.js (CSP, HSTS, X-Frame-Options) |
| Multi-tenancy | JWT companyId, never client-trusted |
| Cross-company | HMAC-SHA256 signed token required |
| SQL Injection | ORM + column whitelist |
| Path Traversal | DB-stored filenames only |
| File Security | S3 private ACL + 15-min signed URLs |
| Dev Endpoints | Not registered in production |
| Audit | All actions logged, retry queue |

---

## 10. Deployment

### Development
```bash
# Frontend
npm run dev          # Vite dev server → http://localhost:5173

# Backend
cd server && node index.js   # Express → http://localhost:3000
```

### Production (Render)
- Backend: Render Web Service
- Database: PostgreSQL (via `DATABASE_URL` env var)
- Frontend: Vercel (static build)
- File Storage: AWS S3 / Cloudflare R2

### Required Environment Variables (server/.env)
```
JWT_SECRET=          # 64-char random hex (required in production)
REFRESH_SECRET=      # 64-char random hex (required in production)
DATABASE_URL=        # PostgreSQL URL (empty = SQLite)
FRONTEND_URL=        # Allowed CORS origin
ALLOWED_ORIGINS=     # Additional CORS origins (comma-separated)
EMAIL_SMTP_HOST=     # SMTP server
EMAIL_SMTP_USER=     # SMTP username
EMAIL_SMTP_PASS=     # SMTP password
AWS_S3_BUCKET_NAME=  # S3 bucket for receipts
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
```

### Android APK
```bash
npm run android:build   # Build + sync Capacitor
npm run android:open    # Open in Android Studio
```

---

## 11. Testing

| Type | Tool | Coverage |
|---|---|---|
| Unit Tests | Vitest | `salaryCalculator.ts` — all calculation paths |
| E2E Tests | Playwright | Full payroll flow (login → generate → lock → export) |
| TypeScript | tsc --noEmit | Strict mode — 0 errors |

```bash
npm test          # Vitest unit tests
npm run test:e2e  # Playwright E2E
```

---

## 12. What's Next (Remaining Items)

| Priority | Feature |
|---|---|
| 🟡 Medium | Face recognition model preload via service worker |
| 🟡 Medium | Report download endpoint (proper file serve) |
| 🟡 Medium | Old Regime TDS in calculators.js standalone |
| 🟡 Low | Foreign key constraints in Sequelize models |
| 🟡 Low | Multi-company context switch flush for all stores |
| 🟡 Low | AdvanceSalary status uppercase standardization |

---

## 13. Project Stats

| Metric | Count |
|---|---|
| Total source files | 100+ |
| Lines of code (approx) | 25,000+ |
| React pages | 70 |
| Zustand stores | 38 |
| API routes | ~120 |
| Database tables | 32 |
| Git commits | 50+ |
| TypeScript errors | **0** |
| Critical security issues fixed | **10** |
| High priority issues fixed | **13** |
| Total audit fixes applied | **52** |

---

## 14. Feature Quick Reference

### "Kya yeh system kar sakta hai?" — Jaldi check karo

| Feature | Available |
|---|---|
| Face biometric attendance | ✅ |
| GPS geofenced punch | ✅ |
| Automatic payroll calculation | ✅ |
| Old Regime + New Regime TDS | ✅ |
| PF ECR export for EPFO | ✅ |
| ESIC export | ✅ |
| Form-16 generation | ✅ |
| Multi-step loan approval | ✅ |
| Employee self-service portal | ✅ |
| WhatsApp notifications | ✅ |
| Email payslip delivery | ✅ |
| Scheduled auto-reports | ✅ |
| Sales CRM with GPS visits | ✅ |
| Full & Final settlement | ✅ |
| Multi-company support | ✅ |
| Android APK | ✅ |
| Offline mode (attendance) | ✅ |
| Dark/light theme | ✅ |
| Hindi + English UI | ✅ |
| Role-based access control | ✅ |
| Audit trail | ✅ |
| Database backup | ✅ |
| Production tracking | ✅ |
| Custom report builder | ✅ |
| Data consistency checker | ✅ |

---

*Report generated: June 2026 | SM Payroll System v2.0*
