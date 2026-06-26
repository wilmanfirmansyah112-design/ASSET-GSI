import React, { useState, useMemo } from "react";
import { 
  ArrowLeftRight, Calendar, ClipboardList, TrendingUp, History, 
  BarChart3, Info, Search, RefreshCw, AlertCircle, CheckCircle2, 
  Trash2, MapPin, Package, ArrowRight, User, HelpCircle, FileText,
  Upload, FileSpreadsheet, Plus, Printer, Download
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { InventoryItem, TransferLog } from "../types";
import { LOCATION_MAP, loadTransferLogs, saveTransferLogs, formatRupiah } from "../dataService";

interface AssetTransferReportProps {
  items: InventoryItem[];
  onUpdateItems: (newItems: InventoryItem[]) => void;
  onShowToast: (message: string) => void;
}

export default function AssetTransferReport({ 
  items, 
  onUpdateItems, 
  onShowToast 
}: AssetTransferReportProps) {
  // ----------------------------------------------------
  // States
  // ----------------------------------------------------
  
  // Date range for report (Default to June 2026 based on metadata)
  const [startDate, setStartDate] = useState("2026-06-01");
  const [endDate, setEndDate] = useState("2026-06-25");

  // Transfer Logs state
  const [logs, setLogs] = useState<TransferLog[]>(() => loadTransferLogs());

  // Search filter for logs table
  const [logSearchQuery, setLogSearchQuery] = useState("");

  // Sub-tabs in report: "log", "stock", or "import"
  const [reportTab, setReportTab] = useState<"log" | "stock" | "import">("log");

  // Import states
  const [importType, setImportType] = useState<"new_assets" | "mutations">("new_assets");
  const [rawImportText, setRawImportText] = useState("");
  const [importError, setImportError] = useState("");
  const [importSuccess, setImportSuccess] = useState("");
  const [parsedPreview, setParsedPreview] = useState<any[]>([]);

  // Transfer Form States
  const [selectedItemId, setSelectedItemId] = useState("");
  const [destLocationCode, setDestLocationCode] = useState("");
  const [transferQty, setTransferQty] = useState(1);
  const [transferDate, setTransferDate] = useState("2026-06-25");
  const [transferNotes, setTransferNotes] = useState("");
  const [formError, setFormError] = useState("");
  const [formSuccess, setFormSuccess] = useState("");
  
  // Search query for selecting asset in form
  const [assetSearchQuery, setAssetSearchQuery] = useState("");
  const [showAssetDropdown, setShowAssetDropdown] = useState(false);

  // Filter reconstructed stock by branch
  const [reconstructedBranchFilter, setReconstructedBranchFilter] = useState("");
  const [selectedLogForPrint, setSelectedLogForPrint] = useState<TransferLog | null>(null);

  // ----------------------------------------------------
  // Computations & Find Selectable Assets
  // ----------------------------------------------------
  const selectableAssets = useMemo(() => {
    return items.filter(item => {
      // Must have quantity and matches search if query is provided
      if (item.qty <= 0) return false;
      if (!assetSearchQuery) return true;
      const q = assetSearchQuery.toLowerCase();
      return (
        item.name.toLowerCase().includes(q) ||
        item.code.toLowerCase().includes(q) ||
        (LOCATION_MAP[item.locationCode] || "").toLowerCase().includes(q) ||
        item.locationCode.toLowerCase().includes(q)
      );
    });
  }, [items, assetSearchQuery]);

  const selectedItem = useMemo(() => {
    return items.find(item => item.id === selectedItemId) || null;
  }, [items, selectedItemId]);

  // Adjust transferQty limits if selectedItem changes
  const handleSelectAsset = (item: InventoryItem) => {
    setSelectedItemId(item.id);
    setAssetSearchQuery(`${item.code} - ${item.name} (${item.locationCode})`);
    setTransferQty(1);
    setDestLocationCode("");
    setShowAssetDropdown(false);
    setFormError("");
  };

  // ----------------------------------------------------
  // Transfer Execution Logic
  // ----------------------------------------------------
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    setFormError("");
    setFormSuccess("");

    if (!selectedItem) {
      setFormError("Silakan pilih aset sumber yang akan dipindahkan.");
      return;
    }
    if (!destLocationCode) {
      setFormError("Silakan pilih cabang tujuan pemindahan.");
      return;
    }
    if (destLocationCode === selectedItem.locationCode) {
      setFormError("Cabang tujuan tidak boleh sama dengan cabang asal.");
      return;
    }
    if (transferQty <= 0) {
      setFormError("Jumlah transfer harus minimal 1 unit.");
      return;
    }
    if (transferQty > selectedItem.qty) {
      setFormError(`Jumlah transfer (${transferQty}) melebihi stok yang tersedia (${selectedItem.qty} unit).`);
      return;
    }
    if (!transferDate) {
      setFormError("Silakan pilih tanggal pemindahan.");
      return;
    }

    try {
      const updatedItems = [...items];
      
      // 1. Find the index of the source item
      const sourceIndex = updatedItems.findIndex(i => i.id === selectedItem.id);
      if (sourceIndex === -1) {
        setFormError("Aset sumber tidak ditemukan dalam database.");
        return;
      }

      // 2. Subtract qty and recalculate total price for source item
      const sourceItem = { ...updatedItems[sourceIndex] };
      sourceItem.qty -= transferQty;
      sourceItem.priceTotal = sourceItem.qty * sourceItem.priceUnit;
      
      // Replace in array (keep it with qty 0 or update)
      updatedItems[sourceIndex] = sourceItem;

      // 3. Check if the destination branch already has the exact same item
      // We check by Code to keep database integrity
      const destIndex = updatedItems.findIndex(
        i => i.code === sourceItem.code && i.locationCode === destLocationCode
      );

      let actualDestId = "";

      if (destIndex !== -1) {
        // Destination item exists: update quantity and prices
        const destItem = { ...updatedItems[destIndex] };
        destItem.qty += transferQty;
        destItem.priceTotal = destItem.qty * destItem.priceUnit;
        updatedItems[destIndex] = destItem;
        actualDestId = destItem.id;
      } else {
        // Destination item does not exist: create a new item
        const newId = `${sourceItem.code}-${destLocationCode}`;
        const newNo = `${Date.now()}`; // Unique number identifier
        const newItem: InventoryItem = {
          ...sourceItem,
          id: newId,
          no: newNo,
          qty: transferQty,
          priceTotal: transferQty * sourceItem.priceUnit,
          locationCode: destLocationCode,
          locationName: LOCATION_MAP[destLocationCode] || `Cabang ${destLocationCode}`,
        };
        updatedItems.push(newItem);
        actualDestId = newId;
      }

      // 4. Create and save the Transfer Log
      const newLog: TransferLog = {
        id: `TRF-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        itemId: sourceItem.id,
        itemName: sourceItem.name,
        assetCode: sourceItem.code,
        fromLocationCode: sourceItem.locationCode,
        fromLocationName: LOCATION_MAP[sourceItem.locationCode] || sourceItem.locationCode,
        toLocationCode: destLocationCode,
        toLocationName: LOCATION_MAP[destLocationCode] || destLocationCode,
        qty: transferQty,
        transferDate: transferDate,
        notes: transferNotes.trim() || "Pemindahan rutin antar cabang",
        operator: "Wilman Firmansyah"
      };

      const updatedLogs = [newLog, ...logs];
      
      // Save everything
      onUpdateItems(updatedItems);
      setLogs(updatedLogs);
      saveTransferLogs(updatedLogs);

      // Reset form states
      setAssetSearchQuery("");
      setSelectedItemId("");
      setDestLocationCode("");
      setTransferQty(1);
      setTransferNotes("");
      
      setFormSuccess(`Berhasil memindahkan ${transferQty} unit "${sourceItem.name}" ke ${LOCATION_MAP[destLocationCode]}!`);
      onShowToast(`Pemindahan barang berhasil diproses dan dicatat.`);
    } catch (err: any) {
      console.error(err);
      setFormError("Terjadi kesalahan teknis saat memproses pemindahan.");
    }
  };

  // ----------------------------------------------------
  // Reverse / Delete Transfer Log Logic
  // ----------------------------------------------------
  const handleDeleteLog = (logToDelete: TransferLog) => {
    const confirmed = window.confirm(
      `Apakah Anda yakin ingin membatalkan/menghapus log pemindahan ini?\n\n` +
      `Item: ${logToDelete.itemName} (${logToDelete.qty} unit)\n` +
      `Dari: ${logToDelete.fromLocationName} -> Ke: ${logToDelete.toLocationName}\n\n` +
      `Sistem akan membalikkan kuantitas stok barang di kedua cabang jika kuantitas di cabang tujuan mencukupi.`
    );

    if (!confirmed) return;

    try {
      const updatedItems = [...items];

      // 1. Find destination item to subtract qty
      // Match by code at the destination branch
      const destIndex = updatedItems.findIndex(
        item => item.code === logToDelete.assetCode && item.locationCode === logToDelete.toLocationCode
      );

      if (destIndex === -1) {
        alert("Gagal membalikkan pemindahan: Item di cabang tujuan tidak ditemukan.");
        return;
      }

      const destItem = { ...updatedItems[destIndex] };
      if (destItem.qty < logToDelete.qty) {
        alert(
          `Gagal membalikkan pemindahan: Stok di cabang tujuan (${destItem.qty} unit) ` +
          `kurang dari jumlah yang dipindahkan (${logToDelete.qty} unit).`
        );
        return;
      }

      // Subtract from destination
      destItem.qty -= logToDelete.qty;
      destItem.priceTotal = destItem.qty * destItem.priceUnit;
      updatedItems[destIndex] = destItem;

      // 2. Add back to source item
      const sourceIndex = updatedItems.findIndex(
        item => item.code === logToDelete.assetCode && item.locationCode === logToDelete.fromLocationCode
      );

      if (sourceIndex !== -1) {
        const sourceItem = { ...updatedItems[sourceIndex] };
        sourceItem.qty += logToDelete.qty;
        sourceItem.priceTotal = sourceItem.qty * sourceItem.priceUnit;
        updatedItems[sourceIndex] = sourceItem;
      } else {
        // Source item was completely deleted/not found, let's restore it as new
        const restoredSource: InventoryItem = {
          id: logToDelete.itemId,
          no: `${Date.now()}`,
          code: logToDelete.assetCode,
          category: destItem.category,
          name: logToDelete.itemName,
          spec: destItem.spec,
          qty: logToDelete.qty,
          priceUnit: destItem.priceUnit,
          priceTotal: logToDelete.qty * destItem.priceUnit,
          acquisitionDate: destItem.acquisitionDate,
          locationCode: logToDelete.fromLocationCode,
          locationName: logToDelete.fromLocationName,
          conditionRaw: destItem.conditionRaw,
          status: destItem.status,
          usefulLife: destItem.usefulLife,
          depreciation: destItem.depreciation
        };
        updatedItems.push(restoredSource);
      }

      // Remove items that end up with 0 quantity if desired, or keep them. Let's keep them so they can be re-filled.
      // 3. Remove the log
      const updatedLogs = logs.filter(l => l.id !== logToDelete.id);

      // Save everything
      onUpdateItems(updatedItems);
      setLogs(updatedLogs);
      saveTransferLogs(updatedLogs);

      onShowToast("Transaksi pemindahan barang berhasil dibatalkan dan stok dikembalikan.");
    } catch (err) {
      console.error(err);
      alert("Gagal membatalkan pemindahan karena kesalahan sistem.");
    }
  };

  // ----------------------------------------------------
  // Period Filtering and Statistics
  // ----------------------------------------------------
  const filteredLogs = useMemo(() => {
    return logs.filter(log => {
      // Date filter
      const matchesDate = log.transferDate >= startDate && log.transferDate <= endDate;
      if (!matchesDate) return false;

      // Query filter
      if (!logSearchQuery) return true;
      const q = logSearchQuery.toLowerCase();
      return (
        log.itemName.toLowerCase().includes(q) ||
        log.assetCode.toLowerCase().includes(q) ||
        log.fromLocationName.toLowerCase().includes(q) ||
        log.toLocationName.toLowerCase().includes(q) ||
        (log.notes && log.notes.toLowerCase().includes(q))
      );
    });
  }, [logs, startDate, endDate, logSearchQuery]);

  // Calculations for KPI cards of selected period
  const periodStats = useMemo(() => {
    const totalCount = filteredLogs.length;
    const totalQtyMoved = filteredLogs.reduce((sum, log) => sum + log.qty, 0);
    
    // Find unit prices of assets to calculate moved valuation
    let totalValueMoved = 0;
    filteredLogs.forEach(log => {
      const match = items.find(i => i.code === log.assetCode);
      const priceUnit = match ? match.priceUnit : 0;
      totalValueMoved += log.qty * priceUnit;
    });

    return {
      totalCount,
      totalQtyMoved,
      totalValueMoved
    };
  }, [filteredLogs, items]);

  // ----------------------------------------------------
  // ADVANCED FEATURE: Retroactive Historical Stock Reconstruction
  // ----------------------------------------------------
  const reconstructedStock = useMemo(() => {
    // We want to find the exact stock quantities of items at the date = endDate
    // Reconstruct formula:
    // Reconstructed Qty = Current Qty - (Transfers received after endDate) + (Transfers sent after endDate)
    // Also, if acquisitionDate of item is after endDate, then the item didn't exist yet, so Qty = 0.

    const result: { item: InventoryItem; reconstructedQty: number; reconstructedValue: number }[] = [];

    items.forEach(item => {
      // 1. If acquired after endDate, it didn't exist in the company yet
      if (item.acquisitionDate && item.acquisitionDate > endDate) {
        return; // Skip this item entirely
      }

      let reconQty = item.qty;

      // 2. Track logs that occurred AFTER endDate
      // If a transfer happened after endDate, we must "undo" its effect to see the state at endDate
      logs.forEach(log => {
        if (log.transferDate > endDate) {
          // If this item was the destination (received the transfer)
          if (item.code === log.assetCode && item.locationCode === log.toLocationCode) {
            reconQty -= log.qty; // Subtract received qty because at endDate it hadn't arrived yet
          }
          // If this item was the source (sent the transfer)
          if (item.code === log.assetCode && item.locationCode === log.fromLocationCode) {
            reconQty += log.qty; // Add back sent qty because at endDate it hadn't left yet
          }
        }
      });

      // Filter out items that reconstructed to <= 0 to avoid clutter
      if (reconQty > 0) {
        result.push({
          item,
          reconstructedQty: reconQty,
          reconstructedValue: reconQty * item.priceUnit
        });
      }
    });

    // Apply branch filter to the reconstructed table
    if (reconstructedBranchFilter) {
      return result.filter(r => r.item.locationCode === reconstructedBranchFilter);
    }

    return result;
  }, [items, logs, endDate, reconstructedBranchFilter]);

  // Total summary statistics of the reconstructed state
  const reconstructedSummary = useMemo(() => {
    let totalItems = reconstructedStock.length;
    let totalQty = reconstructedStock.reduce((sum, r) => sum + r.reconstructedQty, 0);
    let totalVal = reconstructedStock.reduce((sum, r) => sum + r.reconstructedValue, 0);

    return {
      totalItems,
      totalQty,
      totalVal
    };
  }, [reconstructedStock]);

  // ----------------------------------------------------
  // Bulk Import Handlers
  // ----------------------------------------------------
  const handleParseImport = () => {
    setImportError("");
    setImportSuccess("");
    setParsedPreview([]);

    if (!rawImportText.trim()) {
      setImportError("Silakan tempel teks data CSV atau data dari Excel terlebih dahulu.");
      return;
    }

    const lines = rawImportText.split("\n").map(l => l.trim()).filter(Boolean);
    const parsed: any[] = [];
    let lineNum = 0;

    for (const line of lines) {
      lineNum++;
      // Skip header line if it looks like headers
      if (lineNum === 1 && (
        line.toLowerCase().includes("kode") || 
        line.toLowerCase().includes("nama") || 
        line.toLowerCase().includes("kategori") ||
        line.toLowerCase().includes("asal")
      )) {
        continue;
      }

      // Support Tab (\t) or Comma (,) or Semicolon (;)
      let separator = ",";
      if (line.includes("\t")) {
        separator = "\t";
      } else if (line.includes(";")) {
        separator = ";";
      }

      const cols = line.split(separator).map(c => c.trim().replace(/^["']|["']$/g, ""));

      if (importType === "new_assets") {
        if (cols.length < 5) {
          setImportError(`Baris ${lineNum} tidak lengkap. Format minimal: Kode, Nama Aset, Kategori, Qty, Harga Satuan`);
          return;
        }

        const code = cols[0].toUpperCase();
        const name = cols[1];
        const category = cols[2];
        const qty = parseInt(cols[3]);
        const priceUnit = parseFloat(cols[4].replace(/[Rp.\s]/g, ""));
        const branchCode = (cols[5] || "KP").toUpperCase();
        const spec = cols[6] || "-";

        if (!code || !name || !category) {
          setImportError(`Baris ${lineNum} memiliki Kode, Nama, atau Kategori kosong.`);
          return;
        }

        if (isNaN(qty) || qty <= 0) {
          setImportError(`Baris ${lineNum} memiliki Jumlah (Qty) tidak valid: ${cols[3]}`);
          return;
        }

        if (isNaN(priceUnit) || priceUnit < 0) {
          setImportError(`Baris ${lineNum} memiliki Harga Satuan tidak valid: ${cols[4]}`);
          return;
        }

        if (!LOCATION_MAP[branchCode]) {
          setImportError(`Baris ${lineNum} memiliki Kode Cabang tidak valid: "${branchCode}". Pilih KP, MT, KC, dsb.`);
          return;
        }

        parsed.push({
          code,
          name,
          category,
          qty,
          priceUnit,
          branchCode,
          spec,
          lineNum
        });
      } else {
        // mutations (Bulk Transfers)
        if (cols.length < 4) {
          setImportError(`Baris ${lineNum} tidak lengkap. Format minimal: Kode Aset, Cabang Asal, Cabang Tujuan, Qty`);
          return;
        }

        const assetCode = cols[0].toUpperCase();
        const fromCode = cols[1].toUpperCase();
        const toCode = cols[2].toUpperCase();
        const qty = parseInt(cols[3]);
        const notes = cols[4] || "Mutasi masal via import";

        if (!assetCode) {
          setImportError(`Baris ${lineNum}: Kode Aset kosong.`);
          return;
        }

        if (!LOCATION_MAP[fromCode] || !LOCATION_MAP[toCode]) {
          setImportError(`Baris ${lineNum}: Kode Cabang Asal ("${fromCode}") atau Tujuan ("${toCode}") tidak valid.`);
          return;
        }

        if (fromCode === toCode) {
          setImportError(`Baris ${lineNum}: Cabang Asal dan Tujuan sama ("${fromCode}").`);
          return;
        }

        if (isNaN(qty) || qty <= 0) {
          setImportError(`Baris ${lineNum}: Qty mutasi tidak valid.`);
          return;
        }

        const sourceItem = items.find(i => i.code === assetCode && i.locationCode === fromCode);
        if (!sourceItem) {
          setImportError(`Baris ${lineNum}: Aset dengan kode "${assetCode}" tidak ditemukan di Cabang Asal "${fromCode}".`);
          return;
        }

        if (sourceItem.qty < qty) {
          setImportError(`Baris ${lineNum}: Stok aset "${assetCode}" di Cabang "${fromCode}" tidak mencukupi. Tersedia: ${sourceItem.qty}, diminta: ${qty}.`);
          return;
        }

        parsed.push({
          assetCode,
          itemName: sourceItem.name,
          fromCode,
          toCode,
          qty,
          notes,
          sourceItemId: sourceItem.id,
          lineNum
        });
      }
    }

    setParsedPreview(parsed);
    onShowToast(`Berhasil menganalisis ${parsed.length} baris data. Silakan tinjau preview sebelum memproses.`);
  };

  const handleExecuteImport = () => {
    if (parsedPreview.length === 0) return;

    try {
      const updatedItems = [...items];

      if (importType === "new_assets") {
        parsedPreview.forEach(p => {
          const existingIndex = updatedItems.findIndex(
            i => i.code === p.code && i.locationCode === p.branchCode
          );

          if (existingIndex !== -1) {
            const match = { ...updatedItems[existingIndex] };
            match.qty += p.qty;
            match.priceTotal = match.qty * match.priceUnit;
            updatedItems[existingIndex] = match;
          } else {
            const newId = `${p.code}-${p.branchCode}`;
            const newNo = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newItem: InventoryItem = {
              id: newId,
              no: newNo,
              code: p.code,
              category: p.category,
              name: p.name,
              spec: p.spec,
              qty: p.qty,
              priceUnit: p.priceUnit,
              priceTotal: p.qty * p.priceUnit,
              acquisitionDate: "2026-06-25",
              locationCode: p.branchCode,
              locationName: LOCATION_MAP[p.branchCode] || p.branchCode,
              conditionRaw: "Bagus",
              status: "Digunakan",
              usefulLife: 5,
              depreciation: 0
            };
            updatedItems.push(newItem);
          }
        });

        onUpdateItems(updatedItems);
        setImportSuccess(`Berhasil mengimpor ${parsedPreview.length} aset baru ke database!`);
        setRawImportText("");
        setParsedPreview([]);
        onShowToast(`Pemasukan ${parsedPreview.length} aset baru masal berhasil.`);
      } else {
        const updatedLogs = [...logs];

        parsedPreview.forEach(p => {
          const srcIdx = updatedItems.findIndex(i => i.id === p.sourceItemId);
          if (srcIdx === -1) return;

          const sourceItem = { ...updatedItems[srcIdx] };
          sourceItem.qty -= p.qty;
          sourceItem.priceTotal = sourceItem.qty * sourceItem.priceUnit;
          updatedItems[srcIdx] = sourceItem;

          const destIdx = updatedItems.findIndex(
            i => i.code === p.assetCode && i.locationCode === p.toCode
          );

          if (destIdx !== -1) {
            const destItem = { ...updatedItems[destIdx] };
            destItem.qty += p.qty;
            destItem.priceTotal = destItem.qty * destItem.priceUnit;
            updatedItems[destIdx] = destItem;
          } else {
            const newId = `${p.assetCode}-${p.toCode}`;
            const newNo = `${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            const newItem: InventoryItem = {
              ...sourceItem,
              id: newId,
              no: newNo,
              qty: p.qty,
              priceTotal: p.qty * sourceItem.priceUnit,
              locationCode: p.toCode,
              locationName: LOCATION_MAP[p.toCode] || p.toCode,
            };
            updatedItems.push(newItem);
          }

          const newLog: TransferLog = {
            id: `TRF-BLK-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
            itemId: sourceItem.id,
            itemName: sourceItem.name,
            assetCode: sourceItem.code,
            fromLocationCode: sourceItem.locationCode,
            fromLocationName: LOCATION_MAP[sourceItem.locationCode] || sourceItem.locationCode,
            toLocationCode: p.toCode,
            toLocationName: LOCATION_MAP[p.toCode] || p.toCode,
            qty: p.qty,
            transferDate: "2026-06-25",
            notes: p.notes,
            operator: "Wilman Firmansyah"
          };
          updatedLogs.unshift(newLog);
        });

        onUpdateItems(updatedItems);
        setLogs(updatedLogs);
        saveTransferLogs(updatedLogs);

        setImportSuccess(`Berhasil memproses ${parsedPreview.length} mutasi/perpindahan barang masal!`);
        setRawImportText("");
        setParsedPreview([]);
        onShowToast(`Mutasi masal ${parsedPreview.length} aset berhasil diproses.`);
      }
    } catch (err: any) {
      console.error(err);
      setImportError("Gagal menyimpan data impor masal karena kendala teknis.");
    }
  };

  const downloadTemplate = (type: "new_assets" | "mutations") => {
    let headers = "";
    let data = "";
    let filename = "";

    if (type === "new_assets") {
      headers = "Kode,Nama Aset,Kategori,Qty,Harga Satuan,Kode Cabang,Spesifikasi";
      data = "AST-901,Laptop ThinkPad L14 Gen 4,Elektronik,5,12500000,KP,Intel Core i5 16GB RAM 512GB SSD\nAST-902,Kursi Ergonomis Kantor,Furnitur,12,1250000,MT,Jaring Hitam Adjustable";
      filename = "template_registrasi_aset_baru.csv";
    } else {
      headers = "Kode Aset,Cabang Asal,Cabang Tujuan,Qty,Catatan";
      data = "AST-101,KP,MT,1,Mutasi rutin divisi audit\nAST-102,KP,KC,1,Mutasi server internal";
      filename = "template_mutasi_aset.csv";
    }

    const csvContent = "\uFEFF" + headers + "\n" + data;
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    onShowToast("Template CSV berhasil diunduh.");
  };

  return (
    <div className="space-y-8" id="asset-transfer-report-container">
      
      {/* SECTION BANNER DESCRIPTION */}
      <div className="bg-slate-900 text-white rounded-3xl p-6 md:p-8 border border-slate-800 shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative overflow-hidden">
        <div className="absolute right-0 top-0 translate-x-12 -translate-y-12 w-64 h-64 bg-indigo-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="space-y-1.5 z-10">
          <span className="text-[10px] bg-indigo-500/35 text-indigo-200 px-2.5 py-1 rounded-full font-extrabold uppercase tracking-widest border border-indigo-500/20 inline-block">
            Modul Administrasi Aset GSI
          </span>
          <h2 className="text-xl md:text-2xl font-bold tracking-tight">Mutasi & Rekapitulasi Periode</h2>
          <p className="text-xs text-slate-300 leading-relaxed max-w-xl font-medium">
            Lakukan pemindahan barang antar cabang, catat log mutasi internal, dan hitung rekonstruksi stock opname di akhir periode secara otomatis.
          </p>
        </div>
        <div className="flex items-center gap-2 bg-slate-800/80 border border-slate-700 p-3 rounded-2xl shrink-0 z-10">
          <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <User className="w-5 h-5" />
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block font-semibold leading-none">Petugas Audit</span>
            <span className="text-xs font-bold text-white mt-0.5 block">Wilman Firmansyah</span>
          </div>
        </div>
      </div>

      {/* SPLIT LAYOUT: LEFT IS FORM, RIGHT IS PERIODIC RECAP REPORT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        
        {/* ========================================================= */}
        {/* LEFT COLUMN: FORM MUTASI / PEMINDAHAN (4 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6" id="mutation-form-panel">
            <div className="flex items-center gap-3 border-b border-gray-100 pb-4 mb-5">
              <div className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <ArrowLeftRight className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Form Pemindahan Aset</h3>
                <p className="text-[11px] text-gray-500 font-semibold">Mutasi Barang dari Pusat ke Cabang / Antar-Cabang</p>
              </div>
            </div>

            {formError && (
              <div className="mb-4 p-3 bg-red-50 border border-red-100 text-red-700 rounded-xl text-xs flex items-start gap-2 animate-pulse">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="mb-4 p-3 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleExecuteTransfer} className="space-y-4">
              
              {/* SELECT ASSET WITH AUTOCOMPLETE DROPDOWN */}
              <div className="space-y-1.5 relative">
                <label className="text-[11px] font-bold text-gray-700 flex items-center justify-between">
                  <span>Pilih Aset Sumber</span>
                  {selectedItem && (
                    <span className="text-[10px] text-indigo-600 font-bold bg-indigo-50 px-2 py-0.5 rounded-full">
                      Stok: {selectedItem.qty} Unit
                    </span>
                  )}
                </label>
                
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <Search className="h-4 w-4 text-gray-400" />
                  </div>
                  <input
                    type="text"
                    placeholder="Ketik kode / nama aset atau cabang..."
                    value={assetSearchQuery}
                    onChange={(e) => {
                      setAssetSearchQuery(e.target.value);
                      setShowAssetDropdown(true);
                      if (selectedItemId) {
                        setSelectedItemId(""); // reset selection if they type
                      }
                    }}
                    onFocus={() => setShowAssetDropdown(true)}
                    className="pl-9 w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-gray-800"
                  />
                  {assetSearchQuery && (
                    <button
                      type="button"
                      onClick={() => {
                        setAssetSearchQuery("");
                        setSelectedItemId("");
                        setShowAssetDropdown(true);
                      }}
                      className="absolute right-3 top-2.5 text-[10px] font-bold text-gray-400 hover:text-gray-600"
                    >
                      Clear
                    </button>
                  )}
                </div>

                {/* DROPDOWN MENU */}
                {showAssetDropdown && (
                  <div className="absolute z-20 w-full bg-white mt-1.5 border border-gray-200 rounded-xl shadow-lg max-h-[220px] overflow-y-auto divide-y divide-gray-100">
                    {selectableAssets.length === 0 ? (
                      <div className="p-4 text-center text-xs text-gray-400 font-medium">
                        Tidak ada aset yang cocok atau memiliki kuantitas.
                      </div>
                    ) : (
                      selectableAssets.slice(0, 15).map(item => (
                        <button
                          key={item.id}
                          type="button"
                          onClick={() => handleSelectAsset(item)}
                          className="w-full text-left p-3 hover:bg-slate-50 transition-colors block"
                        >
                          <div className="flex justify-between items-start gap-2">
                            <span className="font-bold text-xs text-slate-800 line-clamp-1">
                              {item.name}
                            </span>
                            <span className="shrink-0 text-[10px] font-extrabold px-1.5 py-0.5 rounded-sm bg-slate-100 text-slate-600 font-mono">
                              {item.locationCode}
                            </span>
                          </div>
                          <div className="flex items-center justify-between mt-1 text-[10px] text-gray-500">
                            <span className="font-semibold font-mono text-indigo-600">{item.code}</span>
                            <span>Qty: <strong className="text-gray-800">{item.qty}</strong> | {formatRupiah(item.priceUnit)}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
              </div>

              {/* SELECTED ASSET HIGHLIGHT CARD */}
              {selectedItem && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.98 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="p-3.5 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs"
                >
                  <div className="flex items-start gap-2.5">
                    <div className="p-1.5 bg-indigo-50 text-indigo-600 rounded-lg mt-0.5">
                      <Package className="w-3.5 h-3.5" />
                    </div>
                    <div className="space-y-0.5">
                      <span className="text-[10px] font-bold text-slate-400 block font-mono">{selectedItem.code}</span>
                      <strong className="text-slate-800 block font-bold leading-tight">{selectedItem.name}</strong>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-200/40 text-[10px] font-medium text-slate-600">
                    <div>
                      <span>Cabang Asal:</span>
                      <span className="font-bold text-slate-800 block flex items-center gap-0.5 mt-0.5">
                        <MapPin className="w-3 h-3 text-red-500" /> {selectedItem.locationName} ({selectedItem.locationCode})
                      </span>
                    </div>
                    <div>
                      <span>Harga Satuan:</span>
                      <span className="font-bold text-slate-800 block mt-0.5">{formatRupiah(selectedItem.priceUnit)}</span>
                    </div>
                  </div>
                </motion.div>
              )}

              {/* DESTINATION BRANCH */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 block">
                  Cabang Tujuan
                </label>
                <select
                  value={destLocationCode}
                  onChange={(e) => setDestLocationCode(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-gray-800"
                >
                  <option value="">-- Pilih Cabang Tujuan --</option>
                  {Object.entries(LOCATION_MAP).map(([code, name]) => {
                    // Disable destination same as selected item location
                    const isSame = selectedItem && selectedItem.locationCode === code;
                    return (
                      <option key={code} value={code} disabled={isSame}>
                        {name} ({code}) {isSame ? "- (Asal)" : ""}
                      </option>
                    );
                  })}
                </select>
              </div>

              {/* GRID FOR QTY AND DATE */}
              <div className="grid grid-cols-2 gap-3">
                
                {/* QUANTITY TO MOVE */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Jumlah (Qty)
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={selectedItem ? selectedItem.qty : 999}
                    value={transferQty}
                    onChange={(e) => setTransferQty(Math.max(1, parseInt(e.target.value) || 1))}
                    className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-gray-800"
                  />
                </div>

                {/* TRANSFER DATE */}
                <div className="space-y-1.5">
                  <label className="text-[11px] font-bold text-gray-700 block">
                    Tanggal Transfer
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-gray-800 font-mono"
                  />
                </div>

              </div>

              {/* NOTES */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-gray-700 block">
                  Catatan Mutasi
                </label>
                <textarea
                  rows={2}
                  placeholder="Contoh: Pemindahan server cadangan untuk outlet baru Kiaracondong..."
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-xl py-2 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-medium text-gray-800"
                />
              </div>

              {/* PROCESS BUTTON */}
              <button
                type="submit"
                disabled={!selectedItem || !destLocationCode}
                className="w-full py-2.5 px-4 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-400 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-all"
              >
                <ArrowLeftRight className="w-4 h-4" />
                <span>Proses Pemindahan Aset</span>
              </button>

            </form>
          </div>
        </div>

        {/* ========================================================= */}
        {/* RIGHT COLUMN: REKAP MUTASI & LAPORAN PERIODE (7 cols) */}
        {/* ========================================================= */}
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs p-5 md:p-6" id="periodic-report-panel">
            
            {/* Header with Date pickers */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-gray-100 pb-4 mb-5">
              <div>
                <h3 className="font-bold text-gray-900 text-sm">Rekap Laporan Mutasi & Stok</h3>
                <p className="text-[11px] text-gray-500 font-semibold">Tentukan periode untuk merekap data</p>
              </div>

              <div className="flex items-center gap-2 bg-slate-50 border border-gray-200 p-2 rounded-xl text-[11px] font-semibold text-gray-700">
                <Calendar className="w-4 h-4 text-gray-400 shrink-0" />
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-mono text-[11px] focus:ring-0 p-0 text-gray-800"
                />
                <span className="text-gray-300">s/d</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="bg-transparent border-none outline-none font-mono text-[11px] focus:ring-0 p-0 text-gray-800"
                />
              </div>
            </div>

            {/* STATISTICAL KPIS FOR PERIOD */}
            <div className="grid grid-cols-3 gap-3.5 mb-6">
              <div className="p-3 bg-slate-50/70 border border-slate-100 rounded-xl space-y-1 text-center">
                <span className="text-[10px] text-gray-500 block font-bold uppercase tracking-wider">Mutasi Diproses</span>
                <span className="text-lg font-extrabold text-slate-800 block font-mono">
                  {periodStats.totalCount}
                </span>
                <span className="text-[9px] text-gray-400 font-semibold">Kali mutasi</span>
              </div>
              
              <div className="p-3 bg-indigo-50/30 border border-indigo-100/30 rounded-xl space-y-1 text-center">
                <span className="text-[10px] text-indigo-600 block font-bold uppercase tracking-wider">Aset Bermutasi</span>
                <span className="text-lg font-extrabold text-indigo-600 block font-mono">
                  {periodStats.totalQtyMoved}
                </span>
                <span className="text-[9px] text-indigo-400 font-semibold">Unit aset</span>
              </div>

              <div className="p-3 bg-emerald-50/40 border border-emerald-100/30 rounded-xl space-y-1 text-center">
                <span className="text-[10px] text-emerald-700 block font-bold uppercase tracking-wider">Valuasi Mutasi</span>
                <span className="text-xs font-bold text-emerald-700 block h-7 flex items-center justify-center font-mono truncate">
                  {formatRupiah(periodStats.totalValueMoved)}
                </span>
                <span className="text-[9px] text-emerald-500 font-semibold">Rupiah mutasi</span>
              </div>
            </div>

            {/* TAB SELECTOR */}
            <div className="flex border-b border-gray-100 mb-4 p-0.5 bg-gray-100 rounded-xl">
              <button
                onClick={() => setReportTab("log")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  reportTab === "log" 
                    ? "bg-white text-gray-900 shadow-xs" 
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <History className="w-3.5 h-3.5" />
                <span>Histori Mutasi ({filteredLogs.length})</span>
              </button>
              
              <button
                onClick={() => setReportTab("stock")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  reportTab === "stock" 
                    ? "bg-white text-gray-900 shadow-xs" 
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>Stok Akhir Periode ({reconstructedStock.length})</span>
              </button>

              <button
                onClick={() => setReportTab("import")}
                className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                  reportTab === "import" 
                    ? "bg-white text-gray-900 shadow-xs" 
                    : "text-gray-500 hover:text-gray-800"
                }`}
              >
                <Upload className="w-3.5 h-3.5" />
                <span>Import Masal</span>
              </button>
            </div>

            {/* ========================================================= */}
            {/* TAB CONTENT: LOG MUTASI */}
            {/* ========================================================= */}
            {reportTab === "log" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-3">
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                      <Search className="h-3.5 w-3.5 text-gray-400" />
                    </div>
                    <input
                      type="text"
                      placeholder="Cari dalam log mutasi..."
                      value={logSearchQuery}
                      onChange={(e) => setLogSearchQuery(e.target.value)}
                      className="pl-9 w-full bg-gray-50 hover:bg-gray-100/50 focus:bg-white border border-gray-200 focus:border-indigo-500 rounded-lg py-1.5 px-3 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all placeholder:text-gray-400 font-medium"
                    />
                  </div>
                </div>

                {filteredLogs.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center space-y-1">
                    <ClipboardList className="w-8 h-8 text-gray-300 stroke-1" />
                    <span className="text-xs text-gray-500 font-bold">Tidak ada log pemindahan</span>
                    <span className="text-[11px] text-gray-400">
                      Tidak ditemukan transaksi dalam rentang {startDate} s/d {endDate}.
                    </span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                          <th className="p-3">Tanggal</th>
                          <th className="p-3">Item / Kode</th>
                          <th className="p-3">Rute Mutasi</th>
                          <th className="p-3 text-center">Qty</th>
                          <th className="p-3 text-right">Aksi</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        {filteredLogs.map(log => (
                          <tr key={log.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3 font-mono text-[10px] text-gray-500 whitespace-nowrap">
                              {log.transferDate}
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-gray-800 block max-w-[180px] truncate" title={log.itemName}>
                                {log.itemName}
                              </span>
                              <span className="text-[10px] text-indigo-500 font-mono">{log.assetCode}</span>
                            </td>
                            <td className="p-3">
                              <div className="flex items-center gap-1 text-[11px]">
                                <span className="bg-red-50 text-red-600 px-1.5 py-0.5 rounded-md font-bold font-mono">
                                  {log.fromLocationCode}
                                </span>
                                <ArrowRight className="w-3 h-3 text-gray-400" />
                                <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded-md font-bold font-mono">
                                  {log.toLocationCode}
                                </span>
                              </div>
                              {log.notes && (
                                <span className="text-[10px] text-gray-400 block max-w-[150px] truncate italic mt-1" title={log.notes}>
                                  "{log.notes}"
                                </span>
                              )}
                            </td>
                            <td className="p-3 text-center font-bold text-gray-900 font-mono">
                              {log.qty}
                            </td>
                            <td className="p-3 text-right whitespace-nowrap">
                              <button
                                onClick={() => setSelectedLogForPrint(log)}
                                className="p-1.5 text-indigo-600 hover:text-indigo-800 hover:bg-indigo-50 rounded-lg transition-all cursor-pointer mr-1.5 inline-flex items-center gap-1"
                                title="Cetak Surat Jalan / Bukti Perpindahan Barang"
                                id={`btn-print-surat-jalan-${log.id}`}
                              >
                                <Printer className="w-3.5 h-3.5" />
                                <span className="text-[10px] font-bold">Surat Jalan</span>
                              </button>
                              <button
                                onClick={() => handleDeleteLog(log)}
                                className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all cursor-pointer inline-flex"
                                title="Batalkan transaksi mutasi & kembalikan stok"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB CONTENT: STOK AKHIR PERIODE (RECONSTRUCTION) */}
            {/* ========================================================= */}
            {reportTab === "stock" && (
              <div className="space-y-4">
                
                {/* INFO EXPLANATION ALERT */}
                <div className="p-3 bg-indigo-50 border border-indigo-100/40 text-indigo-800 rounded-xl text-xs flex items-start gap-2.5">
                  <Info className="w-4.5 h-4.5 text-indigo-500 shrink-0 mt-0.5" />
                  <div className="space-y-0.5">
                    <span className="font-bold block text-[11px]">Bagaimana data ini dihitung?</span>
                    <span className="text-[10px] text-indigo-700 font-medium block leading-relaxed">
                      Sistem merekonstruksi posisi stok di akhir tanggal <strong>{endDate}</strong> secara otomatis dengan menelusuri tanggal masuk aset, mengurangi mutasi masuk yang terjadi setelah tanggal {endDate}, dan menambah kembali mutasi keluar yang dikirim setelah tanggal tersebut.
                    </span>
                  </div>
                </div>

                {/* FILTERS FOR RECONSTRUCTED LIST */}
                <div className="flex gap-2.5">
                  <select
                    value={reconstructedBranchFilter}
                    onChange={(e) => setReconstructedBranchFilter(e.target.value)}
                    className="bg-gray-50 border border-gray-200 rounded-lg py-1.5 px-3 text-xs outline-none focus:border-indigo-500 transition-all text-gray-700 font-bold"
                  >
                    <option value="">-- Semua Cabang --</option>
                    {Object.entries(LOCATION_MAP).map(([code, name]) => (
                      <option key={code} value={code}>
                        {name} ({code})
                      </option>
                    ))}
                  </select>
                  
                  <div className="flex-1 bg-slate-50 border border-slate-100 rounded-lg p-2 flex items-center justify-between text-[11px] font-bold text-slate-600">
                    <span>Rekap Total ({endDate}):</span>
                    <div className="flex items-center gap-3 font-mono text-xs">
                      <span>{reconstructedSummary.totalQty} Unit</span>
                      <span className="text-gray-300">|</span>
                      <span className="text-indigo-600">{formatRupiah(reconstructedSummary.totalVal)}</span>
                    </div>
                  </div>
                </div>

                {reconstructedStock.length === 0 ? (
                  <div className="py-12 text-center border-2 border-dashed border-gray-100 rounded-xl flex flex-col items-center justify-center space-y-1">
                    <Package className="w-8 h-8 text-gray-300 stroke-1" />
                    <span className="text-xs text-gray-500 font-bold">Stok akhir kosong</span>
                    <span className="text-[11px] text-gray-400">
                      Tidak ditemukan stok aset pada akhir periode {endDate}.
                    </span>
                  </div>
                ) : (
                  <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[300px] overflow-y-auto custom-scrollbar">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead className="sticky top-0 z-10">
                        <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                          <th className="p-3 bg-slate-50">Cabang</th>
                          <th className="p-3 bg-slate-50">Aset</th>
                          <th className="p-3 bg-slate-50 text-center">Stok Rekon</th>
                          <th className="p-3 bg-slate-50 text-right">Nilai Rekon</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                        {reconstructedStock.map(({ item, reconstructedQty, reconstructedValue }) => (
                          <tr key={`${item.id}-recon`} className="hover:bg-slate-50/50 transition-colors">
                            <td className="p-3">
                              <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded-md font-bold font-mono text-[10px]" title={item.locationName}>
                                {item.locationCode}
                              </span>
                            </td>
                            <td className="p-3">
                              <span className="font-bold text-gray-800 block truncate max-w-[200px]" title={item.name}>
                                {item.name}
                              </span>
                              <span className="text-[10px] text-gray-400 font-mono block">{item.code}</span>
                            </td>
                            <td className="p-3 text-center font-bold text-gray-900 font-mono">
                              {reconstructedQty} <span className="text-[10px] text-gray-400 font-normal">unit</span>
                            </td>
                            <td className="p-3 text-right font-mono font-bold text-indigo-600">
                              {formatRupiah(reconstructedValue)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB CONTENT: IMPORT DATA MASAL (NEW ASSETS & MUTATIONS) */}
            {/* ========================================================= */}
            {reportTab === "import" && (
              <div className="space-y-5" id="bulk-import-content-section">
                
                {/* SELECT IMPORT TYPE */}
                <div className="flex gap-2 p-1 bg-slate-100 rounded-xl" id="import-type-selector">
                  <button
                    type="button"
                    onClick={() => {
                      setImportType("new_assets");
                      setRawImportText("");
                      setParsedPreview([]);
                      setImportError("");
                      setImportSuccess("");
                    }}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      importType === "new_assets"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    id="btn-import-new-assets"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>1. Registrasi Aset Baru Masal</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setImportType("mutations");
                      setRawImportText("");
                      setParsedPreview([]);
                      setImportError("");
                      setImportSuccess("");
                    }}
                    className={`flex-1 py-2 text-center text-xs font-bold rounded-lg transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                      importType === "mutations"
                        ? "bg-indigo-600 text-white shadow-xs"
                        : "text-gray-600 hover:text-gray-900"
                    }`}
                    id="btn-import-mutations"
                  >
                    <ArrowLeftRight className="w-3.5 h-3.5" />
                    <span>2. Mutasi / Transfer Masal</span>
                  </button>
                </div>

                {/* INSTRUCTIONS PANEL */}
                <div className="p-4 bg-slate-50 border border-slate-200/60 rounded-xl space-y-2 text-xs text-slate-700" id="import-instructions">
                  <div className="flex items-center gap-2 text-slate-900 font-bold">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>Petunjuk Format Import ({importType === "new_assets" ? "Aset Baru" : "Mutasi Masal"})</span>
                  </div>
                  
                  {importType === "new_assets" ? (
                    <div className="space-y-1.5 leading-relaxed text-[11px] text-slate-600">
                      <p>
                        Salin data dari Excel / Spreadsheet Anda, lalu tempel pada kolom teks di bawah. Sistem mendukung pemisah Koma (<code className="bg-slate-200 font-mono px-1 rounded">,</code>), Titik Koma (<code className="bg-slate-200 font-mono px-1 rounded">;</code>), atau Tab.
                      </p>
                      <p className="font-bold text-slate-800">Format Urutan Kolom:</p>
                      <code className="block bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[10px] whitespace-pre-wrap leading-tight">
                        KodeAset, NamaAset, Kategori, Qty, HargaSatuan, KodeCabang, Spesifikasi
                      </code>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/50 mt-1">
                        <span className="text-[10px] text-gray-500 font-semibold">* Kode Cabang valid: KP, MT, KC, KCP, SL, dsb.</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => downloadTemplate("new_assets")}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                            id="btn-download-new-assets-template"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Template CSV</span>
                          </button>
                          <span className="text-gray-300 text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              setRawImportText(
                                "Kode, Nama Aset, Kategori, Qty, Harga Satuan, Kode Cabang, Spesifikasi\n" +
                                "AST-901, Laptop ThinkPad L14 Gen 4, Elektronik, 5, 12500000, KP, Intel Core i5 16GB RAM 512GB SSD\n" +
                                "AST-902, Kursi Ergonomis Kantor, Furnitur, 12, 1250000, MT, Jaring Hitam Adjustable\n" +
                                "AST-903, Printer Epson L3210, Elektronik, 3, 2400000, KC, InkTank Multifungsi"
                              );
                              setParsedPreview([]);
                              setImportError("");
                              setImportSuccess("");
                            }}
                            className="text-[10px] text-indigo-600 font-extrabold hover:underline cursor-pointer"
                            id="btn-use-sample-new-assets"
                          >
                            Gunakan Data Contoh
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-1.5 leading-relaxed text-[11px] text-slate-600">
                      <p>
                        Pindahkan barang dalam jumlah banyak sekaligus antar cabang. Sistem akan memvalidasi ketersediaan stok barang di cabang asal secara real-time.
                      </p>
                      <p className="font-bold text-slate-800">Format Urutan Kolom:</p>
                      <code className="block bg-slate-900 text-slate-100 p-2 rounded-lg font-mono text-[10px] whitespace-pre-wrap leading-tight">
                        KodeAset, CabangAsal, CabangTujuan, Qty, CatatanMutasi
                      </code>
                      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pt-2 border-t border-slate-200/50 mt-1">
                        <span className="text-[10px] text-gray-500 font-semibold">* Pastikan Kode Aset telah terdaftar di Cabang Asal dengan stok memadai.</span>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => downloadTemplate("mutations")}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 font-extrabold flex items-center gap-1 cursor-pointer transition-colors"
                            id="btn-download-mutations-template"
                          >
                            <Download className="w-3.5 h-3.5" />
                            <span>Download Template CSV</span>
                          </button>
                          <span className="text-gray-300 text-[10px]">|</span>
                          <button
                            type="button"
                            onClick={() => {
                              const itemsWithQty = items.filter(i => i.qty > 0).slice(0, 2);
                              const row1 = itemsWithQty[0] ? `${itemsWithQty[0].code}, ${itemsWithQty[0].locationCode}, MT, 1, Mutasi masal contoh komputer` : "AST-101, KP, MT, 1, Mutasi rutin divisi audit";
                              const row2 = itemsWithQty[1] ? `${itemsWithQty[1].code}, ${itemsWithQty[1].locationCode}, KC, 1, Mutasi masal inventaris meja` : "AST-102, KP, KC, 1, Mutasi server internal";
                              
                              setRawImportText(
                                "Kode Aset, Cabang Asal, Cabang Tujuan, Qty, Catatan\n" +
                                row1 + "\n" +
                                row2
                              );
                              setParsedPreview([]);
                              setImportError("");
                              setImportSuccess("");
                            }}
                            className="text-[10px] text-indigo-600 font-extrabold hover:underline cursor-pointer"
                            id="btn-use-sample-mutations"
                          >
                            Gunakan Data Contoh
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* FILE DROP / PASTE INPUT AREA */}
                <div className="space-y-2" id="import-input-wrapper">
                  <label className="text-[11px] font-bold text-slate-700 block">
                    Tempel Data CSV / Excel atau Tarik & Lepas File (.csv / .txt)
                  </label>
                  
                  {/* TEXTAREA INPUT */}
                  <div className="relative">
                    <textarea
                      rows={6}
                      value={rawImportText}
                      onChange={(e) => setRawImportText(e.target.value)}
                      placeholder="Tempel baris data di sini..."
                      className="w-full bg-slate-50 hover:bg-slate-100/30 focus:bg-white border border-slate-200 focus:border-indigo-500 rounded-xl p-3.5 text-xs outline-none focus:ring-2 focus:ring-indigo-500/10 transition-all font-mono leading-relaxed"
                      id="raw-import-text-area"
                    />

                    {/* DRAG AND DROP CAPABILITIES IN TEXTAREA */}
                    <div 
                      className="absolute bottom-2.5 right-2.5 flex items-center gap-1 text-[10px] text-slate-400 bg-white/90 border border-slate-200 py-1 px-2 rounded-lg font-bold pointer-events-none shadow-xs"
                    >
                      <Upload className="w-3 h-3 text-indigo-500" />
                      <span>Atau Pilih File .CSV</span>
                    </div>
                  </div>

                  <input
                    type="file"
                    accept=".csv,.txt"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const reader = new FileReader();
                      reader.onload = (event) => {
                        const text = event.target?.result;
                        if (typeof text === "string") {
                          setRawImportText(text);
                        }
                      };
                      reader.readAsText(file);
                    }}
                    className="text-xs text-slate-500 file:mr-3 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[10px] file:font-extrabold file:bg-slate-100 file:text-slate-700 hover:file:bg-slate-200 cursor-pointer"
                    id="file-import-uploader"
                  />
                </div>

                {/* ACTIONS */}
                <div className="flex gap-2.5" id="import-actions-row">
                  <button
                    type="button"
                    onClick={() => {
                      setRawImportText("");
                      setParsedPreview([]);
                      setImportError("");
                      setImportSuccess("");
                    }}
                    className="py-2 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 font-bold rounded-lg text-xs transition-colors cursor-pointer"
                    id="btn-import-reset"
                  >
                    Reset
                  </button>

                  <button
                    type="button"
                    onClick={handleParseImport}
                    className="flex-1 py-2 px-4 bg-slate-800 hover:bg-slate-950 text-white font-bold rounded-lg text-xs flex items-center justify-center gap-2 cursor-pointer transition-colors"
                    id="btn-import-analyze"
                  >
                    <Search className="w-4 h-4 text-indigo-400" />
                    <span>Mulai Analisis Data</span>
                  </button>
                </div>

                {/* ERROR MESSAGE */}
                {importError && (
                  <div className="p-3.5 bg-rose-50 border border-rose-100 text-rose-700 rounded-xl text-xs flex items-start gap-2.5" id="import-error-banner">
                    <AlertCircle className="w-4.5 h-4.5 text-rose-500 shrink-0 mt-0.5" />
                    <span className="font-semibold">{importError}</span>
                  </div>
                )}

                {/* SUCCESS MESSAGE */}
                {importSuccess && (
                  <div className="p-3.5 bg-emerald-50 border border-emerald-100 text-emerald-700 rounded-xl text-xs flex items-start gap-2.5" id="import-success-banner">
                    <CheckCircle2 className="w-4.5 h-4.5 text-emerald-500 shrink-0 mt-0.5" />
                    <span className="font-bold">{importSuccess}</span>
                  </div>
                )}

                {/* PREVIEW TABLE AND EXECUTE PANEL */}
                {parsedPreview.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 5 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="space-y-3.5 border-t border-slate-100 pt-5"
                    id="import-preview-wrapper"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-bold text-gray-900 text-xs">Preview Hasil Analisis ({parsedPreview.length} Baris)</h4>
                        <p className="text-[10px] text-gray-500 font-semibold">Tinjau kesesuaian data sebelum menyimpannya permanen</p>
                      </div>

                      <span className="text-[10px] text-emerald-600 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                        Semua Data Valid
                      </span>
                    </div>

                    {/* TABLE PREVIEW FOR NEW ASSETS */}
                    {importType === "new_assets" ? (
                      <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[220px] overflow-y-auto" id="preview-table-new-assets">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                              <th className="p-2.5">Kode</th>
                              <th className="p-2.5">Nama Aset</th>
                              <th className="p-2.5">Kategori</th>
                              <th className="p-2.5 text-center">Qty</th>
                              <th className="p-2.5 text-right">Harga Satuan</th>
                              <th className="p-2.5 text-center">Cabang</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-semibold text-gray-600">
                            {parsedPreview.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50/40 text-[11px]" id={`row-preview-asset-${i}`}>
                                <td className="p-2.5 font-mono text-indigo-600 font-bold">{p.code}</td>
                                <td className="p-2.5 text-gray-800 font-bold max-w-[150px] truncate" title={p.name}>{p.name}</td>
                                <td className="p-2.5 text-slate-500">{p.category}</td>
                                <td className="p-2.5 text-center font-bold text-slate-800">{p.qty}</td>
                                <td className="p-2.5 text-right font-mono">{formatRupiah(p.priceUnit)}</td>
                                <td className="p-2.5 text-center">
                                  <span className="bg-slate-100 text-slate-700 px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold">
                                    {p.branchCode}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* TABLE PREVIEW FOR MUTATIONS */
                      <div className="overflow-x-auto border border-gray-100 rounded-xl max-h-[220px] overflow-y-auto" id="preview-table-mutations">
                        <table className="w-full text-left border-collapse text-xs">
                          <thead>
                            <tr className="bg-slate-50 text-[10px] font-bold uppercase tracking-wider text-gray-500 border-b border-gray-100">
                              <th className="p-2.5">Kode</th>
                              <th className="p-2.5">Nama Aset</th>
                              <th className="p-2.5">Asal</th>
                              <th className="p-2.5">Tujuan</th>
                              <th className="p-2.5 text-center">Qty</th>
                              <th className="p-2.5">Catatan</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-gray-100 font-semibold text-gray-600">
                            {parsedPreview.map((p, i) => (
                              <tr key={i} className="hover:bg-slate-50/40 text-[11px]" id={`row-preview-mutation-${i}`}>
                                <td className="p-2.5 font-mono text-indigo-600 font-bold">{p.assetCode}</td>
                                <td className="p-2.5 text-gray-800 font-bold max-w-[150px] truncate" title={p.itemName}>{p.itemName}</td>
                                <td className="p-2.5">
                                  <span className="bg-rose-50 text-rose-600 px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold">
                                    {p.fromCode}
                                  </span>
                                </td>
                                <td className="p-2.5">
                                  <span className="bg-emerald-50 text-emerald-600 px-1.5 py-0.5 rounded font-mono text-[10px] font-extrabold">
                                    {p.toCode}
                                  </span>
                                </td>
                                <td className="p-2.5 text-center font-bold text-slate-800">{p.qty}</td>
                                <td className="p-2.5 text-gray-400 italic max-w-[120px] truncate" title={p.notes}>"{p.notes}"</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* CONFIRM EXECUTE BUTTON */}
                    <button
                      type="button"
                      onClick={handleExecuteImport}
                      className="w-full py-2.5 px-4 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-xl text-xs flex items-center justify-center gap-2 cursor-pointer shadow-sm transition-colors"
                      id="btn-import-execute-final"
                    >
                      <CheckCircle2 className="w-4.5 h-4.5" />
                      <span>Simpan & Eksekusi {parsedPreview.length} Data Masal ke Sistem</span>
                    </button>
                  </motion.div>
                )}
              </div>
            )}

          </div>
        </div>

      </div>

      {/* SURAT JALAN PRINT PREVIEW MODAL */}
      <AnimatePresence>
        {selectedLogForPrint && (() => {
          const matchingAsset = items.find(i => i.code === selectedLogForPrint.assetCode);
          const assetSpec = matchingAsset?.spec || "-";
          const assetCategory = matchingAsset?.category || "-";
          const docNumber = `SJBST/2026/06/${selectedLogForPrint.id.replace('TRF-', '').substring(0, 8).toUpperCase()}`;

          const renderSuratJalanCopy = (copyTypeLabel: string) => {
            const notesToDisplay = selectedLogForPrint.notes && 
                                   selectedLogForPrint.notes.toLowerCase() !== "pemindahan rutin antar cabang" && 
                                   selectedLogForPrint.notes !== "Mutasi masal via import"
                                   ? selectedLogForPrint.notes 
                                   : "";

            return (
              <div className="space-y-4 p-4 bg-white rounded-lg border border-gray-200 text-left relative" style={{ pageBreakInside: "avoid" }}>
                {/* WATERMARK / COPY LABEL */}
                <div className="absolute top-2 right-2 text-[8px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded font-extrabold uppercase tracking-wider">
                  {copyTypeLabel}
                </div>

                {/* LETTERHEAD / KOP SURAT */}
                <div className="flex items-center justify-between border-b-2 border-gray-950 pb-3">
                  <div className="space-y-0.5">
                    <h2 className="text-xs font-black tracking-wider text-gray-950 uppercase">PT GADAI SEJAHTERA INDONESIA</h2>
                    <p className="text-[8px] text-gray-500 font-semibold leading-tight max-w-md">
                      Jl. Karasak 300A Kecamatan Astanaanyar, Kota Bandung, Jawa Barat (Kode Pos 40243).
                    </p>
                  </div>
                  <div className="text-right text-[8px] text-gray-400 font-mono">
                    <span>ORIGINAL DOCUMENT</span><br />
                    <span>Sistem Manajemen Mutasi v1.4</span>
                  </div>
                </div>

                {/* TITLE OF DOCUMENT */}
                <div className="text-center space-y-0.5 py-1">
                  <h3 className="text-[11px] font-extrabold tracking-widest text-gray-950 uppercase decoration-1 underline underline-offset-4">
                    SURAT JALAN
                  </h3>
                  <p className="text-[9px] text-gray-600 font-mono font-bold">Nomor Dokumen: {docNumber}</p>
                </div>

                {/* SENDER AND RECIPIENT INFORMATION */}
                <div className="grid grid-cols-2 gap-4 bg-gray-50/50 p-3 rounded-lg border border-gray-150 text-[10px] leading-relaxed">
                  <div className="space-y-1.5 border-r border-gray-200 pr-2">
                    <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">PIHAK I (PENGIRIM)</p>
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="font-semibold text-gray-500 w-24">Nama Cabang</td>
                          <td className="font-bold text-gray-900">: {selectedLogForPrint.fromLocationName}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold text-gray-500">Tanggal Kirim</td>
                          <td className="font-semibold text-gray-800">: {selectedLogForPrint.transferDate}</td>
                        </tr>
                        <tr>
                          <td className="font-semibold text-gray-500">Petugas Logistik</td>
                          <td className="font-semibold text-gray-800">: {selectedLogForPrint.operator || "Wilman Firmansyah"}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>

                  <div className="space-y-1.5 pl-2">
                    <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">PIHAK II (PENERIMA)</p>
                    <table className="w-full">
                      <tbody>
                        <tr>
                          <td className="font-semibold text-gray-500 w-24">Nama Cabang</td>
                          <td className="font-bold text-gray-900">: {selectedLogForPrint.toLocationName}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* BARANG YANG DIPINDAHKAN */}
                <div className="space-y-1">
                  <p className="text-[8px] font-extrabold text-gray-400 uppercase tracking-wider">DETAIL BARANG INVENTARIS YANG DIKIRIMKAN</p>
                  <div className="border border-gray-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left border-collapse text-[10px]">
                      <thead>
                        <tr className="bg-gray-100/80 text-gray-600 font-bold border-b border-gray-200">
                          <th className="p-1.5 w-8 text-center">No</th>
                          <th className="p-1.5 w-24">Kode Aset</th>
                          <th className="p-1.5">Deskripsi Nama Barang / Aset</th>
                          <th className="p-1.5">Kategori</th>
                          <th className="p-1.5 text-center w-20">Jumlah (Qty)</th>
                          <th className="p-1.5">Kondisi Fisik</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200 font-medium text-gray-700">
                        <tr>
                          <td className="p-2 text-center">1</td>
                          <td className="p-2 font-mono text-indigo-600 font-bold">{selectedLogForPrint.assetCode}</td>
                          <td className="p-2">
                            <span className="font-bold text-gray-900 block">{selectedLogForPrint.itemName}</span>
                            <span className="text-[9px] text-gray-400 block font-mono">Spek: {assetSpec}</span>
                          </td>
                          <td className="p-2 text-gray-500">{assetCategory}</td>
                          <td className="p-2 text-center font-bold text-gray-900">{selectedLogForPrint.qty} Unit</td>
                          <td className="p-2 text-emerald-600 font-bold">Baik / Bagus</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* KETERANGAN CATATAN JALAN */}
                <div className="p-2 bg-slate-50 border border-slate-200/60 rounded-lg text-[9px] text-slate-600 min-h-[36px] flex flex-col justify-center">
                  <span className="font-bold text-gray-800">Catatan / Alasan Perpindahan:</span>
                  <p className="italic">{notesToDisplay ? `"${notesToDisplay}"` : "-"}</p>
                </div>

                {/* SIGNATURE BLOCK */}
                <div className="pt-4 grid grid-cols-3 gap-4 text-center text-[9px] leading-tight">
                  <div className="space-y-10">
                    <p className="font-bold text-gray-600">Dikirim Oleh (Pihak I)</p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-900 underline decoration-1">{selectedLogForPrint.operator || "Wilman Firmansyah"}</p>
                      <p className="text-gray-400 text-[8px]">Staf Logistik</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <p className="font-bold text-gray-600">Kurir / Pembawa</p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-900 font-mono">............................................</p>
                      <p className="text-gray-400 text-[8px]">Petugas Driver / Ekspedisi</p>
                    </div>
                  </div>

                  <div className="space-y-10">
                    <p className="font-bold text-gray-600">Diterima Oleh (Pihak II)</p>
                    <div className="space-y-0.5">
                      <p className="font-bold text-gray-900 font-mono">............................................</p>
                      <p className="text-gray-400 text-[8px]">Penerima Cabang</p>
                    </div>
                  </div>
                </div>

                {/* FOOTER */}
                <div className="border-t border-gray-100 pt-1.5 flex justify-between text-[7px] text-gray-400 font-semibold uppercase tracking-wider">
                  <span>PT GADAI SEJAHTERA INDONESIA</span>
                  <span>Waktu Cetak: {new Date().toISOString().split('T')[0]} {new Date().toLocaleTimeString('id-ID', {hour: '2-digit', minute:'2-digit'})} WIB</span>
                </div>
              </div>
            );
          };

          return (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-gray-900/60 backdrop-blur-xs overflow-y-auto"
              id="surat-jalan-modal-backdrop"
              onClick={() => setSelectedLogForPrint(null)}
            >
              <style dangerouslySetInnerHTML={{__html: `
                @media print {
                  body {
                    background-color: white !important;
                    color: black !important;
                  }
                  #root > *:not(#asset-transfer-report-container) {
                    display: none !important;
                  }
                  #asset-transfer-report-container > *:not(#surat-jalan-modal-backdrop) {
                    display: none !important;
                  }
                  #surat-jalan-modal-backdrop {
                    position: absolute !important;
                    left: 0 !important;
                    top: 0 !important;
                    background: white !important;
                    padding: 0 !important;
                    margin: 0 !important;
                    width: 100% !important;
                    height: auto !important;
                    overflow: visible !important;
                    backdrop-filter: none !important;
                  }
                  #surat-jalan-modal-card {
                    border: none !important;
                    box-shadow: none !important;
                    max-width: 100% !important;
                    width: 100% !important;
                    margin: 0 !important;
                    padding: 0 !important;
                  }
                  #surat-jalan-header-actions {
                    display: none !important;
                  }
                }
              `}} />

              <motion.div
                initial={{ scale: 0.95, y: 15 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 15 }}
                className="bg-white rounded-2xl shadow-xl border border-gray-100 max-w-4xl w-full p-6 space-y-6 relative max-h-[90vh] overflow-y-auto cursor-default text-gray-800"
                id="surat-jalan-modal-card"
                onClick={(e) => e.stopPropagation()}
              >
                {/* ACTIONS HEADER */}
                <div className="flex items-center justify-between border-b border-gray-100 pb-4" id="surat-jalan-header-actions">
                  <div className="flex items-center gap-2">
                    <FileText className="w-5 h-5 text-indigo-600" />
                    <div>
                      <h3 className="font-bold text-gray-900 text-sm">Cetak Surat Jalan</h3>
                      <p className="text-[10px] text-gray-500 font-medium">Dokumen Bukti Pengiriman Barang PT Gadai Sejahtera Indonesia</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg flex items-center gap-1.5 cursor-pointer shadow-xs transition-colors"
                      id="btn-trigger-print-now"
                    >
                      <Printer className="w-3.5 h-3.5" />
                      <span>Cetak Surat</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => setSelectedLogForPrint(null)}
                      className="py-1.5 px-3 bg-gray-100 hover:bg-gray-200 text-gray-700 text-xs font-bold rounded-lg cursor-pointer transition-colors"
                      id="btn-close-print-modal"
                    >
                      Tutup
                    </button>
                  </div>
                </div>

                {/* THE DOCUMENT TO PRINT */}
                <div className="space-y-6 p-1 border border-dashed border-gray-200 rounded-xl text-left" id="printable-surat-jalan">
                  {renderSuratJalanCopy("LEMBAR 1: UNTUK CABANG PENGIRIM")}
                  
                  <div className="my-6 border-t-2 border-dashed border-gray-300 relative flex items-center justify-center print:my-4">
                    <span className="absolute bg-white px-3 py-1 border border-gray-200 rounded-full text-[9px] font-bold text-gray-500 uppercase flex items-center gap-1">
                      ✂️ Gunting & Potong di Sini (Arsip)
                    </span>
                  </div>

                  {renderSuratJalanCopy("LEMBAR 2: UNTUK CABANG PENERIMA")}
                </div>
              </motion.div>
            </motion.div>
          );
        })()}
      </AnimatePresence>

    </div>
  );
}
