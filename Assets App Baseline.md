# Working Baseline

This is the current working baseline based on the decisions locked so far. It should be treated as the implementation baseline unless superseded by a newer explicitly approved revision.

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
