# Implementation Log Archive

Archive notice:

- This file is historical implementation context, not the active baseline for the current repo state.
- It intentionally contains superseded planning and checkpoint notes, including earlier `React + Vite` and `Expo` directions that are no longer the current platform truth.
- For current truth, use `Assets App Baseline.md` for normative intent and `ACTUAL_BASELINE_2026-06-02.md` for the code-derived implementation baseline.

This archive preserves earlier working-baseline notes, implementation checkpoints, and planning decisions captured during the rebuild.

## 1. Product Shape
- Rebuild the app as a fresh v2 in the same `React + Vite + Supabase` stack.
- Reuse the current login page, mobile logo, and general visual style.
- Do not carry over the current route complexity, workflow sprawl, or wedding features.
- Wedding features are removed from the rebuild entirely.

### Deployment baseline
- Mobile deployment target is Expo EAS project ID `9d29bb3a-56c2-440b-8165-354b270ca275`.
- Expected init command once the Expo app project exists:
  - `npx eas-cli@latest init --id 9d29bb3a-56c2-440b-8165-354b270ca275`
- This command must be run from inside the actual Expo app directory after the app scaffold exists.

## 2. Roles
### `admin`
- Full operational access across all locations.
- Can manage users, roles, settings, reports, approvals, returns, transfers, and assets.
- Can process Office workflows.
- Can resolve damage workflows.
- Can approve cross-location transfers.

### `asset_manager`
- Locked to exactly one location.
- Can operate only within their assigned location.
- Can process sign-outs, sign-ins, kits, approvals, and consumables for their location.
- Can create assets for their location.
- Can trigger damage-lock workflows.
- Can resolve damage workflows.
- Can request cross-location transfers, but cannot approve them.

Allowed asset edits after creation:
- Can change `name`
- Can change `tag`
- Can change `department/team`
- Cannot change `serial number`
- Cannot edit main notes/description
- After resolving a damage case, a scoped one-time condition note field becomes available on the asset for the resolving manager. This is a post-resolution condition record only and does not grant general notes/description editing rights.

### `staff`
- Can browse the full inventory catalog across all locations.
- Can request any asset on the system regardless of location through request workflows.
- Can request:
  - normal assets
  - saved kits
  - temporary use of stationed items
  - reassignment of permanently assigned items
- Can approve or decline assignments sent to them.
- Can submit return requests.
- Can be locked if an assigned asset is signed in as damaged.

Page access:
- `Dashboard`
- `Inventory`
- `My Assets`
- `Requests`

### `volunteer`
- Cannot browse the general inventory registry.
- Can see only assets assigned to them.
- Can approve or decline assignments sent to them.
- Can submit return requests for assigned items.
- Can be locked if an assigned asset is signed in as damaged.

Page access:
- `Dashboard`
- `My Assets`

## 3. Locations
Final location list:
- `Centurion`
- `Krugersdorp`
- `Lanseria`
- `Office`
- `Traveling`

Removed from locations:
- `Prophet`
  It is a department/team, not a location.

### Location meaning
- `Centurion`, `Krugersdorp`, `Lanseria`: main operating sites
- `Office`: holding location
- `Traveling`: temporary movement location for assets

### `Office`
- Can be a user home base.
- Is admin-managed.
- Uses a shared admin queue.
- Does not use saved kits.
- Assets in Office can be signed out by admin and later signed into a normal site like Centurion.

### `Traveling`
- Temporary movement location only.
- Never a user home base.

### Sunday kits
Only these locations can run saved Sunday kit workflows:
- `Centurion`
- `Krugersdorp`
- `Lanseria`

## 4. User Location Model
- Each user has exactly one `home base`.
- No separate `current working location`.
- GPS/location prompt is opt-in precise.
- GPS prompt only suggests a permanent home-base change request.
- Home-base change requires request then approval.
- Approval goes to the destination location's manager or an admin.
- Users can only receive assets from their approved home base.
- Staff can browse the full inventory catalog and request any asset on the system regardless of location.

## 5. Departments / Teams
- Departments/teams are grouping labels, not locations.
- Every asset must have a department/team.
- Users may optionally have a department/team.
- `Prophet` belongs in this model.

## 6. Core Navigation
Top-level pages:
- `Dashboard`
- `Inventory`
- `Check-out/In`
- `My Assets`
- `Requests`
- `Approvals`
- `Settings`

### Page access intent
- Shared shell for all roles
- Role-specific dashboard
- `Approvals` full page only for admin and managers
- `Check-out/In` is a manager/admin operational workspace
- `Settings` is role-aware

## 7. Page Structure Locked So Far
### `Inventory`
- Main structure: grouped catalog
- Group by item name/type first
- Open group into physical units with tag/serial detail
- Grouped cards show name/type, operational counts, and location spread
- Grouped count emphasis is `Available`, `Assigned`, `Traveling`, and `Damaged`
- Opening a grouped item first opens the unit list drawer/panel
- Unit rows prioritize `Tag`, `Name`, `Serial`, `Status`, `Current Location`, and `Holder`
- Unit-row context menus contain view plus core allowed operations
- Asset detail leads with current state and allowed actions
- Allowed field edits happen in an inline edit section
- Asset detail shows a recent history preview with access to full history

### `My Assets`
Tabs:
- `Assigned`
- `Pending`
- `Damage`

Tab intent:
- `Assigned`: action-oriented list of currently assigned items
- `Pending`: inline approval/decline review surface for incoming assignments
- `Damage`: user-facing damage history/record view only

### `Requests`
Tabs:
- `Asset`
- `Special`
- `Returns`
- `History`

Locked behavior:
- Uses a guided step flow for request creation
- Supports a multi-item request basket
- One basket is limited to one workflow type
- One basket is limited to one source location
- One basket is one shared sign-out request with shared details across all items
- `Returns` is the unified user return workspace for both creating and tracking return requests
- `Asset` starts with browse/search and basket building
- `Asset` uses multi-select into one basket
- `Asset` requests target specific physical units, not generic item groups
- `Asset` required basket fields are `Need Date`, `Reason`, `Duration`, and `Event/Use Context`
- `Special` uses one dynamic form
- `Special` starts with special request type selection
- `Special` v1 types are `Stationed Use` and `Permanent Reassignment`
- `Special` picks the target asset before the rest of the request details
- `Returns` starts by selecting from the user's assigned assets
- `Returns` supports one shared return request for multiple assets
- `Returns` required fields are `Return Date`, `Preferred Return Location`, and `Note`

### `Approvals`
Tabs:
- `Recipient`
- `Asset Requests`
- `Special Requests`
- `Returns`
- `Damage Locks`

Locked behavior:
- Main layout is queue list plus review panel
- Decisions happen inline inside the review panel
- Review panel should be decision-complete in most cases
- Bulk actions are allowed for simple/compatible queues
- `Recipient` supports bulk reminders only, not bulk approve/decline overrides

### Return surface handoff
- `Approvals > Returns` is the decision surface for user-submitted return requests.
- `Accept Return` in `Approvals > Returns` is the terminal action and auto-signs items back in immediately using the approver-selected final sign-in location.
- `Check-out/In > Returns` is a read-only monitoring surface showing pending and completed returns for awareness only.
- Direct intake through `Check-out/In > Standard` is only for unplanned walk-up returns where no prior return request exists.

### `Check-out/In`
Will exist as a top-level manager/admin workspace.
Locked intent:
- contains all asset operations
- includes 6 tabs
- tabs are `Standard`, `Permanent`, `Stationed`, `Sunday Kits`, `Returns`, and `QR Scan`
- `Standard` is the default tab
- `Standard` is optimized for fast operational processing

Tab behavior locked so far:
- `Standard` uses a two-mode workspace: `Sign Out` and `Sign In`
- `Standard > Sign Out` is asset-first
- `Standard > Sign In` is assigned-asset-first
- `Standard` allows direct intake without a prior return request
- `Standard` requires the sign-in outcome to be chosen as `Available` or `Damaged`
- `Standard` supports multi-item sign-out and sign-in where context matches
- `Permanent` is a dedicated permanent-assignment workspace
- `Permanent` allows direct permanent issue without a prior request
- `Permanent` reassignment starts from the assigned asset
- `Permanent` sign-in requires an explicit return location
- `Stationed` is a site resting-state model, not an always-fixed active state
- `Stationed` allows direct temporary-use issue without a prior request
- `Stationed` temporary use moves the asset to `Traveling` and assigns a responsible user
- `Stationed` sign-in supports `Stationed`, `Available`, and `Damaged` outcomes
- If `Damaged` is selected on a stationed sign-in, the responsible user from the temporary-use assignment enters the standard damage lock workflow
- `Sunday Kits` is a saved-kit deployment workspace
- `Sunday Kits` operates at kit level with item-level visibility
- `Sunday Kits` supports partial returns
- Partial Sunday kit returns resolve each returned item individually as `Available` or `Damaged`
- Unreturned kit items remain individually `Assigned` to the responsible user from deployment
- Kit group tracking ends at deployment; after that, individual asset states apply
- The kit definition in `Settings > Kits` carries no live deployment status
- `QR Scan` is an in-tab bulk operations surface
- `QR Scan` starts with choosing `Sign In` or `Sign Out`
- `QR Scan` supports scanning multiple items into one active batch
- `QR Scan` keeps each batch in one mode and one compatible workflow context

### `Settings`
Role-aware tabs:
- `Users`
- `Roles`
- `Locations`
- `Departments`
- `Kits`
- `Consumables`
- `Reports`
- `Duplicates`
- `Config`

Settings scope:
- admins see all allowed tabs
- managers have limited operational settings access only

Locked behavior:
- `Users`: admins manage full user records; managers can edit operational profile fields for users in their own location only
- `Users` uses one shared record structure with split admin vs manager edit sets
- `Roles`: fixed system roles in v1; no custom role or permission editor
- `Locations`: admins can add, disable, or retire locations in v1
- `Departments`: admin-managed list with create, rename, merge, archive, and organization controls
- `Kits`: saved kit builder for creating, editing, and retiring kit definitions
- `Consumables`: consumable catalog plus stock rules
- `Reports`: filter + export workspace
- `Duplicates`: admin review queue with compare-and-merge tools
- `Config`: business rules plus system toggles, including QR export tooling

## 8. Asset Lifecycle Rules
### Asset creation
- Asset managers and admins can create assets.
- Same-location duplicate tag conflicts block save.
- Serial number must exist.
- If missing, save as `NA`.

### Tag rule
- Same visible tag may exist in multiple locations.
- Tag uniqueness is enforced by location, not globally.
- Same-location duplicate tags are not allowed.

### Asset history
Must track at least:
- create
- edit
- sign-out
- approval
- sign-in
- transfer
- damage
- consumable attach/detach
- resolution actions

## 9. Special Assignment Types
### Permanent sign-out
- Permanent sign-outs are treated as `Traveling`.
- Asset active/current location becomes `Traveling`.
- Still shown as a separate `permanent` status.
- Return location is chosen by manager/admin at sign-in.
- Staff can request reassignment of items already permanently assigned elsewhere.
- Permanent reassignment request goes to:
  - current holder as the blocking approver
  - admin as override authority
- The asset manager at the current holder's location is notified but has no approval role.
- If the current holder declines, the request moves to `Declined` unless admin explicitly overrides.
- If the current holder does not respond within the reminder escalation window, the request escalates to admin for a forced decision.
- The reassigned asset remains `Traveling` throughout reassignment; no separate location-change step is required.

### Stationed sign-out
- Stationed is a site resting state, not an always-fixed active state.
- During temporary use, the asset moves to `Traveling`.
- A responsible user is required during temporary use.
- Sign-in is handled by the manager/admin for that site or receiving site.
- Staff can request temporary use of a stationed item.
- That request goes to the site manager/admin.
- Requests against stationed items are allowed with warning before submit.

## 10. Damage Lock Workflow
This is a hard workflow requirement.

### Trigger
- When a manager/admin signs an assigned asset back in as `Damaged`, the system locks the responsible user.

### Lock behavior
- User app is locked after the damaged sign-in event.
- Locked user cannot:
  - use normal app areas
  - receive assets
  - approve new incoming assignments
  - continue normal workflows
- Locked user sees a dedicated blocking screen with the lock reason and affected asset context.
- User gets immediate notification that the app is locked.

### Notifications on lock
Immediate notifications go to:
- locked user
- responsible manager
- admin

Responsible manager routing:
- The responsible manager is the active asset manager at the locked user's home-base location.
- If no active asset manager exists at that location, notifications route to admins only.
- If the user is in an `Unassigned` home-base state, notifications route to admins only.
- Manager-routing fallback does not affect the user's ability to submit the damage form and auto-unlock.

### Unlock path
- Damaged return creates a temporary under-review damage case.
- Locked user must complete a damage form from the dedicated lock screen.
- Damage form submission auto-unlocks the user.
- Admin or manager reviews the submitted case from `Approvals > Damage Locks`.
- Admin or manager can resolve the asset to:
  - `Available`
  - `Damaged`
  - `Lost`

### Status model
- Damaged workflow uses a real temporary inactive/under-review state.
- `Lost` should be treated as part of the damage flow.
- `Quarantine` is removed from v1.
- Core asset states are `Available`, `Assigned`, `Traveling`, `Stationed`, and `Damaged`.
- `Lost` is a damage-workflow outcome, not a core steady-state asset status.
- `Unassigned` is a temporary holding/intake state for admin cleanup, not a normal steady-state asset status.

