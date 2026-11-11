# ARCHITECTURE.md — Dental Lounge by HS

> **Status:** Documentation only. No application code was modified. This file describes the existing "vibe-coded" codebase as-is.

---

## 1. Project Overview

**dental-lounge-by-hs** is a dental clinic management system built with the Next.js App Router. It provides patient directory management, appointment scheduling, clinical charting (odontogram), treatment notes, digital prescriptions with PDF generation, document/X-ray uploads, and billing/invoicing.

### Tech Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js (App Router) | 16.4.5 |
| UI Library | React | 19.3.0 |
| Styling | Tailwind CSS | v4 (via `@tailwindcss/turbopack`) |
| Backend / BaaS | Supabase (PostgreSQL + Auth + Storage) | `@supabase/supabase-js` ^2.119.0 |
| SSR Auth Helpers | `@supabase/ssr` | ^0.12.7 |
| PDF Generation | jspdf | ^4.2.1 |
| Language | TypeScript | ^5 |
| Build Tool | Turbopack | — |

### Configuration Files

| File | Purpose |
|------|---------|
| `next.config.ts` | Minimal Next.js config; enables `experimental.agentFeedback`, `cacheComponents`, `partialPrefetching`, and Tailwind v4 turbopack rules |
| `tsconfig.json` | Strict TypeScript, path alias `@/*` → `./*`, ESNext modules |
| `package.json` | Scripts: `dev`, `build`, `start`, `lint` |
| `.env.local` | `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` (client-exposed) |
| `eslint.config.mjs` | ESLint flat config |

---

## 2. Folder & Route Map

### 2.1 Top-Level Layout

```
dental-lounge-by-hs/
├── app/
│   ├── (dashboard)/                 # Route group — protected dashboard (no URL segment)
│   │   ├── layout.tsx               # Dashboard shell: sidebar + logout + main content
│   │   ├── page.tsx                 # "/" — Patient Directory (list + add)
│   │   ├── SidebarNav.tsx           # Navigation links (Patients, Calendar, Billing, Inventory)
│   │   ├── calendar/page.tsx        # "/calendar" — Weekly appointment calendar
│   │   ├── patient/[id]/page.tsx    # "/patient/:id" — Patient profile (odontogram, Rx, docs, invoices)
│   │   └── billing/page.tsx         # "/billing" — Invoices + procedure price management
│   ├── login/page.tsx               # "/login" — Email/password sign-in
│   └── test/page.tsx                # "/test" — Supabase connection smoke test
├── lib/
│   └── supabase.ts                  # Singleton Supabase client (anon key, browser-exposed)
├── public/                          # Static SVG assets only
├── supabase_patient_cascade.sql     # Migration: ON DELETE CASCADE for appointments/invoices
├── supabase_prescriptions.sql       # Migration: adds prescription_id column to prescriptions
├── supabase_procedure_billing.sql   # Migration: procedure_prices + invoice_items tables + RLS
├── supabase_setup_xrays.sql         # Migration: patient_documents table + patient_files bucket + RLS
├── ARCHITECTURE.md                  # This file (new)
├── README.md
├── .env.local                       # Supabase credentials (committed locally)
├── .gitignore
├── next-env.d.ts
└── tsconfig.json
```

### 2.2 Routes (App Router Pages)

| Route | Page File | Auth Required? | Description |
|-------|-----------|----------------|-------------|
| `/` | `app\(dashboard)\page.tsx` | Yes (session check → redirect `/login`) | Patient Directory: searchable patient table, add-patient modal, delete patient |
| `/calendar` | `app\(dashboard)\calendar\page.tsx` | Yes | Weekly appointment grid (Mon–Sun, 9 AM–5 PM), book/cancel/delete appointments |
| `/patient/:id` | `app\(dashboard)\patient\[id]\page.tsx` | Yes | Patient profile: demographics, odontogram, treatment notes, prescriptions, documents/X-rays, invoice generation |
| `/billing` | `app\(dashboard)\billing\page.tsx` | Yes | Invoice list (search, status filter, mark paid/overdue, print, delete), procedure price CRUD |
| `/login` | `app/login/page.tsx` | No | Supabase email/password sign-in |
| `/test` | `app/test/page.tsx` | No | Public smoke test: reads first 5 rows from `patients` table |

