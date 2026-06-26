# Assets App — Master Project Baseline

This is the single source of truth for session context, product intent, implementation state, and project history.

## Session Start Instructions

Read this file at the start of every session before writing any code.

Platform truth: `Next.js 16.2.7 + React 19.2.4 + Supabase`.
Routing: App Router under `src/app`.
Do not invent platform history — the old Vite and Expo directions are archived here but are not active.

Supabase:
- Remote URL: `https://qeelerohenfgphioizye.supabase.co`
- Remote ref: `qeelerohenfgphioizye`
- Use the linked Supabase CLI for migrations.
- Do not store secrets in this file.

Ground truth files:
- Shell/protection: `src/components/app-shell.tsx`, `src/components/protected-app.tsx`
- Auth/access: `src/contexts/auth-context.tsx`, `src/lib/auth.ts`
- Location scope: `src/contexts/location-scope-context.tsx`
- Supabase client: `src/lib/supabase/client.ts`
- Pages: `src/app/(app)/dashboard/page.tsx`, `inventory/page.tsx`, `check-out-in/page.tsx`, `my-assets/page.tsx`, `requests/page.tsx`, `approvals/page.tsx`, `settings/page.tsx`
- Data/logic: `src/lib/dashboard.ts`, `inventory.ts`, `check-operations.ts`, `my-assets.ts`, `requests.ts`, `approvals.ts`, `settings.ts`, `reports.ts`, `qr-export.ts`, `damage-lock.ts`

---

## 1. Platform Direction

- Active platform: `Next.js 16 + React 19 + Supabase`
- Routing: App Router under `src/app`
- Primary deployment: Vercel web
- Mobile-aware interaction patterns are used so an Expo/mobile client can be added later
- This is a v2 rebuild; old app is a visual parity reference only, not a workflow baseline

---

## 2. Product Shape

- v2 rebuild of the Assets App
- Shared visual language: dark matrix-style background, green/cyan glow, shell gradients, card/panel styling
- Login-led entry, mobile-aware shell, role-aware navigation
- Wedding-specific legacy features are out of scope
- Smaller set of strong operational workflows over sprawling route complexity

---

## 3. Roles

| Role | Access |
|---|---|
| `main_admin` | Full cross-location administrative and operational access |
| `admin` | Full cross-location administrative and operational access |
| `asset_manager` | Locked to one assigned location; operational access within that location |
| `staff` | Can browse full inventory, use request workflows |
| `volunteer` | Limited to own assigned assets and related actions |

Role capability is defined by the current route gating, location locking, and workflow write handlers in the active web app.

---

## 4. Access and Gating

- Signed-out users redirect to `/login`
- Approved users enter the protected app shell
- `pending_approval` users redirect to `/approval-pending`
- `damage_locked` users redirect to `/damage-lock`
- Route access is role-aware
- Auth bootstrap: prefers `get_my_access_context`, falls back to direct `profiles` + `user_roles` reads
- If `is_approved` RPC is unavailable, auth degrades to profile-and-role approval inference

---

## 5. Location Model

- Location scope is a first-class concept
- `admin`/`staff` can work across all locations or select one
- `asset_manager` is locked to their assigned manager location
- `volunteer` is locked to their assigned location when applicable
- Scope is persisted in `localStorage` per user
- `Traveling` is a workflow location, not a user home base
- Final location list: `Centurion`, `Krugersdorp`, `Lanseria`, `Office`, `Traveling`
- Sunday kit workflows run at: `Centurion`, `Krugersdorp`, `Lanseria` only

---

## 6. Core Navigation

Protected pages (shared shell):
- `Dashboard`
- `Inventory`
- `Check-out/In`
- `My Assets`
- `Requests`
- `Approvals`
- `Settings`

Public routes:
- `/login`
- `/approval-pending`
- `/damage-lock`

---

## 7. Page Baselines

### Dashboard
- Role-aware operational overview
- Admin top cards: `Approvals`, `Damage Locks`, `Transfers`, `Blocked Workflows`
- Asset manager top cards: `Approvals`, `Returns`, `Sign-Outs`, `Damage Tasks`
- Staff/volunteer top cards: `Pending Approvals`, `My Assigned Items`, `Return Requests`, `Damage Actions`
- Lower sections: operational-feed based, 5-row preview cap, navigation-only
- Uses live, mixed, or fallback data

### Inventory
- Grouped catalog first, drill into physical units
- Filters: `Search`, `Location`, `Department`, `Status`, `Availability`
- Grouped cards: name/type, counts for Available/Assigned/Traveling/Damaged, location spread
- Unit detail: Tag, Name, Serial, Status, Location, Department, Holder
- Inline editing allowed for `Name`, `Tag`, `Department / Team` (admin and asset-manager only)
- Asset detail routes into compatible request, check-out/in, return, reassignment, damage-review workflows
- Recent asset history preview on selected unit