### Return handling
- Normal sign-in outcomes are:
  - `Available`
  - `Damaged`

## 11. Approval Rules
- All assigned items require recipient approval.
- Users can `approve` or `decline`.
- Decline reason is required.
- Full approvals page is for admin and asset managers.
- Manager or admin can approve normal operational requests.
- User/role/access management is admin only.

## 12. Transfer Rules
- Cross-location transfer:
  - manager requests
  - admin approves

## 13. Notifications Baseline
### Channels
- `In-app + push` are required in v1
- Email is not a general notification channel
- Email, if used, is backup-only for damage-related escalation

### UI model
- Notification bell + inbox
- Also keep workflow tasks in their main pages

### Categories
- `Approvals`
- `Requests`
- `Damage`
- `Returns`

### Priority
Urgent push categories:
- locks
- approvals
- requests

### Controls
- Critical notifications cannot be turned off
- Non-critical categories can be managed
- Non-critical pushes can respect quiet hours

### Persistence
- Action-required notifications stay visible until resolved

### Reminder model
- Escalating reminders
- Short ladder:
  immediate, later same day, then daily until resolved

### Event routing locked so far
- Assignment sent to recipient: user gets in-app + push
- New manager/admin queue item: manager/admin gets in-app + push
- Damage lock: user + manager + admin
- Location retirement: affected users + admins + managers
- Permanent reassignment request: current holder + admin
- Stationed-use request: site manager/admin
- Return request: manager + admin
- Assignment approved: requester/manager
- Assignment declined: requester + admin
- Damage form submitted: manager + admin
- Damage resolution completed: user + resolving ops side

## 14. Reports / Duplicates / Config
### `Reports`
v1 focus:
- damage reports
- asset history
- accountability history
- filtered report views with direct export
- export formats: `CSV`, `XLSX`, and `PDF`

### `Duplicates`
v1 scope:
- review suspected duplicates
- merge duplicates
- admin review queue with compare-and-merge flow
- admin chooses the surviving asset
- surviving asset keeps its own fields/details as source of truth
- active operational links move to the surviving asset where possible
- combined history is preserved on the surviving asset
- losing record becomes a merged tombstone
- merges are reviewed one pair at a time

### `Config`
v1 scope:
- business-rule settings plus technical/admin switches
- home for bulk QR export tooling

### QR export baseline
- Bulk QR export lives in `Settings > Config`
- Filter assets by created-date range plus standard filters before generating sheets
- Output is print-ready `A4 PDF`
- Use a `5mm` outer page border
- Pack many QR codes per page; do not generate one QR per page
- Each QR label is `20mm x 20mm`
- QR labels are sorted by `tag`
- Each printed label shows the QR plus small visible tag text
- Each QR encodes the raw backend asset `UUID`
- Use outer border only; no internal cut-line grid

## 15. Remaining Cleanup Areas
These are the remaining cleanup items before implementation detail work:
- exact final field lists on every page
- final validation placement/details where not already locked
- final status wording cleanup by view where needed
- notification timing details by role if needed
- any remaining backend workflow edge cases discovered during implementation planning

## 16. Q/A Log Snapshot
Locked decisions captured in this baseline:
- Rebuild fresh v2, reuse style/login/logo
- Remove wedding features
- Keep 4 roles
- Final locations are 5
- Prophet is a department/team
- Office is holding/admin-managed
- Traveling is temporary asset location
- Main 3 sites get Sunday kits
- Staff browse the full inventory catalog and can request any asset on the system regardless of location
- Volunteers do not browse inventory
- Permanent assignments move to Traveling
- Stationed is a resting state and can move to Traveling during temporary use
- Damage lock workflow is mandatory
- Damage report is completed by the locked user from a dedicated lock-screen form
- Bell + inbox notification model
- Push required in v1
- Reports export as `CSV`, `XLSX`, and `PDF`
- Bulk QR sheet export is part of v1
- No helper text is used in the app UI
- Final baseline should be very detailed once all major systems are locked

## 17. Current Conversation Checkpoint
Locked so far in the live page-by-page pass:
- `Dashboard` is an action hub.
- Admin dashboard top cards are `Approvals`, `Damage Locks`, `Transfers`, and `Blocked Workflows`.
- Asset manager dashboard top cards are `Approvals`, `Returns`, `Sign-Outs`, and `Damage Tasks`.
- Staff and volunteer dashboard top cards are `Pending Approvals`, `My Assigned Items`, `Return Requests`, and `Damage Actions`.
- Dashboard lower sections are operational-feed based, not reporting-heavy.
- Dashboard lower sections use `Recent + Open + Snapshot` card types.
- Dashboard lower cards show a `5` row preview cap and are navigation-only.
- Dashboard card rows stay role-specific and lead with action cards before summaries.
- Admin lower cards are `Recent Asset Activity`, `Recent Requests`, `Recent Returns`, `Recent Damage Reports`, and `Location Snapshot`.
- Asset manager lower cards are `Recent Asset Activity`, `Open Requests Snapshot`, `Returns in Progress`, `Damage Workflow Updates`, and `Location Inventory Snapshot`.
- Staff lower cards are `My Recent Requests`, `My Return Requests`, `My Pending Items`, and `Home Base Inventory Highlights`.
- Volunteer lower cards are `My Pending Items`, `My Assigned Assets`, `My Return Requests`, and `My Damage Actions`.
- `Inventory` is a grouped catalog first.
- `Inventory` top-level filters are core filters only, with deeper detail after drill-in.
- Grouped units open into physical units with row context menus and a dedicated asset detail page.
- Asset detail is the primary action surface after drill-in.
- `My Assets` starts on `Assigned` and uses `Assigned`, `Pending`, and `Damage` tabs.
- `My Assets` is action-oriented overall.
- `Assigned` allows request actions directly from the list.
- `Pending` uses inline review cards with multi-select, bulk approve, and bulk decline.
- Bulk decline in `Pending` uses one shared required reason per action.
- `Damage` is history-only for users; it does not host a user damage-report workflow.
- `Requests` uses `Asset`, `Special`, `Returns`, and `History` tabs.
- `Requests` uses a guided step flow with a multi-item basket.
- One request basket is limited to one workflow type and one source location.
- One basket is one shared sign-out request with shared details across all items.
- `Requests > Returns` is the unified return workspace.
- `Approvals` uses `Recipient`, `Asset Requests`, `Special Requests`, `Returns`, and `Damage Locks`.
- `Approvals` uses a queue list + review panel layout.
- `Approvals` decisions happen inline in the review panel.
- Review panels are decision-complete in most cases.
- Bulk actions are allowed for simple queues, with `Recipient` limited to bulk reminders only.
- `Approvals` queue rows are decision-summary rows.
- `Asset Requests` rows show requester, assets, need date, location, and status.
- `Special Requests` rows show requester, type, asset, location, and status.
- `Returns` rows show user, asset count, return date, return location, and status.
- `Recipient` rows show recipient, asset, assigned by, sent date, and status.
- `Damage Locks` rows show user, asset, lock date, submission status, and case status.
- `Asset Requests` panels show the request brief plus asset/requester context.
- `Special Requests` panels show workflow-specific form details plus asset context.
- `Returns` panels show return request details plus final sign-in decision context.
- `Recipient` panels show assignment context plus response state.
- `Damage Locks` panels show user form, asset context, and resolution actions.
- `Asset Requests` inline actions are `Approve`, `Decline`, and `Request Changes`.
- `Special Requests` inline actions are `Approve`, `Decline`, and `Request Changes`.
- `Returns` inline actions are `Accept Return` and `Decline`.
- `Check-out/In` uses `Standard`, `Permanent`, `Stationed`, `Sunday Kits`, `Returns`, and `QR Scan`.
- `Check-out/In` is admin and manager only, with `Standard` as the default tab.
- `Check-out/In > Standard` is optimized for fast operational processing.
- `Standard` uses `Sign Out` and `Sign In` modes and supports multi-item operations.
- `Permanent` is a dedicated permanent-assignment workspace with direct issue and explicit return-location sign-in.
- `Stationed` is a resting-state model that can move to `Traveling` with a responsible user during temporary use.
- `Sunday Kits` is a saved-kit deployment workspace with partial returns.
- `Accept Return` auto-signs items back in.
- Accepted returns use approver-selected final sign-in location.
- Shared return approvals can resolve outcomes per item in one submit.
- `QR Scan` supports bulk in-tab sign-in/sign-out batches.
- `Settings` managers have limited operational access only.
- Managers can edit local operational profile fields in `Users`.
- `Users` uses split admin vs manager edit sets on the same record structure.
- `Roles` are fixed system roles in v1.
- `Locations` can be added/disabled in v1, including forced retirement to a temporary `Unassigned` holding state.
- When a location is force-retired, retirement proceeds immediately.
- All in-flight workflows tied to the retiring location move to `Blocked` with system reason `Location retired`.
- This includes pending or in-progress asset requests, active sign-outs, open approval items, pending or in-progress transfers, and unresolved damage cases tied to that location.
- All assets tied to the location move to `Unassigned`.
- All users with that location as home base move to `Unassigned`.
- Admin must resolve each affected asset and user individually before they re-enter normal workflows.
- `Departments`, `Kits`, `Consumables`, `Reports`, `Duplicates`, and `Config` have defined v1 roles.
- Statuses use short operational labels and separate asset states from workflow states.
- No helper text or tooltip-dependent meaning is used for statuses.
- Core asset states are `Available`, `Assigned`, `Traveling`, `Stationed`, and `Damaged`.
- `Approved` is distinct from `Completed`.
- Visible asset-state labels stay as the core labels: `Available`, `Assigned`, `Traveling`, `Stationed`, `Damaged`.
- Visible request/workflow labels stay as `Draft`, `Pending`, `Approved`, `Declined`, `In Progress`, `Completed`, and `Blocked`.
- Visible approval labels are `Pending`, `Approved`, `Declined`, `Request Changes`, and `Awaiting Recipient`.
- Visible return labels are `Pending`, `Accepted`, `Routed to Intake`, `In Progress`, `Completed`, and `Declined`.
- Visible damage labels are `Locked`, `Form Pending`, `Form Submitted`, `Under Review`, `Resolved: Available`, `Resolved: Damaged`, and `Resolved: Lost`.
- Reports export as `CSV`, `XLSX`, and `PDF` from filtered views.
- Bulk QR export lives in `Settings > Config` and generates packed A4 PDF sheets with `20mm x 20mm` QR labels.
- Force-retired locations move assets to `Unassigned` and users to an `Unassigned` home-base state.
- Managers can see the shared `Unassigned` pool but can only resolve records into their own location.
- Unassigned users must request reassignment before they can resume asset workflows.
- Damage lock resolution happens in `Approvals > Damage Locks`.
- Damage form submission auto-unlocks the user before final asset resolution.
- Duplicate merges preserve history, move active links, and leave a merged tombstone.
- Shared workflow statuses are `Draft`, `Pending`, `Approved`, `Declined`, `In Progress`, `Completed`, and `Blocked`.
- `Blocked` is reserved for real blockers only.
- Workflow statuses are role-filtered in the UI.
- `Inventory` top-level filter set is `Search + Location + Department + Status + Availability`.
- Grouped inventory cards show counts and location spread before drill-in.
- `Requests > Asset` is a shared-detail multi-item physical-unit request flow.
- `Requests > Special` is a dynamic form for `Stationed Use` and `Permanent Reassignment`.
- `Requests > Returns` is a multi-asset shared return-request flow.
- `Draft` is used only for request creation.
- Request baskets auto-save as `Draft` at each step of the guided flow.
- Drafts appear in `Requests > History` under `Draft` status and are visible only to the requesting user.
- Navigating away does not discard a draft.
- A user may have one active draft per workflow type at a time.
- Starting a new basket when a draft of the same type exists prompts the user to resume or discard the existing draft.
- Drafts are never visible in manager or admin approval queues.
- Validation uses inline error labels only.
- Request and return dates cannot be in the past.
- Shared return requests may only include assets currently assigned to the requesting user.
- If one requested asset becomes unavailable before approval, available items may still be approved.
- Users should see which removed item became unavailable and why.
- Saved kit requests stay out of `Requests > Special` in v1.

