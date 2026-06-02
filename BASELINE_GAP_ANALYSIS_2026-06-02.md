# Baseline Gap Analysis

This compares `Assets App Baseline.md` against the actual working-tree implementation on 2026-06-02.

It is part of the active startup baseline set together with `Assets App Baseline.md` and `ACTUAL_BASELINE_2026-06-02.md`.

## Overall Summary

- Large parts of the product shape are already implemented.
- The platform-baseline contradiction has been resolved in the active baseline docs.
- Most top-level pages in the baseline exist in code.
- Many baseline workflows are implemented with live or mixed live/fallback behavior.
- Several areas remain partial, intentionally deferred, or narrower than the baseline wording suggests.
- The main documentation risk is now historical mixing: `IMPLEMENTATION_LOG_2026-06-02.md` still contains archived Vite and Expo planning/history and must not be read as current baseline truth.
- This file should only describe current intent-versus-implementation gaps for the Next.js web app in this repo.

## 1. Product Shape

### Match

- Baseline doc says the active app platform is `Next.js 16 + React 19 + Supabase`.
- Actual repo uses `Next 16.2.7 + React 19.2.4 + Supabase`.

- The app is a v2-style rebuild rather than the old route structure.
- Shared visual language, login flow, and a unified shell are already present.

### Historical only

- Old Vite and Expo/EAS notes remain in the archived implementation log.
- Those notes are historical context, not active requirements for this repo.

## 2. Roles

### Match

- Roles for `asset_manager`, `staff`, and `volunteer` are represented.
- An admin tier is represented.
- Route-level access restrictions broadly match the intended role model.
- Damage-lock behavior is present.

### Partial

- The document promises exact operational capabilities by role, but code only proves some of them.
- Some management permissions are implemented through route gating and write handlers, but not every baseline statement is fully verifiable from current UI code alone.

## 3. Locations

### Match

- Location-aware behavior is implemented.
- `Traveling` is treated as a workflow location in the operational model.
- Sunday Kits are represented as a specific workflow area.

### Partial

- The baseline document locks a final location list and semantic rules like which locations can run Sunday kits.
- The code reads locations live from Supabase and does not hardcode the final list in the frontend.

## 4. User Location Model

### Match

- Users have assigned location context in auth and location-scope state.
- Asset managers and volunteers are location constrained.
- Staff can browse broad inventory scope.

### Partial

- The full home-base change workflow, GPS suggestion flow, and destination-manager approval flow are not visible in the current frontend implementation.

## 5. Departments / Teams

### Match

- Departments exist as a first-class settings and asset-classification concept.
- Assets and inventory UI are department-aware.

## 6. Core Navigation

### Match

