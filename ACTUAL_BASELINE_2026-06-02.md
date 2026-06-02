# Actual Baseline

This document describes the actual current application baseline in the working tree on 2026-06-02. It is based on the checked-out code, not on the planning language in `Assets App Baseline.md`.

It is part of the active startup baseline set together with `Assets App Baseline.md` and `BASELINE_GAP_ANALYSIS_2026-06-02.md`.

## Baseline Source

- Framework baseline is `Next 16.2.7`, `React 19.2.4`, and Supabase, as defined in `package.json`.
- Routing is Next App Router under `src/app`.
- Authentication and role gating are client-side and Supabase-backed.
- The working tree is dirty, so this baseline includes uncommitted local work that is currently present in source.
- This file is descriptive only. It documents the implementation that exists today and does not override the normative intent in `Assets App Baseline.md`.
- Do not pull platform assumptions from `IMPLEMENTATION_LOG_2026-06-02.md`; that file is archive-only.

## Ground Truth Files

- App shell and route protection: `src/components/app-shell.tsx`, `src/components/protected-app.tsx`
- Auth and access context: `src/contexts/auth-context.tsx`, `src/lib/auth.ts`
- Location scope: `src/contexts/location-scope-context.tsx`
- Supabase client: `src/lib/supabase/client.ts`
- Feature pages:
  - `src/app/(app)/dashboard/page.tsx`
  - `src/app/(app)/inventory/page.tsx`
  - `src/app/(app)/check-out-in/page.tsx`
  - `src/app/(app)/my-assets/page.tsx`
  - `src/app/(app)/requests/page.tsx`
  - `src/app/(app)/approvals/page.tsx`
  - `src/app/(app)/settings/page.tsx`
- Feature data/load and write-side logic:
  - `src/lib/dashboard.ts`
  - `src/lib/inventory.ts`
  - `src/lib/check-operations.ts`
  - `src/lib/my-assets.ts`
  - `src/lib/requests.ts`
  - `src/lib/approvals.ts`
  - `src/lib/settings.ts`
  - `src/lib/reports.ts`
  - `src/lib/qr-export.ts`
  - `src/lib/damage-lock.ts`

## Platform Shape

- `/` redirects to `/login`.
- Protected routes live inside the `(app)` route group.
- The app uses a shared shell with role-filtered navigation and location scoping.
- The shell now includes a persisted local notification center with unread count, categories, priority, mark-read, mark-all-read, and clear-all controls.
- Fonts, branding, and styling are custom and already wired in `src/app/layout.tsx` and `src/app/globals.css`.

## Auth and Access Model

- Supabase env vars are required for live auth:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- Supported roles in code:
  - `admin`
  - `main_admin`
  - `asset_manager`
  - `staff`
  - `volunteer`
- Access states in code:
  - `loading`
  - `approved`
  - `pending_approval`
  - `damage_locked`
  - `error`
  - `unconfigured`
- Protected routing behavior currently includes:
  - redirect to `/login` when signed out
  - redirect to `/approval-pending` when access is pending approval
  - redirect to `/damage-lock` when the user is under an active damage lock
  - redirect to `/dashboard` when a signed-in user hits a route their role cannot access
- Auth bootstrap now prefers `get_my_access_context`, then falls back to direct `profiles` + `user_roles` reads.
- If the legacy `is_approved` RPC is unavailable, auth now degrades to profile-and-role approval inference instead of treating startup access as a hard failure.

## Location Scope Model

- Admins and staff can select `All locations` or a specific location.
- Asset managers are locked to their assigned manager location.
- Volunteers are locked to their assigned location if one exists.
- Scope is persisted in `localStorage` per user.
- Scope drives read behavior across dashboard, inventory, requests, approvals, and related workspaces.

## Current Routes

- Public:
  - `/login`
  - `/approval-pending`
  - `/damage-lock`
- Protected:
  - `/dashboard`
  - `/inventory`
  - `/check-out-in`
  - `/my-assets`
  - `/requests`
  - `/approvals`
  - `/settings`

## Feature Status

### Dashboard

- Present and substantial.
- Loads a live aggregated workspace from multiple feature modules.
- Supports role-specific cards and lower feed panels.
- Uses `live`, `mixed`, or `fallback` source states.
- Handles partial backend/schema availability by degrading per data source.

### Inventory

- Present and substantial.
- Uses grouped catalog browsing with search and filters.
- Supports grouped cards and physical-unit drill-in.
- Shows asset detail and recent history preview.
- Asset detail now supports inline editing of the allowed fields (`Name`, `Tag`, and `Department / Team`) for admin and asset-manager roles.
- Asset detail also exposes direct workflow-routing actions into compatible request, operational, return, reassignment, and damage-review surfaces for the selected unit.
- Live data comes from `assets`, `locations`, `departments`, `profiles`, and `asset_history`.
- Falls back to a preview dataset when live schema access fails.

### Check-out/In

- Present and substantial.
- Tabs implemented:
  - `Standard`
  - `Permanent`
  - `Stationed`
  - `Sunday Kits`
  - `Returns`
  - `QR Scan`