### 2.3 API Routes

**None.** There is no `app/api/` directory and no `middleware.ts`. All data access is performed directly from the browser via the Supabase JavaScript client using the `NEXT_PUBLIC_SUPABASE_ANON_KEY`. Row-level access control is expected to be enforced entirely by Supabase RLS policies (see Security & Bug Audit below).

---

## 3. Database Schema & Data Flow

### 3.1 Supabase Client (`lib/supabase.ts`)

```ts
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabase = createClient(supabaseUrl, supabaseKey);
```

- A single browser-side Supabase client is used everywhere.
- No server-side client, no `createServerClient` from `@supabase/ssr` is instantiated anywhere despite the package being installed.
- Auth state is checked via `supabase.auth.getSession()` in a `useEffect` on every dashboard page; unauthenticated users are redirected to `/login`.

### 3.2 Database Tables

The following tables are referenced by the frontend code. **There is no centralized schema migration file; table creation is split across four SQL files plus implicit assumptions about `patients`, `appointments`, `invoices`, `prescriptions`, and `treatment_notes`.**

#### `patients` (assumed; referenced everywhere)
- `id` UUID PK
- `first_name`, `last_name` TEXT
- `phone_number` TEXT?
- `date_of_birth` DATE?
- `medical_alerts` TEXT?
- `created_at` TIMESTAMPTZ

#### `appointments` (assumed; referenced in cascade SQL + calendar + patient detail)
- `id` UUID PK
- `patient_id` UUID → `patients(id)` ON DELETE CASCADE
- `dentist_id` UUID?
- `appointment_date` TIMESTAMPTZ
- `appointment_time` TEXT?
- `duration_minutes` INTEGER
- `status` TEXT (scheduled/cancelled)
- `notes` TEXT?
- `created_at` TIMESTAMPTZ

#### `invoices` (assumed; referenced in cascade SQL + billing)
- `id` UUID PK
- `patient_id` UUID → `patients(id)` ON DELETE CASCADE
- `total_amount` NUMERIC
- `amount_paid` NUMERIC
- `status` TEXT (paid/pending/overdue)
- `created_at` TIMESTAMPTZ