## 18. Implementation Checkpoint
Current implementation status in the Expo rebuild workspace:
- New app stack is now `Expo + Expo Router + React Query + Supabase`.
- Expo project is linked to EAS project ID `9d29bb3a-56c2-440b-8165-354b270ca275`.
- Expo app slug is `ec-asset`.
- Supabase project link saved for this rebuild is project ref `kpcfvmteutmzcfoazszp` with project name `EC Asset`.
- Shared app shell exists with top-level pages:
  - `Dashboard`
  - `Inventory`
  - `Check-out/In`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Settings`
- Auth flows implemented so far:
  - login
  - signup
  - approval-pending screen
  - damage-lock screen
- Push notification registration is wired into the Expo app bootstrap.
- Notification backend foundation exists for:
  - in-app inbox records
  - push delivery records
  - email delivery records
- Fresh Supabase schema and RPC foundation has been created for:
  - locations
  - departments
  - profiles
  - assets
  - asset history
  - request drafts
  - requests
  - approvals
  - return requests
  - damage cases
  - push tokens
  - notifications
  - notification deliveries
- Live data behavior implemented so far:
  - access context lookup from Supabase
  - push-token registration RPC
  - request draft autosave RPC
  - request submit-from-draft RPC
  - live request history query
  - live notification inbox query
  - notification resolve action
  - live approvals queue query
  - live approval review action
  - live damage-case queue query
  - damage form submit RPC
  - damage case resolve RPC
- Current remote Supabase state:
  - repo migrations through `20260531204000_live_approvals_and_damage_queue.sql` have been pushed to project ref `kpcfvmteutmzcfoazszp`
- Screens still partly scaffolded and not yet fully workflow-complete:
  - `Dashboard`
  - `Inventory`
  - `Asset Detail`
  - `My Assets`
  - `Approvals`
  - `Check-out/In`
  - `Settings`
- Major remaining build work:
  - full approval decision actions
  - full sign-out and sign-in workflow RPCs
  - permanent assignment workflows
  - stationed workflows
  - Sunday kit deployment and partial returns
  - transfer request and admin approval flow
  - complete damage lock lifecycle in UI
  - reports export flow
  - QR sheet export flow
- duplicate merge workflow
- real email provider integration
- final mobile/web UI completion across all tabs

## 19. Session Update - 2026-06-01
This section records the concrete implementation and deployment work completed in the current session. The old web app remains a visual and UX reference only, not the product baseline.

### Baseline progress after this session
- Auth screens were restyled to match the old app reference more closely:
  - login
  - approval-pending
  - boot/loading
- Shared auth visuals were added for the Expo app:
  - Matrix-style background
  - decipher loading text
  - loading card treatment
- `Approvals` moved beyond first-item actions and now uses a selectable queue plus review panel.
- `Approvals > Returns` now supports approver-selected final return location at decision time, which matches the locked baseline handoff.
- `Check-out/In > Permanent` now has first-pass live workflow actions for:
  - direct issue
  - reassignment
  - explicit sign-in return
- `Check-out/In > Stationed` now has first-pass live workflow actions for:
  - temporary-use issue
  - sign-in as `Stationed`
  - sign-in as `Available`
  - sign-in as `Damaged`
- `Check-out/In > Sunday Kits` now has first-pass live workflow actions for:
  - kit deployment
  - sign-in
  - partial item return handling
  - item-level outcome selection
- Request submission and approval side effects were expanded so `Asset`, `Special`, and `Returns` no longer stop at draft/history behavior only.
- Recipient-decline handling now returns assets to the recorded source location when that context exists.

### New local database work added in this session
- New migration created:
  - `supabase/migrations/20260601190000_request_and_operational_workflows.sql`
- New migration created:
  - `supabase/migrations/20260601203000_sunday_kit_workflows.sql`
- Existing migration updated locally:
  - `supabase/migrations/20260601000000_recipient_review_assignments.sql`

### Important current truth
- These newer workflow migrations are currently local repo work and should be treated as not fully active in Supabase until explicitly applied.
- The Expo app is further along, but the whole baseline is still not complete.

### Areas that are now in better shape
- auth and approval gating
- live request submit flow
- approval review flow
- return approval handoff
- damage lock entry points
- permanent operational workspace
- stationed operational workspace
- Sunday kit operational workspace
- legacy visual alignment for auth screens

### Areas still partial, scaffolded, or not baseline-complete
- transfer workflows, including cross-location manager request and admin approval flow
- settings CRUD behavior across users, locations, departments, kits, consumables, config
- reports export flows
- duplicate merge workflow
- QR Scan real batch workflow behavior
- richer Sunday kit item sourcing and deployment filtering
- home-base change request and approval flow
- broader bulk approval tools where the baseline allows them
- final polish and edge-case handling across all operational tabs

### Deployment/debugging notes from this session
- Expo web export had already succeeded earlier in the repo and produced a `dist` folder.
- `eas deploy` failed once with `The specified bucket does not exist.`
- A later `eas deploy --non-interactive --json` succeeded against the linked Expo project, which suggests the bucket error was transient or hosting-side rather than a permanent project-link failure.
- To align the repo with Expo web hosting expectations, `app.json` was updated so `expo.web.output = "static"`.
- Static export then exposed a real repo requirement: `@expo/metro-runtime` needed to be a direct dependency for the web export path.
- `tsconfig.json` was updated to exclude generated web output folders so `dist` does not get typechecked as source.
- An interrupted static export can leave `dist` with route folders but no actual files. In that state, deployed hosting can show:
  - `Route Not Found`
  - `The worker has no matching route handler for this path`
- Before any future web deploy, confirm `dist` contains actual output files such as `index.html`, `metadata.json`, and `_expo/static/...`, not only empty route directories.

### Working summary
- The baseline remains the build spec.
- The old app remains a style reference only.
- The current Expo rebuild has moved from scaffold-only status into real workflow implementation for approvals, permanent, stationed, and Sunday kits.
- The remaining work is still substantial enough that the app should not yet be described as baseline-complete.

## 20. Reset Direction - 2026-06-01
This section supersedes the previous rebuild direction where it conflicts. The product baseline remains the source of truth, but the implementation reset direction is now different.

### Implementation direction now locked
- Build the new app as a fresh `Vercel-first` rebuild using `Next.js App Router + Supabase`.
- The old app is not the workflow/code baseline.
- The old app is the visual parity reference for:
  - auth screens
  - shell
  - navigation feel
  - spacing
  - card treatments
  - glow/border/color treatment
  - generic UI components
- Visual parity target is intentionally very high.
- If there is a conflict between old visuals and baseline workflows:
  - visual decisions follow the old app as closely as possible
  - workflow and architecture decisions follow this baseline

### Code migration rule
- Do not port the old app wholesale.
- Copy only selected visual assets, shared styling patterns, and generic UI building blocks from the old app.
- Rebuild workflow pages and data flow cleanly against this baseline.

### Platform direction
- Primary implementation target is `Vercel web`.
- The app should still be built with mobile-aware interaction patterns so an Expo/mobile client can be added next.
- Mobile navigation does not need to exactly match desktop navigation if role usability is better with a different mobile pattern.

### Progress tracking rule
- After each major page or section is created, append a checkpoint to this baseline.
- Each checkpoint should record:
  - what page/section was created
  - what is visually complete
  - what is functional vs scaffolded
  - what still remains for that page/section

### Navigation and settings additions
- `Settings` now includes a `Profile` tab visible to all roles.
- The rest of `Settings` remains role-aware as already defined elsewhere in the baseline.

### Handover workflow added to baseline
- `Handover` exists in v2 as a workflow, not as a top-level page.
- Handover starts from `My Assets > Assigned`.
- Incoming handovers appear in `My Assets > Pending`.
- A pending handover keeps the asset operationally `Assigned` while a transfer decision is waiting.
- Pending handover blocks conflicting actions until the recipient accepts or rejects.
- Accept transfers holder responsibility to the recipient.
- Reject returns control to the original holder.

### Reset build order
1. Scaffold fresh `Next.js` app in this repo.
2. Recreate the old app visual system and shell.
3. Build auth shell and entry surfaces.
4. Build page scaffolds in baseline order:
   - `Dashboard`
   - `Inventory`
   - `My Assets`
   - `Requests`
   - `Approvals`
   - `Check-out/In`
   - `Settings`
5. Rebuild workflows page by page against this baseline.

### Current reset assumptions
- `Next.js App Router` is the chosen stack for the new web rebuild.
- Old workflow/page code is reference-only unless explicitly approved for reuse.
- The rebuild should feel like the same app visually, even though the internals are being rebuilt almost from scratch.

## 21. Implementation Checkpoint - 2026-06-01
This checkpoint records the first concrete implementation work completed in the fresh `Next.js` reset workspace.

### What was created
- A fresh `Next.js App Router + Tailwind v4` app was scaffolded in this repo.
- The new repo now contains the first real rebuild foundation instead of only the baseline markdown file.
- Old app visual assets copied into the new app so far:
  - main icon files
  - favicon
- The first shared visual system pass was created from the old app reference:
  - dark matrix-style background
  - green/cyan glow treatment
  - shell gradients
  - card/panel styling
  - display/font hierarchy
  - matrix-style field and button treatment

### Pages and sections created in this pass
- Auth entry page created:
  - `Login`
- Shared app shell scaffold created for baseline routes:
  - `Dashboard`
  - `Inventory`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Check-out/In`
  - `Settings`

### Visual completion status
- `Login` now has a strong first-pass visual match to the old app:
  - matrix rain background
  - centered auth card
  - old logo treatment
  - uppercase display heading
  - glow treatment
  - matrix-style input/button presentation
- Desktop and mobile app shell direction is now established:
  - sidebar on desktop
  - bottom nav + more drawer pattern on mobile
  - top header card treatment
- Overall look is already intentionally close to the old app, but still needs refinement to reach near-final parity.

### Functional status
- Current pages are shell/scaffold level only.
- Routing is live for:
  - `/login`
  - `/dashboard`
  - `/inventory`
  - `/my-assets`
  - `/requests`
  - `/approvals`
  - `/check-out-in`
  - `/settings`
- Root route redirects to `/login`.
- No auth, Supabase integration, or real workflow logic has been reconnected yet in this new reset.

### Verification completed
- Production build passed successfully in the new `Next.js` app.
- Next.js config was adjusted to lock Turbopack root to this repo and avoid incorrect workspace-root inference.

### What remains next for these sections
- Refine shell parity further against the old app:
  - spacing
  - nav density
  - header details
  - finer typography tuning
- Build real auth flow and gating.
- Replace scaffold page bodies with baseline-driven page structures.
- Start with the next major implementation layer:
  - auth plumbing
  - shared route protection
  - real `Dashboard` structure

## 22. Implementation Checkpoint - 2026-06-01
This checkpoint records the next page/section pass completed after the initial shell scaffold.

### Auth surfaces improved
- `Approval Pending` page was created in the new app.
- Shared decipher text treatment from the old app was recreated for the new stack.
- A reusable decipher loader component was added for future auth/loading transitions.

### Dashboard progressed
- `Dashboard` moved from simple placeholder state into a baseline-shaped first pass.
- The page now includes:
  - action-hub intro section
  - admin-style top action cards
  - role-specific top-card previews for:
    - admin
    - asset manager
    - staff/volunteer
  - lower operational feed/snapshot card scaffolds
- This is still not live-data complete, but it now reflects the intended baseline page structure more clearly.

### Visual completion status in this pass
- Approval pending now closely follows the old app’s visual style:
  - shield badge block
  - matrix background
  - decipher status panel
  - centered auth/gating card treatment
- Dashboard now feels materially closer to the old app shell and card language than the earlier scaffold pass.

### Functional status in this pass
- `Approval Pending` is currently a visual/static screen only.
- `Dashboard` is currently structural and visual only.
- No real auth polling, role resolution, or live dashboard data is connected yet in the new reset app.

### Verification completed
- Production build passed successfully after these additions.

### What remains next
- Connect real auth/session plumbing and route protection.
- Decide the first live data integration layer:
  - auth context
  - Supabase client wiring
  - role-aware shell access
- Continue page rebuild in baseline order after auth foundation is in place.

## 23. Implementation Checkpoint - 2026-06-01
This checkpoint records the auth/session foundation pass in the fresh `Next.js` rebuild.

### Auth foundation added
- Supabase browser client helper was added for the new app.
- An app-level auth provider/context was created.
- Root layout now wraps the app with shared providers.
- Protected app routes are now gated by a reusable protected-app wrapper.

### Current auth behavior
- If Supabase env vars are missing:
  - login remains visible
  - real sign-in is disabled
  - protected routes show a setup-required screen
- If Supabase env vars exist and a user is signed out:
  - protected routes redirect to `Login`
- If a user is signed in:
  - protected app routes are allowed through the shared shell

### Login flow progress
- `Login` is no longer static-only.
- It now has:
  - client-side form state
  - sign-in submission path
  - forgot-password request path
  - redirect handling for `next` target routes
  - reset-recovery route-state handling scaffold
- Signup and full reset completion are still intentionally partial and not baseline-complete yet.

