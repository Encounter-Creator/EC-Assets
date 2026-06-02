# Assets App Baseline

This is the active concise baseline spec for the Assets App as of 2026-06-02.

It replaces the previous mixed document that had baseline decisions, implementation checkpoints, and session notes all in one file.

## Startup Baseline

Use this file as the startup baseline for new work in this repo.

Startup read order:

1. `Assets App Baseline.md`
2. `ACTUAL_BASELINE_2026-06-02.md`
3. `BASELINE_GAP_ANALYSIS_2026-06-02.md`

Startup rules:

- Start from the current web-app truth only: `Next.js 16 + React 19 + Supabase`.
- Treat `src/app` and the current working tree as the active implementation target.
- Use `Assets App Baseline.md` for product intent, `ACTUAL_BASELINE_2026-06-02.md` for code-derived reality, and `BASELINE_GAP_ANALYSIS_2026-06-02.md` for remaining differences.
- Do not use `IMPLEMENTATION_LOG_2026-06-02.md` as startup truth. It is archive-only and intentionally contains superseded Vite and Expo history.

Startup Supabase target:

- Remote Supabase project URL: `https://qeelerohenfgphioizye.supabase.co`
- Remote Supabase project ref: `qeelerohenfgphioizye`
- Use the linked Supabase CLI project when pushing migrations or running linked SQL.
- Do not store Supabase personal access tokens, service-role keys, database passwords, or other secrets in baseline documents or tracked repo files.

## Related Documents

- Current code-derived state: `ACTUAL_BASELINE_2026-06-02.md`
- Baseline vs implementation comparison: `BASELINE_GAP_ANALYSIS_2026-06-02.md`
- Archived implementation log and old mixed baseline: `IMPLEMENTATION_LOG_2026-06-02.md`

Document roles:

- `Assets App Baseline.md` is the normative product and workflow baseline for the current web app in this repo.
- `ACTUAL_BASELINE_2026-06-02.md` describes the current working-tree implementation, including uncommitted local changes.
- `BASELINE_GAP_ANALYSIS_2026-06-02.md` only tracks remaining differences between baseline intent and the current implementation.
- `IMPLEMENTATION_LOG_2026-06-02.md` is historical context only. It contains superseded planning notes from earlier Vite and Expo directions and must not be used as current platform truth.

## 1. Platform Direction

- The active app platform is `Next.js 16 + React 19 + Supabase`.
- Routing uses the App Router under `src/app`.
- This baseline is for the current web app in this repo, not for a separate Vite or Expo implementation.

## 2. Product Shape

- This is a v2 rebuild of the Assets App.
- The app keeps the shared visual language, login-led entry, mobile-aware shell, and role-aware navigation.
- Wedding-specific legacy features are out of scope.
- The implementation should prefer a smaller set of strong operational workflows over sprawling route complexity.

## 3. Roles

Supported application roles:

- `main_admin`
- `admin`
- `asset_manager`
- `staff`
- `volunteer`

Role intent:

- `main_admin` and `admin` have full cross-location administrative and operational access.
- `asset_manager` is operationally tied to one assigned location.
- `staff` can browse inventory and use request workflows.
- `volunteer` is limited to their own assigned assets and related actions.
- Role capability detail is defined by the current route gating, location locking, and workflow write handlers in the active web app rather than by a separate unpublished rules matrix.

## 4. Access and Gating

- Signed-out users are redirected to `Login`.
- Approved users enter the protected app shell.
- Users pending approval are redirected to `Approval Pending`.
- Users under an active damage lock are redirected to `Damage Lock`.
- Route access remains role-aware.

## 5. Location Model

- Location scope is a first-class app concept.
- `admin` and `staff` can work across all locations or select one location scope.
- `asset_manager` is locked to their assigned manager location.
- `volunteer` is locked to their assigned location when applicable.
- `Traveling` remains a workflow location, not a user home base.
- Sunday Kit workflows are location-aware and remain distinct from standard asset operations.
- Home-base change, GPS suggestion, and destination-manager approval flows are out of the current baseline unless they are explicitly added as user-visible workflows in this repo.

## 6. Core Navigation

Top-level protected pages:

- `Dashboard`
- `Inventory`
- `Check-out/In`
- `My Assets`
- `Requests`
- `Approvals`
- `Settings`

Supporting non-shell routes:

- `Login`
- `Approval Pending`
- `Damage Lock`

## 7. Page Baselines

### Dashboard

- Role-aware operational overview.
- Uses live, mixed, or fallback data depending on backend availability.

### Inventory

- Grouped catalog first.
- Drill into physical units.
- Prioritize status, location, holder, and recent history.
- Allowed asset-detail edits currently cover `Name`, `Tag`, and `Department / Team` for admin and asset-manager roles.
- Inventory action surfaces route operators into the compatible request, check-out/in, return, reassignment, or damage-review workflow for the selected unit.

### Check-out/In