#### `procedure_prices` (created by `supabase_procedure_billing.sql`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `name` | TEXT NOT NULL | Unique (lower-case index) |
| `price` | NUMERIC(12,2) | DEFAULT 0, CHECK >= 0 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Enabled. Policy: `Authenticated users can manage procedure prices` — `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.

Seed data inserted: Composite Filling, Extraction, Crown, Root Canal, Dental Implant, Scaling / Cleaning (all price 0).

#### `invoice_items` (created by `supabase_procedure_billing.sql`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `invoice_id` | UUID | → `invoices(id)` ON DELETE CASCADE, NOT NULL |
| `procedure_name` | TEXT NOT NULL | |
| `quantity` | INTEGER | DEFAULT 1, CHECK > 0 |
| `unit_price` | NUMERIC(12,2) | DEFAULT 0, CHECK >= 0 |
| `total_price` | NUMERIC(12,2) | DEFAULT 0, CHECK >= 0 |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Enabled. Policy: `Authenticated users can manage invoice items` — `FOR ALL TO authenticated USING (true) WITH CHECK (true)`.

#### `prescriptions` (assumed; altered by `supabase_prescriptions.sql`)
- `id` UUID PK
- `patient_id` UUID → `patients(id)`
- `prescription_id` UUID (added by migration) — groups multiple medicine lines into one Rx
- `medication` TEXT
- `dosage` TEXT
- `instructions` TEXT
- `created_at` TIMESTAMPTZ

**Index:** `prescriptions_prescription_id_idx` on `prescription_id`.

**RLS:** No RLS policy or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is defined in any SQL file.

#### `treatment_notes` (assumed; referenced in patient detail page)
- `id` UUID PK
- `patient_id` UUID → `patients(id)`
- `procedure_type` TEXT
- `tooth_number` INTEGER?
- `clinical_notes` TEXT?
- `created_at` TIMESTAMPTZ

**RLS:** No RLS policy or `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` is defined in any SQL file.

#### `patient_documents` (created by `supabase_setup_xrays.sql`)
| Column | Type | Notes |
|--------|------|-------|
| `id` | UUID PK | `gen_random_uuid()` |
| `patient_id` | UUID | → `patients(id)` ON DELETE CASCADE, NOT NULL |
| `file_name` | TEXT NOT NULL | |
| `file_url` | TEXT NOT NULL | Public Supabase Storage URL |
| `file_type` | TEXT | |
| `file_size` | INTEGER | |
| `created_at` | TIMESTAMPTZ | DEFAULT now() |

**RLS:** Enabled. Policies (all `USING (true)`, `WITH CHECK (true)` for insert):
- SELECT: `Authenticated users can select patient documents`
- INSERT: `Authenticated users can insert patient documents`
- DELETE: `Authenticated users can delete patient documents`

### 3.3 Storage Buckets

| Bucket | Public? | Purpose | RLS Policies |
|--------|---------|---------|--------------|
| `patient_files` | `true` | Patient X-rays and documents | SELECT/INSERT/DELETE for `authenticated` where `bucket_id = 'patient_files'` |

Created by `supabase_setup_xrays.sql` via `INSERT INTO storage.buckets ... ON CONFLICT (id) DO UPDATE SET public = true`.

### 3.4 Data Flow: Frontend → Supabase

All interactions are direct client-to-Supabase (no backend API layer). Each page performs its own `supabase.from(...)` calls.

#### Patient Directory (`/`)
1. `supabase.auth.getSession()` — redirect to `/login` if no session.
2. `supabase.from("patients").select("*").order("created_at", { ascending: false })` — load all patients.
3. Client-side search filter on `first_name`/`last_name`/`phone_number`.
4. Insert: `supabase.from("patients").insert([payload]).select()` — add new patient.
5. Delete: `supabase.from("patients").delete().eq("id", patient.id)` — relies on DB-level ON DELETE CASCADE (set up via `supabase_patient_cascade.sql`) to remove linked appointments/invoices.

#### Calendar (`/calendar`)
1. Auth check → redirect if no session.
2. `supabase.from("patients").select("id, first_name, last_name, phone_number").order("first_name")`
3. `supabase.from("appointments").select("*").order("appointment_date")`
4. Insert: `supabase.from("appointments").insert([newAppointment]).select()` — `appointment_date` constructed as `${date}T${time}:00`.
5. Update (cancel): `supabase.from("appointments").update({ status: "cancelled" }).eq("id", id)`.
6. Delete: `supabase.from("appointments").delete().eq("id", id)`.

#### Patient Profile (`/patient/:id`)
1. `supabase.from("patients").select("*").eq("id", id).single()`
2. `supabase.from("treatment_notes").select("*").eq("patient_id", id).order("created_at", { ascending: false })`
3. `supabase.from("patient_documents").select("*").eq("patient_id", id).order("created_at", { ascending: false })`
4. `supabase.from("prescriptions").select("*").eq("patient_id", id).order("created_at", { ascending: false })`
5. `supabase.from("appointments").select("id, appointment_date, status, notes, duration_minutes").eq("patient_id", id).order("appointment_date", { ascending: false })`
6. **Save treatment note:** `supabase.from("treatment_notes").insert({ patient_id: id, procedure_type, tooth_number, clinical_notes })`
7. **Save prescription:** `supabase.from("prescriptions").insert(medicines.map(...))` — each medicine row gets a `crypto.randomUUID()` as `prescription_id` to group lines.
8. **Upload document:** (1) `supabase.storage.from("patient_files").upload(filePath, file)`, (2) `supabase.storage.from("patient_files").getPublicUrl(filePath)`, (3) `supabase.from("patient_documents").insert({ patient_id, file_name, file_url, file_type, file_size })`.
9. **Delete document:** `supabase.from("patient_documents").delete().eq("id", doc.id)` — **does NOT remove the file from Storage** (orphaned object).
10. **Generate invoice:** reads `procedure_prices`, aggregates `treatment_notes` by procedure, inserts into `invoices`, then inserts line items into `invoice_items`, then generates a PDF via jspdf.

#### Billing (`/billing`)
1. `Promise.all([supabase.from("invoices").select("*")..., supabase.from("patients").select(...), supabase.from("procedure_prices").select("*")..., supabase.from("invoice_items").select("*")...])`
2. **Add procedure:** `supabase.from("procedure_prices").insert({ name, price }).select().single()`
3. **Update procedure:** `supabase.from("procedure_prices").update({ price }).eq("id", id)`
4. **Delete procedure:** `supabase.from("procedure_prices").delete().eq("id", id)`
5. **Mark paid/overdue/delete invoice:** `supabase.from("invoices").update({ status }).eq("id", id)` or `.delete().eq("id", id)` — `invoice_items` are cascade-deleted via FK.

#### Login (`/login`)
- `supabase.auth.signInWithPassword({ email, password })` → on success redirect to `/`.

#### Test (`/test`)
- Instantiates its own `createClient` (not the shared `@/lib/supabase`), reads `supabase.from("patients").select("*").limit(5)`, renders raw JSON.

---

## 4. Component Breakdown

### 4.1 Layout & Navigation

#### `app\(dashboard)\layout.tsx` — DashboardLayout
- **Type:** Client component (`"use client"`), Next.js layout wrapper.
- **Props:** `children: React.ReactNode`.
- **State:** `showAccountMenu` (boolean).
- **Logic:** Renders a fixed sidebar (`w-64`) with "Dental Lounge" brand, `SidebarNav` inside `<Suspense>`, bottom user area (hardcoded "Dr / Admin"), and logout button. On logout, computes session duration from `localStorage` login timestamp, clears it, calls `supabase.auth.signOut()`, and redirects to `/login?logged_out=1&session_duration=Xm Ys`. The "Clinic Settings" menu item hard-redirects to `/billing?tab=procedures` (the `tab` query param is not consumed anywhere in `billing/page.tsx`).

#### `app\(dashboard)\SidebarNav.tsx` — SidebarNav
- **Type:** Client component.
- **Props:** None.
- **State:** None (uses `usePathname()` from `next/navigation`).
- **Logic:** Four nav links: Patients (`/`), Calendar (`/calendar`), Billing (`/billing`), Inventory (`#` — dead link, no page exists). Active state determined by pathname prefix matching.