### Supporting project setup added
- `.env.example` was created for:
  - `NEXT_PUBLIC_SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- App Router login route was refactored into:
  - server page wrapper for `searchParams`
  - client login form for interactive logic

### Functional status in this pass
- Auth/session architecture now exists in the reset app.
- Role resolution and access-context loading do not exist yet.
- Approval-pending, damage-lock, and richer auth gating are still not connected to real backend access rules.

### Verification completed
- Production build passed successfully after auth/session integration.

### What remains next
- Add role/access-context loading from Supabase.
- Recreate approval-pending and damage-lock gating with real auth state.
- Decide whether the next implementation layer should be:
  - shell role-awareness
  - `Inventory`
  - `My Assets`

## 24. Implementation Checkpoint - 2026-06-01
This checkpoint records the first real role/access-state integration pass in the new `Next.js` rebuild.

### Role and access context progress
- Auth context now tracks more than session state.
- It now includes:
  - roles
  - approval/access state
  - auth error state
  - assigned location context
  - asset-manager location context
  - derived role flags
- Access loading now attempts:
  - `get_my_access_context`
  - then legacy fallback queries if that RPC does not exist

### Location scope progress
- A dedicated location-scope provider was added.
- The new shell can now reflect:
  - all-location access
  - locked role-based location access
  - assigned-location behavior
- Location scope selection state is now persisted per user in local storage.

### Shell progress in this pass
- Shared app shell is now role-aware instead of generic.
- Navigation visibility now changes by role.
- Header/profile area now uses live auth context values instead of placeholder text.
- Shell now exposes current location scope state.
- Logout is wired into the shell.

### Approval-pending gating progress
- `Approval Pending` now has first-pass real gating behavior.
- Signed-in users in pending-approval state can be routed there.
- The page now retries access checks on an interval and on focus/pageshow events.
- Approved users can be routed back into the app.

### Dashboard progress in this pass
- `Dashboard` now changes its top action-card set by role:
  - admin
  - asset manager
  - staff/volunteer
- This is still scaffolded data, but the role-specific structure now reflects the baseline more accurately than before.

### Functional status in this pass
- The new app now has:
  - session auth foundation
  - approval/access-state model
  - role-aware navigation
  - location-scope foundation
- The new app still does not yet have:
  - final damage-lock gating
  - real live dashboard queries
  - role-complete page content beyond shell/dashboard structure

### Verification completed
- Production build passed successfully after role/access integration.

### What remains next
- Build the first real baseline page on this foundation.
- Recommended next page:
  - `Inventory`
- After `Inventory`, move to:
  - `My Assets`
  - then `Requests`

## 25. Implementation Checkpoint - 2026-06-01
This checkpoint records the first real baseline page rebuild completed on top of the new shell and role/access foundation.

### Inventory progress
- `Inventory` is no longer a placeholder.
- It now follows the intended baseline interaction shape:
  - grouped catalog first
  - core filters at the top
  - grouped cards with operational counts
  - drill-in panel showing physical units

### Inventory filters implemented
- Top-level filter set now includes:
  - `Search`
  - `Department`
  - `Status`
  - `Availability`
- Location scope is currently driven by the shared shell/header scope rather than duplicated again inside the page.

### Inventory grouped-catalog behavior implemented
- Assets are grouped by item name first.
- Group cards now show:
  - item name
  - location spread
  - grouped counts for:
    - `Available`
    - `Assigned`
    - `Traveling`
    - `Damaged`
- Selecting a group opens the right-side drill-in surface for physical units.

### Inventory drill-in behavior implemented
- Drill-in surface now lists physical units with:
  - `Tag`
  - `Name`
  - `Serial`
  - `Status`
  - `Location`
  - `Department`
  - `Holder`
- This is currently a first-pass detail panel, not the final dedicated asset-detail workflow.

### Role behavior implemented
- Inventory is now blocked for volunteer-style access.
- The page currently allows inventory browsing only for the roles intended by the baseline:
  - admin
  - asset manager
  - staff

### Data status in this pass
- Inventory currently uses safe local fallback/mock data for the first baseline rebuild pass.
- Live Supabase inventory queries and final asset-detail actions are still pending.

### Supporting implementation added
- New asset utility layer added for:
  - status normalization
  - status labels
  - status badge styling
  - grouped asset summarization
- New lightweight search matching helper added for baseline page filtering.

### Verification completed
- Production build passed successfully after the inventory rebuild pass.

### What remains next for Inventory
- Replace mock inventory data with live Supabase queries.
- Add final top-level filter parity where needed.
- Add unit-row actions/context menus.
- Add dedicated asset-detail route/page behavior.
- Connect inline edit permissions to role-aware real data.

### Recommended next page
- `My Assets`

## 26. Implementation Checkpoint - 2026-06-01
This checkpoint records the `My Assets` rebuild pass completed after `Inventory`.

### My Assets progress
- `My Assets` is no longer a placeholder.
- The page now follows the baseline tab structure:
  - `Assigned`
  - `Pending`
  - `Damage`

### Assigned tab progress
- `Assigned` is now the action-oriented user asset hub.
- Assigned asset cards currently show:
  - `Tag`
  - `Name`
  - `Status`
  - `Serial`
  - `Location`
  - `Department`
  - `Assigned by`
  - assignment time
- Direct action buttons now exist in the UI for:
  - return request entry
  - handover request entry

### Pending tab progress
- `Pending` now acts as the inline decision surface for incoming user actions.
- The page currently shows both:
  - incoming asset assignments
  - incoming handovers
- This matches the locked v2 handover fit:
  - handover does not get its own top-level page
  - handover lives inside `My Assets`
- Pending items now have:
  - inline approve button
  - inline decline button
  - batch-selection UI scaffolding
  - visual distinction between assignment and handover items

### Damage tab progress
- `Damage` now exists as a history-only user-facing tab.
- It does not host the user damage-report workflow, which remains aligned with the baseline.

### Handover baseline fit implemented in UI structure
- Handover entry is now represented from the `Assigned` tab via direct action affordance.
- Incoming handover responses are now represented in the `Pending` tab.
- This matches the revised baseline rule for v2 handover placement.

### Role behavior in this pass
- Volunteer-style access remains naturally compatible with this page shape because it centers on:
  - assigned items
  - pending decisions
  - damage history

### Data status in this pass
- `My Assets` currently uses safe local fallback/mock data for structure and UX rebuild.
- No real asset assignments, pending approvals, or handover queries are connected yet.

### Verification completed
- Production build passed successfully after the `My Assets` rebuild pass.

### What remains next for My Assets
- Replace fallback data with live Supabase queries.
- Connect real recipient approval actions.
- Connect real handover request and response actions.
- Add bulk approve/decline behavior where allowed.
- Connect real return-request entry flow from assigned items.

### Recommended next page
- `Requests`

## 27. Implementation Checkpoint - 2026-06-01
This checkpoint records the `Requests` rebuild pass completed after `My Assets`.

### Requests progress
- `Requests` is no longer a placeholder.
- The page now follows the baseline tab structure:
  - `Asset`
  - `Special`
  - `Returns`
  - `History`

### Asset tab progress
- `Asset` now reflects the shared basket and guided flow direction.
- Current first-pass structure includes:
  - browse/search surface for requestable physical units
  - multi-select basket behavior
  - shared basket summary
  - required shared-field UI scaffolding for:
    - `Need Date`
    - `Reason`
    - `Duration`
    - `Event / Use Context`
- This aligns with the baseline rule that one basket is one shared request with shared details.

### Special tab progress
- `Special` now exists as a dynamic-form workspace scaffold.
- The UI currently supports the baseline v1 types:
  - `Stationed Use`
  - `Permanent Reassignment`
- Asset selection happens before the rest of the dynamic form, matching the locked baseline behavior.

### Returns tab progress
- `Returns` now exists as the unified return workspace.
- The page currently supports:
  - selecting from assigned assets
  - one shared return basket
  - required-field UI scaffolding for:
    - `Return Date`
    - `Preferred Return Location`
    - `Note`
- The page also preserves the baseline handoff concept that approval-side final sign-in happens later.

### History tab progress
- `History` now exists as the request/draft visibility surface.
- The page currently shows:
  - asset requests
  - special requests
  - return requests
  - draft visibility behavior messaging

### Role behavior in this pass
- Request creation remains restricted away from volunteer-style access in the new app structure.
- The page currently fits staff/admin request behavior more closely than before.

### Data status in this pass
- `Requests` currently uses safe local fallback/mock data for the rebuild pass.
- Real draft autosave, basket persistence, submit flows, and history queries are still pending.

### Verification completed
- Production build passed successfully after the `Requests` rebuild pass.

### What remains next for Requests
- Replace fallback data with live request/draft queries.
- Connect draft autosave and resume/discard behavior.
- Enforce one-active-draft-per-workflow behavior.
- Connect real submit actions for:
  - asset requests
  - special requests
  - return requests
- Add unavailable-item handling and partial-approval behavior from the baseline.

### Recommended next page
- `Approvals`

## 28. Implementation Checkpoint - 2026-06-01
This checkpoint records the `Approvals` rebuild pass completed after `Requests`.

### Approvals progress
- `Approvals` is no longer a placeholder.
- The page now follows the baseline review-workspace direction:
  - queue list on the left
  - review panel on the right
  - tabbed approval categories across the top

### Approval queue tabs implemented
- The queue currently includes the locked v2 approval categories:
  - `Recipient`
  - `Asset Requests`
  - `Special Requests`
  - `Returns`
  - `Damage Locks`

### Queue-list structure implemented
- Queue rows are now decision-summary cards instead of oversized old-flow pages.
- Each row currently shows:
  - requester
  - summary
  - context/meta line
  - current status

### Review-panel structure implemented
- Selecting a queue row opens an inline review panel.
- The review panel currently includes:
  - review title
  - workflow description
  - core metrics/context cards
  - inline action buttons
- This matches the baseline direction that most approval work should stay decision-complete inside one workspace.

### Workflow-specific approval notes represented
- Recipient queue currently reflects the rule that:
  - bulk reminders are allowed
  - bulk approve/decline override is not the intended pattern
- Returns queue currently reflects the rule that:
  - `Accept Return` is the terminal approval action
  - final sign-in location is selected on the approval side
- Damage Locks queue currently reflects the rule that:
  - manager/admin resolution happens here
  - final outcomes are `Available`, `Damaged`, or `Lost`

### Role behavior in this pass
- `Approvals` is now structurally restricted to:
  - admin
  - asset manager
- Non-approval roles are blocked from this workspace in the new shell.

### Data status in this pass
- `Approvals` currently uses safe local fallback/mock queue data for the rebuild pass.
- Real approval queries, counts, bulk operations, and workflow actions are still pending.

### Verification completed
- Production build passed successfully after the `Approvals` rebuild pass.

### What remains next for Approvals
- Replace fallback queue data with live Supabase approval queries.
- Connect real approve, decline, request-changes, and reminder actions.
- Add role-scoped queue filtering by location/access context.
- Add bulk behaviors only where the baseline allows them.

### Recommended next page
- `Check-out/In`

## 29. Implementation Checkpoint - 2026-06-01
This checkpoint records the `Check-out/In` rebuild pass completed after `Approvals`.

### Check-out/In progress
- `Check-out/In` is no longer a placeholder.
- The page now follows the locked six-tab operational workspace structure:
  - `Standard`
  - `Permanent`
  - `Stationed`
  - `Sunday Kits`
  - `Returns`
  - `QR Scan`

### Standard tab progress
- `Standard` now includes a first-pass mode split for:
  - `Sign Out`
  - `Sign In`
- The UI currently reflects the baseline intent that:
  - sign out stays fast and operational
  - sign in remains the direct intake surface
  - sign-in outcomes are constrained to the baseline outcome model

### Permanent tab progress
- `Permanent` now exists as its own dedicated workspace instead of being buried inside older mixed flows.
- The UI currently reflects:
  - direct permanent issue support
  - reassignment from the assigned asset
  - explicit return-location selection at sign-in

### Stationed tab progress
- `Stationed` now reflects the baseline resting-state model rather than a permanently active location lock.
- The UI currently calls out:
  - temporary use moving assets to `Traveling`
  - required responsible user tracking
  - sign-in outcomes including `Stationed`, `Available`, or `Damaged`

### Sunday Kits tab progress
- `Sunday Kits` now exists as a dedicated deployment workspace.
- The UI currently reflects:
  - kit-level deployment
  - per-asset return resolution
  - support for partial returns

### Returns and QR Scan progress
- `Returns` now exists as the read-only monitoring tab aligned to the baseline.
- `QR Scan` now exists as the mode-first batch workspace scaffold aligned to the baseline bulk-operations rule.

### Role behavior in this pass
- `Check-out/In` remains restricted to:
  - admin
  - asset manager
- Other roles are blocked from this operational workspace in the new shell.

### Data status in this pass
- `Check-out/In` currently uses structural UI scaffolding only for the rebuild pass.
- Real operational queries, live issue/sign-in forms, scan flows, and submission actions are still pending.

### Verification completed
- Production build passed successfully after the `Check-out/In` rebuild pass.

### What remains next for Check-out/In
- Connect real standard sign-out and sign-in workflows.
- Build permanent, stationed, and Sunday-kit live action flows.
- Connect returns monitoring to real return-request state.
- Connect live QR scan batching and compatibility validation.

### Recommended next page
- `Settings`

## 30. Implementation Checkpoint - 2026-06-01
This checkpoint records the `Settings` rebuild pass completed after `Check-out/In`.

### Settings progress
- `Settings` is no longer a placeholder.
- The page now follows the revised baseline rule that `Profile` is available to all roles.
- The workspace now uses a role-aware tab list with a detail panel instead of the older oversized admin sprawl.

### Tabs implemented
- The page currently includes:
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

### Profile tab progress
- `Profile` now exists as a real dedicated tab visible to every signed-in role.
- The current first-pass surface includes:
  - operator name
  - role
  - email
  - home-base placeholder
- This replaces the previous direction where profile editing was not clearly surfaced in the new baseline.

### Role-aware visibility implemented
- `Users` is currently visible to:
  - admin
  - asset manager
- `Roles`, `Locations`, `Departments`, `Kits`, `Reports`, `Duplicates`, and `Config` are currently admin-only in the rebuilt shell.
- `Consumables` is currently visible to:
  - admin
  - asset manager

### Settings section intent captured
- Each tab now carries the baseline intent for that operational area, including:
  - split admin versus manager edit scope in `Users`
  - fixed-system-role direction in `Roles`
  - location lifecycle handling in `Locations`
  - saved-kit lifecycle handling in `Kits`
  - export/report direction in `Reports`
  - compare-and-merge direction in `Duplicates`
  - bulk QR export placement in `Config`

### Data status in this pass
- `Settings` currently uses structural UI scaffolding and placeholder field values for the rebuild pass.
- Real CRUD actions, profile editing, exports, merge tooling, and configuration forms are still pending.

### Verification completed
- Production build passed successfully after the `Settings` rebuild pass.

### What remains next for Settings
- Connect real profile fields and update actions.
- Connect admin and manager CRUD actions by section.
- Build report export flows and duplicate-merge tooling.
- Build config forms including live QR export tooling.

## 36. Infrastructure Connection Checkpoint - 2026-06-02
This checkpoint records the successful connection of the project to GitHub, Vercel, and Supabase.

### GitHub Connection
- **Repository:** `https://github.com/Encounter-Creator/EC-Assets.git`
- **Status:** Connected and code pushed to `main` branch.
- **Authentication:** Using Personal Access Token (PAT).

