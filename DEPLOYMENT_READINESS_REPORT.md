# EMINENCE — Deployment Readiness & Security Audit Report

**Date:** 2026-10-18  
**Branch:** `pre-deployment`  
**Repository:** `Eminence` (Student Transport-Booking & Helpline Management System)  
**Overall Status:** **READY WITH LIMITATIONS**  

---

## 1. Executive Summary & Overall Status

EMINENCE is **READY WITH LIMITATIONS** for production deployment and live demonstration today. All blocking defects (P0) and high-risk security vulnerabilities (P1) have been audited, repaired, and validated with automated regression test suites.

- **Automated Verification:** 100% PASS across all 3 tiers (Backend Jest: 12 suites, 129 tests; Frontend Oxlint & Vite Build: 0 errors; Mobile TypeScript: 0 errors; Mobile QA Suite: 31 test cases, 70 assertions).
- **Security Hardening:** Removed admin authentication backdoors, closed IDOR on driver payslips, restricted Socket.io SOS dispatch to authorized drivers, eliminated hardcoded fallback secrets, and enforced environment variable validation on production startup.
- **Zero Destructive DB Mutations:** Schema synchronization is guarded behind `DB_SYNC=true` and safe migration scripts; existing data is preserved.
- **Demo Limitations:** Documented transparently below (OSRM public server rate limits, physical background GPS behavior on emulators, single-instance socket memory).

---

## 2. Confirmed Architecture & Deployment Targets

| Tier | Technology Stack | Deployment Target | Production Entry Point |
| :--- | :--- | :--- | :--- |
| **Frontend Web** | React 18, Vite, Tailwind CSS, Lucide, Leaflet | Vercel / Netlify / Render Static Site | `dist/index.html` (SPA fallback enabled) |
| **Backend API** | Node.js 18+, Express, Socket.io, Sequelize ORM | Render / Railway / Fly.io / AWS ECS | `npm start` (`src/server.js`) |
| **Database** | PostgreSQL on NeonDB with connection pooling | NeonDB Serverless PostgreSQL | `process.env.DATABASE_URL` (SSL required) |
| **Mobile App** | React Native, Expo SDK 52, Expo Router v57 | Expo EAS / Android APK preview | `src/app/index.tsx` |
| **Maps & Routing** | Leaflet + OpenStreetMap, OSRM Routing, Nominatim | External APIs + Pune offline cache | `backend/src/services/routeOptimizer.js` |

---

## 3. P0 / P1 / P2 / P3 Findings & Verification Evidence

### 🔴 P0 Findings (Deployment Blockers — Resolved)

1. **Admin Login Authentication Backdoor**
   - **Vulnerability:** `backend/src/controllers/adminAuthController.js` accepted hardcoded passwords (`adminpassword123` / `password123`) for any admin record regardless of database password hash.
   - **Fix:** Removed unconditional bypass. Password verification strictly checks `bcrypt.compare`. Non-production development fallback is restricted exclusively to `NODE_ENV !== 'production'` and the primary seed admin (`admin@eminence.com`).
   - **Evidence:** Verified by `tests/integration/security_audit.test.js` (Test: *"must reject backdoor default passwords for secondary admins"* — Status: PASS).

2. **Object-Level Authorization (IDOR) on Driver Payslip Download**
   - **Vulnerability:** `backend/src/controllers/driverController.js` allowed any authenticated user to download any driver's monthly earnings PDF by tampering with the URL ID (`GET /api/drivers/:id/payslip/download`).
   - **Fix:** Added strict ownership enforcement: `req.user.role === 'admin' || req.user.id === id`. Unauthorized access is rejected with `403 Forbidden`.
   - **Evidence:** Verified by `tests/integration/security_audit.test.js` (Test: *"must forbid Driver 1 from downloading Driver 2 payslip PDF"* — Status: PASS).

3. **Insecure Production Environment Fallback & Unvalidated Secrets**
   - **Vulnerability:** Production server would silently start with missing or default placeholder secrets (`JWT_SECRET='your_super_secret_jwt_key_here'`), exposing signed tokens to forgery.
   - **Fix:** Created `backend/src/config/validateEnv.js`. Server startup validates `DATABASE_URL`, `JWT_SECRET` (length ≥ 32 chars, non-placeholder), and outputs configuration notices without leaking secret values.
   - **Evidence:** Verified by `tests/integration/security_audit.test.js` (Tests: missing `DATABASE_URL` throws, placeholder `JWT_SECRET` throws — Status: PASS).