### 4.2 Pages

#### `app\(dashboard)\page.tsx` — PatientDirectory
- **Type:** Client component.
- **Props:** None.
- **State:**
  - `isCheckingAuth` (boolean) — blank screen while checking session.
  - `patients` (any[]) — all patients from Supabase.
  - `searchTerm` (string) — client-side filter.
  - `isModalOpen`, `isSubmitting`, `formData` (first_name, last_name, phone_number, date_of_birth, medical_alerts).
- **Logic:** On mount checks auth, fetches patients. Supports add (insert into `patients`), delete (delete from `patients`), and inline row click navigation to `/patient/${id}`.

#### `app\login\page.tsx` — Login
- **Type:** Client component.
- **Props:** None.
- **State:**
  - `email`, `password`, `showPassword`, `isSigningIn`, `error`, `sessionInfo`
  - `isSignupOpen`, `signupEmail`, `signupFirstName`, `signupLastName`, `signupPassword`, `signupProfilePic`, `isSigningUp`, `signupError`
  - `isForgotOpen`, `forgotEmail`, `isResetting`, `resetMessage`
- **Logic:**
  - **Sign in:** `supabase.auth.signInWithPassword({ email, password })` with inline error display (red banner) instead of `alert()`. On success, stores login timestamp in `localStorage` and redirects to `/`.
  - **Password visibility toggle:** Eye icon button toggles `type="password"` ↔ `type="text"`.
  - **Clear-on-logout:** `useEffect` watches for `?logged_out=1` query param; clears email/password/error/`isSigningIn` state and shows a session-duration banner (computed by the dashboard layout on logout).
  - **Session time:** Dashboard `handleLogout()` computes elapsed time since login and passes it via `session_duration` query param.
  - **Create new account:** Modal with First Name, Last Name, Email, Password (min 6 chars), optional Profile Picture upload. Uses `supabase.auth.signUp()`; uploads avatar to `patient_files` bucket and updates user metadata.
  - **Forget password:** Modal with email input; calls `supabase.auth.resetPasswordForEmail()` to send a secure reset link (Supabase does not send plain-text passwords).
  - **Error handling:** All Supabase errors caught and displayed inline in color-coded banners (red for errors, emerald for success). Button states show loading text ("Signing in...", "Creating account...", "Sending...").