### Vercel Connection
- **Project Name:** `ec-assets`
- **Link Status:** Linked and environment variables pulled to `.env.local`.
- **Primary Deployment:** Vercel Web.

### Supabase Connection
- **Project Ref:** `kpcfvmteutmzcfoazszp`
- **Project Name:** `EC Asset`
- **CLI Status:** Linked via `npx supabase`.
- **Database Status:** Migration history sync in progress (local migrations from 2026-06-01 onwards).

### Next Steps
- Finalize Supabase migration sync using `migration repair`.
- Complete remaining workflow implementations (`Sunday Kits`, `Settings` CRUD).
- Verify end-to-end live data flow on Vercel deployment.

## 31. Implementation Checkpoint - 2026-06-01
This checkpoint records the first live workflow-data pass completed after the page scaffolding phase.

### My Assets live-data progress
- `My Assets` has now moved beyond static mock-only structure.
- The page now attempts to load real live data for:
  - assigned assets
  - pending recipient approvals
  - pending handovers
  - damage history

### Assigned tab live status
- `Assigned` now loads from the live `assets` table using the signed-in user as the current holder.
- Location and department labels are now resolved against live reference tables where available.
- The old-style visual card treatment remains unchanged while the data source is now real.

### Pending tab live status
- `Pending` now attempts to load recipient-approval items using the live recipient approval RPC:
  - `get_my_pending_recipient_signout_approvals()`
- `Pending` also now attempts to load incoming handovers from the live handover tables and related asset/profile data.
- Inline Approve and Decline actions are now wired for both:
  - recipient approvals
  - handover responses
- Bulk approve and bulk decline now execute the same live actions across selected items.

### Damage tab live status
- `Damage` now attempts to load real user-linked damage history from the live damage workflow table instead of always using static preview content.
- The tab still remains history-only in line with the baseline.

### Fallback behavior added
- `My Assets` now degrades gracefully if parts of the schema or RPC surface are missing.
- The page can now run in three modes:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners now tell the operator which parts are still falling back when the newer schema/functions are not available.

### Supporting implementation added
- A dedicated `my-assets` data layer was added to normalize:
  - assigned asset records
  - pending approval records
  - handover records
  - damage history records
- This keeps the page structure clean and creates a reusable pattern for the next live workflow pages.

### What is still intentionally deferred on My Assets
- `Request Return` and `Request Handover` initiation from the assigned cards are not yet wired to live forms/actions.
- Assigned-by attribution is currently a live placeholder label rather than final workflow-derived attribution.
- Real-time subscriptions are not yet connected in the new app for this page.

### Verification completed
- Production build passed successfully after the live `My Assets` wiring pass.

### Recommended next step
- Continue the live-data replacement pass with either:
  - `Requests`
  - `Approvals`
  - `Check-out/In`

## 32. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Requests` wiring pass completed after the first `My Assets` data pass.

### Requests live-data progress
- `Requests` has now moved beyond static page-only scaffolding.
- The page now attempts to load real live data for:
  - requestable assets
  - assigned assets available for return selection
  - request history from grouped request bundles

### Asset tab live status
- `Asset` now loads real requestable assets from the live inventory shape.
- The page currently respects the selected location scope when choosing what is requestable.
- Asset basket selection remains in the rebuilt v2 UI, but now works against live records instead of only fallback rows.

### Asset request submit status
- `Asset` now submits through the live grouped request workflow RPC:
  - `submit_asset_request_bundle(...)`
- The rebuilt page structure still uses the new baseline fields:
  - `Need Date`
  - `Reason`
  - `Duration`
  - `Event / Use Context`
- At this stage those fields are being mapped pragmatically into the currently available backend request-bundle interface, rather than waiting for a fuller draft system.

### Returns tab live status
- `Returns` now uses real assigned assets for return selection instead of only mock assigned rows.
- The tab structure remains aligned to the unified baseline return workspace.
- Actual return-request submission is still intentionally deferred.

### History tab live status
- `History` now attempts to load real request history from:
  - `asset_request_bundles`
  - `asset_request_bundle_items`
- History entries now summarize live bundle state, location, date, and line-level context where available.

### Fallback behavior added
- `Requests` now degrades gracefully when request tables or RPCs are missing.
- The page now runs in:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners explain which parts are still falling back when the live schema surface is incomplete.

### Supporting implementation added
- A dedicated `requests` data layer was added to normalize:
  - requestable assets
  - return-selectable assigned assets
  - grouped request history
  - live asset-request submission
- This keeps the rebuilt page structure clean and establishes a repeatable live-data pattern for the remaining pages.

### What is still intentionally deferred on Requests
- `Special` request submission is still scaffold-only.
- `Returns` request submission is still scaffold-only.
- Draft autosave, resume/discard behavior, and one-active-draft-per-workflow enforcement are not wired yet.
- The current live asset-request submit mapping is practical and usable, but not yet the final backend model for all v2 shared fields.

### Verification completed
- Production build passed successfully after the live `Requests` wiring pass.

### Recommended next step
- Continue the live-data replacement pass with:
  - `Approvals`
  - then `Check-out/In`

## 33. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Approvals` wiring pass completed after the first live `Requests` pass.

### Approvals live-data progress
- `Approvals` has now moved beyond safe local mock-only queue rows.
- The page now attempts to load real live queue data for:
  - approval records
  - damage-lock review records

### Queue structure now live
- The page still follows the locked v2 queue-list plus review-panel layout.
- The following tabs remain the active shell structure:
  - `Recipient`
  - `Asset Requests`
  - `Special Requests`
  - `Returns`
  - `Damage Locks`
- Location scope is now respected where location context is available from the live queue data.

### Approval queue live status
- `Approvals` now attempts to load live approval rows from the approval/request tables instead of always rendering fallback queue examples.
- Queue items are now classified into:
  - `Recipient`
  - `Asset Requests`
  - `Special Requests`
  - `Returns`
- Inline decision actions now attempt to execute through the live approval review RPC:
  - `review_approval(...)`

### Damage Locks live status
- `Damage Locks` now attempts to load active live damage cases where the legacy damage-case surface exists.
- The page also includes compatibility fallback handling for the newer damage-report surface when the older damage-case table is not the active schema.
- Inline resolution actions now attempt to execute through the live damage resolution RPC:
  - `resolve_damage_case(...)`

### Fallback behavior added
- `Approvals` now degrades gracefully when parts of the queue schema or RPC surface are missing.
- The page now runs in:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners now explain which parts are still falling back when the backend surface is incomplete or split across schema generations.

### What is still intentionally deferred on Approvals
- `Recipient` reminder delivery is still scaffold-only.
- Any queue lane without a confirmed write-side backend path remains visible but not fully operational.
- Bulk queue actions beyond the currently confirmed review actions are not wired yet.

### Verification completed
- Production build passed successfully after the live `Approvals` wiring pass.

### Recommended next step
- Continue the live workflow replacement pass with:
  - `Check-out/In`

## 34. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Check-out/In` wiring pass completed after the live `Approvals` pass.

### Check-out/In live-data progress
- `Check-out/In` has now moved beyond structural-only scaffolding for the `Standard` workflow.
- The page now attempts to load real live operational data for:
  - standard sign-out asset pool
  - standard sign-in asset pool
  - standard recipients
  - standard sign-in locations
  - return-request monitoring

### Standard tab live status
- `Standard` now uses the locked two-mode workspace:
  - `Sign Out`
  - `Sign In`
- `Standard > Sign Out` now performs live asset-first sign-out through:
  - `standard_sign_out_assets(...)`
- `Standard > Sign In` now performs live assigned-asset-first sign-in through:
  - `standard_sign_in_assets(...)`
- Sign-in outcome remains limited to:
  - `Available`
  - `Damaged`
- The rebuilt page now supports multi-item selection batches in both directions where the backend RPC allows it.

### Returns tab live status
- `Check-out/In > Returns` now attempts to load the live read-only return monitoring feed through:
  - `list_return_request_monitor()`
- The tab remains awareness-only and does not become the decision surface.
- The locked handoff still remains:
  - decision in `Approvals > Returns`
  - direct walk-up intake in `Check-out/In > Standard > Sign In`

### Fallback behavior added
- `Check-out/In` now degrades gracefully when standard-operation RPCs or return-monitor RPCs are missing.
- The page now runs in:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners now explain which operational surfaces are still falling back.

### What is still intentionally deferred on Check-out/In
- `Permanent` remains scaffold-only in this new web app pass.
- `Stationed` remains scaffold-only in this new web app pass.
- `Sunday Kits` remains scaffold-only in this new web app pass.
- `QR Scan` remains scaffold-only in this new web app pass.
- The page currently does not include live scan/camera batching, stationed workflows, permanent workflows, or saved-kit execution.

### Verification completed
- Production build passed successfully after the live `Check-out/In` wiring pass.

### Recommended next step
- Continue implementation with:
  - `Dashboard`
  - then `Settings`

## 35. Current Progress Snapshot - 2026-06-01
This snapshot records the current implementation state across the top-level web pages so progress can be tracked from the baseline itself.

### Route existence
- All top-level pages now exist in the new web app shell:
  - `Dashboard`
  - `Inventory`
  - `Check-out/In`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Settings`
  - plus auth/access pages such as `Login` and `Approval Pending`

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - now loads live inventory data with fallback handling
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - special and return submit still deferred
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live returns monitoring
  - other tabs still scaffold-only
- `Dashboard`
  - role-aware structural page exists
  - still primarily visual/scaffold-level
- `Settings`
  - role-aware structural page exists
  - still primarily scaffold-level with placeholder section bodies

### Overall completion view
- Shell and route framework: in place
- Auth and protected-role access flow: in place
- Highest-priority workflow pages with live data/actions:
  - `Inventory`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Check-out/In > Standard`
- Remaining major implementation focus:
  - `Dashboard`
  - `Settings`
  - deeper workflow completion for `Special`, `Returns submit`, `Permanent`, `Stationed`, `Sunday Kits`, and `QR Scan`

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 67. Checkpoint - 2026-06-02 - Settings kits membership editor
This checkpoint records the saved-kit membership pass.

### Settings kits progressed
- `Settings > Kits` now supports asset-backed membership editing instead of only kit-name plus item-count lifecycle actions.
- Admins can now:
  - choose a saved kit for editing
  - load its current member assets
  - browse a live asset pool
  - add and remove assets from the kit draft
  - save the full kit membership back to Supabase
- The settings kit summary now treats membership count as the primary source-of-truth item count.

### Sunday Kit source-of-truth improved
- Added `supabase/migrations/20260602190000_settings_kit_members.sql`.
- The migration adds `public.kit_members`.
- Added `public.list_settings_kit_members`.
- Added `public.save_settings_kit_members`.
- `public.list_settings_kits` now derives `item_count` from saved membership when available.
- `public.deploy_sunday_kit` now uses saved kit members when `p_kit_reference` resolves to a kit id with membership rows, and falls back to legacy count-based placeholder items when that schema is unavailable or empty.

### Frontend/data-layer changes
- `src/lib/settings.ts` now loads:
  - saved kit members
  - kit asset candidates
  - kit membership saves
- `src/app/(app)/settings/page.tsx` now includes a real saved-kit membership editor alongside the existing kit create/retire surface.

### Baseline alignment improved
- This closes the previously explicit gap where saved-kit membership was not managed as a real asset-backed settings workflow.
- Sunday Kits now has a maintainable source-of-truth for deployments instead of relying only on abstract item counts when the new schema is present.

### Remaining gaps after this pass
- QR scan remains manual batch entry rather than camera-driven scanning.
- Notifications still lack backend event generation and routing.
- Some deeper workflow edge cases may still remain outside the currently visible frontend paths.

### Verification completed
- `npm run lint` passes after the saved-kit membership pass.

## 68. Checkpoint - 2026-06-02 - QR camera-assisted scan pass
This checkpoint records the QR scan workflow upgrade from manual entry only to camera-assisted capture plus manual fallback.

### QR workflow progressed
- `Check-out/In > QR Scan` now supports in-tab camera-assisted QR capture when the browser exposes `BarcodeDetector` and camera permissions.
- Captured codes append into the same batch textarea already used for manual scan/paste entry.
- The existing resolve-and-run operational batch flow remains unchanged after codes are captured.

### Frontend behavior changes
- Added camera start/stop controls and live video preview to the QR tab.
- Added unique-code capture so repeated camera frames do not endlessly duplicate the same asset code in the batch field.
- Manual batch entry remains available and is still the compatibility fallback when camera detection support is missing.

### Baseline alignment improved
- This closes the earlier gap where the QR tab only supported manual batch input with no camera-assisted path at all.
- The remaining QR gap is browser support variability rather than absence of an integrated camera workflow.

