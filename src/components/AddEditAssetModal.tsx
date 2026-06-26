import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { X, Save, AlertCircle } from "lucide-react";
import { InventoryItem } from "../types";
import { LOCATION_MAP } from "../dataService";

interface AddEditAssetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (item: InventoryItem) => void;
  editingItem: InventoryItem | null;
  items?: InventoryItem[];
}

const CATEGORIES = [
  "ATK",
  "ELEKTRONIK",
  "FURNITURE & MEBEUL",
  "KENDARAAN",
  "PERALATAN PANTRY",
  "PERALATAN TEKNISI",
  "RUMAH TANGGA KANTOR (RTK)",
  "LAIN-LAIN"
];

const STATUS_OPTIONS = ["Baik", "Rusak Ringan", "Rusak Berat", "Tidak Diketahui"];

const getCategoryAbbreviation = (cat: string): string => {
  const upper = cat.toUpperCase();
  if (upper.includes("ATK")) return "ATK";
  if (upper.includes("ELEKTRONIK")) return "ELK";
  if (upper.includes("FURNITURE")) return "FRN";
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
  return new Date().getFullYear().toString().substring(2);
};

const getNextSequence = (
  itemsList: InventoryItem[],
  locCode: string,
  catAbbr: string,
  yearAbbr: string
): string => {
  let maxSeq = 0;
  const prefix = `GSI-${locCode}-${catAbbr}-${yearAbbr}-`;
  
  itemsList.forEach(item => {
    if (item.code && item.code.toUpperCase().startsWith(prefix)) {
      const parts = item.code.split("-");
      const seqStr = parts[parts.length - 1];
      const seqNum = parseInt(seqStr, 10);
      if (!isNaN(seqNum) && seqNum > maxSeq) {
        maxSeq = seqNum;
      }
    }
  });
  
  const nextSeq = maxSeq + 1;
  return nextSeq.toString().padStart(4, "0");
};