#### `app\test\page.tsx` — SupabaseTestPage
- **Type:** Server component (async, no `"use client"`).
- **Props:** None.
- **State:** None.
- **Logic:** Creates its own Supabase client, queries `patients` limit 5, renders raw JSON or error. Exports `instant = false` (Next.js cache opt-out).

#### `app\(dashboard)\calendar\page.tsx` — CalendarPage
- **Type:** Client component.
- **Props:** None.
- **State:** `isCheckingAuth`, `patients` (Patient[]), `appointments` (Appointment[]), `currentWeekStart`, `todayIso`, `isModalOpen`, `isSubmitting`, `formError`, `selectedAppointment`, `formData` (patient_id, appointment_date, appointment_time, duration_minutes, notes).
- **Logic:** Weekly grid (Mon–Sun), time slots 9 AM–5 PM. Clicking a slot opens the booking modal prefilled with date/time. Submit inserts into `appointments`. Appointment detail modal shows patient info, date/time, status, notes, with Cancel and Delete actions.

#### `app\(dashboard)\patient\[id]\page.tsx` — PatientProfile
- **Type:** Client component wrapped in outer `PatientProfile` with `<Suspense>` fallback.
- **Props:** None (uses `useParams()` for `id`).
- **State:** `patient`, `loading`, `showNoteModal`, `treatmentNotes`, `appointments`, `newNote`, `selectedTooth`, `toothProcedure`, `toothNotes`, `isSavingTooth`, `documents`, `isUploading`, `uploadError`, `selectedDocPreview`, `isDragging`, `prescriptions`, `showRxModal`, `rxMedicines`, `isSavingRx`, `isGeneratingInvoice`.
- **Key Sub-Components (inline):** `getToothStatus`, `ToothIcon`, `PatientProfileContent`.
- **Logic:** Fetches patient + all related records on mount. Interactive odontogram (Universal Numbering System, teeth 1–32) maps `treatment_notes` to tooth status badges (Filling/Extraction/Crown/Root Canal/Implant). Supports adding treatment notes, saving prescriptions (grouped by `prescription_id`), uploading documents to `patient_files` bucket + `patient_documents` table, deleting documents, generating invoices from treatment notes (PDF via jspdf), and printing prescriptions (PDF via jspdf).

