export const MembershipRole = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  ADMIN: 'ADMIN',
  MAINTENANCE_MANAGER: 'MAINTENANCE_MANAGER',
  TECHNICIAN: 'TECHNICIAN',
  OPERATOR: 'OPERATOR',
  WAREHOUSE: 'WAREHOUSE',
} as const;
export type MembershipRole = (typeof MembershipRole)[keyof typeof MembershipRole];

export const TenantStatus = {
  ACTIVE: 'ACTIVE',
  SUSPENDED: 'SUSPENDED',
} as const;
export type TenantStatus = (typeof TenantStatus)[keyof typeof TenantStatus];

export const UserStatus = {
  ACTIVE: 'ACTIVE',
  DISABLED: 'DISABLED',
} as const;
export type UserStatus = (typeof UserStatus)[keyof typeof UserStatus];

export const EquipmentStatus = {
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
  ARCHIVED: 'ARCHIVED',
} as const;
export type EquipmentStatus = (typeof EquipmentStatus)[keyof typeof EquipmentStatus];

export const FaultStatus = {
  OPEN: 'OPEN',
  ACKNOWLEDGED: 'ACKNOWLEDGED',
  IN_PROGRESS: 'IN_PROGRESS',
  RESOLVED: 'RESOLVED',
  CLOSED: 'CLOSED',
  CANCELLED: 'CANCELLED',
} as const;
export type FaultStatus = (typeof FaultStatus)[keyof typeof FaultStatus];

export const FaultPriority = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL',
} as const;
export type FaultPriority = (typeof FaultPriority)[keyof typeof FaultPriority];

export const WorkOrderStatus = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  ON_HOLD: 'ON_HOLD',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type WorkOrderStatus = (typeof WorkOrderStatus)[keyof typeof WorkOrderStatus];

export const WorkActivityKind = {
  NOTE: 'NOTE',
  ACTION: 'ACTION',
} as const;
export type WorkActivityKind = (typeof WorkActivityKind)[keyof typeof WorkActivityKind];

export const QR_PATH_PREFIX = '/q/';

export function equipmentQrPath(qrPublicId: string): string {
  return `${QR_PATH_PREFIX}${qrPublicId}`;
}

export interface ApiErrorBody {
  statusCode: number;
  error: string;
  code: string;
  message: string | string[];
  timestamp: string;
  path: string;
}

export interface PageMeta {
  page: number;
  pageSize: number;
  total: number;
  pageCount: number;
}

export interface DataResponse<T> {
  data: T;
}

export interface ListResponse<T> {
  data: T[];
  meta: PageMeta;
}

export interface SiteSummaryDto {
  id: string;
  name: string;
  timezone: string;
}

export interface SiteDto extends SiteSummaryDto {
  tenantId: string;
  createdAt: string;
  updatedAt: string;
}

export interface EquipmentDto {
  id: string;
  tenantId: string;
  siteId: string;
  code: string;
  name: string;
  description: string | null;
  status: EquipmentStatus;
  qrPublicId: string;
  qrPath: string;
  qrUrl: string;
  version: number;
  createdAt: string;
  updatedAt: string;
  site: SiteSummaryDto;
}

export interface EquipmentSummaryDto {
  id: string;
  code: string;
  name: string;
}

export interface UserSummaryDto {
  id: string;
  name: string;
  email: string;
}

export interface FaultDto {
  id: string;
  tenantId: string;
  equipmentId: string;
  reporterId: string;
  description: string;
  status: FaultStatus;
  priority: FaultPriority;
  workOrderCount: number;
  createdAt: string;
  updatedAt: string;
  equipment: EquipmentSummaryDto;
}

export interface FaultDetailDto extends FaultDto {
  workOrders: WorkOrderSummaryDto[];
  allowedTransitions: FaultStatus[];
}

export interface WorkOrderSummaryDto {
  id: string;
  number: string;
  title: string;
  status: WorkOrderStatus;
  assignee: UserSummaryDto | null;
}

export interface WorkOrderActivityDto {
  id: string;
  workOrderId: string;
  actor: UserSummaryDto;
  kind: WorkActivityKind;
  description: string;
  createdAt: string;
}

export interface WorkOrderDto {
  id: string;
  tenantId: string;
  number: string;
  faultId: string;
  equipmentId: string;
  title: string;
  description: string | null;
  status: WorkOrderStatus;
  version: number;
  assignee: UserSummaryDto | null;
  createdBy: UserSummaryDto;
  openedAt: string;
  startedAt: string | null;
  completedAt: string | null;
  cancelledAt: string | null;
  createdAt: string;
  updatedAt: string;
  equipment: EquipmentSummaryDto;
  fault: {
    id: string;
    status: FaultStatus;
    priority: FaultPriority;
    description: string;
  };
}

export interface WorkOrderDetailDto extends WorkOrderDto {
  activities: WorkOrderActivityDto[];
  allowedTransitions: WorkOrderStatus[];
  canAssign: boolean;
  canClaim: boolean;
  canAddActivity: boolean;
}

export interface MembershipDto {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantSlug: string;
  tenantStatus: TenantStatus;
  role: MembershipRole;
  createdAt: string;
}

export interface MeDto {
  id: string;
  email: string;
  name: string;
  status: UserStatus;
  memberships: MembershipDto[];
}

export interface SessionUserDto {
  id: string;
  email: string;
  name: string;
}

export interface SessionDto {
  accessToken: string;
  user: SessionUserDto;
}

export interface TenantDto {
  id: string;
  name: string;
  slug: string;
  status: TenantStatus;
  createdAt: string;
  updatedAt: string;
}