- Manager/admin operations workspace.
- Tabs:
  - `Standard`
  - `Permanent`
  - `Stationed`
  - `Sunday Kits`
  - `Returns`
  - `QR Scan`

### My Assets

- Personal action workspace.
- Tabs:
  - `Assigned`
  - `Pending`
  - `Damage`
- `Damage` supports incident authoring plus active-case follow-through into the dedicated damage-lock workflow.

### Requests

- Guided request workspace.
- Tabs:
  - `Asset`
  - `Special`
  - `Returns`
  - `History`
- One request basket is intentionally limited to one workflow type and one explicit source location.
- `Asset`, `Special`, and `Returns` keep one local draft per workflow per user with restore and discard behavior.
- When working from `All locations`, each request workflow must still resolve to one explicit source location before submit.
- Source-location selection now constrains live requestable items to that location for request submission.
- `Special` enforces asset-type compatibility by workflow:
  - `Stationed Use` only accepts stationed assets
  - `Permanent Reassignment` only accepts permanent assets

### Approvals

- Queue plus review-panel workflow.
- Tabs:
  - `Recipient`
  - `Asset Requests`
  - `Special Requests`
  - `Returns`
  - `Damage Locks`
- Compatible queues support bulk actions, including return acceptance when one shared final sign-in location is intentionally applied to the selected return set.
- Recipient reminders and damage-lock terminal resolutions are handled from this workspace where the active backend surface supports them.
- Bulk behavior is intentionally queue-specific rather than universal across every approval type.

### Settings

- Role-aware administrative and operational configuration surface.
- Tabs may include:
  - `Profile`
  - `Users`
  - `Roles`
  - `Locations`
  - `Departments`
  - `Kits`
  - `Consumables`
  - `Reports`
  - `Duplicates`
  - `Config`
- `Kits` includes saved-kit definition lifecycle plus asset-backed membership editing.
- The current baseline expects substantial live behavior for:
  - profile updates
  - user updates
  - locations
  - departments
  - kit lifecycle and membership editing
  - consumables
  - config saves
  - duplicate comparison and resolution
  - report export
  - QR export preview, filtering, and PDF generation

## 8. Workflow Rules

- Standard asset operations remain centered on sign-out and sign-in.
- Permanent assignment remains a distinct workflow from standard issue/return.
- Stationed assets remain a distinct workflow from standard issue/return.
- Stationed return-to-site supports `Stationed`, `Available`, and `Damaged` outcomes.
- Sunday Kits remain a kit-level workflow with operational visibility.
- Saved kit definitions can now store explicit asset membership in `Settings > Kits`.
- Sunday Kit returns resolve deployment items individually where the live deployment-item ledger is available.
- Sunday Kit deployments should use saved kit membership when the membership schema is available, with legacy count-based fallback only as a degradation path.
- `QR Scan` supports camera-assisted capture when the browser exposes in-tab barcode detection, while keeping manual batch entry and batch-file import as fallback paths.
- Return requests are user-initiated and manager/admin-resolved.
- Damage lock remains a real access state, not just a status badge.
- Asset lifecycle rules in the current baseline are the rules expressed by status-aware workflow entry points, route gating, and write-side handlers in the active app. A separate standalone lifecycle engine is not part of the current baseline.
- Transfer and reassignment behavior is represented through the implemented request, permanent, stationed, return, and approval workflows rather than through a separate transfer-only workspace.

## 9. Data and Degradation Model

- Live Supabase-backed behavior is the default target.
- When backend schema surfaces are incomplete or missing, the UI may degrade to mixed or fallback behavior.
- Fallback handling is an intentional part of the current baseline until all backend surfaces are fully stable.

## 10. Notification Baseline

- The shell notification center supports:
  - unread count
  - categories
  - priority
  - mark read
  - mark all read
  - clear all
  - local persistence per user
- Live notification generation covers approvals, recipient follow-up, damage review, personal pending items, active damage incidents, request-history updates, return-intake monitoring, Sunday Kit deployment follow-up, and sign-in backlog cues.
- Backend event routing remains follow-up work.

## 11. Current Constraints

- The short baseline spec is normative.
- `ACTUAL_BASELINE_2026-06-02.md` is descriptive current-state documentation.
- `BASELINE_GAP_ANALYSIS_2026-06-02.md` tracks where implementation diverges from intent.
- `IMPLEMENTATION_LOG_2026-06-02.md` is historical context, not the active spec, and may intentionally describe superseded stacks or exploratory directions.

## 12. Active Constraints

- The baseline spec should stay aligned with the actual Next.js app and its current write-side behavior.
- Browser-dependent QR camera support is an accepted compatibility constraint; manual batch entry and batch-file import are the required fallback paths.
- Notification behavior now includes live domain refresh from backend table changes plus local persistence, while still tolerating missing backend surfaces through fallback handling.
- Some settings tabs remain intentionally lighter operationally than others, but the current tab set and live/write-side scope define the active baseline.