#### `app\(dashboard)\billing\page.tsx` — BillingPage
- **Type:** Client component.
- **Props:** None.
- **State:** `isCheckingAuth`, `invoices`, `patients`, `searchTerm`, `statusFilter`, `activeTab` ("invoices" \| "procedures"), `procedures`, `invoiceItems`, `procedureName`, `procedurePrice`.
- **Logic:** Fetches invoices, patients, procedure_prices, invoice_items in parallel. Tabbed UI: Invoices (list with search/status filter, mark paid/overdue, print HTML invoice, delete) and Procedures (CRUD for `procedure_prices`). `formatCurrency` displays amounts as `PKR` (Pakistani Rupees) using `en-PK` locale. `handlePrintInvoice` opens a popup window and writes raw HTML with inline styles.

### 4.3 Libraries

#### `lib/supabase.ts`
- Exports a single `supabase` browser client created from env vars. No error handling for missing env vars (non-null assertion `!`).

---

## 5. Security & Bug Audit

### 5.1 Exposed API Routes

**None exist.** There is no `app/api/` directory and no `middleware.ts`. All data access goes directly from the browser to Supabase using the `NEXT_PUBLIC_SUPABASE_ANON_KEY`.

**Risk:** The `NEXT_PUBLIC_SUPABASE_ANON_KEY` is embedded in `.env.local` and shipped to the browser (it is a `NEXT_PUBLIC_` variable, which is intentional for Supabase client-side usage). Anyone who can inspect the page can extract the key. Combined with overly permissive RLS (see below), this means any authenticated user can read/write all data.

### 5.2 Missing Supabase Row Level Security (RLS)

| Table | RLS Enabled? | Policies | Assessment |
|-------|-------------|----------|------------|
| `patients` | ❌ No (not in any SQL file) | None | **Critical.** Any authenticated user can read/update/delete all patient records. |
| `appointments` | ❌ No | None | **Critical.** Full read/write access for all authenticated users. |
| `invoices` | ❌ No | None | **Critical.** Full read/write access for all authenticated users. |
| `prescriptions` | ❌ No | None | **Critical.** Full read/write access for all authenticated users. |
| `treatment_notes` | ❌ No | None | **Critical.** Full read/write access for all authenticated users. |
| `procedure_prices` | ✅ Yes | `FOR ALL TO authenticated USING (true) WITH CHECK (true)` | **Weak.** Authenticated = unrestricted. No ownership check (e.g., `auth.uid()`). |
| `invoice_items` | ✅ Yes | `FOR ALL TO authenticated USING (true) WITH CHECK (true)` | **Weak.** Same as above. |
| `patient_documents` | ✅ Yes | SELECT/INSERT/DELETE all `USING (true)` | **Weak.** Authenticated users can access any patient's documents regardless of ownership. |
| `storage.objects` (bucket `patient_files`) | ✅ Yes | SELECT/INSERT/DELETE where `bucket_id = 'patient_files'` | **Weak.** No folder-level isolation; any authenticated user can read/upload/delete any file in the bucket. |

**Summary:** Five of seven tables have **no RLS at all**. The two tables with RLS use blanket `USING (true)` policies that grant all authenticated users full access to all rows, with no row ownership or clinic scoping. There is no multi-tenancy (no `clinic_id` or `organization_id` column anywhere), so RLS cannot distinguish between different clinics or users even if policies were tightened.

### 5.3 Potential Bugs & Issues