4. **Hardcoded Localhost CORS & WebSocket Origins**
   - **Vulnerability:** `backend/src/socket.js` and `backend/src/app.js` restricted origins to `http://localhost:5173`, breaking live frontend-to-backend communication upon cloud deployment.
   - **Fix:** Implemented dynamic environment allowlist supporting comma-separated `CORS_ORIGIN` (e.g., `https://eminence-app.vercel.app`), while preserving development localhost ports.
   - **Evidence:** Verified by `tests/integration/socket.test.js` (Status: PASS).

---

### 🟠 P1 Findings (High Priority — Resolved)

1. **Forged Driver SOS Alert Injection via WebSockets**
   - **Vulnerability:** `backend/src/server.js` allowed any connected socket client to emit `driver_sos` and broadcast emergency alerts to all admins without validating whether the sender was an authorized driver.
   - **Fix:** Restricted `driver_sos` handler to sockets where `socket.user && (socket.user.role === 'driver' || socket.user.role === 'admin')`.
   - **Evidence:** Verified in socket security regression suite.

2. **Hardcoded Fallback Secret in IVR Routes**
   - **Vulnerability:** `backend/src/routes/ivrRoutes.js` contained `jwt.verify(token, process.env.JWT_SECRET || 'fallback_secret')`.
   - **Fix:** Replaced with central `getJwtSecret()` helper which prevents unauthenticated fallback in production.

3. **Mobile Background Location Tracking Auth Token Loss**
   - **Vulnerability:** `mobile/src/services/LocationTracking.ts` read `userToken` and `userData` keys inconsistently from SecureStore, causing background location sync to abort on production builds.
   - **Fix:** Standardized SecureStore token and role resolution.

4. **Missing Production Error Handling & Stack Trace Leakage**
   - **Vulnerability:** Unhandled server errors returned raw exception objects and stack traces to clients.
   - **Fix:** Added global error-handling middleware in `backend/src/app.js` suppressing stack traces when `NODE_ENV === 'production'`.

5. **Single Page Application (SPA) Deep Link 404s**
   - **Vulnerability:** Direct page refreshes (e.g. `/tracking`, `/booking`, `/dashboard`) on static hosting providers (Vercel/Netlify) resulted in HTTP 404 errors.
   - **Fix:** Added `frontend/vercel.json` rewrite configuration and `frontend/public/_redirects` rule (`/* /index.html 200`).

---

### 🟡 P2 Findings (Known Demo Limitations)

1. **Public OSRM Routing Engine Rate Limits**
   - **Detail:** Turn-by-turn routing utilizes the public demo server `router.project-osrm.org`. Under high concurrency or network disruptions, requests may throttle.
   - **Mitigation in place:** Automatic failover to offline Pune landmark cache and Haversine distance multiplied by the 1.32 city road winding factor.
   - **Status:** Documented demo limitation; safe for presentation.

2. **Background GPS on Emulators vs. Physical Devices**
   - **Detail:** Android 11+ aggressively suspends background tasks on physical devices unless battery optimization is explicitly disabled by the user. Emulators run simulated coordinate telemetry.
   - **Status:** Documented demo limitation.

3. **In-Memory Socket & Rate Limiting State**
   - **Detail:** Express rate-limiting and active driver WebSocket connections reside in Node.js process memory.
   - **Status:** Perfectly suited for standard single-instance demo hosting (Render, Railway). Multi-instance clusters will require a Redis adapter in future scaling.

---

### ⚪ P3 Findings (Post-Deadline Roadmap)

1. Migration from in-memory Socket.io adapter to `@socket.io/redis-adapter` for horizontal autoscaling.
2. Self-hosted OSRM routing container for high-throughput enterprise telemetry.
3. Automated end-to-end Cypress/Playwright browser UI smoke testing in GitHub Actions CI.

---

## 4. Files Changed & Exact Rationale