### Verification completed
- `npm run lint` passes after the QR camera-assisted scan pass.

## 60. Implementation Checkpoint - 2026-06-02
This checkpoint records the stationed return-to-site baseline alignment pass completed after the documentation split.

### Stationed return outcome gap closed
- `Check-out/In > Stationed > Return To Site` now supports `Stationed`, `Available`, and `Damaged` outcomes.
- The UI copy now reflects the full set of allowed outcomes instead of implying a two-outcome flow.

### Backend contract updated
- Added `supabase/migrations/20260602170000_stationed_checkin_available_outcome.sql`.
- The replacement RPC now accepts `available` in addition to `stationed` and `damaged`.
- Choosing `Available` now clears the holder, sets the final location, and restores the asset status to `available`.

### Baseline alignment improved
- This closes one of the explicit `Check-out/In` mismatches against the active baseline.
- The remaining highest-value `Check-out/In` gaps are:
  - Sunday Kit item-level partial return handling
  - QR camera-based scanning instead of manual batch input only

### Verification completed
- Verified the frontend state and outcome selector were updated in `src/app/(app)/check-out-in/page.tsx`.
- Verified the stationed helper typing was updated in `src/lib/check-operations.ts`.
- Verified the Supabase RPC replacement migration exists for the new outcome support.

## 61. Implementation Checkpoint - 2026-06-02
This checkpoint records the Sunday Kit return workflow upgrade from aggregate counts to item-level deployment resolution.

### Sunday Kit returns progressed
- `Check-out/In > Sunday Kits > Returns` now prefers item-level return resolution instead of aggregate returned/damaged counts.
- The selected deployment now loads explicit deployment items and separates them into:
  - pending items
  - resolved items
- Operators can choose `Available` or `Damaged` per pending deployment item and submit a partial return for any subset of unresolved items.

### Backend contract added
- Added `supabase/migrations/20260602173000_sunday_kit_item_returns.sql`.
- The migration adds `public.kit_deployment_items`.
- Existing deployment rows are backfilled into item rows so older deployments remain visible in the new UI.
- `public.deploy_sunday_kit` now creates deployment-item rows at deploy time.
- Added `public.return_sunday_kit_item_resolutions` for item-level return submission.

### Fallback behavior retained
- If the deployment-item schema is not available in a target environment yet, the UI falls back to the older returned/damaged count capture path.
- This keeps Sunday Kits operational while migrations are still rolling out.

### Baseline alignment improved
- The old mismatch where Sunday Kit returns were only aggregate counts is now closed at the workflow/UI level.
- The remaining Sunday Kit gap is deeper kit composition:
  - saved-kit membership is still not managed as a full asset-backed kit-definition editor in Settings

### Verification completed
- `npm run lint` passes after the Sunday Kit item-resolution pass.
- Verified the new item-resolution UI path in `src/app/(app)/check-out-in/page.tsx`.
- Verified the new helper functions in `src/lib/check-operations.ts`.
- Verified the migration exists for deployment-item storage and item-level Sunday Kit return resolution.

## 62. Implementation Checkpoint - 2026-06-02
This checkpoint records the Requests draft workflow pass.

### Requests draft behavior progressed
- `Requests > Asset`, `Requests > Special`, and `Requests > Returns` now each keep one local draft per workflow per user.
- Entering a workflow tab restores that workflow's saved draft into the form.
- Drafts now clear on successful submit.
- Each workflow now exposes an explicit discard action.

### Current implementation scope
- Drafts are stored locally in `localStorage`.
- The asset and special workflows now stop sharing one accidental in-memory form state when switching tabs because each tab rehydrates its own draft state.
- The history tab remains read-only and does not participate in draft storage.

### Baseline alignment improved
- This closes the previously explicit gap where draft autosave, resume, and discard were still missing from the request workspace.
- The main remaining Requests gap is still the strict active-location requirement on some submit paths when the scope is `All locations`.

### Verification completed
- `npm run lint` passes after the Requests draft autosave/restore/discard pass.
- Verified the workflow draft logic in `src/app/(app)/requests/page.tsx`.

## 63. Implementation Checkpoint - 2026-06-02
This checkpoint records the request source-location fix for `All locations` scope.

### Request source-location behavior progressed
- `Requests > Asset`, `Requests > Special`, and `Requests > Returns` no longer hard-fail just because the user is scoped to `All locations`.
- When there is no locked or selected active location, each workflow now exposes a source-location picker.
- Submit validation now requires one explicit source location per workflow before the request can be sent.

### Baseline alignment improved
- This closes the mismatch where some request submits were blocked under `All locations` despite the baseline allowing one basket per source location.
- The remaining Requests gap is now mostly conceptual polish around deeper basket modeling rather than a hard submit blocker.

### Verification completed
- `npm run lint` passes after the request source-location selection pass.
- Verified the source-location selection and validation flow in `src/app/(app)/requests/page.tsx`.

## 64. Implementation Checkpoint - 2026-06-02
This checkpoint records the Inventory allowed-edit implementation pass.

### Inventory edit behavior progressed
- The selected asset detail panel now includes a real inline edit form instead of a static allowed-fields summary only.
- Admin and asset-manager roles can now save changes for:
  - `Name`
  - `Tag`
  - `Department / Team`
- Staff can still inspect the allowed-edit surface but cannot save changes.

### Supporting implementation added
- `src/lib/inventory.ts` now carries `departmentId` and `locationId` on inventory asset records.
- Added `updateInventoryAssetDetails` for the allowed asset update path.
- The inventory page now refreshes the workspace after a successful save so both grouped and detail views stay in sync.

### Baseline alignment improved
- This closes the gap where Inventory described editable allowed fields but did not yet expose a real save path in the page.
- The remaining main Inventory gap is deeper action/context-menu behavior rather than missing edit support.

### Verification completed
- `npm run lint` passes after the Inventory inline edit pass.
- Verified the inline edit flow in `src/app/(app)/inventory/page.tsx`.
- Verified the update helper in `src/lib/inventory.ts`.

## 65. Implementation Checkpoint - 2026-06-02
This checkpoint records the Approvals bulk-action pass.

### Approvals bulk behavior progressed
- The queue list now supports multi-select for compatible approval rows.
- A shared bulk-note surface now exists above the queue list.
- Compatible bulk actions now run from the same page for:
  - reminders
  - approve
  - decline
  - request changes
  - damage resolution actions
- `Accept Return` remains intentionally single-item because each return review still depends on a final sign-in location.

### Baseline alignment improved
- This closes the earlier gap where Approvals was still mostly single-item despite the baseline allowing bulk handling for simple/compatible queues.
- The remaining approval bulk limitation is deliberate: return acceptance still needs item-level location choice at review time.

### Verification completed
- `npm run lint` passes after the Approvals bulk-action pass.
- Verified the bulk selection and shared-note flow in `src/app/(app)/approvals/page.tsx`.

## 66. Implementation Checkpoint - 2026-06-02
This checkpoint records the shell notification-center pass.

### Notification center progressed
- The placeholder bell icon in the shell is now a real notification center.
- The shell now shows:
  - unread count
  - category
  - priority
  - mark-read behavior
  - mark-all-read
  - clear-all
  - local per-user persistence

### Current implementation scope
- Notifications are currently local shell data, seeded by role, and persisted per user in `localStorage`.
- This closes the missing shell/UI side of notifications without pretending that the backend event router is complete.

### Baseline alignment improved
- Notifications are no longer just a placeholder icon in the shell.
- The remaining gap is backend-driven notification generation and routing, not the core interaction model.

### Verification completed
- `npm run lint` passes after the notification-center pass.
- Verified the shell notification UI in `src/components/app-shell.tsx`.
- Verified the local notification persistence helper in `src/lib/notifications.ts`.

## 43. Implementation Checkpoint - 2026-06-02
This checkpoint records the last queued workflow-completion pass after the report exports, duplicate resolution tools, and QR sheet export pass.

### Remaining approval-queue gaps closed
- `Approvals > Recipient` reminder actions are no longer scaffold-only.
- Manager/admin reminder sends now write back to the live approval item by:
  - incrementing reminder count
  - stamping the last reminder timestamp
  - storing the optional reminder note
  - appending an auditable reminder line to review context

### Damage resolution completion
- `Approvals > Damage Locks` no longer stops short on `Resolve: Lost`.
- When the live legacy resolution RPC does not provide a lost outcome, the app now completes the workflow directly against the current tables by:
  - marking the linked asset as `lost`
  - clearing the current holder
  - moving the damage case to `Resolved: Lost`

### Baseline alignment improved
- This closes the explicit queue dead ends that were still visible in the rebuilt approvals workspace despite having enough current schema to complete them.
- Recipient monitoring remains recipient-side for the actual accept/decline decision, but reminder follow-up is now operational from the manager/admin queue.
- Damage lock review now supports all three baseline terminal outcomes:
  - `Available`
  - `Damaged`
  - `Lost`

### Verification completed
- `npm run lint` passes
- `npm run build` passes

## 40. Implementation Checkpoint - 2026-06-02
This checkpoint records the `Settings > Reports` export completion pass in the current Next.js rebuild workspace.

### Reports export progress
- `Settings > Reports` is no longer a static placeholder.
- The reports workspace now supports live filtered report loading for:
  - `Damage`
  - `Asset History`
  - `Accountability`

### Filtering progress
- Reports now support a location filter from inside the settings workspace.
- Report type and location filter now drive the same underlying live row surface before export.

### Export progress
- Report export now supports:
  - `CSV`
  - `XLSX`
  - `PDF`
- Export output is generated from the current filtered view instead of a disconnected placeholder path.
- The same report surface now feeds on-screen preview plus export output.

### Fallback behavior
- If the preferred live report surface is not available, the page now falls back where possible:
  - damage reports can fall back to the legacy damage-report surface
  - warning text is shown inline in the workspace

### Verification completed
- `npm run build` passed after report export completion
- `npm run lint` passed after report export completion

## 41. Implementation Checkpoint - 2026-06-02
This checkpoint records the `Settings > Duplicates` compare-and-resolve pass in the current Next.js rebuild workspace.

### Duplicates workflow progress
- `Settings > Duplicates` is no longer a static list-only placeholder.
- The duplicates queue now supports:
  - selecting a duplicate pair
  - side-by-side comparison loading
  - survivor selection
  - resolution choice between `Merged` and `Not Duplicate`
  - required resolution note capture

### Compare surface progress
- The duplicate review panel now attempts to load live asset comparison details for both sides of a pair:
  - tag
  - name
  - serial
  - location
  - department
  - status
- If the richer compare surface cannot be loaded, the page falls back cleanly and keeps the admin review flow usable.

### Resolution progress
- The page now attempts a live duplicate-resolution write path first.
- If the preferred duplicate-resolution RPC is missing, the app now attempts a best-effort direct settings-table update path before falling back to a local review-only state.

### Verification completed
- `npm run build` passed after duplicate compare-and-resolve completion
- `npm run lint` passed after duplicate compare-and-resolve completion

## 42. Implementation Checkpoint - 2026-06-02
This checkpoint records the `Settings > Config` QR export output completion pass in the current Next.js rebuild workspace.

### QR export workflow progress
- `Settings > Config` now includes a real QR export asset-filter workspace instead of config-only numeric fields.
- The QR export surface now supports filtering by:
  - search
  - location
  - department
  - status
  - created-from date
  - created-to date

### QR output progress
- The page now loads a live filtered QR export preview set from the asset table.
- The page now generates a real print-ready PDF QR sheet from the filtered set.
- Output behavior now aligns materially closer to the baseline:
  - A4 PDF output
  - packed label layout
  - sorted by tag
  - UUID-encoded QR payloads
  - visible tag text on each label
  - outer border only

### Config alignment progress
- QR sheet generation now uses the saved config values already managed in `Settings > Config`:
  - label mm
  - page border mm
  - format

### Verification completed
- `npm run build` passed after QR export output completion
- `npm run lint` passed after QR export output completion

## 58. Implementation Checkpoint - 2026-06-02
This checkpoint records the live `Settings > Users` pass completed after the earlier `Kits`, `Consumables`, and `Config` settings work.

### Users settings progress
- `Settings > Users` is no longer a read-only placeholder.
- The page now supports a real admin/manager edit flow for the user fields that are already confirmed by the current schema.

### Scope of the implemented user editor
- The user editor now supports:
  - first name
  - surname
  - home base assignment
  - primary role assignment for admins
- Asset managers can only work inside their scoped location view.
- Asset managers do not get role-edit controls.

### Backend contract added
- A new write-side RPC now exists for the user editor flow:
  - `save_settings_user`
- The RPC updates:
  - `profiles.display_name`
  - `profiles.surname`
  - `profiles.full_name`
  - `profiles.assigned_location_id`
  - `profiles.asset_manager_location_id`
  - primary `user_roles` row replacement when a role is provided

### Implementation guardrails kept in place
- The current pass does not invent user-management fields that are not yet proven by the rebuild schema.
- Approval state and locked-state controls remain read-only in this pass.
- Department assignment is still not added as a write flow because the current user surface does not prove a stable department write path.

### Verification completed
- `npm run lint` passes after the live `Users` pass.
- `npm run build` passes after the live `Users` pass.
- Local runtime smoke test passed:
  - `/settings` returned `200`
  - `/check-out-in` returned `200`
  - `/requests` returned `200`