### Check-out/In
Manager/admin only. Six tabs:
- `Standard` (default): two-mode Sign Out / Sign In; multi-item; outcomes: `Available` or `Damaged`
- `Permanent`: direct issue and reassignment; explicit return-location sign-in
- `Stationed`: resting-state model; temporary use moves to `Traveling`; sign-in outcomes: `Stationed`, `Available`, `Damaged`
- `Sunday Kits`: kit-level deployment with item-level return resolution; saved kit membership from `Settings > Kits` when available
- `Returns`: read-only monitoring surface (decisions happen in `Approvals > Returns`)
- `QR Scan`: camera-assisted capture (requires `BarcodeDetector` + camera permissions); manual batch entry and `.txt`/`.csv` batch-file import as fallbacks

### My Assets
Personal action workspace. Three tabs:
- `Assigned`: action-oriented list; return request and handover entry
- `Pending`: inline approve/decline for assignments and handovers; multi-select bulk actions
- `Damage`: damage history (history-only; report authored from `/damage-lock`)

Handover workflow lives here (not a top-level page):
- Starts from `Assigned`; incoming handovers appear in `Pending`
- Accept transfers holder responsibility; reject returns control to original holder

### Requests
Guided request workspace. Four tabs:
- `Asset`: multi-item basket; required fields: Need Date, Reason, Duration, Event/Use Context; limited to one source location per basket
- `Special`: dynamic form; types: `Stationed Use` (stationed assets only), `Permanent Reassignment` (permanent assets only)
- `Returns`: multi-asset return basket; required fields: Return Date, Preferred Return Location, Note
- `History`: all request types and draft status

Draft behavior:
- Each workflow autosaves one local draft per user in `localStorage`
- Restores on tab return; explicit discard action
- When scope is `All locations`, a source-location picker is shown before submit

### Approvals
Queue plus review-panel workspace. Five tabs:
- `Recipient`: reminder-send only; bulk reminders; no bulk approve/decline override
- `Asset Requests`: Approve, Decline, Request Changes; bulk compatible
- `Special Requests`: Approve, Decline, Request Changes; bulk compatible
- `Returns`: Accept Return (auto-signs into selected final location); single-item because each needs a location choice
- `Damage Locks`: resolve to `Available`, `Damaged`, or `Lost`

Features: queue search, status filtering, URL-addressable tab/item state, multi-select bulk with shared bulk note.

### Settings
Role-aware. All tabs:
- `Profile`: visible to all roles; basic name save
- `Users`: admin full record; manager limited to own-location operational fields; admin can assign role and home base
- `Roles`: fixed system roles (no custom role editor in v1)
- `Locations`: add, enable/disable
- `Departments`: add, enable/archive
- `Kits`: create/retire kit definitions; asset-backed membership editor (adds/removes specific assets)
- `Consumables`: add, archive/re-enable
- `Reports`: filter + export as CSV, XLSX, PDF; report types: Damage, Asset History, Accountability
- `Duplicates`: side-by-side compare and resolve (Merged / Not Duplicate); resolution note required
- `Config`: QR export tooling — filter by search/location/department/status/date range, live preview, A4 PDF output, `20mm × 20mm` labels sorted by tag, UUID-encoded QR, outer border only, label size/border/format configurable

---

## 8. Workflow Rules

- Standard asset operations: sign-out and sign-in centered
- Permanent: distinct from standard; moves asset to `Traveling`; explicit return location at sign-in
- Stationed: resting-state model; temporary use moves to `Traveling` with responsible user
- Sunday Kits: kit-level workflow; saved kit membership when `kit_members` schema available; item-level return resolution when `kit_deployment_items` schema available; count-based fallback
- QR Scan: camera-assisted or manual batch; one batch stays in one compatible workflow mode
- Return requests: user-initiated (`Requests > Returns`); manager/admin-resolved (`Approvals > Returns`); direct walk-up intake via `Check-out/In > Standard`
- Damage lock: real access state; locked user completes damage form from `/damage-lock` which auto-unlocks; manager/admin resolves from `Approvals > Damage Locks`
- Damage lock notifications: locked user + responsible manager + admin
- Responsible manager routing: active asset_manager at locked user's home base; falls back to admins if none

### Asset Lifecycle States
- Core: `Available`, `Assigned`, `Traveling`, `Stationed`, `Damaged`
- `Lost` is a damage-workflow outcome, not a core steady state
- `Unassigned` is a temporary holding state (admin cleanup; force-retired location scenario)