export default function AddEditAssetModal({ isOpen, onClose, onSave, editingItem, items = [] }: AddEditAssetModalProps) {
  const [code, setCode] = useState("");
  const [isAutoCode, setIsAutoCode] = useState(true);
  const [name, setName] = useState("");
  const [category, setCategory] = useState(CATEGORIES[0]);
  const [spec, setSpec] = useState("");
  const [qty, setQty] = useState(1);
  const [priceUnit, setPriceUnit] = useState(0);
  const [locationCode, setLocationCode] = useState("KP");
  const [conditionRaw, setConditionRaw] = useState("BAIK");
  const [status, setStatus] = useState("Baik");
  const [acquisitionDate, setAcquisitionDate] = useState("");
  const [usefulLife, setUsefulLife] = useState(0);
  const [depreciation, setDepreciation] = useState(0);

  const [error, setError] = useState("");

  useEffect(() => {
    if (editingItem) {
      setCode(editingItem.code || "");
      setIsAutoCode(false);
      setName(editingItem.name || "");
      setCategory(editingItem.category || CATEGORIES[0]);
      setSpec(editingItem.spec || "");
      setQty(editingItem.qty || 1);
      setPriceUnit(editingItem.priceUnit || 0);
      setLocationCode(editingItem.locationCode || "KP");
      setConditionRaw(editingItem.conditionRaw || "BAIK");
      setStatus(editingItem.status || "Baik");
      setAcquisitionDate(editingItem.acquisitionDate || "");
      setUsefulLife(editingItem.usefulLife || 0);
      setDepreciation(editingItem.depreciation || 0);
    } else {
      // Set to default for new items
      setCode("");
      setIsAutoCode(true);
      setName("");
      setCategory(CATEGORIES[0]);
      setSpec("");
      setQty(1);
      setPriceUnit(0);
      setLocationCode("KP");
      setConditionRaw("BAIK");
      setStatus("Baik");
      setAcquisitionDate(new Date().getFullYear().toString());
      setUsefulLife(0);
      setDepreciation(0);
    }
    setError("");
  }, [editingItem, isOpen]);

  useEffect(() => {
    if (!editingItem && isAutoCode && isOpen) {
      const catAbbr = getCategoryAbbreviation(category);
      const yearAbbr = getYearAbbreviation(acquisitionDate);
      const nextSeq = getNextSequence(items, locationCode, catAbbr, yearAbbr);
      setCode(`GSI-${locationCode}-${catAbbr}-${yearAbbr}-${nextSeq}`);
    }
  }, [locationCode, category, acquisitionDate, isAutoCode, items, editingItem, isOpen]);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!name.trim()) {
      setError("Nama barang wajib diisi.");
      return;
    }

    if (qty <= 0) {
      setError("Jumlah barang harus minimal 1.");
      return;
    }

    if (priceUnit < 0) {
      setError("Harga perolehan tidak boleh negatif.");
      return;
    }

    // Auto-generate asset code if not filled
    let finalCode = code.trim();
    if (!finalCode) {
      const catAbbr = getCategoryAbbreviation(category);
      const yearAbbr = getYearAbbreviation(acquisitionDate);
      const nextSeq = getNextSequence(items, locationCode, catAbbr, yearAbbr);
      finalCode = `GSI-${locationCode}-${catAbbr}-${yearAbbr}-${nextSeq}`;
    }

    const savedItem: InventoryItem = {
      id: editingItem ? editingItem.id : finalCode,
      no: editingItem ? editingItem.no : Date.now().toString(),
      code: finalCode,
      category,
      name: name.trim(),
      spec: spec.trim(),
      qty: Number(qty),
      priceUnit: Number(priceUnit),
      priceTotal: Number(priceUnit) * Number(qty),
      acquisitionDate: acquisitionDate.trim() || "-",
      locationCode,
      locationName: LOCATION_MAP[locationCode] || `Cabang ${locationCode}`,
      conditionRaw: conditionRaw.trim() || status.toUpperCase(),
      status,
      usefulLife: Number(usefulLife),
      depreciation: Number(depreciation)
    };

    onSave(savedItem);
    onClose();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto" id="add-edit-asset-modal">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 bg-black/40 backdrop-blur-xs cursor-pointer"
          id="modal-backdrop"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 15 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 15 }}
          className="relative bg-white w-full max-w-2xl rounded-2xl shadow-xl border border-gray-100 flex flex-col z-10 max-h-[90vh] overflow-hidden"
          id="modal-content"
        >
          {/* Header */}
          <div className="p-5 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
            <h3 className="text-base font-bold text-gray-900" id="modal-title">
              {editingItem ? "Ubah Data Aset Inventaris" : "Tambah Aset Inventaris Baru"}
            </h3>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-150 rounded-lg text-gray-500 hover:text-gray-700 transition-colors cursor-pointer"
              id="close-modal-button"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-6 space-y-5">
            {error && (
              <div className="p-3 bg-rose-50 border border-rose-100 text-rose-700 text-xs rounded-xl flex items-center gap-2 font-medium" id="form-error-banner">
                <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {/* Row 1: Code & Name */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-bold text-gray-500 uppercase block">Kode Aset</label>
                  {!editingItem && (
                    <label className="flex items-center gap-1 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAutoCode}
                        onChange={(e) => setIsAutoCode(e.target.checked)}
                        className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 cursor-pointer"
                        id="checkbox-auto-code"
                      />
                      <span className="text-[10px] text-indigo-600 font-extrabold">Generate Otomatis</span>
                    </label>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="Contoh: GSI-KP-ELK-26-0001"
                  value={code}
                  disabled={!!editingItem || isAutoCode}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs font-mono font-semibold focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:bg-slate-50 disabled:text-slate-600 disabled:border-slate-200"
                  id="input-asset-code"
                />
                {!editingItem && isAutoCode && (
                  <p className="text-[9px] text-emerald-600 font-semibold italic">
                    * Format GSI-[CABANG]-[KATEGORI]-[TAHUN]-[URUT]
                  </p>
                )}
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Nama Barang <span className="text-rose-500">*</span></label>
                <input
                  type="text"
                  placeholder="Masukkan nama barang (contoh: Monitor Asus)"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-name"
                  required
                />
              </div>
            </div>

            {/* Row 2: Category & Location */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Kategori</label>
                <select
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="select-asset-category"
                >
                  {CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Lokasi Cabang</label>
                <select
                  value={locationCode}
                  onChange={(e) => setLocationCode(e.target.value)}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="select-asset-location"
                >
                  {Object.entries(LOCATION_MAP).map(([code, name]) => (
                    <option key={code} value={code}>{name} ({code})</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Row 3: Specifications */}
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-gray-500 uppercase block">Spesifikasi Detail Barang</label>
              <textarea
                placeholder="Masukkan rincian spesifikasi, tipe, nomor seri, atau merk..."
                value={spec}
                onChange={(e) => setSpec(e.target.value)}
                rows={2}
                className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                id="textarea-asset-spec"
              />
            </div>

            {/* Row 4: Quantity & Price */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Jumlah (Unit)</label>
                <input
                  type="number"
                  min="1"
                  value={qty}
                  onChange={(e) => setQty(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-qty"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Harga Perolehan per Unit (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={priceUnit}
                  onChange={(e) => setPriceUnit(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-price"
                />
              </div>
            </div>

            {/* Row 5: Status & Raw Condition */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Status Kondisi Terstandar</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                  className="w-full border border-gray-200 bg-white rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="select-asset-status"
                >
                  {STATUS_OPTIONS.map(statusOpt => (
                    <option key={statusOpt} value={statusOpt}>{statusOpt}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Catatan Detail Kondisi Lapangan</label>
                <input
                  type="text"
                  placeholder="Contoh: BAIK, RUSAK PARAH, TIDAK ADA KUNCI"
                  value={conditionRaw}
                  onChange={(e) => setConditionRaw(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-condition-raw"
                />
              </div>
            </div>

            {/* Row 6: Acquisition Date & Life/Depreciation */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Waktu Perolehan</label>
                <input
                  type="text"
                  placeholder="Contoh: 2026, Mei 2025"
                  value={acquisitionDate}
                  onChange={(e) => setAcquisitionDate(e.target.value)}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-acquisition-date"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Masa Manfaat (Tahun)</label>
                <input
                  type="number"
                  min="0"
                  value={usefulLife}
                  onChange={(e) => setUsefulLife(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-useful-life"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-bold text-gray-500 uppercase block">Beban Penyusutan (Rp)</label>
                <input
                  type="number"
                  min="0"
                  value={depreciation}
                  onChange={(e) => setDepreciation(Math.max(0, parseInt(e.target.value) || 0))}
                  className="w-full border border-gray-200 rounded-xl px-3.5 py-2 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  id="input-asset-depreciation"
                />
              </div>
            </div>
          </form>

          {/* Footer */}
          <div className="p-5 border-t border-gray-100 bg-gray-50 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="py-2.5 px-4 border border-gray-250 text-gray-600 font-semibold text-xs rounded-xl hover:bg-gray-100 transition-colors cursor-pointer"
              id="cancel-form-button"
            >
              Batal
            </button>
            <button
              onClick={handleSubmit}
              className="py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 text-white font-bold text-xs rounded-xl transition-colors flex items-center gap-1.5 shadow-sm cursor-pointer"
              id="save-form-button"
            >
              <Save className="w-4 h-4" />
              <span>Simpan Perubahan</span>
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