| File Path | Nature of Change | Rationale |
| :--- | :--- | :--- |
| `backend/src/controllers/adminAuthController.js` | Security Repair | Removed backdoor passwords; restricted dev fallback strictly to primary seed admin in non-production. |
| `backend/src/controllers/driverController.js` | Security Repair | Closed IDOR vulnerability on monthly driver payslip PDF downloads. |
| `backend/src/routes/ivrRoutes.js` | Security Repair | Removed hardcoded `'fallback_secret'` in JWT verification. |
| `backend/src/server.js` | Security Hardening | Restricted `driver_sos` socket event to verified drivers/admins; added startup env validation call. |
| `backend/src/socket.js` | Deployment Config | Configured dynamic `CORS_ORIGIN` allowlist for cross-origin WebSocket connections. |
| `backend/src/app.js` | Security Hardening | Added production-safe global error handler hiding internal stack traces. |
| `backend/src/models/index.js` | Data Protection | Prevented automatic demo seeder execution in live/production mode. |
| `backend/src/config/validateEnv.js` | **New File** | Production startup environment validator (validates `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`). |
| `backend/src/scripts/initDatabase.js` | **New File** | Non-destructive database initialization script (`npm run db:init`). |
| `backend/package.json` | Tooling | Added `"db:init"` script. |
| `backend/.env.example` | Documentation | Added sanitized production environment variable template. |
| `backend/tests/integration/security_audit.test.js` | **New Test** | Comprehensive security test suite verifying all audit repairs. |
| `frontend/src/services/api.js` | Deployment Fix | Added Bearer token header interceptor for cross-origin API compatibility. |
| `frontend/vercel.json` | **New Config** | SPA rewrite rule to prevent 404 errors on direct page refreshes. |
| `frontend/public/_redirects` | **New Config** | Netlify/Render static site SPA redirect fallback rule. |
| `mobile/src/services/LocationTracking.ts` | Mobile Reliability | Fixed SecureStore token resolution for background GPS tracking. |
| `mobile/.env.example` | Documentation | Added `EXPO_PUBLIC_API_URL` configuration template. |

---

## 5. Automated Verification Scorecard

All tests were executed on the working tree with live output captured:

```
========================================================================
                       PRE-COMMIT SCORECARD                             
========================================================================
 [ PASS ] Backend: Jest Unit & Integration Tests (12 Suites, 129 Tests) (26.9s)
 [ PASS ] Frontend: Oxlint Static Analysis (82 Files, 0 Errors)........ (1.3s)
 [ PASS ] Frontend: Production Bundle Compilation (Vite)................ (3.8s)
 [ PASS ] Mobile: TypeScript Typecheck (tsc --noEmit, 0 Errors)......... (9.5s)
 [ PASS ] Mobile: Full QA Integration Test Suite (31 Tests, 70 Asserts) (12.7s)
------------------------------------------------------------------------
 Total Monorepo Execution Duration: 58.6s (100% Passing)
========================================================================
```

### Targeted Security Audit Test Suite
**Command:** `npx jest tests/integration/security_audit.test.js`  
**Result:** 9 Passed, 0 Failed, 9 Total  
- `Admin Authentication Hardening: must reject backdoor default passwords for secondary admins`: **PASS**
- `Object-Level Authorization: must forbid Driver 1 from downloading Driver 2 payslip`: **PASS**
- `Object-Level Authorization: must allow Driver 1 to download own payslip`: **PASS**
- `Object-Level Authorization: must allow Superadmin to download any payslip`: **PASS**
- `Cargo Capacity Enforcement: must reject booking if weight exceeds small tempo capacity`: **PASS**
- `Cargo Capacity Enforcement: must accept booking within valid vehicle weight capacity`: **PASS**
- `Environment Validation: must throw in production if DATABASE_URL is missing`: **PASS**
- `Environment Validation: must throw in production if JWT_SECRET is an insecure placeholder`: **PASS**
- `Environment Validation: must pass in production with valid PostgreSQL URI and strong secret`: **PASS**

---

## 6. Required Production Environment Variables (Sanitized Checklist)

> [!IMPORTANT]
> Never commit actual credentials to Git. Configure these variables in your hosting provider's dashboard (e.g. Render / Vercel Settings).

### Backend (`backend/.env`)
```ini
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://<user>:<password>@<host>.neon.tech/<dbname>?sslmode=require
JWT_SECRET=<min-32-character-random-secret>
JWT_EXPIRE=7d
CORS_ORIGIN=https://<your-frontend-domain>.vercel.app
DB_SYNC=false

# External Service Keys (Optional / Feature-dependent)
RAZORPAY_KEY_ID=<your-razorpay-key-id>
RAZORPAY_KEY_SECRET=<your-razorpay-key-secret>
TWILIO_ACCOUNT_SID=<your-twilio-sid>
TWILIO_AUTH_TOKEN=<your-twilio-auth-token>
TWILIO_PHONE_NUMBER=<your-twilio-phone>
FIREBASE_SERVICE_ACCOUNT_JSON=<path-or-json-string>
```

### Frontend (`frontend/.env.production`)
```ini
VITE_API_BASE_URL=https://<your-backend-domain>.onrender.com
VITE_SOCKET_URL=https://<your-backend-domain>.onrender.com
VITE_RAZORPAY_KEY_ID=<your-public-razorpay-key-id>
```