- Includes write-side handlers for:
  - standard sign out
  - standard sign in
  - permanent assignment
  - stationed checkout/check-in
  - Sunday kit deployment and return recording
  - QR/manual batch resolution and execution
- Stationed check-in supports `Stationed`, `Available`, and `Damaged` outcomes.
- Sunday kit deployments now use saved kit membership when the `kit_members` schema is available, with count-based placeholder deployment fallback when it is not.
- Sunday kit returns support item-level resolution in the deployment ledger, with count-based fallback when the newer deployment-item schema is unavailable.
- The QR tab now supports browser-level camera-assisted QR capture when `BarcodeDetector` and camera permissions are available, while preserving manual batch input and `.txt` / `.csv` batch-file import as compatibility fallbacks.
- Uses fallback data when live schema surfaces are unavailable.

### My Assets

- Present and substantial.
- Tabs implemented:
  - `Assigned`
  - `Pending`
  - `Damage`
- Live behaviors currently include:
  - viewing assigned assets
  - responding to pending assignments
  - responding to pending handovers
  - starting return requests from assigned assets
  - submitting handover requests
  - submitting a damage incident from the `Damage` tab or assigned-asset actions
  - following active damage cases into `/damage-lock`

### Requests

- Present and substantial.
- Tabs implemented:
  - `Asset`
  - `Special`
  - `Returns`
  - `History`
- Live behaviors currently include:
  - building a multi-item request basket
  - submitting asset requests
  - submitting special requests
  - submitting return requests
  - reviewing request history
- The current request model intentionally resolves each submitted basket to one explicit source location.
- `Asset`, `Special`, and `Returns` now autosave one local draft per workflow per user, restore on return to the workflow tab, and support explicit discard.
- When scope is `All locations`, `Asset`, `Special`, and `Returns` now expose a source-location picker so the workflow can still submit under the one-basket, one-source-location rule.
- Selected request items are now constrained to the chosen source location in the active workflow.
- `Special` now enforces workflow-compatible target assets:
  - `Stationed Use` uses stationed assets only
  - `Permanent Reassignment` uses permanent assets only

### Approvals

- Present and substantial.
- Tabs implemented:
  - `Recipient`
  - `Asset Requests`
  - `Special Requests`
  - `Returns`
  - `Damage Locks`
- Live behaviors currently include:
  - reviewing approval queue items
  - approving/declining/requesting changes
  - accepting returns into a selected final location
  - sending recipient reminders
  - resolving damage cases to `Available`, `Damaged`, or `Lost`
- Queue review now also includes search, status filtering, URL-addressable tab/item state, and multi-select bulk actions with a shared bulk note.
- Compatible queues support bulk execution, including bulk return acceptance when one shared final sign-in location is intentionally applied to the selected return set.
- Page follows queue-list plus review-panel structure.

### Settings

- Present and substantial.
- Tabs implemented in code and visibility-gated by role:
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
- Live/write-side behaviors currently include selected settings management for:
  - profile updates
  - user updates
  - locations
  - departments
  - kit lifecycle and asset-backed membership editing
  - consumables
  - config saves
  - duplicate comparison and resolution
  - report export to CSV, XLSX, and PDF
  - QR export asset preview, filtering, and PDF generation

## Backend Shape Visible From Repo

- The repo contains Supabase migrations under `supabase/migrations`.
- Migration names indicate live work for:
  - return request submission
  - special request submission
  - permanent assignment
  - stationed workflows
  - Sunday kit deployments
  - settings writes
  - settings schema for consumables/config/kits/users
  - asset-backed saved-kit membership

## Fallback Strategy

- A consistent pattern exists across feature modules:
  - attempt live Supabase reads/writes
  - catch missing-schema or missing-function failures
  - fall back to preview data or mixed-source UI
  - surface warnings in-page
- Auth and access bootstrap now follow the same pattern by degrading through direct table reads when the newer access RPCs are unavailable.
- This is an intentional part of the current baseline, not an edge case.

## Important Baseline Truths

- The repo is not a fresh scaffold anymore. It already contains a broad v2 implementation.
- The implementation baseline is much closer to a live Next web app than to an abstract planning document.
- `Assets App Baseline.md` is the active intent document for this repo and now aligns with the current web-platform direction.
- `IMPLEMENTATION_LOG_2026-06-02.md` still contains archived Vite and Expo planning/history and should not be treated as current platform truth.

## Current Known Incomplete Areas

This section now tracks accepted implementation constraints rather than large missing baseline surfaces.

- The current working tree now passes `npm run build` on `Next 16.2.7`.
- Notification refresh is now live from the shell through backend table subscriptions plus cross-workspace feed generation, while still relying on fallback behavior where backend surfaces are incomplete.
- Camera-assisted QR capture still depends on browser support for `BarcodeDetector` and camera permissions, with manual batch entry and batch-file import preserved as the compatibility fallback.
- Role capability, lifecycle, transfer, and location rules are expressed through the current route gating, scope locking, and workflow handlers that exist in this repo rather than through a separate standalone rules engine.
- Some settings tabs remain lighter than others, but the current visible tabs and write-side handlers define the active baseline scope.