### Recommended next step
- Continue with the remaining `Settings` depth:
  - `Reports`
  - `Duplicates`

## 59. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the prior 2026-06-02 snapshot and records the current state after the live `Settings > Users` pass and localhost runtime smoke test.

### Current page status
- `Inventory`
  - live grouped inventory data
  - selected unit detail surface
  - recent asset-history preview
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live asset request submit
  - live special request submit
  - live return request submit
  - live request history
- `Approvals`
  - live approval queue where backend surface exists
  - live damage queue where backend surface exists
  - live review actions where confirmed
- `Check-out/In`
  - live `Standard`
  - live `Permanent`
  - live `Stationed`
  - live `Sunday Kits` first pass
  - live `QR Scan` manual batch pass
- `Dashboard`
  - live role-aware counts and feed cards
- `Settings`
  - live `Profile`
  - live `Users` first pass
  - live `Locations`
  - live `Departments`
  - live `Kits`
  - live `Consumables`
  - live `Config > qr_export`
  - `Reports` and `Duplicates` still remain to be finished

### Remaining major implementation focus
- `Settings > Reports`
- `Settings > Duplicates`
- deeper Sunday-kit item-level tracking if required later
- camera-based QR capture if required later

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes
- local `next start` smoke test passed on:
  - `/settings`
  - `/check-out-in`
  - `/requests`

## 56. Implementation Checkpoint - 2026-06-02
This checkpoint records the live `Settings > Kits` write-side pass completed after the second live `Settings` write-side pass.

### Kits write-side progress
- `Settings > Kits` is no longer read-only.
- The first live write-side pass now supports:
  - create saved kit definition
  - retire / re-enable saved kit definition

### Live actions added
- Admins can now create a saved kit with:
  - name
  - home base
  - item count
- Admins can now change active state for existing kit definitions from the rebuilt settings route.

### Backend contract added
- Dedicated settings write RPC contracts are now tracked in the repo for:
  - `create_settings_kit`
  - `set_settings_kit_active`

### Baseline alignment improved
- The rebuilt settings route now better reflects the locked baseline rule that `Kits` is the saved-kit builder and lifecycle workspace.
- The remaining gap is now item-membership editing depth, not absence of kit-definition lifecycle actions.

### What is still intentionally deferred on Kits
- Item-level kit membership editing is still deferred.
- Rich edit flows beyond create and active-state lifecycle are still deferred.
- Sunday-kit deployment still uses the saved definition list plus its separate deployment ledger rather than a full per-item kit builder surface.

### Verification completed
- `npm run lint` passed after the live `Settings > Kits` write-side pass.
- `npm run build` passed after the live `Settings > Kits` write-side pass.

## 57. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the live `Settings > Kits` write-side pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live `Sunday Kits` first-pass deploy/return ledger
  - live `QR Scan` manual batch workflow
  - live returns monitoring
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - live `Profile` basic save
  - live `Locations` add + active toggle
  - live `Departments` add + active toggle
  - live `Kits` create + active toggle
  - live `Consumables` add + active toggle
  - live `Config > qr_export` save
  - `Users`, `Reports`, and `Duplicates` write-side still deferred

### Remaining major implementation focus
- `Settings > Users` admin / manager edit sets
- `Settings > Reports` export flows
- `Settings > Duplicates` merge tooling
- broader config editing if required
- deeper Sunday-kit item-level modeling if required
- camera-based QR capture if required

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 54. Implementation Checkpoint - 2026-06-02
This checkpoint records the second live `Settings` write-side pass completed after the first live `Settings` write-side pass.

### Settings write-side progress
- `Settings` now has additional live write-side coverage for:
  - `Consumables`
  - `Config`

### Live actions added
- `Consumables` now supports:
  - add consumable
  - archive / re-enable consumable
- `Config` now supports:
  - live editing of the `qr_export` configuration block
  - saving label size, page border, and paper format values

### Backend contract added
- Dedicated settings write RPC contracts are now tracked in the repo for:
  - `create_settings_consumable`
  - `set_settings_consumable_active`
  - `save_settings_config`

### UX/state behavior improved
- The settings route now uses optimistic local updates for consumables and config rows so the interface remains responsive even when the read-side surface is partial.
- The QR export editor now has a real form instead of static explanatory copy only.

### Baseline alignment improved
- The rebuilt `Settings` route now better reflects the locked baseline rule that:
  - `Consumables` is an operational catalog plus stock-rule workspace
  - `Config` is the home for QR export tooling
- The remaining gap is now export generation depth and broader config breadth, not absence of any write path.

### What is still intentionally deferred on Settings
- `Users` split admin vs manager edit sets are still read-only.
- `Kits` write-side builder actions are still deferred.
- `Reports` export flows are still deferred.
- `Duplicates` merge tooling is still deferred.
- Broader non-QR config editing is still deferred.

### Verification completed
- `npm run lint` passed after the second live `Settings` write-side pass.
- `npm run build` passed after the second live `Settings` write-side pass.

## 55. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the second live `Settings` write-side pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live `Sunday Kits` first-pass deploy/return ledger
  - live `QR Scan` manual batch workflow
  - live returns monitoring
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - live `Profile` basic save
  - live `Locations` add + active toggle
  - live `Departments` add + active toggle
  - live `Consumables` add + active toggle
  - live `Config > qr_export` save
  - `Users`, `Kits`, `Reports`, and `Duplicates` write-side still deferred

### Remaining major implementation focus
- `Settings > Users` admin / manager edit sets
- `Settings > Kits` write-side builder actions
- `Settings > Reports` export flows
- `Settings > Duplicates` merge tooling
- broader config editing if required
- deeper Sunday-kit item-level modeling if required
- camera-based QR capture if required

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 52. Implementation Checkpoint - 2026-06-02
This checkpoint records the first live `Settings` write-side pass completed after the first live `Check-out/In > Sunday Kits` pass.

### Settings write-side progress
- `Settings` is no longer read-only across every section.
- The first live write-side pass now covers:
  - `Profile`
  - `Locations`
  - `Departments`

### Live actions added
- `Profile` now supports basic signed-in user name updates.
- `Locations` now supports:
  - add location
  - enable / disable location
- `Departments` now supports:
  - add department
  - enable / archive department

### Backend contract added
- Dedicated settings write RPC contracts are now tracked in the repo for:
  - `create_settings_location`
  - `set_settings_location_active`
  - `create_settings_department`
  - `set_settings_department_active`
- Profile updates now write directly through the existing `profiles` table surface used elsewhere in the app.

### Baseline alignment improved
- The rebuilt `Settings` route now better reflects the locked baseline rule that:
  - `Locations` is an admin-managed operational section
  - `Departments` is an admin-managed operational section
  - `Profile` is a real self-service settings area rather than read-only identity copy

### What is still intentionally deferred on Settings
- `Users` split admin vs manager edit sets are still read-only in this pass.
- `Kits` write-side builder actions are still deferred.
- `Consumables` write-side catalog / stock-rule actions are still deferred.
- `Reports` export flows are still deferred.
- `Duplicates` merge tooling is still deferred.
- `Config` update forms and bulk QR export tooling are still deferred.

### Verification completed
- `npm run lint` passed after the first live `Settings` write-side pass.
- `npm run build` passed after the first live `Settings` write-side pass.

## 53. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the first live `Settings` write-side pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live `Sunday Kits` first-pass deploy/return ledger
  - live `QR Scan` manual batch workflow
  - live returns monitoring
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - live `Profile` basic save
  - live `Locations` add + active toggle
  - live `Departments` add + active toggle
  - other write-side sections still deferred

### Remaining major implementation focus
- `Settings > Users` admin / manager edit sets
- `Settings > Kits` write-side builder actions
- `Settings > Consumables` write-side catalog / stock-rule actions
- `Settings > Reports` export flows
- `Settings > Duplicates` merge tooling
- `Settings > Config` update forms and QR export tooling
- deeper Sunday-kit item-level modeling if required
- camera-based QR capture if required

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 50. Implementation Checkpoint - 2026-06-02
This checkpoint records the first live `Check-out/In > Sunday Kits` pass completed after the live `Check-out/In > QR Scan` pass.

### Sunday Kits workflow progress
- `Check-out/In > Sunday Kits` is no longer scaffold-only.
- The tab now supports two live operational modes:
  - `Deploy`
  - `Returns`

### Live operator flow added
- `Deploy` now starts from the live saved-kits list already exposed through the settings surface.
- Operators can now deploy one saved kit at a time with:
  - responsible user
  - deployment location
  - optional deployment note
- `Returns` now operates against a live Sunday-kit deployment ledger and supports:
  - partial return counts
  - damaged item counts
  - optional return note

### Backend contract added
- A dedicated `kit_deployments` ledger is now tracked in the repo through a Supabase migration.
- Dedicated `deploy_sunday_kit` and `return_sunday_kit_items` RPC contracts are now tracked for this first live pass.

### Scope of this first live pass
- The new implementation is intentionally kit-level and count-based.
- It records deployment and partial-return progress in a real workflow ledger.
- Full item-level kit membership visibility and per-item return resolution are still intentionally deferred because the current repo does not expose a real kit-item schema.

### Baseline alignment improved
- The rebuilt operational workspace now has a real Sunday-kit deployment and return surface instead of placeholder structure only.
- The remaining Sunday-kit gap is now depth of item-level modeling, not absence of a live workflow path.

### What is still intentionally deferred after this pass
- Sunday-kit item membership detail is not yet visible from the live data layer.
- Per-item outcome handling for Sunday-kit returns is still deferred.
- Settings write-side CRUD/export/config tooling remains the main remaining implementation area.

### Verification completed
- `npm run lint` passed after the first live `Check-out/In > Sunday Kits` pass.
- `npm run build` passed after the first live `Check-out/In > Sunday Kits` pass.

## 51. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the first live `Check-out/In > Sunday Kits` pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live `Sunday Kits` first-pass deploy/return ledger
  - live `QR Scan` manual batch workflow
  - live returns monitoring
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Settings` write-side CRUD/export/config tooling
- deeper Sunday-kit item-level modeling if required
- camera-based QR capture if required

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 48. Implementation Checkpoint - 2026-06-02
This checkpoint records the live `Check-out/In > QR Scan` pass completed after the live `Check-out/In > Stationed` pass.

### QR workflow progress
- `Check-out/In > QR Scan` is no longer scaffold-only.
- The tab now supports two live batch modes:
  - `Sign Out`
  - `Sign In`

### Live operator flow added
- Operators can now paste or scan multiple asset codes into one batch input area.
- The tab resolves those codes against the live asset table before execution.
- The resolved batch can then run through live standard workflow actions:
  - standard sign-out with recipient selection
  - standard sign-in with final location and outcome selection

### Current implementation scope
- This first live pass uses manual code input instead of camera capture.
- The tab still preserves the baseline rule that one batch stays in one compatible workflow mode at a time.
- Batch execution now uses the real operational RPCs already wired for `Standard`.

### Backend/data integration added
- A new live resolver path now maps scanned/pasted asset codes to operational asset records from the live asset table.
- No speculative kit or camera schema was introduced for this pass.

### Baseline alignment improved
- The rebuilt operational workspace now better reflects the locked baseline intent for `QR Scan` as a fast bulk-operations surface.
- The remaining gap is now camera/scan-device integration, not the absence of any real batch workflow.

### What is still intentionally deferred on Check-out/In
- `Sunday Kits` remains scaffold-only.
- Camera capture / hardware-oriented scan intake is still deferred.
- QR batching is currently limited to the standard sign-out and sign-in workflow surfaces.

### Verification completed
- `npm run lint` passed after the live `Check-out/In > QR Scan` pass.
- `npm run build` passed after the live `Check-out/In > QR Scan` pass.

## 49. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the live `Check-out/In > QR Scan` pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live `QR Scan` manual batch workflow
  - live returns monitoring
  - `Sunday Kits` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Check-out/In > Sunday Kits`
- `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 46. Implementation Checkpoint - 2026-06-02
This checkpoint records the live `Check-out/In > Stationed` pass completed after the live `Check-out/In > Permanent` pass.

### Stationed workflow progress
- `Check-out/In > Stationed` is no longer scaffold-only.
- The tab now supports two live operational modes:
  - `Temporary Use`
  - `Return To Site`

### Live operator flow added
- `Temporary Use` now starts from a dedicated stationed-ready asset pool instead of reusing the standard sign-out view.
- `Return To Site` now starts from a dedicated stationed-traveling asset pool.
- The tab now captures:
  - selected assets
  - responsible user for temporary use
  - return site for intake
  - return outcome (`Stationed` or `Damaged`)
  - optional audit note

### Backend contract added
- Dedicated `stationed_checkout_assets` and `stationed_checkin_assets` RPC contracts are now tracked in the repo through a Supabase migration.
- The frontend now calls these dedicated stationed workflow RPCs instead of leaving the tab read-only.

### Read-side live data added
- The check-operations workspace now attempts to load dedicated stationed asset pools from the live asset table:
  - stationed-ready assets
  - stationed-active / traveling assets
- The page still degrades cleanly to fallback preview data if those read surfaces are unavailable.

### Baseline alignment improved
- The rebuilt operational workspace now better reflects the locked baseline distinction between:
  - `Stationed` as the site resting-state model
  - temporary use moving assets into `Traveling`
  - return intake resolving assets back to `Stationed` or into the damage path

### What is still intentionally deferred on Check-out/In
- `Sunday Kits` remains scaffold-only.
- `QR Scan` remains scaffold-only.
- Deeper damage-case metadata capture from stationed return intake is still intentionally light in this pass.

### Verification completed
- `npm run lint` passed after the live `Check-out/In > Stationed` pass.
- `npm run build` passed after the live `Check-out/In > Stationed` pass.

## 47. Current Progress Snapshot - 2026-06-02
This snapshot supersedes the earlier snapshot and records the current state after the live `Check-out/In > Stationed` pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live `Stationed`
  - live returns monitoring
  - `Sunday Kits` and `QR Scan` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Check-out/In > Sunday Kits`
