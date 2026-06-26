export interface InventoryItem {
  id: string;
  no: string;
  code: string;
  category: string;
  name: string;
  spec: string;
  qty: number;
  priceUnit: number;
  priceTotal: number;
  acquisitionDate: string;
  locationCode: string;
  locationName: string;
  conditionRaw: string;
  status: 'Baik' | 'Rusak Ringan' | 'Rusak Berat' | 'Tidak Diketahui' | string;
  usefulLife: number;
  depreciation: number;
}

export interface BranchStat {
  code: string;
  name: string;
  itemCount: number;
  itemQty: number;
  totalValue: number;
}

export interface CategoryStat {
  name: string;
  itemCount: number;
  totalValue: number;
}

export interface StatusStat {
  name: string;
  count: number;
}

export interface InventoryStats {
  totalItems: number;
  totalQty: number;
  totalValue: number;
  locations: BranchStat[];
  categories: CategoryStat[];
  statuses: StatusStat[];
}

export interface TransferLog {
  id: string;
  itemId: string;
  itemName: string;
  assetCode: string;
  fromLocationCode: string;
  fromLocationName: string;
  toLocationCode: string;
  toLocationName: string;
  qty: number;
  transferDate: string; // YYYY-MM-DD
  notes?: string;
  operator?: string;
}

export interface UserAccount {
  name: string;
  email: string;
  role: 'SUPER_ADMIN' | 'STAF_CABANG';
  branchCode: string;
  restrictToBranch: boolean;
}

export interface DisposalRequest {
  id: string; // DISP-XXXX
  itemId: string;
  itemName: string;
  assetCode: string;
  locationCode: string;
  locationName: string;
  qty: number;
  type: 'DIBUANG' | 'HILANG'; // DIBUANG = rusak & buang, HILANG = hilang
  reason: string;
  requestedBy: string;
  requestedDate: string; // YYYY-MM-DD
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  approvedBy?: string;
  approvedDate?: string; // YYYY-MM-DD
  rejectReason?: string;
}

export interface AuditLog {
  id: string; // AUD-XXXX
  itemId: string;
  itemName: string;
  assetCode: string;
  auditedBy: string;
  auditDate: string; // YYYY-MM-DD
  expectedQty: number;
  expectedLocationCode: string;
  expectedLocationName: string;
  expectedStatus: string;
  actualQty: number;
  actualLocationCode: string;
  actualLocationName: string;
  actualStatus: string;
  hasDiscrepancy: boolean;
  discrepancyDetails: string;
  status: 'UNRESOLVED' | 'RESOLVED';
  notes?: string;
}

export interface AuditNotification {
  id: string; // NOTIF-XXXX
  title: string;
  message: string;
  auditLogId: string;
  itemId: string;
  itemName: string;
  discrepancyType: 'QTY_MISMATCH' | 'LOC_MISMATCH' | 'STATUS_MISMATCH' | 'MULTIPLE_MISMATCH';
  severity: 'WARNING' | 'CRITICAL';
  createdDate: string;
  isRead: boolean;
}


