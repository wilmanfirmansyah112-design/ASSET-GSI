import { motion, AnimatePresence } from "motion/react";
import { X, Calendar, MapPin, Tag, CircleAlert, DollarSign, HelpCircle, Layers, ShieldAlert, BadgeInfo, Trash2 } from "lucide-react";
import { InventoryItem } from "../types";
import { formatRupiah } from "../dataService";

interface ItemDetailsModalProps {
  item: InventoryItem | null;
  onClose: () => void;
  onEdit: (item: InventoryItem) => void;
  onDelete: (id: string) => void;
  onDisposalClick?: (item: InventoryItem) => void;
}

export default function ItemDetailsModal({ item, onClose, onEdit, onDelete, onDisposalClick }: ItemDetailsModalProps) {
  if (!item) return null;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Baik":
        return {
          bg: "bg-emerald-50 text-emerald-700 border-emerald-100",
          bullet: "bg-emerald-500",
        };
      case "Rusak Ringan":
        return {
          bg: "bg-amber-50 text-amber-700 border-amber-100",
          bullet: "bg-amber-500",
        };
      case "Rusak Berat":
        return {
          bg: "bg-rose-50 text-rose-700 border-rose-100",
          bullet: "bg-rose-500",
        };
      default:
        return {
          bg: "bg-gray-50 text-gray-700 border-gray-100",
          bullet: "bg-gray-400",
        };
    }
  };

  const badge = getStatusBadge(item.status);

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-end overflow-hidden" id="item-details-drawer">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          id="item-details-backdrop"
        />

        {/* Drawer Content */}
        <motion.div
          initial={{ x: "100%" }}
          animate={{ x: 0 }}
          exit={{ x: "100%" }}
          transition={{ type: "spring", damping: 25, stiffness: 220 }}
          className="relative w-full max-w-md h-full bg-white shadow-2xl flex flex-col z-10"
          id="item-details-content"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <div>
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                Detail Inventaris Aset
              </span>
              <h3 className="text-base font-bold text-gray-900 mt-0.5" id="detail-asset-code">
                {item.code || "ASET-TANPA-KODE"}
              </h3>
            </div>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-150 rounded-lg text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              id="close-details-button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {/* Title & Category */}
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100">
                  {item.category}
                </span>
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-semibold border flex items-center gap-1.5 ${badge.bg}`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${badge.bullet}`} />
                  {item.status}
                </span>
              </div>
              <h2 className="text-xl font-extrabold text-gray-900 tracking-tight" id="detail-asset-name">
                {item.name}
              </h2>
              {item.spec && (
                <div className="p-3.5 bg-gray-50 rounded-xl border border-gray-100 text-xs text-gray-600 font-medium leading-relaxed italic">
                  &ldquo;{item.spec}&rdquo;
                </div>
              )}
            </div>

            {/* Main Info Cards */}
            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Jumlah / Volume</span>
                <span className="text-lg font-bold text-gray-900">{item.qty} unit</span>
              </div>
              <div className="p-4 rounded-xl border border-gray-100 bg-gray-50/30 space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase block">Lokasi / Cabang</span>
                <span className="text-sm font-bold text-gray-800 flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5 text-rose-500 shrink-0" />
                  {item.locationCode}
                </span>
              </div>
            </div>

            {/* Financial Details */}
            <div className="space-y-3 bg-indigo-50/10 border border-indigo-100/50 p-4.5 rounded-xl">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="w-4 h-4 text-indigo-600" />
                Informasi Finansial
              </h4>
              <div className="space-y-2.5 text-xs">
                <div className="flex justify-between pb-2 border-b border-gray-100/75">
                  <span className="text-gray-500">Harga Perolehan / Unit:</span>
                  <span className="font-semibold text-gray-900">{formatRupiah(item.priceUnit)}</span>
                </div>
                <div className="flex justify-between items-center pb-1">
                  <span className="text-gray-500 font-medium">Total Harga Perolehan:</span>
                  <span className="text-sm font-bold text-indigo-700">{formatRupiah(item.priceTotal)}</span>
                </div>
              </div>
            </div>

            {/* Additional Details */}
            <div className="space-y-4">
              <h4 className="text-xs font-bold text-gray-700 uppercase tracking-wider">Spesifikasi Lanjutan</h4>
              <div className="space-y-3 bg-gray-50/30 border border-gray-100 p-4 rounded-xl text-xs">
                {/* Location Full */}
                <div className="flex items-start gap-3">
                  <MapPin className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-400 font-medium block">Nama Lokasi Cabang:</span>
                    <span className="font-semibold text-gray-800">{item.locationName}</span>
                  </div>
                </div>

                {/* Acquisition Date */}
                <div className="flex items-start gap-3 pt-2.5 border-t border-gray-100">
                  <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-400 font-medium block">Waktu Perolehan:</span>
                    <span className="font-semibold text-gray-800">{item.acquisitionDate || "Tidak Terdaftar"}</span>
                  </div>
                </div>

                {/* Condition Details */}
                <div className="flex items-start gap-3 pt-2.5 border-t border-gray-100">
                  <CircleAlert className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-400 font-medium block">Catatan Kondisi Lapangan:</span>
                    <span className="font-semibold text-gray-800">{item.conditionRaw || "Baik (Terawat)"}</span>
                  </div>
                </div>

                {/* Useful Life & Depreciation */}
                <div className="flex items-start gap-3 pt-2.5 border-t border-gray-100">
                  <Layers className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                  <div>
                    <span className="text-gray-400 font-medium block">Masa Manfaat & Penyusutan:</span>
                    <div className="flex items-center gap-3 mt-0.5 font-semibold text-gray-800">
                      <span>{item.usefulLife > 0 ? `${item.usefulLife} Tahun` : "Tidak disusutkan"}</span>
                      {item.depreciation > 0 && (
                        <>
                          <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                          <span className="text-amber-700">Penyusutan: {formatRupiah(item.depreciation)}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Actions Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex flex-col gap-3">
            {onDisposalClick && item.qty > 0 && (
              <button
                onClick={() => {
                  onDisposalClick(item);
                  onClose();
                }}
                className="w-full py-2.5 px-4 bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-300 font-extrabold text-xs rounded-xl transition-all shadow-xs cursor-pointer flex items-center justify-center gap-2"
                id="request-disposal-button"
              >
                <Trash2 className="w-4 h-4 text-slate-500" />
                <span>Ajukan Barang Keluar (Dibuang / Hilang)</span>
              </button>
            )}
            <div className="flex items-center gap-3 w-full">
              <button
                onClick={() => onEdit(item)}
                className="flex-1 py-2.5 px-4 bg-indigo-600 text-white font-bold text-xs rounded-xl hover:bg-indigo-700 transition-colors shadow-sm cursor-pointer text-center"
                id="edit-asset-button"
              >
                Ubah Data
              </button>
              <button
                onClick={() => {
                  if (confirm(`Apakah Anda yakin ingin menghapus aset "${item.name}" dari inventaris?`)) {
                    onDelete(item.id);
                    onClose();
                  }
                }}
                className="py-2.5 px-4 border border-rose-200 text-rose-600 font-bold text-xs rounded-xl hover:bg-rose-50 hover:text-rose-700 transition-colors cursor-pointer"
                id="delete-asset-button"
              >
                Hapus
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
