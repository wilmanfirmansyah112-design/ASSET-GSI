import { InventoryItem, InventoryStats, BranchStat, CategoryStat, StatusStat, TransferLog, DisposalRequest, AuditLog, AuditNotification } from "./types";
import initialItems from "./inventory_data.json";

const STORAGE_KEY = "gsi_inventory_data";
const LOGS_STORAGE_KEY = "gsi_transfer_logs";
const DISPOSAL_STORAGE_KEY = "gsi_disposal_requests";
const AUDIT_LOGS_STORAGE_KEY = "gsi_audit_logs";
const NOTIFICATIONS_STORAGE_KEY = "gsi_audit_notifications";

// Utility helpers for automatic asset code generation
const getCategoryAbbreviation = (cat: string): string => {
  const upper = (cat || "").toUpperCase();
  if (upper.includes("ATK")) return "ATK";
  if (upper.includes("ELEKTRONIK")) return "ELK";
  if (upper.includes("FURNITURE") || upper.includes("FURNITUR")) return "FRN";
  if (upper.includes("KENDARAAN")) return "KND";
  if (upper.includes("PANTRY")) return "PNT";
  if (upper.includes("TEKNISI")) return "TKN";
  if (upper.includes("RUMAH TANGGA")) return "RTK";
  return "LLN";
};

const getYearAbbreviation = (yearStr: string): string => {
  const cleaned = (yearStr || "").trim();
  const match = cleaned.match(/\b(20\d{2}|\d{2})\b/);
  if (match) {
    const yr = match[1];
    return yr.length === 4 ? yr.substring(2) : yr;
  }
  return "26"; // Default/Current year for legacy items
};

// Load items from LocalStorage or fallback to the pre-seeded JSON dataset
export function loadInventoryItems(): InventoryItem[] {
  let rawItems: InventoryItem[] = [];
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      rawItems = JSON.parse(stored) as InventoryItem[];
    }
  } catch (error) {
    console.error("Failed to load inventory from localStorage:", error);
  }

  if (rawItems.length === 0) {
    rawItems = initialItems as InventoryItem[];
  }

  // Track sequence numbers per key: `locationCode-catAbbr-yearAbbr`
  const sequenceCounters: Record<string, number> = {};

  // First, find existing properly-formatted codes to establish starting sequences
  rawItems.forEach(item => {
    if (item.code && item.code !== "-" && item.code.startsWith("GSI-")) {
      const parts = item.code.split("-");
      if (parts.length >= 5) {
        const locCode = parts[1];
        const catAbbr = parts[2];
        const yearAbbr = parts[3];
        const seqStr = parts[parts.length - 1];
        const seqNum = parseInt(seqStr, 10);
        const key = `${locCode}-${catAbbr}-${yearAbbr}`;
        if (!isNaN(seqNum)) {
          sequenceCounters[key] = Math.max(sequenceCounters[key] || 0, seqNum);
        }
      }
    }
  });

  // Now, populate any items that have empty/missing/hyphen codes, correct categories to simple RTK, and correct location names
  let needsSync = false;
  const processed = rawItems.map(item => {
    const currentCategory = (item.category || "").toUpperCase().trim();
    const isRtk = currentCategory === "RUMAH TANGGA KANTOR (RTK)" || currentCategory === "RUMAH TANGGA KANTOR" || currentCategory === "RTK";
    const normalizedCategory = isRtk ? "RTK" : item.category;
    const isCategoryChanged = item.category !== normalizedCategory;

    const locCode = (item.locationCode || "KP").toUpperCase();
    const catAbbr = getCategoryAbbreviation(normalizedCategory);
    const yearAbbr = getYearAbbreviation(item.acquisitionDate);
    const key = `${locCode}-${catAbbr}-${yearAbbr}`;

    const isCodeEmpty = !item.code || item.code.trim() === "" || item.code.trim() === "-";
    const correctedLocName = LOCATION_MAP[item.locationCode] || item.locationName || `Cabang ${item.locationCode}`;
    const isLocNameIncorrect = item.locationName !== correctedLocName;

    if (isCodeEmpty || isLocNameIncorrect || isCategoryChanged) {
      needsSync = true;
      let finalCode = item.code;
      if (isCodeEmpty) {
        const nextSeq = (sequenceCounters[key] || 0) + 1;
        sequenceCounters[key] = nextSeq;
        const paddedSeq = nextSeq.toString().padStart(4, "0");
        finalCode = `GSI-${locCode}-${catAbbr}-${yearAbbr}-${paddedSeq}`;
      }
      return {
        ...item,
        code: finalCode,
        category: normalizedCategory,
        locationName: correctedLocName
      };
    }

    return item;
  });

  if (needsSync) {
    saveInventoryItems(processed);
  }

  return processed;
}

// Save items to LocalStorage
export function saveInventoryItems(items: InventoryItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Failed to save inventory to localStorage:", error);
  }
}

// Load transfer logs from LocalStorage
export function loadTransferLogs(): TransferLog[] {
  try {
    const stored = localStorage.getItem(LOGS_STORAGE_KEY);
    if (stored) {
      const logs = JSON.parse(stored) as TransferLog[];
      return logs.map(log => ({
        ...log,
        fromLocationName: LOCATION_MAP[log.fromLocationCode] || log.fromLocationName || log.fromLocationCode,
        toLocationName: LOCATION_MAP[log.toLocationCode] || log.toLocationName || log.toLocationCode,
      }));
    }
  } catch (error) {
    console.error("Failed to load transfer logs from localStorage:", error);
  }
  return [];
}

