import { AppSnapshot, AppRole, ApprovalStatus, AssetState, MyAssetsTabKey, RequestsTabKey } from "./types";

const rows = (prefix: string, status: string, count = 3) =>
  Array.from({ length: count }, (_, index) => ({
    id: `${prefix}-${index + 1}`,
    title: `${prefix} ${index + 1}`,
    subtitle: `Operational item ${index + 1}`,
    status,
  }));

export const DEFAULT_ROLE: AppRole = "staff";

export const MOCK_SNAPSHOT: AppSnapshot = {
  dashboard: {
    topCards: {
      admin: [
        { id: "a1", label: "Approvals", value: "18", route: "/approvals" },
        { id: "a2", label: "Damage Locks", value: "2", route: "/approvals" },
        { id: "a3", label: "Transfers", value: "4", route: "/approvals" },
        { id: "a4", label: "Blocked Workflows", value: "3", route: "/approvals" },
      ],
      asset_manager: [
        { id: "m1", label: "Approvals", value: "9", route: "/approvals" },
        { id: "m2", label: "Returns", value: "5", route: "/check" },
        { id: "m3", label: "Sign-Outs", value: "14", route: "/check" },
        { id: "m4", label: "Damage Tasks", value: "2", route: "/approvals" },
      ],
      staff: [
        { id: "s1", label: "Pending Approvals", value: "2", route: "/my-assets" },
        { id: "s2", label: "My Assigned Items", value: "6", route: "/my-assets" },
        { id: "s3", label: "Return Requests", value: "1", route: "/requests" },
        { id: "s4", label: "Damage Actions", value: "0", route: "/my-assets" },
      ],
      volunteer: [
        { id: "v1", label: "Pending Approvals", value: "1", route: "/my-assets" },
        { id: "v2", label: "My Assigned Items", value: "3", route: "/my-assets" },
        { id: "v3", label: "Return Requests", value: "0", route: "/requests" },
        { id: "v4", label: "Damage Actions", value: "0", route: "/my-assets" },
      ],
    },
    lowerCards: {
      admin: [
        { id: "la1", title: "Recent Asset Activity", rows: ["Camera CEN-001 signed in", "Mic LAN-004 transferred", "Battery KRU-014 marked damaged"] },
        { id: "la2", title: "Recent Requests", rows: ["4 asset requests pending", "2 special requests under review", "1 return declined"] },
        { id: "la3", title: "Recent Returns", rows: ["Office intake completed", "Traveling items routed", "Shared return split by item"] },
        { id: "la4", title: "Recent Damage Reports", rows: ["Volunteer report submitted", "Admin review pending", "Lost outcome resolved"] },
        { id: "la5", title: "Location Snapshot", rows: ["Centurion 112 items", "Lanseria 67 items", "Traveling 9 items"] },
      ],
      asset_manager: [
        { id: "lm1", title: "Recent Asset Activity", rows: ["4 sign-outs today", "2 sign-ins routed", "1 parked in Traveling"] },
        { id: "lm2", title: "Open Requests Snapshot", rows: ["3 asset requests", "1 stationed-use request", "2 return requests"] },
        { id: "lm3", title: "Returns in Progress", rows: ["2 accepted", "1 intake pending", "0 declined"] },
        { id: "lm4", title: "Damage Workflow Updates", rows: ["1 form submitted", "1 under review", "0 locked"] },
        { id: "lm5", title: "Location Inventory Snapshot", rows: ["Available 84", "Assigned 11", "Damaged 2"] },
      ],
      staff: [
        { id: "ls1", title: "My Recent Requests", rows: ["Lighting request pending", "Kit request approved", "Tripod request draft"] },
        { id: "ls2", title: "My Return Requests", rows: ["Office return accepted", "Mic return pending", "Camera return completed"] },
        { id: "ls3", title: "My Pending Items", rows: ["1 item awaiting approval", "1 request change", "0 blocked"] },
        { id: "ls4", title: "Home Base Inventory Highlights", rows: ["Centurion cameras available", "2 damaged cables", "Traveling stock visible"] },
      ],
      volunteer: [
        { id: "lv1", title: "My Pending Items", rows: ["1 assignment awaiting response", "0 return reminders", "0 damage forms"] },
        { id: "lv2", title: "My Assigned Assets", rows: ["2 microphones", "1 cable kit", "1 power pack"] },
        { id: "lv3", title: "My Return Requests", rows: ["None open", "Last return completed", "No intake delays"] },
        { id: "lv4", title: "My Damage Actions", rows: ["No active locks", "No form required", "History visible only"] },
      ],
    },
  },
  inventoryGroups: [
    { id: "g1", name: "Sony FX3", type: "Camera", available: 4, assigned: 2, traveling: 1, damaged: 0, locations: ["Centurion", "Lanseria"] },
    { id: "g2", name: "Shure SM58", type: "Microphone", available: 12, assigned: 5, traveling: 2, damaged: 1, locations: ["Centurion", "Krugersdorp", "Office"] },
    { id: "g3", name: "Lighting Kit", type: "Kit", available: 3, assigned: 1, traveling: 0, damaged: 0, locations: ["Lanseria"] },
  ],
  assetUnits: [
    { id: "u1", tag: "CEN-CAM-001", name: "Sony FX3", serial: "SN-FX3-001", status: "Available", currentLocation: "Centurion", department: "Production" },
    { id: "u2", tag: "LAN-CAM-002", name: "Sony FX3", serial: "SN-FX3-002", status: "Assigned", currentLocation: "Traveling", holder: "Lebo Mokoena", department: "Production" },
    { id: "u3", tag: "KRU-MIC-004", name: "Shure SM58", serial: "SN-SM58-004", status: "Damaged", currentLocation: "Krugersdorp", department: "Audio", notes: "Connector loose" },
    { id: "u4", tag: "OFF-KIT-010", name: "Lighting Kit", serial: "NA", status: "Stationed", currentLocation: "Office", department: "Lighting" },
  ],
  requests: [
    { id: "rq1", title: "Camera request bundle", subtitle: "Need date Jun 4, source Centurion", status: "Pending" },
    { id: "rq2", title: "Stationed use request", subtitle: "LED wall controller, Lanseria", status: "Approved" },
    { id: "rq3", title: "Return request", subtitle: "3 items routed to Office", status: "In Progress" },
  ],
  approvals: {
    Recipient: [{ id: "ar1", title: "Recipient approval", subtitle: "2 items assigned by Thato", status: "Awaiting Recipient" as ApprovalStatus }],
    "Asset Requests": rows("Asset Request", "Pending", 3),
    "Special Requests": rows("Special Request", "Pending", 2),
    Returns: rows("Return", "Pending", 3),
    "Damage Locks": rows("Damage Lock", "Under Review", 2),
  },
  myAssets: {
    Assigned: [
      { id: "ma1", title: "Sony FX3", subtitle: "Assigned to you, return Jun 7", status: "Approved" },
      { id: "ma2", title: "Battery Kit", subtitle: "Traveling with your assignment", status: "Approved" },
    ],
    Pending: [{ id: "mp1", title: "Wireless Mic Pack", subtitle: "Awaiting your approval", status: "Awaiting Recipient" as ApprovalStatus }],
    Damage: [{ id: "md1", title: "Shure SM58", subtitle: "Resolved: Damaged", status: "Resolved: Damaged" }],
  },
  notifications: [
    { id: "n1", title: "New asset request", body: "A Centurion request needs review.", category: "Approvals", urgent: true, createdAt: "Today" },
    { id: "n2", title: "Return accepted", body: "Your 3-item return was signed in to Office.", category: "Returns", urgent: false, createdAt: "Today" },
    { id: "n3", title: "Damage lock", body: "A damaged sign-in triggered a user lock.", category: "Damage", urgent: true, createdAt: "Yesterday" },
  ],
};

export const REQUESTS_TABS: RequestsTabKey[] = ["Asset", "Special", "Returns", "History"];
export const MY_ASSETS_TABS: MyAssetsTabKey[] = ["Assigned", "Pending", "Damage"];

export const ASSET_STATUS_COLORS: Record<AssetState, string> = {
  Available: "#22c55e",
  Assigned: "#3b82f6",
  Traveling: "#f59e0b",
  Stationed: "#8b5cf6",
  Damaged: "#ef4444",
};