### Status Labels
- Request/workflow: `Draft`, `Pending`, `Approved`, `Declined`, `In Progress`, `Completed`, `Blocked`
- Approval: `Pending`, `Approved`, `Declined`, `Request Changes`, `Awaiting Recipient`
- Return: `Pending`, `Accepted`, `Routed to Intake`, `In Progress`, `Completed`, `Declined`
- Damage: `Locked`, `Form Pending`, `Form Submitted`, `Under Review`, `Resolved: Available`, `Resolved: Damaged`, `Resolved: Lost`
- No helper text or tooltip-dependent meaning; short operational labels only

---

## 9. Data and Degradation Model

- Live Supabase-backed behavior is the default target
- Consistent fallback pattern across all feature modules: attempt live → catch missing schema → fall back to preview/mixed → surface warning
- Three modes: `Live Data`, `Mixed Data`, `Fallback Preview`
- Auth bootstrap follows the same degradation pattern

---

## 10. Notification Baseline

Shell notification center:
- Unread count, categories, priority, mark-read, mark-all-read, clear-all
- Local persistence per user in `localStorage`
- Live domain refresh from backend table subscriptions where tables exist
- Live generation covers: approvals, recipient follow-up, damage review, personal pending items, active damage incidents, request-history updates, return-intake monitoring, Sunday Kit deployment follow-up, sign-in backlog cues
- Backend event routing is follow-up work

---

## 11. Current Implementation State (as of 2026-06-02 + post-baseline refinements)

All top-level pages are live. Latest git commits include matrix rain pointer tracking improvements and asset manager sign-in location locking.

| Page / Area | State |
|---|---|
| Shell, auth, route protection | Complete |
| Login, Approval Pending, Damage Lock screens | Complete with matrix visual treatment |
| Dashboard | Live role-aware counts and feed cards; fallback-aware |
| Inventory | Live grouped catalog, unit detail, history preview, inline edit, workflow routing |
| My Assets | Live assigned, pending (assignments + handovers), damage history |
| Requests > Asset | Live basket submit |
| Requests > Special | Live submit (Stationed Use, Permanent Reassignment) |
| Requests > Returns | Live submit |
| Requests > History | Live |
| Requests draft autosave | Live (localStorage per workflow per user) |
| Approvals all tabs | Live queue + review panel; bulk actions; bulk note |
| Check-out/In > Standard | Live sign-out and sign-in |
| Check-out/In > Permanent | Live direct issue and reassignment |
| Check-out/In > Stationed | Live temporary use and return-to-site (all 3 outcomes) |
| Check-out/In > Sunday Kits | Live deploy/return with item-level resolution; count-based fallback |
| Check-out/In > Returns | Live monitoring (read-only) |
| Check-out/In > QR Scan | Live manual batch + camera-assisted capture |
| Settings > Profile | Live basic save |
| Settings > Users | Live admin/manager edit (name, home base, role) |
| Settings > Locations | Live add + active toggle |
| Settings > Departments | Live add + active toggle |
| Settings > Kits | Live create/retire + asset-backed membership editor |
| Settings > Consumables | Live add + active toggle |
| Settings > Reports | Live filter + CSV/XLSX/PDF export |
| Settings > Duplicates | Live compare and resolve |
| Settings > Config / QR Export | Live filter preview + A4 PDF generation |
| Notification center | Live (local seed + localStorage persistence) |

---

## 12. Active Constraints

- Camera-assisted QR capture depends on browser `BarcodeDetector` support and camera permissions; manual batch and file import are the required fallbacks
- Notification backend event routing is not yet complete; shell uses local seed + subscription where available
- Some settings tabs are operationally lighter than others; the visible tab set and live handlers define the baseline surface
- Role, lifecycle, transfer, and location rules are expressed through current route gating, scope locking, and workflow handlers — no separate standalone rules engine

---

## 13. Supabase Migrations Reference

Migrations live in `supabase/migrations/`. Key RPC contracts established:
- `get_my_access_context`, `is_approved` (auth)
- `get_my_pending_recipient_signout_approvals` (My Assets)
- `submit_asset_request_bundle`, `submit_special_request`, `submit_return_request` (Requests)
- `review_approval`, `resolve_damage_case` (Approvals)
- `standard_sign_out_assets`, `standard_sign_in_assets`, `list_return_request_monitor` (Check-out/In Standard)
- `permanent_assign_assets` (Check-out/In Permanent)
- `stationed_checkout_assets`, `stationed_checkin_assets` (Check-out/In Stationed)
- `deploy_sunday_kit`, `return_sunday_kit_items`, `return_sunday_kit_item_resolutions` (Sunday Kits)
- `create_settings_location`, `set_settings_location_active`, `create_settings_department`, `set_settings_department_active` (Settings)
- `create_settings_consumable`, `set_settings_consumable_active`, `save_settings_config` (Settings)
- `create_settings_kit`, `set_settings_kit_active`, `list_settings_kit_members`, `save_settings_kit_members` (Kits)
- `save_settings_user` (Users)
- Schema additions: `kit_deployments`, `kit_deployment_items`, `kit_members`

