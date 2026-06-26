import { useState, useMemo, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Search, Check, X, ClipboardCheck, AlertTriangle, 
  MapPin, User, Calendar, RefreshCcw, Bell, 
  CheckCircle, ArrowRight, ShieldCheck, Info, Sparkles, AlertCircle, Trash2
} from "lucide-react";
import { InventoryItem, AuditLog, AuditNotification, UserAccount } from "../types";
import { 
  LOCATION_MAP, 
  loadAuditLogs, 
  saveAuditLogs, 
  loadAuditNotifications, 
  saveAuditNotifications 
} from "../dataService";

interface QuickAuditProps {
  items: InventoryItem[];
  onUpdateItems: (newItems: InventoryItem[]) => void;
  onShowToast: (message: string) => void;
  currentUser: UserAccount;
}

export default function QuickAudit({ 
  items, 
  onUpdateItems, 
  onShowToast, 
  currentUser 
}: QuickAuditProps) {
  // Persistence states
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>(() => loadAuditLogs());
  const [notifications, setNotifications] = useState<AuditNotification[]>(() => loadAuditNotifications());

  // Search and selector states
  const [searchItemQuery, setSearchItemQuery] = useState("");
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Field verification states (pre-filled with digital expectations)
  const [actualQty, setActualQty] = useState<number>(1);
  const [actualLocationCode, setActualLocationCode] = useState<string>("KP");
  const [actualStatus, setActualStatus] = useState<string>("Baik");
  const [physicalNotes, setPhysicalNotes] = useState<string>("");

  // Filter and view tabs
  const [activeSubTab, setActiveSubTab] = useState<"audit-form" | "audit-history" | "alerts">("audit-form");
  const [searchHistoryQuery, setSearchHistoryQuery] = useState("");

  // Sync state when selected item changes
  useEffect(() => {
    if (selectedItem) {
      setActualQty(selectedItem.qty);
      setActualLocationCode(selectedItem.locationCode);
      setActualStatus(selectedItem.status || "Baik");
      setPhysicalNotes("");
    }
  }, [selectedItem]);

  // Search items in catalogue
  const filteredCatalogItems = useMemo(() => {
    if (!searchItemQuery.trim()) return [];
    const q = searchItemQuery.toLowerCase();
    return items.filter(item => 
      (item.name || "").toLowerCase().includes(q) ||
      (item.code || "").toLowerCase().includes(q) ||
      (item.locationCode || "").toLowerCase().includes(q) ||
      (item.locationName || "").toLowerCase().includes(q)
    ).slice(0, 10);
  }, [items, searchItemQuery]);

  // Calculate dynamic discrepancies
  const discrepancies = useMemo(() => {
    if (!selectedItem) return null;
    
    const qtyMismatch = actualQty !== selectedItem.qty;
    const locMismatch = actualLocationCode !== selectedItem.locationCode;
    const statusMismatch = actualStatus !== selectedItem.status;

    const mismatchTypes: string[] = [];
    if (qtyMismatch) mismatchTypes.push(`Kuantitas Fisik (${actualQty}) vs Sistem (${selectedItem.qty})`);
    if (locMismatch) mismatchTypes.push(`Lokasi Fisik (${LOCATION_MAP[actualLocationCode] || actualLocationCode}) vs Sistem (${selectedItem.locationName})`);
    if (statusMismatch) mismatchTypes.push(`Kondisi Fisik (${actualStatus}) vs Sistem (${selectedItem.status})`);

    return {
      hasDiscrepancy: qtyMismatch || locMismatch || statusMismatch,
      qtyMismatch,
      locMismatch,
      statusMismatch,
      details: mismatchTypes.join(", "),
      mismatchCount: mismatchTypes.length
    };
  }, [selectedItem, actualQty, actualLocationCode, actualStatus]);

  // Submit Audit Form
  const handleSaveAudit = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItem) return;

    if (actualQty < 0) {
      alert("Jumlah kuantitas fisik tidak boleh negatif!");
      return;
    }

    const hasDiscrepancy = discrepancies?.hasDiscrepancy || false;
    const details = discrepancies?.details || "Kondisi sesuai dengan data sistem digital.";

    // 1. Create Audit Log
    const newAuditLog: AuditLog = {
      id: `AUD-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      itemId: selectedItem.id,
      itemName: selectedItem.name,
      assetCode: selectedItem.code || "-",
      auditedBy: currentUser.name,
      auditDate: new Date().toISOString().split('T')[0],
      expectedQty: selectedItem.qty,
      expectedLocationCode: selectedItem.locationCode,
      expectedLocationName: selectedItem.locationName,
      expectedStatus: selectedItem.status || "Baik",
      actualQty,
      actualLocationCode,
      actualLocationName: LOCATION_MAP[actualLocationCode] || `Cabang ${actualLocationCode}`,
      actualStatus,
      hasDiscrepancy,
      discrepancyDetails: details,
      status: hasDiscrepancy ? 'UNRESOLVED' : 'RESOLVED',
      notes: physicalNotes.trim()
    };

    const updatedLogs = [newAuditLog, ...auditLogs];
    setAuditLogs(updatedLogs);
    saveAuditLogs(updatedLogs);

    // 2. Create Audit Notification if discrepancy found
    let updatedNotifs = [...notifications];
    if (hasDiscrepancy) {
      let discrepancyType: 'QTY_MISMATCH' | 'LOC_MISMATCH' | 'STATUS_MISMATCH' | 'MULTIPLE_MISMATCH' = 'QTY_MISMATCH';
      if (discrepancies!.mismatchCount > 1) {
        discrepancyType = 'MULTIPLE_MISMATCH';
      } else if (discrepancies!.qtyMismatch) {
        discrepancyType = 'QTY_MISMATCH';
      } else if (discrepancies!.locMismatch) {
        discrepancyType = 'LOC_MISMATCH';
      } else if (discrepancies!.statusMismatch) {
        discrepancyType = 'STATUS_MISMATCH';
      }

      const newNotif: AuditNotification = {
        id: `NOTIF-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
        title: `Selisih Audit Fisik: ${selectedItem.name}`,
        message: `Ditemukan selisih pada ${details}. Diaudit oleh ${currentUser.name} (${currentUser.role === 'SUPER_ADMIN' ? 'Super Admin' : 'Staf Cabang'}).`,
        auditLogId: newAuditLog.id,
        itemId: selectedItem.id,
        itemName: selectedItem.name,
        discrepancyType,
        severity: discrepancies!.qtyMismatch ? 'CRITICAL' : 'WARNING',
        createdDate: newAuditLog.auditDate,
        isRead: false
      };
      
      updatedNotifs = [newNotif, ...updatedNotifs];
      setNotifications(updatedNotifs);
      saveAuditNotifications(updatedNotifs);
    }

    onShowToast(`Audit berhasil disimpan! ${hasDiscrepancy ? "⚠️ Notifikasi ketidaksesuaian draf telah dikirim ke log dashboard." : "✓ Data fisik sinkron."}`);
    
    // Clear selections
    setSelectedItem(null);
    setSearchItemQuery("");
    setPhysicalNotes("");
  };

  // Admin action: Resolve discrepancy by auto-updating catalog to match physical reality
  const handleResolveToPhysical = (notif: AuditNotification, log: AuditLog) => {
    if (currentUser.role !== 'SUPER_ADMIN') {
      alert("Hanya akun Super Admin yang diizinkan untuk menyinkronkan data katalog!");
      return;
    }

    if (confirm(`Apakah Anda setuju untuk MEMPERBARUI data katalog dengan kondisi fisik hasil audit lapangan?\n\nKuantitas lama: ${log.expectedQty} -> Kuantitas baru: ${log.actualQty}\nKondisi lama: ${log.expectedStatus} -> Kondisi baru: ${log.actualStatus}\nLokasi lama: ${log.expectedLocationName} -> Lokasi baru: ${log.actualLocationName}`)) {
      // Update inventory items
      const updatedItems = items.map(item => {
        if (item.id === log.itemId) {
          const newQty = log.actualQty;
          const newTotal = newQty * item.priceUnit;
          return {
            ...item,
            qty: newQty,
            priceTotal: newTotal,
            locationCode: log.actualLocationCode,
            locationName: log.actualLocationName,
            status: log.actualStatus,
            conditionRaw: `Diaudit tanggal ${log.auditDate} - ${log.actualStatus}`
          };
        }
        return item;
      });

      // Mark audit log as RESOLVED
      const updatedLogs = auditLogs.map(l => {
        if (l.id === log.id) {
          return { ...l, status: 'RESOLVED' as const };
        }
        return l;
      });

      // Mark notification as read / cleared
      const updatedNotifs = notifications.map(n => {
        if (n.id === notif.id) {
          return { ...n, isRead: true };
        }
        return n;
      });

      setAuditLogs(updatedLogs);
      saveAuditLogs(updatedLogs);
      setNotifications(updatedNotifs);
      saveAuditNotifications(updatedNotifs);
      onUpdateItems(updatedItems);
      onShowToast(`Data katalog "${log.itemName}" berhasil disinkronkan sesuai hasil fisik lapangan.`);
    }
  };

  // Dismiss notification
  const handleDismissNotif = (notifId: string) => {
    const updatedNotifs = notifications.map(n => {
      if (n.id === notifId) {
        return { ...n, isRead: true };
      }
      return n;
    });
    setNotifications(updatedNotifs);
    saveAuditNotifications(updatedNotifs);
  };

  // Get active notification count
  const unreadAlertsCount = useMemo(() => {
    return notifications.filter(n => !n.isRead).length;
  }, [notifications]);

  // Filter history logs
  const filteredHistory = useMemo(() => {
    return auditLogs.filter(log => {
      if (!searchHistoryQuery.trim()) return true;
      const q = searchHistoryQuery.toLowerCase();
      return (
        (log.itemName || "").toLowerCase().includes(q) ||
        (log.assetCode || "").toLowerCase().includes(q) ||
        (log.id || "").toLowerCase().includes(q) ||
        (log.discrepancyDetails || "").toLowerCase().includes(q) ||
        (log.auditedBy || "").toLowerCase().includes(q)
      );
    });
  }, [auditLogs, searchHistoryQuery]);

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden text-gray-800" id="quick-audit-module">
      {/* Module Title Banner */}
      <div className="p-5 border-b border-gray-200 bg-slate-50 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
            <ClipboardCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-extrabold text-sm text-gray-900">Verifikasi Fisik & Quick Audit Aset</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Cabang Aktif: {currentUser.branchCode} ({LOCATION_MAP[currentUser.branchCode] || 'Kantor Pusat'})
            </p>
          </div>
        </div>

        {/* Tab Controls */}
        <div className="flex items-center bg-gray-100 rounded-xl p-1 text-xs self-start sm:self-auto">
          <button
            onClick={() => setActiveSubTab("audit-form")}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === "audit-form" 
                ? "bg-white text-indigo-600 shadow-xs" 
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Form Audit
          </button>
          <button
            onClick={() => setActiveSubTab("alerts")}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer flex items-center gap-1.5 relative ${
              activeSubTab === "alerts" 
                ? "bg-white text-indigo-600 shadow-xs" 
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            <Bell className="w-3.5 h-3.5" />
            <span>Notifikasi Selisih</span>
            {unreadAlertsCount > 0 && (
              <span className="px-1.5 py-0.5 text-[8px] bg-amber-500 text-white rounded-full font-black animate-pulse">
                {unreadAlertsCount}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveSubTab("audit-history")}
            className={`px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
              activeSubTab === "audit-history" 
                ? "bg-white text-indigo-600 shadow-xs" 
                : "text-gray-500 hover:text-gray-800"
            }`}
          >
            Riwayat Audit
          </button>
        </div>
      </div>

      <div className="p-6">
        {/* SUB TAB: AUDIT FORM */}
        {activeSubTab === "audit-form" && (
          <div className="space-y-6" id="audit-form-view">
            {/* 1. Item Selector */}
            <div className="space-y-2">
              <label className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">1. Cari & Pilih Aset yang Akan Diverifikasi Fisik</label>
              
              {selectedItem ? (
                <div className="p-4 bg-indigo-50/50 border border-indigo-100 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <span className="font-extrabold text-sm text-gray-900 block">{selectedItem.name}</span>
                    <span className="font-mono text-[10px] text-indigo-600 bg-indigo-100/50 px-2 py-0.5 rounded font-bold inline-block">
                      Kode Aset: {selectedItem.code || "-"}
                    </span>
                    <p className="text-[10px] text-gray-400 font-semibold">
                      Lokasi Terdaftar: <strong className="text-gray-600">{selectedItem.locationName} ({selectedItem.locationCode})</strong> | Kuantitas Buku: <strong className="text-gray-600">{selectedItem.qty} Unit</strong>
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedItem(null)}
                    className="px-3 py-1.5 bg-white border border-gray-200 hover:bg-gray-50 text-rose-600 font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer self-start sm:self-auto"
                  >
                    Ganti Barang
                  </button>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="relative">
                    <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                    <input
                      type="text"
                      placeholder="Masukkan nama aset, kode inventaris, atau lokasi..."
                      value={searchItemQuery}
                      onChange={(e) => setSearchItemQuery(e.target.value)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2.5 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  
                  {searchItemQuery.trim().length > 0 && (
                    <div className="border border-gray-200 rounded-xl max-h-48 overflow-y-auto divide-y divide-gray-150 bg-white">
                      {filteredCatalogItems.length === 0 ? (
                        <p className="p-4 text-gray-400 italic text-center text-xs">Aset tidak ditemukan. Coba ketik kata kunci lain.</p>
                      ) : (
                        filteredCatalogItems.map(item => (
                          <div
                            key={item.id}
                            onClick={() => setSelectedItem(item)}
                            className="p-3 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-3 text-xs"
                          >
                            <div>
                              <span className="font-bold text-gray-800 block">{item.name}</span>
                              <span className="text-[10px] text-slate-500 block font-mono">{item.code || "-"}</span>
                            </div>
                            <div className="text-right">
                              <span className="text-[10px] text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded font-black block">
                                Stok: {item.qty} Unit
                              </span>
                              <span className="text-[9px] text-gray-400 block mt-0.5">
                                {item.locationCode} - {item.status}
                              </span>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* 2. Side-by-side Verification Panel */}
            {selectedItem && (
              <form onSubmit={handleSaveAudit} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* System Digital (Expectation) Card */}
                  <div className="p-5 border border-gray-150 rounded-2xl bg-gray-50/50 space-y-4">
                    <h4 className="font-black text-xs text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Info className="w-4 h-4 text-indigo-500" />
                      <span>Data Digital (Buku / Sistem)</span>
                    </h4>

                    <div className="divide-y divide-gray-100 text-xs">
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Nama Barang</span>
                        <span className="font-bold text-gray-800 text-right">{selectedItem.name}</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Katalog Kode</span>
                        <span className="font-mono font-bold text-gray-800">{selectedItem.code || "-"}</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Kuantitas Terdaftar</span>
                        <span className="font-extrabold text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{selectedItem.qty} Unit</span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Lokasi Terdaftar</span>
                        <span className="font-bold text-gray-800 flex items-center gap-1">
                          <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                          {selectedItem.locationName} ({selectedItem.locationCode})
                        </span>
                      </div>
                      <div className="py-2.5 flex justify-between items-center">
                        <span className="text-gray-400 font-semibold">Kondisi Terdaftar</span>
                        <span className="font-bold text-gray-800">{selectedItem.status || "Baik"}</span>
                      </div>
                    </div>
                  </div>

                  {/* Physical Observation Input Form */}
                  <div className="p-5 border border-indigo-150 rounded-2xl bg-white space-y-4 shadow-xs">
                    <h4 className="font-black text-xs text-indigo-600 uppercase tracking-widest flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4" />
                      <span>Kondisi Riil Lapangan (Fisik)</span>
                    </h4>

                    <div className="space-y-3.5 text-xs">
                      {/* Quantity Input */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 block">Kuantitas Fisik Riil (Unit)</label>
                        <input
                          type="number"
                          min={0}
                          value={actualQty}
                          onChange={(e) => setActualQty(parseInt(e.target.value, 10) || 0)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>

                      {/* Location Selector */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 block">Lokasi Penempatan Fisik</label>
                        <select
                          value={actualLocationCode}
                          onChange={(e) => setActualLocationCode(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          {Object.entries(LOCATION_MAP).map(([code, name]) => (
                            <option key={code} value={code}>{name} ({code})</option>
                          ))}
                        </select>
                      </div>

                      {/* Status Selector */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 block">Kondisi Fisik Saat Ini</label>
                        <select
                          value={actualStatus}
                          onChange={(e) => setActualStatus(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
                        >
                          <option value="Baik">Baik</option>
                          <option value="Rusak Ringan">Rusak Ringan</option>
                          <option value="Rusak Berat">Rusak Berat</option>
                          <option value="Tidak Diketahui">Tidak Diketahui</option>
                        </select>
                      </div>

                      {/* Audit Observation Notes */}
                      <div className="space-y-1">
                        <label className="text-[11px] font-bold text-gray-500 block">Catatan Tambahan Verifikasi</label>
                        <input
                          type="text"
                          placeholder="Masukkan catatan pendukung (misal: Unit LCD pecah)..."
                          value={physicalNotes}
                          onChange={(e) => setPhysicalNotes(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Dynamic Discrepancy Alert Banner */}
                {discrepancies?.hasDiscrepancy ? (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-amber-50 border border-amber-200 text-amber-800 rounded-2xl text-xs space-y-1.5 flex items-start gap-3 shadow-xs"
                  >
                    <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5 animate-bounce" />
                    <div className="flex-1">
                      <strong className="font-extrabold block text-[13px] text-amber-900">⚠️ Terdeteksi Ketidaksesuaian Data Fisik!</strong>
                      <p className="font-semibold text-amber-800/90 leading-relaxed mt-0.5">
                        Menyimpan verifikasi ini akan memicu alarm notifikasi selisih sistem untuk Super Admin. <br />
                        <span className="font-bold underline text-amber-900">Deskripsi Selisih:</span> {discrepancies.details}
                      </p>
                    </div>
                  </motion.div>
                ) : (
                  <div className="p-4 bg-emerald-50 border border-emerald-150 text-emerald-800 rounded-2xl text-xs flex items-center gap-3">
                    <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />
                    <div>
                      <strong className="font-extrabold block text-emerald-900">✓ Hasil Audit Sesuai</strong>
                      <p className="font-semibold text-emerald-800/90">Kondisi fisik lapangan cocok dengan catatan digital di sistem katalog.</p>
                    </div>
                  </div>
                )}

                {/* Submit Panel */}
                <div className="pt-4 border-t border-gray-150 flex flex-col sm:flex-row items-center justify-between gap-4">
                  <div className="text-[11px] text-gray-400 font-semibold">
                    Diaudit Oleh: <strong className="text-gray-600 font-extrabold">{currentUser.name} ({currentUser.role})</strong> pada {new Date().toISOString().split('T')[0]}
                  </div>
                  <div className="flex gap-3 w-full sm:w-auto">
                    <button
                      type="submit"
                      className="flex-1 sm:flex-none px-6 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                    >
                      Simpan Hasil Verifikasi
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedItem(null);
                        setSearchItemQuery("");
                      }}
                      className="px-4 py-2.5 border border-gray-200 hover:bg-gray-50 text-gray-500 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                    >
                      Batal
                    </button>
                  </div>
                </div>
              </form>
            )}

            {/* If no selected item */}
            {!selectedItem && (
              <div className="p-16 border border-dashed border-gray-200 rounded-2xl text-center space-y-4">
                <div className="mx-auto w-12 h-12 bg-slate-50 text-slate-400 rounded-full flex items-center justify-center">
                  <ClipboardCheck className="w-6 h-6 text-indigo-400" />
                </div>
                <div className="space-y-1">
                  <p className="text-xs font-bold text-gray-700">Verifikasi Fisik Aset</p>
                  <p className="text-[10px] text-gray-400 max-w-md mx-auto leading-relaxed">
                    Staf cabang disarankan untuk memverifikasi fisik aset kantor minimal sebulan sekali. Gunakan pencarian di atas untuk mulai memeriksa item dari katalog.
                  </p>
                </div>
              </div>
            )}
          </div>
        )}

        {/* SUB TAB: DISCREPANCY ALERTS & NOTIFICATIONS */}
        {activeSubTab === "alerts" && (
          <div className="space-y-4" id="discrepancy-alerts-view">
            <div className="p-4 bg-amber-50 rounded-2xl border border-amber-150 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
              <div className="text-xs leading-relaxed">
                <strong className="font-extrabold text-amber-900 block text-[13px]">Pemberitahuan Selisih Fisik</strong>
                <p className="text-amber-800 font-semibold mt-0.5">
                  Daftar di bawah memuat notifikasi ketidaksesuaian data yang dilaporkan oleh staf lapangan saat audit berkala. 
                  {currentUser.role === 'SUPER_ADMIN' ? (
                    <span className="font-black block text-indigo-900 mt-1">✓ Anda login sebagai Super Admin: Anda dapat mengevaluasi dan menyinkronkan data katalog secara otomatis.</span>
                  ) : (
                    <span className="font-black block text-amber-900/90 mt-1">⚠️ Anda login sebagai Staff Cabang: Hubungi Super Admin untuk menyinkronkan katalog atau memproses mutasi / buang.</span>
                  )}
                </p>
              </div>
            </div>

            {notifications.length === 0 ? (
              <div className="p-16 text-center space-y-3.5 border border-dashed border-gray-100 rounded-2xl">
                <div className="mx-auto w-10 h-10 bg-emerald-50 text-emerald-500 rounded-full flex items-center justify-center">
                  <Check className="w-5 h-5" />
                </div>
                <div>
                  <p className="text-xs font-bold text-gray-700">Sempurna! Tidak Ada Selisih Data</p>
                  <p className="text-[10px] text-gray-400 max-w-xs mx-auto mt-0.5">Seluruh verifikasi fisik aset di lapangan saat ini sinkron dengan data sistem digital.</p>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {notifications.map((notif) => {
                  const correspondingLog = auditLogs.find(l => l.id === notif.auditLogId);
                  const isResolved = correspondingLog?.status === 'RESOLVED' || notif.isRead;

                  return (
                    <div 
                      key={notif.id} 
                      className={`p-4 rounded-2xl border transition-all flex flex-col md:flex-row md:items-start justify-between gap-4 ${
                        isResolved 
                          ? 'bg-gray-50/50 border-gray-150 opacity-75' 
                          : notif.severity === 'CRITICAL' 
                            ? 'bg-rose-50/45 border-rose-150 shadow-xs' 
                            : 'bg-amber-50/45 border-amber-150 shadow-xs'
                      }`}
                    >
                      <div className="space-y-2 flex-1 text-xs">
                        {/* Header metadata */}
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`text-[9px] font-black px-2 py-0.5 rounded font-mono ${
                            isResolved 
                              ? 'bg-gray-100 text-gray-500' 
                              : notif.severity === 'CRITICAL' 
                                ? 'bg-rose-100 text-rose-700' 
                                : 'bg-amber-100 text-amber-700'
                          }`}>
                            {notif.id}
                          </span>
                          <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${
                            isResolved 
                              ? 'bg-emerald-100 text-emerald-800' 
                              : 'bg-red-100 text-red-800 animate-pulse'
                          }`}>
                            {isResolved ? "✓ TERATASI (SINKRON)" : "⚠️ AKTIF"}
                          </span>
                          <span className="text-[9px] text-gray-400 font-semibold">{notif.createdDate}</span>
                        </div>

                        {/* Message body */}
                        <div className="space-y-1">
                          <h4 className="font-extrabold text-sm text-gray-900">{notif.title}</h4>
                          <p className="text-gray-500 font-semibold leading-relaxed">
                            {notif.message}
                          </p>
                          {correspondingLog?.notes && (
                            <p className="text-[11px] text-gray-600 bg-white/70 p-2.5 rounded-xl border border-gray-100 italic leading-relaxed">
                              Catatan Staf: &ldquo;{correspondingLog.notes}&rdquo;
                            </p>
                          )}
                        </div>

                        {/* Side-by-side mismatch summary */}
                        {correspondingLog && (
                          <div className="grid grid-cols-2 max-w-sm gap-2.5 text-[10px] bg-white/60 p-2.5 rounded-xl border border-gray-150/60">
                            <div>
                              <span className="text-gray-400 font-bold block">Digital Katalog:</span>
                              <span className="text-slate-600 block">Stok: <strong>{correspondingLog.expectedQty}</strong></span>
                              <span className="text-slate-600 block">Lokasi: <strong>{correspondingLog.expectedLocationCode}</strong></span>
                              <span className="text-slate-600 block">Status: <strong>{correspondingLog.expectedStatus}</strong></span>
                            </div>
                            <div>
                              <span className="text-indigo-600 font-black block">Fisik Lapangan:</span>
                              <span className="text-indigo-800 block">Fisik: <strong>{correspondingLog.actualQty}</strong></span>
                              <span className="text-indigo-800 block">Fisik: <strong>{correspondingLog.actualLocationCode}</strong></span>
                              <span className="text-indigo-800 block">Fisik: <strong>{correspondingLog.actualStatus}</strong></span>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Action controllers */}
                      <div className="flex items-center gap-2 shrink-0 self-start md:self-center">
                        {!isResolved ? (
                          currentUser.role === 'SUPER_ADMIN' ? (
                            <div className="flex flex-col sm:flex-row gap-2 w-full">
                              <button
                                onClick={() => correspondingLog && handleResolveToPhysical(notif, correspondingLog)}
                                className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-extrabold text-xs rounded-xl shadow-xs transition-colors flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <ShieldCheck className="w-4 h-4" />
                                <span>Sinkron Katalog</span>
                              </button>
                              <button
                                onClick={() => handleDismissNotif(notif.id)}
                                className="px-3 py-2 border border-gray-200 hover:bg-gray-100 text-gray-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                              >
                                Abaikan
                              </button>
                            </div>
                          ) : (
                            <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 rounded-lg p-2 font-medium max-w-[180px]">
                              Menunggu Super Admin menyinkronkan data katalog...
                            </div>
                          )
                        ) : (
                          <span className="text-[10px] text-emerald-700 bg-emerald-50 border border-emerald-100 rounded-lg px-2.5 py-1 font-bold flex items-center gap-1">
                            <Check className="w-3.5 h-3.5" />
                            <span>Terselesaikan</span>
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SUB TAB: AUDIT HISTORY */}
        {activeSubTab === "audit-history" && (
          <div className="space-y-4" id="audit-history-view">
            {/* Search History */}
            <div className="relative">
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Cari log audit berdasarkan nama barang, kode, pengaudit..."
                value={searchHistoryQuery}
                onChange={(e) => setSearchHistoryQuery(e.target.value)}
                className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-4 py-2 text-xs focus:outline-none"
              />
            </div>

            {filteredHistory.length === 0 ? (
              <p className="p-16 text-center text-gray-400 italic text-xs">Belum ada riwayat audit fisik yang tersimpan.</p>
            ) : (
              <div className="border border-gray-200 rounded-2xl overflow-hidden divide-y divide-gray-150">
                {filteredHistory.map((log) => (
                  <div key={log.id} className="p-4 bg-white hover:bg-slate-50/40 transition-colors flex flex-col sm:flex-row justify-between gap-4 text-xs">
                    <div className="space-y-2 flex-1">
                      {/* Log meta */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-[9px] bg-slate-100 text-slate-500 font-extrabold px-1.5 py-0.5 rounded">
                          {log.id}
                        </span>
                        <span className={`text-[9px] font-extrabold px-2 py-0.5 rounded-full ${
                          log.hasDiscrepancy 
                            ? 'bg-amber-100 text-amber-800' 
                            : 'bg-emerald-100 text-emerald-800'
                        }`}>
                          {log.hasDiscrepancy ? '⚠️ Selisih Terdeteksi' : '✓ Sesuai (Match)'}
                        </span>
                        <span className="text-[9px] text-gray-400 font-semibold">{log.auditDate}</span>
                      </div>

                      {/* Content */}
                      <div>
                        <h4 className="font-extrabold text-sm text-gray-900">{log.itemName}</h4>
                        <p className="text-[11px] text-gray-400 font-mono font-bold mt-0.5">Kode: {log.assetCode}</p>
                        <p className="text-gray-500 font-semibold leading-relaxed mt-1">
                          Hasil: <strong className="text-gray-700">{log.discrepancyDetails}</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[10px] text-gray-400 font-semibold">
                        <span className="flex items-center gap-1">
                          <User className="w-3.5 h-3.5 text-gray-400" />
                          Auditor: <strong className="text-gray-600 font-bold">{log.auditedBy}</strong>
                        </span>
                        <span>
                          Fisik: <strong className="text-indigo-600 font-extrabold">{log.actualQty} Unit ({log.actualLocationCode})</strong>
                        </span>
                        <span>
                          Status: <strong className="text-gray-600">{log.actualStatus}</strong>
                        </span>
                      </div>
                    </div>

                    <div className="shrink-0 self-start sm:self-center">
                      <span className={`text-[10px] font-bold px-2.5 py-1 rounded-lg border ${
                        log.status === 'RESOLVED' 
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border-amber-100'
                      }`}>
                        {log.status === 'RESOLVED' ? 'Kasus Selesai' : 'Perlu Evaluasi'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