| # | Area | Description | Severity |
|---|------|-------------|----------|
| 1 | **Document deletion** (`patient\[id]\page.tsx`, `handleDeleteDocument`) | Deletes the `patient_documents` DB row but never calls `supabase.storage.from("patient_files").remove(...)`, leaving orphaned files in Storage. | Medium |
| 2 | **Dead nav link** (`SidebarNav.tsx`) | "Inventory" links to `href="#"`; no inventory page exists. | Low |
| 3 | **Unused query param** (`layout.tsx` → `billing?tab=procedures`) | `billing/page.tsx` never reads `searchParams.tab`; the `tab` state is hardcoded to `"invoices"`. | Low |
| 4 | **Missing `patient/page.tsx`** | The `patient` directory only contains `[id]`; there is no index page at `/patient`. Not currently reachable except via the directory table's row click. | Low |
| 5 | **No auth middleware** | Session checks are duplicated in `useEffect` on every dashboard page (`layout.tsx` does not protect routes). A user could theoretically flash protected content before the redirect. | Medium |
| 6 | **Environment variables committed** | `.env.local` contains the Supabase URL and anon key and appears to be tracked in the repo. | Medium |
| 7 | **Test page exposes data** | `/test` is unauthenticated and dumps raw `patients` rows to the page if RLS is not strictly enforced. | Medium |
| 8 | **No server-side client** | `@supabase/ssr` is installed but never used; `createServerClient` is not instantiated anywhere, so there is no server-side auth boundary. | Medium |
| 9 | **Invoice generation trust** (`patient\[id]\page.tsx`, `handleGenerateInvoice`) | The client computes totals from `treatment_notes` and `procedure_prices` and inserts them directly; there is no server-side validation of amounts or authorization. | Medium |
| 10 | **Prescription delete logic** (`patient\[id]\page.tsx`, `handleDeleteRx`) | Deletes by `patient_id` + `prescription_id` (or `id` fallback). If `prescription_id` is null/undefined, it falls back to `id` but still scopes by `patient_id` — acceptable, but no RLS exists to enforce it at the DB level. | Medium |
| 11 | **`treatment_notes` and `prescriptions` tables missing from SQL migrations** | No `.sql` file creates these tables or enables RLS; their existence is assumed. | High |
| 12 | **Cascading delete depends on manual SQL** | `supabase_patient_cascade.sql` must be run manually to add `ON DELETE CASCADE` to `appointments` and `invoices`; without it, deleting a patient leaves orphaned records. | High |
| 13 | **No input sanitization on `handlePrintInvoice`** | `window.open` + `document.write` with interpolated invoice data (patient name, procedure names) — potential XSS if malicious data is stored. | Low |
| 14 | **File upload path predictability** | Storage path is `${id}/${Date.now()}_${cleanFileName}` — patient ID and timestamp are guessable; bucket is public (`public = true`), so files may be accessible via direct URL if the path is known. | Medium |
| 15 | **No `loading.tsx`/`error.tsx`** | No Next.js error boundaries or loading states at the route level; the patient page uses an inline `<Suspense>` fallback only. | Low |

### 5.4 Recommended Remediations (Non-Exhaustive)

1. **Enable RLS on all tables** (`patients`, `appointments`, `invoices`, `prescriptions`, `treatment_notes`) with policies scoped to `auth.uid()` or a clinic/org identifier.
2. **Replace blanket `USING (true)` policies** with ownership checks (e.g., `patient_id = auth.uid()` or via a join through `patients`).
3. **Add a server-side auth boundary** (middleware.ts or server actions with `createServerClient`) so protected routes are enforced before client rendering.
4. **Fix document deletion** to also remove the file from Supabase Storage.
5. **Remove or commit-ignore `.env.local`** and rotate the exposed Supabase anon key.
6. **Create missing SQL migrations** for `treatment_notes` and `prescriptions` including RLS.
7. **Run `supabase_patient_cascade.sql`** as part of the schema setup to ensure orphan prevention on patient delete.
8. **Add `error.tsx`/`loading.tsx`** for route-level error and loading boundaries.

---

## 6. Summary

Dental Lounge by HS is a client-heavy Next.js 16 + Supabase application with no backend API routes and no middleware. All business logic and data access live in browser components using a single exposed Supabase anon client. Security relies entirely on Supabase RLS, which is currently incomplete (five tables unprotected; two protected with blanket `true` policies) and missing on core clinical tables (`patients`, `appointments`, `invoices`, `prescriptions`, `treatment_notes`). The codebase is functional but "vibe-coded" — it works for a single-user demo but requires significant security hardening, RLS scoping, server-side auth, and bug fixes before production use.