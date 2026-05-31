export type AppRole = "admin" | "asset_manager" | "staff" | "volunteer";

export type LocationName =
  | "Centurion"
  | "Krugersdorp"
  | "Lanseria"
  | "Office"
  | "Traveling"
  | "Unassigned";

export type AssetState = "Available" | "Assigned" | "Traveling" | "Stationed" | "Damaged";
export type WorkflowStatus = "Draft" | "Pending" | "Approved" | "Declined" | "In Progress" | "Completed" | "Blocked";
export type ApprovalStatus = "Pending" | "Approved" | "Declined" | "Request Changes" | "Awaiting Recipient";
export type ReturnStatus = "Pending" | "Accepted" | "Routed to Intake" | "In Progress" | "Completed" | "Declined";
export type DamageStatus =
  | "Locked"
  | "Form Pending"
  | "Form Submitted"
  | "Under Review"
  | "Resolved: Available"
  | "Resolved: Damaged"
  | "Resolved: Lost";

export type DashboardCard = {
  id: string;
  label: string;
  value: string;
  route: string;
};

export type DashboardFeedCard = {
  id: string;
  title: string;
  rows: string[];
};

export type UserProfile = {
  id: string;
  email: string;
  fullName: string;
  role: AppRole;
  homeBase: LocationName;
  department?: string;
  approved: boolean;
  locked: boolean;
};

export type InventoryGroup = {
  id: string;
  name: string;
  type: string;
  available: number;
  assigned: number;
  traveling: number;
  damaged: number;
  locations: LocationName[];
};

export type AssetUnit = {
  id: string;
  tag: string;
  name: string;
  serial: string;
  status: AssetState;
  currentLocation: LocationName;
  holder?: string;
  department: string;
  notes?: string;
};

export type RequestQueueRow = {
  id: string;
  title: string;
  subtitle: string;
  status: string;
  route?: string;
};

export type NotificationCategory = "Approvals" | "Requests" | "Damage" | "Returns";

export type NotificationRecord = {
  id: string;
  title: string;
  body: string;
  category: NotificationCategory;
  urgent: boolean;
  createdAt: string;
};

export type RequestsTabKey = "Asset" | "Special" | "Returns" | "History";
export type ApprovalsTabKey = "Recipient" | "Asset Requests" | "Special Requests" | "Returns" | "Damage Locks";
export type MyAssetsTabKey = "Assigned" | "Pending" | "Damage";
export type CheckTabKey = "Standard" | "Permanent" | "Stationed" | "Sunday Kits" | "Returns" | "QR Scan";

export type AppSnapshot = {
  dashboard: {
    topCards: Record<AppRole, DashboardCard[]>;
    lowerCards: Record<AppRole, DashboardFeedCard[]>;
  };
  inventoryGroups: InventoryGroup[];
  assetUnits: AssetUnit[];
  requests: RequestQueueRow[];
  approvals: Record<ApprovalsTabKey, RequestQueueRow[]>;
  myAssets: Record<MyAssetsTabKey, RequestQueueRow[]>;
  notifications: NotificationRecord[];
};
