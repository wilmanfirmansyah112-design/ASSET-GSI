import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Building2, Calendar, ClipboardList, Database, LayoutDashboard, 
  MapPin, RefreshCw, Sparkles, User, ListFilter, HelpCircle, 
  Layers, ChevronRight, AlertCircle, CheckCircle2, ArrowLeftRight,
  Trash2, ShieldAlert
} from "lucide-react";

import { InventoryItem, UserAccount } from "./types";
import { 
  loadInventoryItems, 
  saveInventoryItems, 
  calculateStats,
  loadDisposalRequests,
  saveDisposalRequests
} from "./dataService";

import StatsOverview from "./components/StatsOverview";
import BranchBreakdown from "./components/BranchBreakdown";
import CategoryBreakdown from "./components/CategoryBreakdown";
import InventoryTable from "./components/InventoryTable";
import ItemDetailsModal from "./components/ItemDetailsModal";
import AddEditAssetModal from "./components/AddEditAssetModal";
import GoogleDriveBackup from "./components/GoogleDriveBackup";
import AssetTransferReport from "./components/AssetTransferReport";
import DisposalManagement from "./components/DisposalManagement";
import QuickAudit from "./components/QuickAudit";

export default function App() {
  // Main data state
  const [items, setItems] = useState<InventoryItem[]>(() => loadInventoryItems());
  
  // Filtering states
  const [selectedBranch, setSelectedBranch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");

  // Modal UI States
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);
  const [isAddEditOpen, setIsAddEditOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<InventoryItem | null>(null);

  // Success Notification Toast state
  const [toastMessage, setToastMessage] = useState("");

  // User Accounts & Authentication Role
  const [currentUser, setCurrentUser] = useState<UserAccount>({
    name: "Wilman Firmansyah",
    email: "wilmanfirmansyah112@gmail.com",
    role: "STAF_CABANG", // Start as Branch Staff, can be toggled to SUPER_ADMIN to approve requests!
    branchCode: "KP",
    restrictToBranch: false
  });

  // Navigation state for different views
  const [activeTab, setActiveTab] = useState<"katalog" | "mutasi" | "keluar">("katalog");

  // Disposal & Loss requests state
  const [disposalRequests, setDisposalRequests] = useState(() => loadDisposalRequests());
  const [preselectedDisposalItem, setPreselectedDisposalItem] = useState<InventoryItem | null>(null);

  // Compute stats dynamically from the current items list
  const stats = useMemo(() => calculateStats(items), [items]);

  // Handle saving (add or update) an item
  const handleSaveItem = (savedItem: InventoryItem) => {
    let updatedItems: InventoryItem[] = [];
    const exists = items.some(i => i.id === savedItem.id);

    if (exists) {
      // Update
      updatedItems = items.map(item => item.id === savedItem.id ? savedItem : item);
      showToast(`Aset "${savedItem.name}" berhasil diubah!`);
    } else {
      // Insert new at the beginning of the list
      updatedItems = [savedItem, ...items];
      showToast(`Aset baru "${savedItem.name}" berhasil ditambahkan!`);
    }

    setItems(updatedItems);
    saveInventoryItems(updatedItems);
  };

  // Handle deleting an item
  const handleDeleteItem = (id: string) => {
    const itemToDelete = items.find(i => i.id === id);
    const updatedItems = items.filter(item => item.id !== id);
    
    setItems(updatedItems);
    saveInventoryItems(updatedItems);
    
    if (itemToDelete) {
      showToast(`Aset "${itemToDelete.name}" berhasil dihapus dari inventaris.`);
    }
  };

  // Helper to trigger and auto-hide toast notifications
  const showToast = (message: string) => {
    setToastMessage(message);
    setTimeout(() => {
      setToastMessage("");
    }, 4000);
  };

  // Sync to spreadsheet / Reset local data to CSV
  const handleResetToDefault = () => {
    if (confirm("Apakah Anda yakin ingin memuat ulang database default dari Google Sheets? Semua perubahan lokal akan terhapus.")) {
      localStorage.removeItem("gsi_inventory_data");
      const freshItems = loadInventoryItems();
      setItems(freshItems);
      // Reset filter
      setSelectedBranch("");
      setSelectedCategory("");
      setSelectedStatus("");
      showToast("Database inventaris berhasil dimuat ulang ke kondisi awal.");
    }
  };

  return (
    <div className="min-h-screen bg-[#f8fafc] flex flex-col font-sans relative pb-12" id="app-workspace">
      {/* Top Banner Header */}
      <header className="bg-slate-900 text-white shadow-md border-b border-slate-800" id="app-header">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            {/* Logo and Brand Title */}
            <div className="flex items-center gap-3.5">
              <div className="p-3 bg-indigo-600 rounded-2xl shadow-inner text-white ring-4 ring-indigo-500/10 flex items-center justify-center">
                <Building2 className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-[9px] bg-indigo-500/20 text-indigo-300 px-2 py-0.5 rounded-full font-extrabold uppercase tracking-widest border border-indigo-500/30">
                    Sistem Inventaris GSI
                  </span>
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  <span className="text-[9px] text-emerald-400 font-bold uppercase tracking-wider">
                    Online
                  </span>
                </div>
                <h1 className="text-xl md:text-2xl font-extrabold tracking-tight text-white mt-1">
                  PT Gadai Sejahtera Indonesia
                </h1>
                <p className="text-xs text-slate-400 font-medium">
                  Konsolidasi Buku Aset & Inventaris Seluruh Cabang (15 Outlet)
                </p>
              </div>
            </div>

            {/* Utility Indicators / User Card */}
            <div className="flex items-center gap-4 self-end md:self-center">
              <div className="text-right hidden sm:block">
                <span className="text-xs text-slate-400 block font-semibold">User: Wilman Firmansyah</span>
                <span className="text-[10px] text-slate-500 block">wilmanfirmansyah112@gmail.com</span>
              </div>
              <div className="flex items-center gap-1.5 bg-slate-800 border border-slate-750 rounded-xl px-3 py-1.5 text-xs text-white ring-2 ring-slate-800/50">
                <span className="text-[9px] text-slate-400 font-extrabold uppercase mr-1">Akses:</span>
                <select
                  value={currentUser.role}
                  onChange={(e) => {
                    const newRole = e.target.value as 'SUPER_ADMIN' | 'STAF_CABANG';
                    setCurrentUser(prev => ({ ...prev, role: newRole }));
                    showToast(`Berhasil masuk sebagai: ${newRole === 'SUPER_ADMIN' ? 'Super Admin' : 'Staf Cabang'}`);
                  }}
                  className="bg-transparent border-none text-indigo-400 font-black focus:outline-none cursor-pointer text-xs"
                  id="role-switcher-select"
                >
                  <option value="STAF_CABANG" className="bg-slate-900 text-slate-300">Staff Cabang</option>
                  <option value="SUPER_ADMIN" className="bg-slate-900 text-amber-400 font-bold">Super Admin</option>
                </select>
              </div>
              <div className="p-2.5 bg-slate-800 rounded-xl border border-slate-700 text-slate-300 flex items-center justify-center">
                <User className="w-5 h-5 text-indigo-400" />
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Sub Header Ribbon */}
      <div className="bg-white border-b border-gray-200/80 py-3 shadow-xs" id="sub-header-ribbon">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5 font-medium">
              <Database className="w-4 h-4 text-indigo-500 shrink-0" />
              Database: <span className="font-bold text-gray-700">Seeded from GSheets</span>
            </span>
            <span className="h-4 w-[1px] bg-gray-200 hidden sm:block" />
            <span className="flex items-center gap-1.5 font-medium">
              <ClipboardList className="w-4 h-4 text-emerald-500 shrink-0" />
              Total Item: <span className="font-bold text-gray-700">{items.length.toLocaleString("id-ID")}</span>
            </span>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleResetToDefault}
              className="px-3 py-1.5 bg-gray-50 hover:bg-gray-100 text-gray-600 rounded-lg font-bold border border-gray-200 transition-all flex items-center gap-1.5 cursor-pointer text-[11px]"
              title="Reset data ke bawaan asli dari Google Sheets"
              id="reset-db-button"
            >
              <RefreshCw className="w-3.5 h-3.5 text-gray-500" />
              Muat Ulang GSheets
            </button>
            <span className="flex items-center gap-1 bg-slate-50 border border-slate-100 px-2.5 py-1.5 rounded-lg text-[10px] font-semibold text-slate-500">
              <Calendar className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              Aktif: 25 Juni 2026
            </span>
          </div>
        </div>
      </div>

      {/* Toast Notification Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 max-w-sm" id="toast-notification-banner">
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="p-4 bg-slate-900 border border-slate-800 text-white rounded-2xl shadow-2xl flex items-start gap-3.5"
          >
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-xl">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div className="space-y-0.5 flex-1 pr-1">
              <h5 className="font-bold text-xs text-white">Sistem Notifikasi</h5>
              <p className="text-[11px] text-slate-300 font-medium leading-relaxed">{toastMessage}</p>
            </div>
          </motion.div>
        </div>
      )}

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex-1" id="main-content-layout">
        <div className="space-y-8">
          
          {/* Section 1: Dynamic Statistics Panels */}
          <StatsOverview 
            stats={stats} 
            selectedStatus={selectedStatus}
            onSelectStatus={setSelectedStatus}
          />

          {/* Section 1.5: Navigation Tabs */}
          {(() => {
            const pendingCount = disposalRequests.filter(r => r.status === 'PENDING').length;
            return (
              <div className="flex border-b border-gray-200" id="main-navigation-tabs">
                <button
                  onClick={() => setActiveTab("katalog")}
                  className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "katalog" 
                      ? "border-indigo-600 text-indigo-600" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  <LayoutDashboard className="w-4 h-4" />
                  <span>Katalog & Monitoring Aset</span>
                </button>
                
                <button
                  onClick={() => setActiveTab("mutasi")}
                  className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 ${
                    activeTab === "mutasi" 
                      ? "border-indigo-600 text-indigo-600" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  <ArrowLeftRight className="w-4 h-4" />
                  <span>Mutasi & Rekap Periode</span>
                </button>

                <button
                  onClick={() => setActiveTab("keluar")}
                  className={`pb-3 px-6 text-sm font-bold border-b-2 transition-all cursor-pointer flex items-center gap-2 relative ${
                    activeTab === "keluar" 
                      ? "border-indigo-600 text-indigo-600" 
                      : "border-transparent text-gray-500 hover:text-gray-800 hover:border-gray-300"
                  }`}
                >
                  <Trash2 className="w-4 h-4" />
                  <span>Barang Keluar & Approval</span>
                  {pendingCount > 0 && (
                    <span className="ml-1 px-2 py-0.5 text-[9px] bg-amber-500 text-white rounded-full font-black animate-pulse">
                      {pendingCount}
                    </span>
                  )}
                </button>
              </div>
            );
          })()}

          {/* Section 2: Conditional Render Based on Tab Selection */}
          {activeTab === "katalog" ? (
            <div className="space-y-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
                {/* Sidebar Columns (Left: 4 cols) */}
                <div className="lg:col-span-4 space-y-6 flex flex-col">
                  {/* Branch Selection List */}
                  <BranchBreakdown 
                    branches={stats.locations}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    totalCompanyValue={stats.totalValue}
                  />

                  {/* Category Breakdown Widget */}
                  <CategoryBreakdown 
                    categories={stats.categories}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    totalCompanyValue={stats.totalValue}
                  />

                  {/* Google Drive Backup Widget */}
                  <GoogleDriveBackup
                    currentItems={items}
                    onRestoreSuccess={(restoredItems, fileName) => {
                      setItems(restoredItems);
                      saveInventoryItems(restoredItems);
                      showToast(`Database berhasil dipulihkan dari cadangan Drive: "${fileName}"`);
                    }}
                    onBackupSuccess={(msg) => showToast(msg)}
                  />
                </div>

                {/* Main Content Column (Right: 8 cols) */}
                <div className="lg:col-span-8 space-y-6">
                  {/* Main inventory data catalog table */}
                  <InventoryTable 
                    items={items}
                    onSelectItem={setSelectedItem}
                    onAddNewClick={() => {
                      setEditingItem(null);
                      setIsAddEditOpen(true);
                    }}
                    onDelete={handleDeleteItem}
                    selectedBranch={selectedBranch}
                    onSelectBranch={setSelectedBranch}
                    selectedCategory={selectedCategory}
                    onSelectCategory={setSelectedCategory}
                    selectedStatus={selectedStatus}
                    onSelectStatus={setSelectedStatus}
                  />
                </div>
              </div>

              {/* Quick Physical Audit & Verification Section */}
              <QuickAudit 
                items={items}
                onUpdateItems={(newItems) => {
                  setItems(newItems);
                  saveInventoryItems(newItems);
                }}
                onShowToast={showToast}
                currentUser={currentUser}
              />
            </div>
          ) : activeTab === "mutasi" ? (
            <AssetTransferReport 
              items={items}
              onUpdateItems={(newItems) => {
                setItems(newItems);
                saveInventoryItems(newItems);
              }}
              onShowToast={showToast}
            />
          ) : (
            <DisposalManagement
              items={items}
              onUpdateItems={(newItems) => {
                setItems(newItems);
                saveInventoryItems(newItems);
              }}
              onShowToast={showToast}
              currentUser={currentUser}
              requests={disposalRequests}
              onSetRequests={(newReqs) => {
                setDisposalRequests(newReqs);
                saveDisposalRequests(newReqs);
              }}
              preselectedItem={preselectedDisposalItem}
              onClearPreselected={() => setPreselectedDisposalItem(null)}
            />
          )}
        </div>
      </main>

      {/* Slide-over Item Specifications Drawer */}
      <ItemDetailsModal 
        item={selectedItem}
        onClose={() => setSelectedItem(null)}
        onEdit={(item) => {
          setEditingItem(item);
          setIsAddEditOpen(true);
          setSelectedItem(null); // close details modal when editing
        }}
        onDelete={handleDeleteItem}
        onDisposalClick={(item) => {
          setPreselectedDisposalItem(item);
          setActiveTab("keluar");
        }}
      />

      {/* Insert / Edit Form Modal Dialog */}
      <AddEditAssetModal 
        isOpen={isAddEditOpen}
        onClose={() => {
          setIsAddEditOpen(false);
          setEditingItem(null);
        }}
        onSave={handleSaveItem}
        editingItem={editingItem}
        items={items}
      />
    </div>
  );
}