export interface ProvisionTenantResult {
  tenant: TenantDto;
  site: SiteDto;
  admin: {
    id: string;
    email: string;
    name: string;
    role: MembershipRole;
  };
}

export interface TenantMembershipDto {
  id: string;
  userId: string;
  email: string;
  name: string;
  role: MembershipRole;
  createdAt: string;
}

export const SyncOperationType = {
  FAULT_CREATE: 'FAULT_CREATE',
} as const;
export type SyncOperationType = (typeof SyncOperationType)[keyof typeof SyncOperationType];

export const SyncResultStatus = {
  APPLIED: 'APPLIED',
  DUPLICATE: 'DUPLICATE',
  REJECTED: 'REJECTED',
  CONFLICT: 'CONFLICT',
  RETRYABLE: 'RETRYABLE',
} as const;
export type SyncResultStatus = (typeof SyncResultStatus)[keyof typeof SyncResultStatus];

export interface SyncFaultCreatePayload {
  equipmentId: string;
  description: string;
  priority: FaultPriority;
}

export interface SyncPushOperation {
  operationId: string;
  type: SyncOperationType;
  clientCreatedAt: string;
  payload: SyncFaultCreatePayload;
}

export interface SyncPushRequest {
  deviceId: string;
  operations: SyncPushOperation[];
}

export interface SyncPushOperationResult {
  operationId: string;
  status: SyncResultStatus;
  code?: string;
  message?: string;
  entityType?: string;
  entityId?: string;
  entity?: FaultDto;
}

export interface SyncPushResponse {
  results: SyncPushOperationResult[];
}

export const MaintenanceCadence = {
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type MaintenanceCadence = (typeof MaintenanceCadence)[keyof typeof MaintenanceCadence];

export const MaintenanceTaskStatus = {
  OPEN: 'OPEN',
  COMPLETED: 'COMPLETED',
  CANCELLED: 'CANCELLED',
} as const;
export type MaintenanceTaskStatus =
  (typeof MaintenanceTaskStatus)[keyof typeof MaintenanceTaskStatus];

export const StockReason = {
  RECEIPT: 'RECEIPT',
  ISSUE: 'ISSUE',
  ADJUSTMENT: 'ADJUSTMENT',
  WORK_ORDER: 'WORK_ORDER',
} as const;
export type StockReason = (typeof StockReason)[keyof typeof StockReason];

export const AttachmentEntityType = {
  fault: 'fault',
  maintenance_task: 'maintenance_task',
  work_order: 'work_order',
} as const;
export type AttachmentEntityType = (typeof AttachmentEntityType)[keyof typeof AttachmentEntityType];

export interface MaintenancePlanItemDto {
  id: string;
  sortOrder: number;
  label: string;
  required: boolean;
}

export interface MaintenancePlanDto {
  id: string;
  tenantId: string;
  equipmentId: string;
  title: string;
  description: string | null;
  cadence: MaintenanceCadence;
  interval: number;
  nextDueAt: string;
  active: boolean;
  assignee: UserSummaryDto | null;
  createdAt: string;
  updatedAt: string;
  equipment: EquipmentSummaryDto;
  items: MaintenancePlanItemDto[];
}

export interface MaintenanceCheckItemDto {
  id: string;
  sortOrder: number;
  label: string;
  required: boolean;
  checked: boolean;
  note: string | null;
}

export interface MaintenanceTaskDto {
  id: string;
  tenantId: string;
  planId: string;
  equipmentId: string;
  title: string;
  dueAt: string;
  status: MaintenanceTaskStatus;
  version: number;
  overdue: boolean;
  assignee: UserSummaryDto | null;
  completedAt: string | null;
  completedBy: UserSummaryDto | null;
  createdAt: string;
  updatedAt: string;
  equipment: EquipmentSummaryDto;
  items: MaintenanceCheckItemDto[];
}

export interface PartDto {
  id: string;
  tenantId: string;
  code: string;
  name: string;
  unit: string;
  minQuantity: number;
  quantity: number;
  belowMin: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface StockMovementDto {
  id: string;
  partId: string;
  actor: UserSummaryDto;
  reason: StockReason;
  delta: number;
  quantityAfter: number;
  workOrderId: string | null;
  operationId: string | null;
  note: string | null;
  createdAt: string;
}

export interface WorkOrderPartUseDto {
  id: string;
  workOrderId: string;
  partId: string;
  partCode: string;
  partName: string;
  quantity: number;
  movementId: string;
  createdAt: string;
}

export interface AttachmentDto {
  id: string;
  tenantId: string;
  entityType: AttachmentEntityType;
  entityId: string;
  fileName: string;
  contentType: string;
  size: number;
  uploadedBy: UserSummaryDto;
  createdAt: string;
}

export interface EquipmentImportRowResult {
  row: number;
  status: 'created' | 'skipped' | 'error';
  code?: string;
  equipmentId?: string;
  message: string;
}

export interface EquipmentImportResult {
  created: number;
  skipped: number;
  failed: number;
  rows: EquipmentImportRowResult[];
}

export interface RecurringFaultDto {
  equipmentId: string;
  code: string;
  name: string;
  count: number;
}

export interface MaintenanceReportDto {
  from: string;
  to: string;
  faultCount: number;
  avgFirstResponseMinutes: number | null;
  avgCloseMinutes: number | null;
  plannedCompliancePercent: number | null;
  dueTaskCount: number;
  completedOnTimeCount: number;
  recurringFaults: RecurringFaultDto[];
}