// Save transfer logs to LocalStorage
export function saveTransferLogs(logs: TransferLog[]): void {
  try {
    localStorage.setItem(LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error("Failed to save transfer logs to localStorage:", error);
  }
}

// Branch name mappings for PT Gadai Sejahtera Indonesia (GSI)
export const LOCATION_MAP: Record<string, string> = {
  "MT": "Moh Toha",
  "KC": "Kiaracondong",
  "KI": "Kopo Immanuel",
  "JT": "Jatinangor",
  "RE": "Rancaekek",
  "RB": "Rancabolang",
  "GB": "Gedebage",
  "TP": "Terusan Pasirkoja",
  "PG": "Pagarsih",
  "CG": "Cigondewah",
  "CM": "Cimahi",
  "SP": "Surapati",
  "DU": "Dipatiukur",
  "TR": "Taman Rahayu",
  "GK": "Gegerkalong",
  "SY": "Sayati",
  "CB": "Cibiru",
  "BS": "Bojongsoang",
  "KK": "Kebon Kopi",
  "MT1": "Moh Toha 1",
  "KP": "Kantor Pusat",
  "GUDANG": "Gudang Utama"
};

// Calculate stats dynamically on current array of items
export function calculateStats(items: InventoryItem[]): InventoryStats {
  const totalItems = items.length;
  const totalQty = items.reduce((sum, item) => sum + item.qty, 0);
  const totalValue = items.reduce((sum, item) => sum + item.priceTotal, 0);

  // Group by locations
  const locationsMap: Record<string, { itemCount: number; itemQty: number; totalValue: number }> = {};
  // Initialize with all known location codes to preserve branches even if they have 0 items
  Object.keys(LOCATION_MAP).forEach(code => {
    locationsMap[code] = { itemCount: 0, itemQty: 0, totalValue: 0 };
  });

  items.forEach(item => {
    const code = (item.locationCode || "KP").toUpperCase();
    if (!locationsMap[code]) {
      locationsMap[code] = { itemCount: 0, itemQty: 0, totalValue: 0 };
    }
    locationsMap[code].itemCount += 1;
    locationsMap[code].itemQty += item.qty;
    locationsMap[code].totalValue += item.priceTotal;
  });

  const locations: BranchStat[] = Object.entries(locationsMap).map(([code, data]) => ({
    code,
    name: LOCATION_MAP[code] || `Cabang ${code}`,
    ...data
  })).sort((a, b) => b.totalValue - a.totalValue);

  // Group by categories
  const categoriesMap: Record<string, { itemCount: number; totalValue: number }> = {};
  items.forEach(item => {
    const cat = item.category || "LAIN-LAIN";
    if (!categoriesMap[cat]) {
      categoriesMap[cat] = { itemCount: 0, totalValue: 0 };
    }
    categoriesMap[cat].itemCount += 1;
    categoriesMap[cat].totalValue += item.priceTotal;
  });

  const categories: CategoryStat[] = Object.entries(categoriesMap).map(([name, data]) => ({
    name,
    ...data
  })).sort((a, b) => b.totalValue - a.totalValue);

  // Group by statuses
  const statusesMap: Record<string, number> = {
    "Baik": 0,
    "Rusak Ringan": 0,
    "Rusak Berat": 0,
    "Tidak Diketahui": 0
  };
  items.forEach(item => {
    const status = item.status || "Tidak Diketahui";
    if (statusesMap[status] === undefined) {
      statusesMap[status] = 0;
    }
    statusesMap[status] += 1;
  });

  const statuses: StatusStat[] = Object.entries(statusesMap).map(([name, count]) => ({
    name,
    count
  }));

  return {
    totalItems,
    totalQty,
    totalValue,
    locations,
    categories,
    statuses
  };
}

// Utility to format currency in Indonesian Rupiah
export function formatRupiah(value: number): string {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

// Load disposal and loss requests from LocalStorage
export function loadDisposalRequests(): DisposalRequest[] {
  try {
    const stored = localStorage.getItem(DISPOSAL_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as DisposalRequest[];
    }
  } catch (error) {
    console.error("Failed to load disposal requests from localStorage:", error);
  }
  return [];
}

// Save disposal and loss requests to LocalStorage
export function saveDisposalRequests(requests: DisposalRequest[]): void {
  try {
    localStorage.setItem(DISPOSAL_STORAGE_KEY, JSON.stringify(requests));
  } catch (error) {
    console.error("Failed to save disposal requests to localStorage:", error);
  }
}

// Load Audit Logs
export function loadAuditLogs(): AuditLog[] {
  try {
    const stored = localStorage.getItem(AUDIT_LOGS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AuditLog[];
    }
  } catch (error) {
    console.error("Failed to load audit logs from localStorage:", error);
  }
  return [];
}

// Save Audit Logs
export function saveAuditLogs(logs: AuditLog[]): void {
  try {
    localStorage.setItem(AUDIT_LOGS_STORAGE_KEY, JSON.stringify(logs));
  } catch (error) {
    console.error("Failed to save audit logs to localStorage:", error);
  }
}

// Load Audit Notifications
export function loadAuditNotifications(): AuditNotification[] {
  try {
    const stored = localStorage.getItem(NOTIFICATIONS_STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored) as AuditNotification[];
    }
  } catch (error) {
    console.error("Failed to load audit notifications from localStorage:", error);
  }
  return [];
}

// Save Audit Notifications
export function saveAuditNotifications(notifs: AuditNotification[]): void {
  try {
    localStorage.setItem(NOTIFICATIONS_STORAGE_KEY, JSON.stringify(notifs));
  } catch (error) {
    console.error("Failed to save audit notifications to localStorage:", error);
  }
}