---

## 14. Infrastructure

- GitHub: `https://github.com/Encounter-Creator/EC-Assets.git` (main branch)
- Vercel: project `ec-assets`; env vars pulled to `.env.local`
- Supabase: current active project ref `qeelerohenfgphioizye` (remote URL `https://qeelerohenfgphioizye.supabase.co`)
- Historical Supabase ref `kpcfvmteutmzcfoazszp` was used during the Expo rebuild phase and is no longer the active project

---

## 15. Implementation History (Archive)

This section is historical context. It is not the active spec.

### Platform Evolution
1. **Original**: React + Vite + Supabase
2. **Expo rebuild phase (2026-05-31 to 2026-06-01)**: Rebuilt as Expo + Expo Router + React Query + Supabase. EAS project `9d29bb3a-56c2-440b-8165-354b270ca275`. Supabase ref `kpcfvmteutmzcfoazszp`. Got through approvals, permanent, stationed, Sunday kits workflows. Auth screens, approval gating, and live request/approval/damage flows implemented.
3. **Next.js reset (2026-06-01)**: Direction locked to `Vercel-first` using `Next.js App Router + Supabase`. Old app is visual parity reference only.

### Next.js Rebuild Progression (2026-06-01 to 2026-06-02)
- Session 1: Scaffolded Next.js app; visual system, Login, shared shell, all page scaffolds
- Session 2: Approval Pending page; Dashboard baseline structure
- Session 3: Auth/session foundation; Supabase client, auth context, protected routes
- Session 4: Role/access context; location scope provider; role-aware shell; nav visibility
- Session 5: Inventory first pass — grouped catalog, filters, drill-in
- Session 6: My Assets — Assigned/Pending/Damage tabs
- Session 7: Requests — Asset/Special/Returns/History tabs
- Session 8: Approvals — queue list + review panel, all 5 tab types
- Session 9: Check-out/In — all 6 tabs scaffold pass
- Session 10: Settings — all tabs, role-aware visibility, Profile tab for all roles
- Session 11: My Assets live data — assigned assets, pending approvals, handovers, damage history
- Session 12: Requests live data — requestable assets, history, asset-request submit
- Session 13: Approvals live data — queue rows, inline actions, damage resolution
- Session 14: Check-out/In Standard live — sign-out/sign-in RPCs, returns monitoring
- Session 15: Dashboard live — role-aware top cards and lower feed cards
- Session 16: Settings read-side live — all section data loads
- Session 17: Inventory deeper drill-in — selected unit detail, history preview
- Session 18: Requests Returns submit live
- Session 19: Requests Special submit live (Stationed Use, Permanent Reassignment)
- Session 20: Check-out/In Permanent live — direct issue and reassignment
- Session 21: Check-out/In Stationed live — temporary use and return-to-site
- Session 22: Check-out/In QR Scan live — manual batch mode
- Session 23: Check-out/In Sunday Kits live — first-pass deploy/return ledger
- Session 24: Settings write-side first pass — Profile, Locations, Departments
- Session 25: Settings write-side second pass — Consumables, Config QR export form
- Session 26: Settings Kits write-side — create/retire lifecycle
- Session 27: Settings Users write-side — admin/manager edit sets; `save_settings_user` RPC
- Session 28: Settings Reports — filter + CSV/XLSX/PDF export
- Session 29: Settings Duplicates — compare and resolve flow
- Session 30: Settings Config QR — filter preview + A4 PDF generation
- Session 31: Approvals reminder sends live; Damage Locks Lost resolution complete
- Session 32: GitHub, Vercel, Supabase infrastructure connected
- Session 33: Stationed return outcomes fixed — `Stationed`, `Available`, `Damaged` all supported
- Session 34: Sunday Kits item-level return resolution — `kit_deployment_items` migration + UI
- Session 35: Requests draft autosave — localStorage per workflow per user
- Session 36: Requests source-location picker for `All locations` scope
- Session 37: Inventory inline edit — Name, Tag, Department/Team for admin/asset-manager
- Session 38: Approvals bulk actions — multi-select, shared bulk note, compatible queue bulk ops
- Session 39: Notification center — unread count, categories, priority, persistence
- Session 40: Settings Kits asset-backed membership editor — `kit_members` migration; Sunday Kits deployment uses saved membership
- Session 41: QR camera-assisted scan — `BarcodeDetector` capture + unique-code dedup
- Post-baseline: Matrix rain pointer tracking improvements; asset manager sign-in location locking; default location scope fix
