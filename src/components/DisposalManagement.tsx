import { useState, useMemo, useEffect, FormEvent } from "react";
import { motion, AnimatePresence } from "motion/react";
import { 
  Trash2, Search, Plus, Check, X, Clock, AlertTriangle, 
  User, MapPin, Calendar, HelpCircle, FileText, Ban, 
  TrendingDown, CheckCircle2, AlertCircle, ShieldAlert,
  Inbox
} from "lucide-react";
import { InventoryItem, DisposalRequest, UserAccount } from "../types";
import { formatRupiah, saveDisposalRequests } from "../dataService";

interface DisposalManagementProps {
  items: InventoryItem[];
  onUpdateItems: (newItems: InventoryItem[]) => void;
  onShowToast: (message: string) => void;
  currentUser: UserAccount;
  requests: DisposalRequest[];
  onSetRequests: (newRequests: DisposalRequest[]) => void;
  preselectedItem: InventoryItem | null;
  onClearPreselected: () => void;
}

export default function DisposalManagement({ 
  items, 
  onUpdateItems, 
  onShowToast, 
  currentUser,
  requests,
  onSetRequests,
  preselectedItem,
  onClearPreselected
}: DisposalManagementProps) {
  // UseEffect to open modal with preselected item when requested from catalogue
  useEffect(() => {
    if (preselectedItem) {
      setSelectedItemForDisposal(preselectedItem);
      setDisposalQty(1);
      setDisposalType('DIBUANG');
      setIsRequestModalOpen(true);
      onClearPreselected();
    }
  }, [preselectedItem, onClearPreselected]);
  
  // UI filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  
  // Modal states
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);
  const [selectedItemForDisposal, setSelectedItemForDisposal] = useState<InventoryItem | null>(null);
  const [disposalType, setDisposalType] = useState<'DIBUANG' | 'HILANG'>('DIBUANG');
  const [disposalQty, setDisposalQty] = useState(1);
  const [disposalReason, setDisposalReason] = useState("");
  const [searchItemQuery, setSearchItemQuery] = useState("");

  // Rejection modal states
  const [rejectingRequest, setRejectingRequest] = useState<DisposalRequest | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  // Filter items for the searchable request dropdown
  const filteredItemsForSelect = useMemo(() => {
    if (!searchItemQuery.trim()) return items.slice(0, 15);
    const q = searchItemQuery.toLowerCase();
    return items.filter(item => 
      (item.name || "").toLowerCase().includes(q) ||
      (item.code || "").toLowerCase().includes(q) ||
      (item.locationCode || "").toLowerCase().includes(q)
    ).slice(0, 15);
  }, [items, searchItemQuery]);

  // Handle submitting a new disposal/loss request
  const handleCreateRequest = (e: FormEvent) => {
    e.preventDefault();
    if (!selectedItemForDisposal) {
      alert("Silakan pilih barang terlebih dahulu!");
      return;
    }

    if (disposalQty <= 0) {
      alert("Jumlah barang harus minimal 1 unit!");
      return;
    }

    if (disposalQty > selectedItemForDisposal.qty) {
      alert(`Jumlah melebihi stok yang ada! Maksimal stok saat ini adalah ${selectedItemForDisposal.qty} unit.`);
      return;
    }

    if (!disposalReason.trim()) {
      alert("Silakan berikan alasan atau deskripsi pengajuan!");
      return;
    }

    const newRequest: DisposalRequest = {
      id: `DISP-${Math.random().toString(36).substring(2, 9).toUpperCase()}`,
      itemId: selectedItemForDisposal.id,
      itemName: selectedItemForDisposal.name,
      assetCode: selectedItemForDisposal.code || "-",
      locationCode: selectedItemForDisposal.locationCode,
      locationName: selectedItemForDisposal.locationName,
      qty: disposalQty,
      type: disposalType,
      reason: disposalReason.trim(),
      requestedBy: currentUser.name,
      requestedDate: new Date().toISOString().split('T')[0],
      status: 'PENDING'
    };

    const updatedRequests = [newRequest, ...requests];
    onSetRequests(updatedRequests);
    saveDisposalRequests(updatedRequests);
    
    // Reset form
    setIsRequestModalOpen(false);
    setSelectedItemForDisposal(null);
    setDisposalQty(1);
    setDisposalReason("");
    setSearchItemQuery("");

    onShowToast(`Pengajuan pengeluaran aset "${newRequest.itemName}" berhasil dikirim ke Super Admin.`);
  };

  // Open creation modal with a preselected item (e.g. from details modal)
  const handleOpenWithItem = (item: InventoryItem) => {
    setSelectedItemForDisposal(item);
    setDisposalQty(1);
    setDisposalType('DIBUANG');
    setIsRequestModalOpen(true);
  };

  // Handle Approve request
  const handleApprove = (req: DisposalRequest) => {
    // 1. Find the target item in current inventory
    const targetItem = items.find(i => i.id === req.itemId);
    if (!targetItem) {
      alert("Aset ini tidak dapat ditemukan lagi di dalam database katalog.");
      return;
    }

    if (targetItem.qty < req.qty) {
      alert(`Gagal menyetujui: Stok barang saat ini tinggal ${targetItem.qty} unit, tidak mencukupi pengajuan sebanyak ${req.qty} unit.`);
      return;
    }

    if (confirm(`Apakah Anda yakin menyetujui pengeluaran ${req.qty} unit dari aset "${req.itemName}"?\nTindakan ini akan memotong saldo stok aset secara permanen.`)) {
      // 2. Reduce the quantity of the item
      const updatedItems = items.map(item => {
        if (item.id === req.itemId) {
          const newQty = Math.max(0, item.qty - req.qty);
          const newTotal = newQty * item.priceUnit;
          return {
            ...item,
            qty: newQty,
            priceTotal: newTotal,
            // If Qty becomes 0, mark status as "Tidak Aktif" or "Dibuang"
            status: newQty === 0 ? (req.type === 'DIBUANG' ? 'Dibuang' : 'Hilang') : item.status
          };
        }
        return item;
      });

      // 3. Update request status to APPROVED
      const updatedRequests = requests.map(r => {
        if (r.id === req.id) {
          return {
            ...r,
            status: 'APPROVED' as const,
            approvedBy: currentUser.name,
            approvedDate: new Date().toISOString().split('T')[0]
          };
        }
        return r;
      });

      onSetRequests(updatedRequests);
      saveDisposalRequests(updatedRequests);
      onUpdateItems(updatedItems);
      onShowToast(`Pengajuan ${req.id} telah DISETUJUI. Stok aset "${req.itemName}" telah dipotong.`);
    }
  };

  // Handle Reject request
  const handleRejectSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (!rejectingRequest) return;

    if (!rejectReason.trim()) {
      alert("Berikan alasan penolakan!");
      return;
    }

    const updatedRequests = requests.map(r => {
      if (r.id === rejectingRequest.id) {
        return {
          ...r,
          status: 'REJECTED' as const,
          approvedBy: currentUser.name,
          approvedDate: new Date().toISOString().split('T')[0],
          rejectReason: rejectReason.trim()
        };
      }
      return r;
    });

    onSetRequests(updatedRequests);
    saveDisposalRequests(updatedRequests);
    onShowToast(`Pengajuan ${rejectingRequest.id} telah ditolak.`);
    setRejectingRequest(null);
    setRejectReason("");
  };

  // Filter requests based on user search/filters
  const filteredRequests = useMemo(() => {
    return requests.filter(req => {
      // Search text filter
      const q = searchQuery.toLowerCase();
      const matchesSearch = 
        (req.itemName || "").toLowerCase().includes(q) ||
        (req.assetCode || "").toLowerCase().includes(q) ||
        (req.id || "").toLowerCase().includes(q) ||
        (req.reason || "").toLowerCase().includes(q) ||
        (req.locationName || "").toLowerCase().includes(q) ||
        (req.requestedBy || "").toLowerCase().includes(q);

      // Type filter
      const matchesType = !typeFilter || req.type === typeFilter;

      // Status filter
      const matchesStatus = !statusFilter || req.status === statusFilter;

      return matchesSearch && matchesType && matchesStatus;
    });
  }, [requests, searchQuery, typeFilter, statusFilter]);

  // Statistics counters
  const disposalStats = useMemo(() => {
    const pending = requests.filter(r => r.status === 'PENDING').length;
    const approved = requests.filter(r => r.status === 'APPROVED');
    const rejected = requests.filter(r => r.status === 'REJECTED').length;

    const totalQtyDibuang = approved
      .filter(r => r.type === 'DIBUANG')
      .reduce((sum, r) => sum + r.qty, 0);

    const totalQtyHilang = approved
      .filter(r => r.type === 'HILANG')
      .reduce((sum, r) => sum + r.qty, 0);

    return {
      pending,
      approvedCount: approved.length,
      rejected,
      totalQtyDibuang,
      totalQtyHilang
    };
  }, [requests]);

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'APPROVED':
        return "bg-emerald-50 text-emerald-700 border-emerald-150";
      case 'REJECTED':
        return "bg-rose-50 text-rose-700 border-rose-150";
      default:
        return "bg-amber-50 text-amber-700 border-amber-150";
    }
  };

  return (
    <div className="space-y-6 text-gray-800" id="disposal-management-panel">
      
      {/* 1. Header Ribbon & Quick Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Stat: Pending Approval */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-500 rounded-xl">
            <Clock className="w-5 h-5 animate-pulse" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Menunggu Persetujuan</span>
            <span className="text-xl font-black text-gray-950">{disposalStats.pending} <span className="text-xs font-semibold text-gray-500">Berkas</span></span>
          </div>
        </div>

        {/* Stat: Approved Discarded */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-red-50 text-red-500 rounded-xl">
            <Trash2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Barang Rusak & Dibuang</span>
            <span className="text-xl font-black text-gray-950">{disposalStats.totalQtyDibuang} <span className="text-xs font-semibold text-gray-500">Unit</span></span>
          </div>
        </div>

        {/* Stat: Approved Lost */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-slate-50 text-slate-500 rounded-xl">
            <Ban className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Barang Hilang / Rusak</span>
            <span className="text-xl font-black text-gray-950">{disposalStats.totalQtyHilang} <span className="text-xs font-semibold text-gray-500">Unit</span></span>
          </div>
        </div>

        {/* Stat: Total Completed Cases */}
        <div className="p-4 bg-white border border-gray-200 rounded-2xl shadow-xs flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-500 rounded-xl">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">Total Disetujui</span>
            <span className="text-xl font-black text-gray-950">{disposalStats.approvedCount} <span className="text-xs font-semibold text-gray-500">Kasus</span></span>
          </div>
        </div>
      </div>

      {/* 2. Control Filters & Button */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex-1 grid grid-cols-1 sm:grid-cols-3 gap-3">
          {/* Search Box */}
          <div className="relative">
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Cari nama barang, kode, alasan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Type Selector */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">Semua Tipe Pengeluaran</option>
            <option value="DIBUANG">Rusak & Dibuang</option>
            <option value="HILANG">Barang Hilang</option>
          </select>

          {/* Status Selector */}
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bg-slate-50 border border-gray-200 rounded-xl px-3 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 cursor-pointer"
          >
            <option value="">Semua Status Approval</option>
            <option value="PENDING">Menunggu Persetujuan</option>
            <option value="APPROVED">Disetujui (Discharge)</option>
            <option value="REJECTED">Ditolak Super Admin</option>
          </select>
        </div>

        {/* Action Button: Ajukan Baru */}
        <button
          onClick={() => {
            setSelectedItemForDisposal(null);
            setDisposalQty(1);
            setDisposalReason("");
            setIsRequestModalOpen(true);
          }}
          className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-all flex items-center gap-2 cursor-pointer self-start md:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Ajukan Barang Keluar</span>
        </button>
      </div>

      {/* 3. List of Requests */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
        <div className="p-4 border-b border-gray-200 bg-gray-50/50 flex items-center justify-between">
          <div>
            <h3 className="font-extrabold text-sm text-gray-900">Daftar Berkas Pengajuan Barang Keluar</h3>
            <p className="text-[10px] text-gray-400 font-semibold uppercase tracking-wider mt-0.5">
              Role Saat Ini: {currentUser.role === 'SUPER_ADMIN' ? 'SUPER ADMIN (Dapat Menyetujui)' : 'STAF CABANG (Hanya Mengajukan)'}
            </p>
          </div>
          <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 border border-indigo-100 rounded-full px-2.5 py-0.5">
            Total {filteredRequests.length} Berkas
          </span>
        </div>

        {filteredRequests.length === 0 ? (
          <div className="p-16 text-center space-y-3.5">
            <div className="mx-auto w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400">
              <Inbox className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-bold text-gray-700">Tidak ada pengajuan ditemukan</p>
              <p className="text-[10px] text-gray-400 max-w-sm mx-auto">Silakan ubah filter pencarian atau buat pengajuan baru dengan menekan tombol biru di atas.</p>
            </div>
          </div>
        ) : (
          <div className="divide-y divide-gray-200">
            {filteredRequests.map((req) => (
              <motion.div 
                layoutId={`req-card-${req.id}`}
                key={req.id} 
                className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4 hover:bg-slate-50/50 transition-colors"
              >
                {/* Left Area: Title & Core Info */}
                <div className="space-y-2 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold">
                      {req.id}
                    </span>
                    <span className={`text-[9px] font-black uppercase tracking-wider border rounded px-2 py-0.5 ${
                      req.type === 'DIBUANG' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-slate-100 text-slate-700 border-slate-200'
                    }`}>
                      {req.type === 'DIBUANG' ? '🚮 Rusak & Dibuang (Scrap)' : '🔍 Barang Hilang'}
                    </span>
                    <span className={`text-[9px] font-extrabold border rounded-full px-2.5 py-0.5 flex items-center gap-1 ${getStatusStyle(req.status)}`}>
                      {req.status === 'PENDING' && <Clock className="w-3 h-3 animate-pulse" />}
                      {req.status === 'APPROVED' && <Check className="w-3 h-3" />}
                      {req.status === 'REJECTED' && <X className="w-3 h-3" />}
                      {req.status === 'PENDING' ? 'MENUNGGU APPROVAL' : req.status === 'APPROVED' ? 'DISETUJUI / KELUAR' : 'DITOLAK'}
                    </span>
                  </div>

                  <div className="space-y-0.5">
                    <h4 className="text-sm font-extrabold text-gray-900 flex items-center gap-2">
                      {req.itemName}
                      <span className="text-xs font-bold text-gray-400 font-mono">({req.assetCode})</span>
                    </h4>
                    <p className="text-xs text-gray-500 font-semibold leading-relaxed max-w-2xl italic">
                      Alasan: &ldquo;{req.reason}&rdquo;
                    </p>
                  </div>

                  {/* Metadata line */}
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[10px] text-gray-400 font-semibold">
                    <span className="flex items-center gap-1">
                      <User className="w-3.5 h-3.5" />
                      Pengaju: <strong className="text-gray-600 font-bold">{req.requestedBy}</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <MapPin className="w-3.5 h-3.5 text-rose-400" />
                      Asal: <strong className="text-gray-600 font-bold">{req.locationName} ({req.locationCode})</strong>
                    </span>
                    <span className="flex items-center gap-1">
                      <Calendar className="w-3.5 h-3.5" />
                      Tanggal: <strong className="text-gray-600 font-bold">{req.requestedDate}</strong>
                    </span>
                    <span className="text-indigo-600 bg-indigo-50/50 px-1.5 py-0.5 rounded font-extrabold">
                      Qty: {req.qty} Unit
                    </span>
                  </div>

                  {/* Admin feedback if approved or rejected */}
                  {(req.approvedBy || req.rejectReason) && (
                    <div className="mt-2.5 p-3 rounded-xl border border-dashed bg-gray-50 text-[11px] leading-relaxed max-w-xl">
                      {req.status === 'APPROVED' ? (
                        <p className="text-emerald-700">
                          <strong>✓ Disetujui oleh:</strong> {req.approvedBy} pada {req.approvedDate}. Stok inventaris telah otomatis terpotong secara resmi.
                        </p>
                      ) : (
                        <p className="text-rose-700">
                          <strong>✗ Ditolak oleh:</strong> {req.approvedBy} pada {req.approvedDate}. <br />
                          <span className="font-bold text-rose-800">Alasan Penolakan:</span> &ldquo;{req.rejectReason}&rdquo;
                        </p>
                      )}
                    </div>
                  )}
                </div>

                {/* Right Area: Action controls based on role */}
                <div className="flex items-center gap-2 self-start lg:self-center shrink-0">
                  {req.status === 'PENDING' ? (
                    currentUser.role === 'SUPER_ADMIN' ? (
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleApprove(req)}
                          className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-lg shadow-sm transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <Check className="w-3.5 h-3.5" />
                          <span>Setujui</span>
                        </button>
                        <button
                          onClick={() => {
                            setRejectingRequest(req);
                            setRejectReason("");
                          }}
                          className="px-3 py-1.5 bg-rose-50 hover:bg-rose-100 text-rose-600 font-bold text-xs border border-rose-200 rounded-lg transition-all flex items-center gap-1 cursor-pointer"
                        >
                          <X className="w-3.5 h-3.5" />
                          <span>Tolak</span>
                        </button>
                      </div>
                    ) : (
                      <div className="text-[10px] bg-amber-50 text-amber-800 border border-amber-100 px-3 py-1.5 rounded-lg flex items-center gap-1.5 font-medium max-w-[200px]">
                        <Clock className="w-3.5 h-3.5 animate-spin" />
                        <span>Menunggu keputusan Super Admin...</span>
                      </div>
                    )
                  ) : (
                    <div className="text-[10px] text-gray-400 font-bold uppercase tracking-widest bg-gray-50 border border-gray-100 px-2.5 py-1 rounded-lg">
                      Kasus Selesai
                    </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </div>

      {/* 4. MODAL: CREATE DISPOSAL REQUEST */}
      <AnimatePresence>
        {isRequestModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-lg w-full p-6 space-y-5 relative cursor-default"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-indigo-600">
                  <Trash2 className="w-5 h-5" />
                  <h3 className="font-extrabold text-sm text-gray-900">Form Pengajuan Barang Keluar</h3>
                </div>
                <button 
                  onClick={() => setIsRequestModalOpen(false)}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Form body */}
              <form onSubmit={handleCreateRequest} className="space-y-4 text-xs">
                {/* 1. Select Asset (Searchable list) */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Pilih Barang dari Katalog</label>
                  {selectedItemForDisposal ? (
                    <div className="p-3 bg-indigo-50/50 border border-indigo-100 rounded-xl flex items-center justify-between">
                      <div>
                        <span className="font-bold text-gray-900 block">{selectedItemForDisposal.name}</span>
                        <span className="text-[10px] text-indigo-600 block font-mono font-bold">Code: {selectedItemForDisposal.code} | Stok: {selectedItemForDisposal.qty} Unit</span>
                        <span className="text-[10px] text-gray-400 block font-semibold">Lokasi: {selectedItemForDisposal.locationName} ({selectedItemForDisposal.locationCode})</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setSelectedItemForDisposal(null)}
                        className="text-[10px] font-bold text-rose-600 hover:underline cursor-pointer"
                      >
                        Ganti Barang
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-gray-400 absolute left-3 top-2.5" />
                        <input
                          type="text"
                          placeholder="Ketik nama atau kode barang..."
                          value={searchItemQuery}
                          onChange={(e) => setSearchItemQuery(e.target.value)}
                          className="w-full bg-slate-50 border border-gray-200 rounded-xl pl-9 pr-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                      <div className="border border-gray-200 rounded-xl overflow-hidden max-h-40 overflow-y-auto divide-y divide-gray-150 bg-white">
                        {filteredItemsForSelect.length === 0 ? (
                          <p className="p-3.5 text-gray-400 italic text-center">Aset tidak ditemukan</p>
                        ) : (
                          filteredItemsForSelect.map(item => (
                            <div
                              key={item.id}
                              onClick={() => {
                                setSelectedItemForDisposal(item);
                                if (disposalQty > item.qty) {
                                  setDisposalQty(item.qty);
                                }
                              }}
                              className="p-2.5 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between"
                            >
                              <div>
                                <span className="font-bold text-gray-800 block">{item.name}</span>
                                <span className="text-[9px] text-slate-500 block font-mono">{item.code || "-"} | Stok: {item.qty} Unit</span>
                              </div>
                              <span className="text-[9px] text-gray-400 font-bold bg-slate-100 rounded px-1.5 py-0.5">
                                {item.locationCode}
                              </span>
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Disposal Type Selector */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Tipe Pengeluaran</label>
                  <div className="grid grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setDisposalType('DIBUANG')}
                      className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        disposalType === 'DIBUANG' 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold block text-[11px]">🚮 Rusak & Dibuang (Scrap)</span>
                      <span className="text-[9px] text-gray-500 leading-snug">Aset dalam kondisi rusak parah/berat dan akan dimusnahkan.</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDisposalType('HILANG')}
                      className={`p-3.5 rounded-xl border text-left flex flex-col gap-1 transition-all cursor-pointer ${
                        disposalType === 'HILANG' 
                          ? 'border-indigo-600 bg-indigo-50 text-indigo-900 ring-2 ring-indigo-100' 
                          : 'border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="font-bold block text-[11px]">🔍 Hilang / Dicuri</span>
                      <span className="text-[9px] text-gray-500 leading-snug">Aset hilang dari area penempatan, tidak ditemukan saat audit.</span>
                    </button>
                  </div>
                </div>

                {/* 3. Quantity field & validation info */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Jumlah (Quantity) Keluar</label>
                    <input
                      type="number"
                      min={1}
                      max={selectedItemForDisposal ? selectedItemForDisposal.qty : 9999}
                      value={disposalQty}
                      onChange={(e) => setDisposalQty(parseInt(e.target.value, 10) || 1)}
                      className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-bold focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-gray-500 uppercase block">Nama Pengaju</label>
                    <input
                      type="text"
                      disabled
                      value={currentUser.name}
                      className="w-full bg-gray-100 border border-gray-200 rounded-xl px-3.5 py-2 text-xs text-gray-500 font-bold"
                    />
                  </div>
                </div>

                {/* 4. Reason textarea */}
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Alasan Detail Pengeluaran Aset</label>
                  <textarea
                    placeholder="Contoh: Monitor pecah LCD karena tersenggol saat pembersihan kantor..."
                    value={disposalReason}
                    onChange={(e) => setDisposalReason(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  />
                </div>

                {/* Footer Buttons */}
                <div className="flex gap-3 pt-3 border-t border-gray-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl shadow-xs transition-colors cursor-pointer text-center"
                  >
                    Kirim Pengajuan
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsRequestModalOpen(false)}
                    className="py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* 5. REJECTION MODAL */}
      <AnimatePresence>
        {rejectingRequest && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-md w-full p-6 space-y-4"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="flex items-center gap-2 text-rose-600">
                <ShieldAlert className="w-5 h-5" />
                <h3 className="font-extrabold text-sm text-gray-900">Form Tolak Pengajuan</h3>
              </div>

              <form onSubmit={handleRejectSubmit} className="space-y-3 text-xs">
                <p className="text-[11px] text-gray-500 leading-relaxed font-semibold">
                  Tolak pengajuan pengeluaran barang <strong className="text-gray-800">{rejectingRequest.itemName}</strong> ({rejectingRequest.assetCode}) sebanyak {rejectingRequest.qty} unit.
                </p>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Alasan Penolakan Super Admin</label>
                  <textarea
                    placeholder="Contoh: Bukti foto barang rusak belum dilampirkan atau alasan kurang detail..."
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    rows={3}
                    className="w-full bg-slate-50 border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    required
                  />
                </div>

                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    type="submit"
                    className="flex-1 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs rounded-xl shadow-sm transition-colors cursor-pointer"
                  >
                    Tolak Pengajuan
                  </button>
                  <button
                    type="button"
                    onClick={() => setRejectingRequest(null)}
                    className="py-2.5 px-4 border border-gray-200 hover:bg-gray-50 text-gray-600 font-bold text-xs rounded-xl transition-colors cursor-pointer"
                  >
                    Batal
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