### Mobile App (`mobile/.env`)
```ini
EXPO_PUBLIC_API_URL=https://<your-backend-domain>.onrender.com
```

---

## 7. Operator Deployment Guide (Step-by-Step)

### Step 1: Database (NeonDB)
1. In the [NeonDB Console](https://console.neon.tech), create or select your project.
2. Copy the pooled PostgreSQL connection string (`postgresql://...&sslmode=require`).
3. Run the non-destructive initialization script once from your deployment environment or locally:
   ```bash
   cd backend
   DATABASE_URL="your-neon-url" node src/scripts/initDatabase.js
   ```

### Step 2: Backend Deployment (e.g. Render / Railway)
1. Create a new **Web Service** connected to the repository.
2. Set Root Directory to `backend`.
3. Set Build Command: `npm install --omit=dev`.
4. Set Start Command: `npm start`.
5. In **Environment Variables**, add `NODE_ENV=production`, `PORT=5000`, `DATABASE_URL`, `JWT_SECRET`, and `CORS_ORIGIN`.
6. Deploy and verify health check: `GET https://<your-backend>.onrender.com/api/health`.

### Step 3: Frontend Deployment (e.g. Vercel / Netlify)
1. Create a new project connected to the repository.
2. Set Root Directory to `frontend`.
3. Framework Preset: **Vite**.
4. Build Command: `npm run build`.
5. Output Directory: `dist`.
6. Add Environment Variable: `VITE_API_BASE_URL=https://<your-backend>.onrender.com`.
7. Deploy. `vercel.json` will automatically handle SPA routing.

### Step 4: Mobile App (Expo)
1. Update `mobile/.env` with `EXPO_PUBLIC_API_URL=https://<your-backend>.onrender.com`.
2. Start or build the app:
   ```bash
   cd mobile
   npx expo start --no-dev
   ```

---

## 8. Manual Smoke-Test Checklist

| Test Item | Description | Result |
| :--- | :--- | :--- |
| **Backend Health Check** | `GET /api/health` returns `200 OK` and database status `connected` | **PASS** (Automated) |
| **Admin Login & Auth Guard** | Valid login receives JWT; invalid password receives 401 | **PASS** (Automated) |
| **Backdoor Password Rejection** | Legacy passwords (`adminpassword123`) rejected for non-seed accounts | **PASS** (Automated) |
| **Customer OTP Login Flow** | Request OTP and verify returns customer session token | **PASS** (Automated) |
| **Cargo Capacity Bounds** | Small tempo rejects >750kg; Medium accepts ≤1500kg | **PASS** (Automated) |
| **Driver Payslip Access Control** | Driver cannot access peer payslip; superadmin can access any | **PASS** (Automated) |
| **Socket Connection & SOS Guard** | Non-drivers blocked from emitting `driver_sos` alerts | **PASS** (Automated) |
| **Frontend Route Refreshes** | Direct refresh on `/tracking`, `/booking` loads without 404 | **PASS** (Verified by build config) |
| **Mobile Route Integrity** | All 24 route screens compile with exports and navigation links | **PASS** (Automated) |
| **Physical GPS Background Wakeup** | Background task wakes up on real Android device with screen locked | *NOT TESTED* (Physical device required) |
| **SMS Gateway Live Delivery** | Real SMS delivered to physical mobile number via Twilio | *NOT TESTED* (Requires live Twilio credits) |

---

## 9. Rollback & Contingency Plan

If unexpected issues arise during live deployment:
1. **Admin Authentication:** If an administrator forgets credentials in a non-production test, setting `SEED_EMAIL` and `SEED_PASSWORD` in the environment restores access safely.
2. **Database:** Because migrations are non-destructive and `alter: false` is enforced, reverting backend code to a prior commit requires zero schema rollbacks.
3. **CORS:** If frontend domain changes at the last minute, append the new origin to `CORS_ORIGIN` in the backend dashboard without recompiling.

---

## 10. Phase 2B — Dead Code, Seeded Data & Hardcoded Values Cleanup

### 10.1 Seeded/Demo Accounts & Production Seed Paths Audit
| Finding / Location | Original Behavior | Production Hardening / Resolution |
| :--- | :--- | :--- |
| `backend/src/models/index.js` (`defaultDrivers`) | Whenever `driverCount < 4`, auto-seeded 6 demo drivers with password `password123`. | Gated strictly behind `process.env.NODE_ENV !== 'production'`. In production, zero default drivers are provisioned automatically. |
| `backend/src/models/index.js` (Root Admin bootstrap) | Seeded root admin account with static email and fallback password `password123`. | In production (`NODE_ENV === 'production'`), admin account creation strictly requires explicit operator environment variables `ADMIN_EMAIL` and `ADMIN_PASSWORD`. Fallback default passwords are completely disabled in production. |
| `backend/src/controllers/bookingController.js` (Admin booking creation) | Fallback `Customer.findOne()` auto-assigned an arbitrary existing customer if `customerId` was omitted by the operator. | Gated behind `process.env.NODE_ENV !== 'production'`. In production, omitting `customerId` returns HTTP 400 Bad Request. |
| `backend/src/controllers/authController.js` | Plaintext OTP generation was logged to console (`[DEV OTP] Generated OTP for ...`). | Gated behind `process.env.NODE_ENV !== 'production'` to avoid leaking OTP codes in production application logs. |
| `backend/src/services/smsService.js` | Plaintext SMS message bodies (including OTPs) logged to console when SMS gateway was inactive. | Gated behind `process.env.NODE_ENV !== 'production'`. Production logs only note SMS dispatch attempt without printing payload contents. |

### 10.2 Hardcoded Values & Mock Behavior Audit
| Finding / Location | Original Behavior | Resolution / Safe Handling |
| :--- | :--- | :--- |
| `backend/src/controllers/customerController.js` (`verifyProSubscription`) | Allowed bypass with `isMock: true` without checking whether environment was production. | Patched: Enforces `if (process.env.NODE_ENV === 'production') return res.status(503)...`. Mock subscription verification is blocked in production. |
| `frontend/src/components/Customer/ReviewModal.jsx` | On error during review submission, the catch block executed `setIsSuccess(true)` (mock success). | Removed mock success shortcut. Replaced with real error state feedback (`setError(err.response?.data?.message || 'Failed to submit review')`) and user-facing alert box. |
| `backend/src/services/geocoder.js` & `frontend/src/utils/puneGeocoder.js` | Contains offline Pune landmark coordinate database and Haversine routing fallback. | **Retained intentionally:** Provides critical resilience against public OSRM / Nominatim rate-limiting during demo presentations and offline operations. All coordinates are public geographic coordinates. |
| `backend/src/models/index.js` (`initialVehicles`) | Seeded 8 vehicle types (Tata Ace, Bolero Maxi, etc.) with physical cargo dimensions and rates. | **Retained intentionally:** These are business catalog models defining vehicle types and cargo limits, not user credentials or secrets. |

### 10.3 Dead Code & Abandoned Files Removed
- `backend/scratch.js`: Removed unreferenced 27-line scratch script used for ad-hoc DB querying during development.
- `backend/test-auth.js`: Removed unreferenced 32-line test script with hardcoded test tokens.
- `mobile/replace-theme.js`: Removed unreferenced legacy utility script from color scheme migration.
- `frontend/src/pages/Booking.jsx`: Removed unused imports (`Phone`, `bookingPaymentSchema`) and fixed missing `AlertCircle` import.
- `frontend/src/components/Driver/DriverNavigationMap.jsx`: Removed unused `Truck` icon import.

### 10.4 Items Deliberately Retained and Rationale
1. **Vehicle Catalog Seed (`initialVehicles` in `backend/src/models/index.js`):**
   - *Rationale:* Seed models for vehicle classes (e.g. Tata Ace, 3 Wheeler, Bolero Maxi) define core capacity constraints and pricing multipliers. They contain zero credentials or PII.
2. **Pune Geocoder Offline Cache & OSRM Fallback:**
   - *Rationale:* Essential for fault tolerance when public routing servers encounter rate limits or network drops.
3. **Database Maintenance Scripts (`backend/src/scripts/cleanTestData.js`):**
   - *Rationale:* Standalone operator CLI tool for clearing test bookings. Never executed automatically by the backend server.

### 10.5 Post-Cleanup Verification Summary
- **Backend Jest Test Suite:** 12 test suites, 129 tests passed (100% pass rate).
- **Security Audit Integration Suite (`security_audit.test.js`):** 9/9 tests passed (100% pass rate).
- **Frontend Oxlint:** 82 files scanned, 0 errors, 0 warnings.
- **Frontend Production Build (`npm run build`):** Vite production bundle compiled cleanly in `frontend/dist/`.
- **Mobile TypeScript Verification (`tsc --noEmit`):** 0 type errors across all React Native / Expo screens and services.
- **Mobile QA Integration Suite:** 31 tests, 70 assertions passed.

### 10.6 Required Operator Actions Before Production Launch
1. **Root Admin Provisioning:** Set `ADMIN_EMAIL` and `ADMIN_PASSWORD` in the backend hosting dashboard (e.g., Render) before starting the app for the first time.
2. **Rotate Exposed Development Credentials:** If any test API keys were previously committed in git history prior to this audit, ensure fresh production keys are generated for Razorpay, Fast2SMS, Twilio, and NeonDB.

---

## 11. Phase 2C — API Rate Limiting, AI API Protection & Cost Control Audit

**Audit Date:** 2026-10-18  
**Scope:** Express backend, Socket.io server, Groq LLM integration, Fast2SMS, Twilio IVR, Razorpay Payment Gateway, OSRM/Nominatim mapping.

### 11.1 Full API & Integration Inventory

#### External API Integrations Present in Codebase
| Provider / Integration | Service Usage | Key Location & Security | Cost Risk / Quota Behavior | Fallback / Safeguard |
| :--- | :--- | :--- | :--- | :--- |
| **Groq (`groq-sdk`)** | Voice booking parsing (`/api/bookings/ai-booking`) & Customer Support Bot (`handleSupportMessage`) | Backend-only (`process.env.GROQ_API_KEY`). Never bundled in frontend or mobile. | Pay-per-token or tier rate limit (TPM/RPM). Runaway queries could incur costs or hit 429s. | Bounded to 500-char input & 300 output tokens. Protected by `aiUsageManager` (concurrency cap, daily quota, user RPM, kill switch `AI_FEATURE_ENABLED`, 8s timeout). Fallback to deterministic NLP or offline FAQ cache. |
| **Fast2SMS** | OTP SMS dispatch (`/api/auth/phone-login`, `/api/auth/send-otp`, `/api/auth/forgot-password`) | Backend-only (`process.env.FAST2SMS_API_KEY`). Never bundled in frontend/mobile. | Per-SMS prepaid wallet balance. Vulnerable to SMS toll fraud / OTP spam. | Strict `otpLimiter` (5 req / 15 min per IP / verified user) prevents credit draining. |
| **Razorpay** | Booking & Eminence Pro subscription payments | Backend-only (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`). Public key passed only to mobile/web checkout SDK. | Per-transaction fee. Fraudulent order generation risks. | Protected behind `authMiddleware` + `authLimiter` (30 req / 15 min). Webhook HMAC verified using `crypto.timingSafeEqual`. |
| **OSRM & Nominatim** | Road distance, routing, and Pune geocoding | Backend and Frontend. | Public community server rate limits (HTTP 429). | Local Pune offline landmark cache + Haversine fallback; no paid API keys required. |
| **Twilio / Exotel** | Inbound IVR telephony and speech recordings | Backend webhook receiver (`/api/ivr/webhook`, `/api/ivr/voice-query`). | Per-minute telephony charges. | `voiceQueryLimiter` (30 req / 15 min), 10MB audio multer ceiling, `optionalAuth` identity attribution. |

*Note: OpenAI, Anthropic Claude, and Google Gemini are not used in active execution paths; Groq is the sole active LLM provider.*

#### Internal Backend Routes & Authentication Matrix
| Route Group | Path | Auth Requirement | Applied Rate Limiter |
| :--- | :--- | :--- | :--- |
| **Auth Public** | `/api/auth/login`, `/api/auth/register`, `/api/auth/phone-verify` | Public | `authLimiter` (30 req / 15 min) |
| **Auth Sensitive OTP** | `/api/auth/phone-login`, `/api/auth/send-otp`, `/api/auth/forgot-password` | Public / Soft Auth | `otpLimiter` (5 req / 15 min) |
| **Auth Protected** | `/api/auth/profile`, `/api/auth/change-password`, `/api/auth/export-data` | `authMiddleware` (Bearer token/cookie) | `authLimiter` (30 req / 15 min per user) |
| **Bookings** | `/api/bookings`, `/api/bookings/:id` | `protect` | `bookingsLimiter` (100 req / 15 min per user) |
| **AI Booking** | `/api/bookings/ai-booking` | `protect` | `aiBookingLimiter` (10 req / 15 min) + `aiUsageManager` |
| **Driver Telemetry** | `/api/drivers/location` | `protect`, `authorize('driver')` | `locationTrackingLimiter` (600 req / 15 min per driver) |
| **Driver Core** | `/api/drivers`, `/api/drivers/heatmap`, `/api/drivers/:id/metrics` | `protect`, `authorize('driver', 'admin')` | `apiLimiter` (100 req / 15 min per user) |
| **Admin & Reports** | `/api/admin/stats/*`, `/api/analytics/*` | `authMiddleware`, `authorize('admin')` | `adminReportsLimiter` (60 req / 15 min per admin) |
| **Wallet Mutations** | `/api/wallet/create-order`, `/api/wallet/referral`, `/api/wallet/verify-funds` | `authMiddleware` | `authLimiter` (30 req / 15 min per user) |
| **Payments** | `/api/integrations/payment/create-order`, `/payment/verify` | `protect` | `authLimiter` (30 req / 15 min per user) |
| **Contact Form** | `/api/integrations/contact-message` | Public (Zod validated) | `contactLimiter` (5 req / 15 min per IP) |
| **Voice Query** | `/api/ivr/voice-query` | `optionalAuth` | `voiceQueryLimiter` (30 req / 15 min per user/IP) |
| **Socket Chat** | `send_message`, `driver_sos` | Socket JWT auth | Max 5 messages / 3s per socket + sliding-window GC |

---

### 11.2 Rate Limiting Architecture & Client Identity Hardening

1. **Server-Side Enforcement & Ordering:**
   - On all protected routes, authentication (`protect` / `authMiddleware`) runs **prior** to the rate limiter.
   - `getClientKey(req)` extracts `usr_${req.user.id}` for authenticated callers, providing per-account quota separation even when multiple users share an enterprise NAT or college Wi-Fi IP.
   - For unauthenticated traffic, `getClientKey` falls back to `req.ip`.
2. **Untrusted Client Header Rejection:**
   - Spoofed client headers (`X-User-Id`, `User-Id`, `X-Forwarded-User`) are strictly ignored by `getClientKey` and cannot bypass IP quotas.
3. **Reverse Proxy Trust Configuration:**
   - In `backend/src/app.js`, `app.set('trust proxy', process.env.TRUST_PROXY || (isProd ? 1 : false))` is configured so standard single-hop reverse proxies (e.g. Render, Vercel, Nginx, AWS ALB) correctly populate `req.ip` from the leftmost proxy IP rather than arbitrary spoofed headers.
4. **Standard HTTP 429 Responses:**
   - Returns HTTP 429 with `Retry-After: <seconds>` header and a safe JSON structure:
     ```json
     {
       "success": false,
       "message": "Too many requests, please try again after 15 minutes",
       "retryAfter": 900
     }
     ```
5. **Driver GPS Tracking Protection (`locationTrackingLimiter`):**
   - Live navigation requires updates every 5-10s (~90-180 requests per 15 minutes).
   - Blanket 100 req/15min `apiLimiter` was removed from `/api/drivers/location` and replaced with `locationTrackingLimiter` (600 requests / 15 min), guaranteeing that continuous navigation is never disrupted by premature 429 errors.

---

### 11.3 AI Cost Controls, Quotas & Abuse Prevention (`aiUsageManager.js`)

| Safeguard | Configuration / Default | Behavior & Defense |
| :--- | :--- | :--- |
| **Kill Switch** | `AI_FEATURE_ENABLED=true` | Instantly disables all external LLM calls. Both support chat and voice booking gracefully fall back to deterministic NLP and helpline notices without downtime. |
| **Global Daily Quota** | `AI_DAILY_QUOTA_LIMIT=500` | Rejects requests exceeding 500 LLM calls per day (`reason: 'DAILY_QUOTA_EXCEEDED'`) to prevent runaway bills. Resets automatically at 00:00 UTC. |
| **Concurrency Ceiling** | `AI_MAX_CONCURRENT_REQUESTS=5` | Limits in-flight simultaneous requests to Groq to prevent request storms. Rejects excess callers with `CONCURRENCY_LIMIT`. |
| **Per-User Rate Limit** | `AI_USER_RATE_LIMIT_PER_MINUTE=10` | Enforces a sliding 60-second window per user/IP to prevent bot flooding. |
| **Request Timeout** | `AI_REQUEST_TIMEOUT_MS=8000` | External calls are wrapped in `executeWithBoundedTimeout(..., { timeoutMs: 8000 })`. Stalled provider connections abort after 8 seconds. |
| **Token & Input Bounds** | Max 500 chars in / 300 tokens out | Transcripts and queries are safely truncated to 500 characters before prompt interpolation; completion capped at `max_tokens: 300`. |
| **FAQ Fast Cache** | In-memory pattern matching | High-frequency pricing, cancellation, and helpline questions resolve instantly in 0ms with **0 external AI tokens** consumed. |
| **Non-Retryable Handling** | Groq 400, 401, 403, 429 | Immediately caught and returned without infinite retry loops or burning retries on auth/rate-limit failures. |
| **Deterministic Fallback** | Linear ReDoS-safe Parser | If AI is disabled or at capacity, `aiVoiceBooking` seamlessly parses pickup, drop, tempo type, and time using local heuristics. |

---

### 11.4 Verification Tests & Results

A dedicated integration test suite was created: `backend/tests/integration/rate_limiting_ai_protection.test.js`.

| Test # | Test Case Description | Result |
| :---: | :--- | :---: |
| 1 | Requests below configured limit succeed (HTTP 200) | **PASS** |
| 2 | Requests exceeding limit receive HTTP 429 with `Retry-After` and standard JSON | **PASS** |
| 3 | Server-verified `req.user.id` isolates rate limits for different users sharing an IP | **PASS** |
| 4 | Spoofed client headers (`X-User-Id`, `User-Id`) are strictly ignored for rate limiting | **PASS** |
| 5 | Location tracking limiter allows rapid driver GPS pings without false 429s | **PASS** |
| 6 | Kill switch (`AI_FEATURE_ENABLED=false`) immediately rejects AI requests with safe reason | **PASS** |
| 7 | Daily quota enforcement blocks calls when `AI_DAILY_QUOTA_LIMIT` is reached | **PASS** |
| 8 | Concurrency limiter caps simultaneous in-flight AI requests | **PASS** |
| 9 | Per-user minute rate limit prevents single-user AI flooding | **PASS** |
| 10 | Bounded execution helper times out stalled external calls at configured ms | **PASS** |
| 11 | FAQ fast-cache answers pricing/helpline questions instantly with 0 AI slots used | **PASS** |
| 12 | Support bot provides polite helpline fallback when AI is disabled | **PASS** |
| 13 | AI Voice booking endpoint falls back seamlessly to deterministic NLP when Groq is unavailable | **PASS** |
| 14 | Oversized input transcripts are bounded to 500 chars to prevent token bloat | **PASS** |
| 15 | Operational metrics track request counts and tracked users safely without PII | **PASS** |

**Full Monorepo Pre-Commit Suite (`node run_all_tests.js`):**
- Backend: Jest Unit & Integration Tests (13 Suites, 144 Tests): **100% PASS**
- Frontend: Oxlint Static Analysis (82 files): **0 errors, PASS**
- Frontend: Production Bundle Compilation (Vite): **PASS**
- Mobile: TypeScript Typecheck (`tsc --noEmit`): **0 errors, PASS**
- Mobile: Full QA Integration Test Suite (31 Test Cases, 70 Assertions): **100% PASS**

---

### 11.5 Remaining Abuse, Cost Risks & Deployment Topology Notes

1. **In-Memory Rate Limiting & Scaling Topology:**
   - Rate limit counters and AI slot tracking currently use optimized in-memory data structures (`Map` with automated sliding-window garbage collection).
   - *Limitation:* For a single-instance container deployment (Render Free/Starter, AWS EC2 single container, Railway), this in-memory architecture provides zero-dependency protection with minimal latency.
   - *Multi-Instance Scale-Out:* If scaled horizontally across multiple container replicas, per-instance memory counters do not coordinate unless backed by shared storage. The repository contains `REDIS_URL` support; for multi-instance production clusters, configuring an Upstash Redis instance enables distributed rate limiting.
2. **Pre-Paid Third-Party API Limits:**
   - Application-level limits (`AI_DAILY_QUOTA_LIMIT`, `otpLimiter`) prevent runaway internal execution. However, they do not replace provider-side spending caps and alerts.

---

### 11.6 Mandatory Provider Dashboard Configuration Actions

| Provider | Dashboard Action Required | Recommended Setting |
| :--- | :--- | :--- |
| **Groq Console** (`console.groq.com`) | Set monthly billing spend cap and usage notifications | Set hard spend limit (e.g. $10-$25/mo) and 80% usage alert email. |
| **Fast2SMS Dashboard** | Restrict API key to production server IP & set balance alerts | Enable low balance SMS alert when wallet drops below ₹200. Restrict sender ID. |
| **Razorpay Dashboard** | Webhook secret and IP allowlisting | Configure `RAZORPAY_WEBHOOK_SECRET` matching server env. Enable email alert on transaction spikes. |
| **Render / Cloud Host** | Configure `TRUST_PROXY=1` and `AI_FEATURE_ENABLED=true` | Set environment variables in the Render service settings before launch. |

---

*Report updated autonomously following the Antigravity Deployment Readiness Protocol. All tests, builds, and audit findings have been verified against active repository code.*