- Top-level pages in the baseline exist:
  - `Dashboard`
  - `Inventory`
  - `Check-out/In`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Settings`
- Shared shell exists.
- Navigation visibility is role-aware.

## 7. Page Structure Locked So Far

### Inventory

- Status: mostly matched
- Matched:
  - grouped catalog
  - group-first browsing
  - physical-unit drill-in
  - emphasis on availability/assignment/travel/damage counts
  - recent history preview
  - inline editing for allowed fields now exists for admin and asset-manager roles
  - asset detail now routes directly into compatible request, sign-out/in, permanent, stationed, return, and damage-review workflows

### My Assets

- Status: mostly matched
- Matched:
  - `Assigned`, `Pending`, `Damage` tabs
  - action-oriented assigned list
  - inline approval/decline for pending items
  - damage tab as active record plus authoring surface

### Requests

- Status: mostly matched
- Matched:
  - `Asset`, `Special`, `Returns`, `History` tabs
  - basket model
  - multi-item asset request selection
  - physical-unit selection
  - required fields for the main flows are represented
  - special request types include `Stationed Use` and `Permanent Reassignment`
  - returns support one shared request for multiple assets
  - one-basket-per-source-location is now treated as intentional baseline behavior
  - local per-user workflow drafts now autosave, restore, and support discard
  - when scope is `All locations`, the workflows now allow explicit source-location selection instead of blocking submission
  - source-location choice now constrains the active request items to that location
  - special-request asset compatibility is now enforced by workflow type
- Partial:
  - the workflow is intentionally constrained to one source location, but the product surface is still lighter than a deeply modeled basket-management system

### Approvals

- Status: mostly matched
- Matched:
  - required tabs exist
  - queue list plus review panel layout exists
  - queue search and status filtering exist
  - decisions are inline
  - return acceptance signs items into a selected final location
  - recipient reminders are now write-side handled from the queue
  - damage lock resolution supports `Available`, `Damaged`, and `Lost`
  - compatible queues now support bulk actions
- Partial:
  - recipient reminder behavior exists, but not every queue type supports the same bulk-action depth

### Check-out/In

- Status: partially matched
- Matched:
  - all 6 tabs exist
  - `Standard` is the default tab
  - sign-in/sign-out flows exist
  - permanent workflow exists
  - stationed workflow exists
  - Sunday Kits exists
  - returns monitor exists
  - QR/manual batch workflow exists
  - QR tab now supports browser camera-assisted capture where in-tab barcode detection is available
  - QR tab now supports `.txt` / `.csv` batch-file import into the same operational batch flow
  - stationed sign-in supports `Stationed`, `Available`, and `Damaged`
  - Sunday Kit deployments can now source real saved-kit membership when that schema is available
  - Sunday Kit returns support item-level resolution in the deployment ledger
- Partial:
  - camera scanning still depends on browser support for `BarcodeDetector` and camera permissions, so manual batch entry and batch-file import remain the fallback

### Settings

- Status: mostly matched
- Matched:
  - role-aware settings surface
  - tabs for users, roles, locations, departments, kits, consumables, reports, duplicates, and config
  - kits now support asset-backed membership editing
  - the baseline now explicitly matches the current live/write-side settings scope
  - reports now export from the live workspace as CSV, XLSX, and PDF
  - duplicates now include compare-and-resolve handling
  - QR export now includes filtered asset preview plus PDF generation
- Partial:
  - some settings sections are still operationally thinner than the full tab surface suggests
  - several tabs are operationally present but may not yet be fully complete end-to-end

## 8. Asset Lifecycle Rules

- Status: partial
- Matched:
  - status/state-aware operations are present
  - history surfaces exist
- Partial:
  - the full locked lifecycle rules, field-level mutability rules, and all asset-creation constraints are not fully expressed in the current frontend implementation

## 9. Special Assignment Types

- Status: mostly matched
- Matched:
  - permanent assignment workflow exists
  - stationed temporary-use workflow exists
- Partial:
  - some exact edge-case behaviors from the baseline are not fully provable from the current UI alone

## 10. Damage Lock Workflow

- Status: mostly matched
- Matched:
  - damage lock access state exists
  - dedicated `/damage-lock` route exists
  - damage cases can be resolved through approvals
- Constraint:
  - return handling and case signaling follow the current visible workflow and backend-surface availability rather than a broader standalone case-management subsystem

## 11. Approval Rules

- Status: partial
- Many approval paths exist in code.
- The full rule set from the document is broader than what can be confirmed from the current UI and handlers alone.

## 12. Transfer Rules

- Status: partial
- Cross-location and reassignment ideas are present in requests and operational flows.
- A clearly isolated transfer rules engine or transfer-dedicated UI is not evident as a separately complete surface.

## 13. Notifications Baseline

- Status: mostly matched
- The shell now has a persisted local notification center instead of a placeholder bell icon only.
- Categories, priority, unread state, mark-read controls, and local persistence are now user-visible.
- Live domain-specific generation now covers approvals, recipient follow-up, damage review, personal pending items, active damage incidents, request-history updates, return-intake monitoring, Sunday Kit deployment follow-up, and sign-in backlog cues.
- Shell refresh is wired through backend table subscriptions where those tables exist, with fallback behavior preserved where backend surfaces are incomplete.

## 14. Reports / Duplicates / Config

### Reports

- Status: mostly matched
- Report workspace and export helpers exist for CSV, XLSX, and PDF.

### Duplicates

- Status: mostly matched
- Duplicate comparison and resolution flows exist in settings.

### Config

- Status: mostly matched
- Config editing exists.
- QR export config and QR sheet generation exist.

### QR export baseline

- Status: mostly matched
- QR asset preview and PDF generation exist.
- Output constraints are represented in the UI and helper modules.

## 15. Remaining Cleanup Areas

- The archived implementation log still contains superseded platform planning and mixed historical checkpoints.
- The repo should keep a strict separation between:
  - baseline spec
  - actual current-state documentation
  - implementation changelog/checkpoints

## Ongoing Maintenance

1. Keep the three active documents aligned whenever workflow behavior changes: baseline intent, actual baseline, and gap analysis.
2. Preserve the implementation log as archive only and avoid copying its historical Vite/Expo notes back into active baseline docs.
3. Decide whether location-scoped request submission behavior is the intended final model or a temporary implementation constraint.
4. Decide whether any remaining settings sections need tighter baseline wording versus the currently broad product language.
5. Re-verify production build and route behavior when tab/query-state code changes, since those flows are now baseline-critical.

## Active Constraint Queue

The remaining items are now accepted implementation constraints rather than large missing baseline surfaces.

- `Notifications`
  Live feed generation and backend table-driven refresh are implemented in the shell, but the app still depends on fallback behavior where backend schema surfaces are incomplete.
- `Check-out/In > QR Scan`
  Camera-assisted scan behavior remains browser-capability dependent, with manual batch entry and batch-file import as the defined fallbacks.
- `Settings`
  Some tabs remain lighter than others, but the visible tab set and live/write-side handlers now define the intended baseline surface.
- `Role, lifecycle, transfer, and location rules`
  These are represented through the current route gating, location scoping, and workflow handlers rather than through a separate rules engine or additional standalone workflows. Requests now also enforce source-location consistency and special-request asset compatibility in the active UI.