- `Check-out/In > QR Scan`
- `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 44. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Check-out/In > Permanent` pass completed after the live `Requests > Special` submit pass.

### Permanent workflow progress
- `Check-out/In > Permanent` is no longer scaffold-only.
- The tab now supports two live operational modes:
  - `Direct Issue`
  - `Reassign`

### Live operator flow added
- `Direct Issue` now starts from the available/sign-out asset pool.
- `Reassign` now starts from the assigned/sign-in asset pool.
- Both modes now capture:
  - selected assets
  - receiving user
  - target home-base location
  - optional audit note

### Backend contract added
- A dedicated `permanent_assign_assets` RPC contract is now tracked in the repo through a Supabase migration.
- The frontend now calls this dedicated permanent-assignment RPC instead of leaving the tab read-only.

### Baseline alignment improved
- The rebuilt operational workspace now better reflects the locked baseline distinction between:
  - `Standard` for shared temporary assignment
  - `Permanent` for long-term holder assignment / reassignment
- The permanent workflow now has its own dedicated operator surface instead of being described only as future intent.

### What is still intentionally deferred on Check-out/In
- `Stationed` remains scaffold-only.
- `Sunday Kits` remains scaffold-only.
- `QR Scan` remains scaffold-only.
- Permanent sign-in-specific return-path nuance beyond the current dedicated assignment action is still intentionally light in this pass.

### Verification completed
- `npm run lint` passed after the live `Check-out/In > Permanent` pass.
- `npm run build` passed after the live `Check-out/In > Permanent` pass.

## 45. Current Progress Snapshot - 2026-06-01
This snapshot supersedes the earlier snapshot and records the current state after the live `Check-out/In > Permanent` pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live `Permanent`
  - live returns monitoring
  - `Stationed`, `Sunday Kits`, and `QR Scan` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Check-out/In > Stationed`
- `Check-out/In > Sunday Kits`
- `Check-out/In > QR Scan`
- `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 42. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Requests > Special` submit pass completed after the live `Requests > Returns` submit pass.

### Special workflow progress
- `Requests > Special` now submits into a live special-request workflow instead of remaining scaffold-only.
- The special request surface now supports:
  - `Stationed Use`
  - `Permanent Reassignment`
- The page now submits the selected target asset together with:
  - need date
  - duration
  - reason
  - event / use context

### Live integration added
- A new `submit_special_request` RPC contract is now tracked in the repo through a Supabase migration.
- Special-request submissions now create compatible request + approval records for the rebuilt approvals workflow.
- The requests workspace now attempts to load compatible legacy special-request history alongside:
  - bundle request history
  - legacy return-request history

### UX/state behavior improved
- The special request form now clears itself on success.
- The page now switches directly to `History` after successful special-request submission.
- Requests page messaging now reflects that:
  - `Asset` is live
  - `Special` is live
  - `Returns` is live

### Baseline alignment improved
- The requests route now better matches the locked baseline rule that special workflows are initiated from the requests workspace and then resolved from the approvals side.
- `Approvals > Special Requests` remains the review/decision surface after request creation.

### What is still intentionally deferred after this pass
- No post-submit edit/cancel flow exists yet for special requests.
- No more granular workflow-specific form fields beyond the shared staged fields have been added yet.

### Verification completed
- `npm run lint` passed after the live `Requests > Special` submit pass.
- `npm run build` passed after the live `Requests > Special` submit pass.

## 43. Current Progress Snapshot - 2026-06-01
This snapshot supersedes the earlier snapshot and records the current state after the live `Requests > Special` submit pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live special-request submit
  - live return-request submit
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live returns monitoring
  - `Permanent`, `Stationed`, `Sunday Kits`, and `QR Scan` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Check-out/In > Permanent`
- `Check-out/In > Stationed`
- `Check-out/In > Sunday Kits`
- `Check-out/In > QR Scan`
- `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 40. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Requests > Returns` submit pass completed after the deeper `Inventory` drill-in pass.

### Returns workflow progress
- `Requests > Returns` now submits into a live return-request workflow instead of remaining scaffold-only.
- The page now captures:
  - selected assigned assets
  - return date
  - preferred return location
  - optional note

### Live integration added
- The requests workspace now attempts to load compatible legacy return-request history alongside the newer bundle history surface.
- The returns submit action now calls the dedicated `submit_return_request` RPC.
- A matching Supabase migration has been added so the repo tracks the expected backend contract for this flow.

### UX/state behavior improved
- Returns submit now clears the basket and form on success.
- The page now switches the operator directly to `History` after a successful return-request submission.
- Feedback messaging now reflects that `Returns` is live while `Special` remains scaffolded.

### Baseline alignment improved
- The requests route now better matches the baseline rule that returns are requested from the request workspace and then finalized from the approvals side.
- `Approvals > Returns` remains the acceptance/review surface, while `Requests > Returns` now owns request creation.

### What is still intentionally deferred on Requests
- `Special > Stationed Use` submit is still scaffold-only.
- `Special > Permanent Reassignment` submit is still scaffold-only.
- No richer return-request edit/cancel flow is implemented yet after submission.

### Verification completed
- `npm run lint` passed after the live `Requests > Returns` submit pass.
- `npm run build` passed after the live `Requests > Returns` submit pass.

## 41. Current Progress Snapshot - 2026-06-01
This snapshot supersedes the earlier snapshot and records the current state after the live `Requests > Returns` submit pass.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - live return-request submit
  - special submit still deferred
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live returns monitoring
  - `Permanent`, `Stationed`, `Sunday Kits`, and `QR Scan` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Remaining major implementation focus
- `Requests > Special` submit
- `Check-out/In > Permanent`
- `Check-out/In > Stationed`
- `Check-out/In > Sunday Kits`
- `Check-out/In > QR Scan`
- `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes

## 36. Implementation Checkpoint - 2026-06-01
This checkpoint records the live `Dashboard` wiring pass completed after the live `Check-out/In` pass.

### Dashboard live-data progress
- `Dashboard` has now moved beyond structural-only role-aware cards.
- The page now attempts to load real live dashboard content derived from already-wired workflow surfaces instead of relying only on decorative placeholder rows.

### Top-card live status
- Dashboard top cards now derive from live page/workflow counts by role.
- Admin top cards now attempt to reflect live counts for:
  - approvals
  - damage locks
  - transfers/special-workflow volume
  - blocked workflows
- Asset manager top cards now attempt to reflect live counts for:
  - approvals
  - returns
  - sign-outs
  - damage tasks
- Staff and volunteer top cards now attempt to reflect live counts for:
  - pending approvals
  - assigned items
  - return requests
  - damage actions

### Lower-card live status
- Lower dashboard sections now attempt to load real operational-feed rows from the surfaces already wired elsewhere in the app, including:
  - recent asset activity
  - request history/request summaries
  - return monitoring
  - damage workflow activity
  - inventory/location snapshot data
- The page still follows the locked baseline rule that these sections remain:
  - operational-feed based
  - preview-capped
  - navigation-oriented

### Fallback behavior added
- `Dashboard` now degrades gracefully when one or more source workflow surfaces are unavailable.
- The page now runs in:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners now explain when dashboard values are partially falling back.

### What is still intentionally deferred on Dashboard
- The dashboard does not yet include direct drill-through navigation wiring per card row.
- No real-time subscription layer has been added yet for auto-refresh.
- The dashboard is now operationally informative, but still not the final fully interactive command surface.

### Verification completed
- Production build passed successfully after the live `Dashboard` wiring pass.

### Recommended next step
- Continue the live read-side replacement pass with:
  - `Settings`

## 37. Implementation Checkpoint - 2026-06-01
This checkpoint records the live read-side `Settings` wiring pass completed after the live `Dashboard` pass.

### Settings live-data progress
- `Settings` has now moved beyond structural-only section scaffolds.
- The page now attempts to load real live read-side data for:
  - users
  - locations
  - departments
  - kits
  - consumables
  - duplicates
  - config

### Profile tab progress
- `Profile` now reflects live signed-in identity context where available, including:
  - operator name
  - role
  - email
  - current home-base resolution
- The page still keeps `Profile` visible to all roles as already locked in the baseline.

### Operational tab live status
- `Users` now attempts to load from the live settings RPC surface.
- `Locations` now attempts to load from the live settings RPC surface.
- `Departments` now attempts to load from the live settings RPC surface.
- `Kits` now attempts to load from the live settings RPC surface.
- `Consumables` now attempts to load from the live settings RPC surface.
- `Duplicates` now attempts to load from the live settings RPC surface.
- `Config` now attempts to load from the live settings RPC surface.
- `Reports` and `Roles` remain read-only informational sections in this pass because they do not yet have equivalent final v2 write-side forms or export tooling in the new app.

### Fallback behavior added
- `Settings` now degrades gracefully when one or more settings RPCs are unavailable.
- The page now runs in:
  - `Live Data`
  - `Mixed Data`
  - `Fallback Preview`
- Warning banners now explain which settings sections are still falling back.

### What is still intentionally deferred on Settings
- No write-side CRUD actions are implemented yet in the new web app pass.
- No profile-edit save flow is implemented yet.
- No report export tooling is implemented yet.
- No duplicate merge action flow is implemented yet.
- No config update forms are implemented yet.

### Verification completed
- Production build passed successfully after the live read-side `Settings` wiring pass.

### Recommended next step
- Continue with deeper workflow completion inside already-built pages.

## 38. Implementation Checkpoint - 2026-06-01
This checkpoint records the deeper `Inventory` drill-in pass completed after the live `Settings` pass.

### Inventory drill-in progress
- `Inventory` has now moved beyond grouped cards plus unit list only.
- The unit drill-in now supports a selected physical unit detail surface inside the existing page.

### Asset detail progress
- Selecting a physical unit now exposes a dedicated detail panel within the inventory route.
- The detail surface now leads with:
  - asset name
  - tag
  - serial
  - current location
  - department
  - holder
  - current state badge

### Recent history preview progress
- Inventory now attempts to load a recent asset-history preview for the selected unit.
- The history preview now attempts to show:
  - action
  - note
  - performed by
  - created date/time
- If the live history surface is unavailable, the page falls back cleanly to preview history rows.

### Baseline alignment improved
- The inventory route now better reflects the locked baseline rule that:
  - asset detail leads with current state and allowed actions
  - recent history preview is visible from the asset detail surface
- The current pass also exposes the allowed-edit summary more clearly in the selected asset detail area.

### What is still intentionally deferred on Inventory
- The unit-row context menu is still not implemented as a real action menu.
- Full dedicated asset-detail routing is still not added.
- Real inline edit forms for the allowed edit fields are still deferred.
- Full history navigation beyond the recent preview is still deferred.

### Verification completed
- Production build passed successfully after the deeper `Inventory` drill-in/history pass.

### Recommended next step
- Continue with deeper workflow completion inside:
  - `Requests`
  - or `Check-out/In`

## 39. Current Progress Snapshot - 2026-06-01
This snapshot supersedes the earlier snapshot and records the current state after the live `Dashboard`, live read-side `Settings`, and deeper `Inventory` drill-in passes.

### Current page status
- `Inventory`
  - grouped-catalog UI exists
  - loads live inventory data with fallback handling
  - selected unit detail surface now exists
  - recent asset-history preview now exists
- `My Assets`
  - live assigned assets
  - live pending recipient approvals
  - live pending handovers
  - live damage history where available
- `Requests`
  - live requestable assets
  - live request history
  - live asset-request submit
  - special and return submit still deferred
- `Approvals`
  - live approval queues where backend surface exists
  - live damage-lock queues where backend surface exists
  - live approval and damage resolution actions where confirmed
- `Check-out/In`
  - live `Standard` sign-out
  - live `Standard` sign-in
  - live returns monitoring
  - `Permanent`, `Stationed`, `Sunday Kits`, and `QR Scan` still scaffold-only
- `Dashboard`
  - live role-aware top-card counts
  - live role-aware lower feed cards
  - fallback-aware mixed-data behavior
- `Settings`
  - live read-side section data where RPCs exist
  - write-side CRUD and exports still deferred

### Overall completion view
- Top-level page shell coverage: complete
- Shared auth/access shell: complete
- Core live workflow pages now materially active:
  - `Inventory`
  - `My Assets`
  - `Requests`
  - `Approvals`
  - `Check-out/In > Standard`
  - `Dashboard`
  - `Settings` read-side
- Remaining major implementation focus:
  - `Requests > Special` submit
  - `Requests > Returns` submit
  - `Check-out/In > Permanent`
  - `Check-out/In > Stationed`
  - `Check-out/In > Sunday Kits`
  - `Check-out/In > QR Scan`
  - `Settings` write-side CRUD/export/config tooling

### Verification state at this snapshot
- `npm run lint` passes
- `npm run build` passes
