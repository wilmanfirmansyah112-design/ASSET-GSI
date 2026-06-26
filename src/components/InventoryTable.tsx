import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { 
  Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, 
  ChevronsLeft, ChevronsRight, FileSpreadsheet, Eye, 
  Trash2, X, PlusCircle, AlertCircle
} from "lucide-react";
import { InventoryItem } from "../types";
import { formatRupiah } from "../dataService";

interface InventoryTableProps {
  items: InventoryItem[];
  onSelectItem: (item: InventoryItem) => void;
  onAddNewClick: () => void;
  onDelete: (id: string) => void;
  selectedBranch: string;
  onSelectBranch: (branchCode: string) => void;
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

type SortField = 'code' | 'name' | 'category' | 'qty' | 'priceUnit' | 'priceTotal' | 'locationCode' | 'status';
type SortOrder = 'asc' | 'desc';

export default function InventoryTable({
  items,
  onSelectItem,
  onAddNewClick,
  onDelete,
  selectedBranch,
  onSelectBranch,
  selectedCategory,
  onSelectCategory,
  selectedStatus,
  onSelectStatus
}: InventoryTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("code");
  const [sortOrder, setSortOrder] = useState<SortOrder>("asc");
  
  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);

  // Apply sorting and filtering
  const filteredAndSortedItems = useMemo(() => {
    let result = [...items];

    // 1. Filter by branch
    if (selectedBranch) {
      result = result.filter(item => item.locationCode === selectedBranch);
    }

    // 2. Filter by category
    if (selectedCategory) {
      result = result.filter(item => item.category === selectedCategory);
    }

    // 3. Filter by status
    if (selectedStatus) {
      result = result.filter(item => item.status === selectedStatus);
    }

    // 4. Filter by text search (code, name, spec)
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(item => 
        item.code.toLowerCase().includes(q) ||
        item.name.toLowerCase().includes(q) ||
        item.spec.toLowerCase().includes(q)
      );
    }

    // 5. Apply sorting
    result.sort((a, b) => {
      let valA = a[sortField];
      let valB = b[sortField];

      if (typeof valA === 'string' && typeof valB === 'string') {
        return sortOrder === 'asc' 
          ? valA.localeCompare(valB) 
          : valB.localeCompare(valA);
      } else {
        const numA = Number(valA) || 0;
        const numB = Number(valB) || 0;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      }
    });

    return result;
  }, [items, searchQuery, selectedBranch, selectedCategory, selectedStatus, sortField, sortOrder]);

  // Adjust current page if filter reduces item count below current page boundaries
  const totalPages = Math.max(1, Math.ceil(filteredAndSortedItems.length / itemsPerPage));
  const activePage = currentPage > totalPages ? totalPages : currentPage;

  // Slice items for current page
  const paginatedItems = useMemo(() => {
    const start = (activePage - 1) * itemsPerPage;
    return filteredAndSortedItems.slice(start, start + itemsPerPage);
  }, [filteredAndSortedItems, activePage, itemsPerPage]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  // Status Badge Helper
  const getStatusStyle = (status: string) => {
    switch (status) {
      case "Baik":
        return "bg-emerald-50 text-emerald-700 border-emerald-100";
      case "Rusak Ringan":
        return "bg-amber-50 text-amber-700 border-amber-100";
      case "Rusak Berat":
        return "bg-rose-50 text-rose-700 border-rose-100";
      default:
        return "bg-gray-50 text-gray-700 border-gray-100";
    }
  };

  // CSV Exporter
  const handleExportCSV = () => {
    // Generate CSV string
    const headers = ["No", "Kode Aset", "Kategori", "Nama Barang", "Spesifikasi", "Jumlah", "Harga Unit (Rp)", "Total Harga (Rp)", "Tanggal Perolehan", "Kode Lokasi", "Nama Lokasi", "Kondisi Raw", "Status Terstandar"];
    const rows = filteredAndSortedItems.map((item, idx) => [
      idx + 1,
      item.code,
      item.category,
      item.name,
      `"${item.spec.replace(/"/g, '""')}"`,
      item.qty,
      item.priceUnit,
      item.priceTotal,
      item.acquisitionDate,
      item.locationCode,
      item.locationName,
      `"${item.conditionRaw.replace(/"/g, '""')}"`,
      item.status
    ]);

    const csvContent = "data:text/csv;charset=utf-8," 
      + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
    
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `inventaris_gsi_export_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Clear all filters
  const handleClearFilters = () => {
    setSearchQuery("");
    onSelectBranch("");
    onSelectCategory("");
    onSelectStatus("");
    setCurrentPage(1);
  };

  const hasActiveFilters = searchQuery || selectedBranch || selectedCategory || selectedStatus;

  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col" id="inventory-table-container">
      {/* Filtering Actions Panel */}
      <div className="p-5 border-b border-gray-100 space-y-4 bg-gray-50/30">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="space-y-1">
            <h3 className="font-bold text-gray-900 text-base">Daftar Buku Inventaris Aset</h3>
            <p className="text-xs text-gray-500">
              Menampilkan <span className="font-semibold text-indigo-600">{filteredAndSortedItems.length}</span> dari <span className="font-semibold text-gray-700">{items.length}</span> baris aset terdaftar
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Export CSV */}
            <button
              onClick={handleExportCSV}
              className="py-2 px-3.5 bg-emerald-50 hover:bg-emerald-100 border border-emerald-100 text-emerald-700 rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-xs"
              id="export-csv-button"
              title="Unduh data tabel saat ini sebagai file CSV"
            >
              <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
              <span>Ekspor CSV</span>
            </button>

            {/* Add New Item */}
            <button
              onClick={onAddNewClick}
              className="py-2 px-3.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer shadow-md shadow-indigo-600/15"
              id="add-new-asset-button"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Tambah Aset</span>
            </button>
          </div>
        </div>

        {/* Search and Filters Status Block */}
        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" />
            <input
              type="text"
              placeholder="Cari berdasarkan kode aset, nama barang, atau spesifikasi detail..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10 pr-4 py-2.5 w-full text-xs border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-100 focus:border-indigo-500 bg-white shadow-xs"
              id="table-search-input"
            />
          </div>

          {/* Active Filter Badges */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-1.5 md:max-w-md">
              {selectedBranch && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-indigo-50 border border-indigo-100 text-indigo-700 text-[10px] font-bold">
                  Cabang: {selectedBranch}
                  <X className="w-3 h-3 hover:bg-indigo-100 rounded cursor-pointer" onClick={() => onSelectBranch("")} />
                </span>
              )}
              {selectedCategory && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 border border-emerald-100 text-emerald-700 text-[10px] font-bold">
                  Kategori: {selectedCategory.substring(0, 15)}...
                  <X className="w-3 h-3 hover:bg-emerald-100 rounded cursor-pointer" onClick={() => onSelectCategory("")} />
                </span>
              )}
              {selectedStatus && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-50 border border-amber-100 text-amber-700 text-[10px] font-bold">
                  Kondisi: {selectedStatus}
                  <X className="w-3 h-3 hover:bg-amber-100 rounded cursor-pointer" onClick={() => onSelectStatus("")} />
                </span>
              )}
              {searchQuery && (
                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-blue-50 border border-blue-100 text-blue-700 text-[10px] font-bold">
                  Keyword: "{searchQuery.substring(0,10)}"
                  <X className="w-3 h-3 hover:bg-blue-100 rounded cursor-pointer" onClick={() => setSearchQuery("")} />
                </span>
              )}
              <button
                onClick={handleClearFilters}
                className="text-[10px] text-rose-600 hover:text-rose-700 hover:underline font-bold px-2 py-1 cursor-pointer"
                id="clear-all-filters-button"
              >
                Reset Filter
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Table Body */}
      <div className="overflow-x-auto w-full">
        <table className="w-full text-left border-collapse" id="inventory-data-table">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/70 text-[10px] uppercase font-bold text-gray-500 tracking-wider">
              <th className="py-3 px-4 w-12 text-center">No.</th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('code')}>
                <div className="flex items-center gap-1">
                  KODE ASET <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors min-w-[180px]" onClick={() => handleSort('name')}>
                <div className="flex items-center gap-1">
                  NAMA BARANG <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors" onClick={() => handleSort('category')}>
                <div className="flex items-center gap-1">
                  KATEGORI <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-center w-20" onClick={() => handleSort('qty')}>
                <div className="flex items-center justify-center gap-1">
                  QTY <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('priceUnit')}>
                <div className="flex items-center justify-end gap-1">
                  HARGA SATUAN <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-right" onClick={() => handleSort('priceTotal')}>
                <div className="flex items-center justify-end gap-1">
                  TOTAL PEROLEHAN <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-center w-20" onClick={() => handleSort('locationCode')}>
                <div className="flex items-center justify-center gap-1">
                  LOKASI <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 cursor-pointer hover:bg-gray-100 transition-colors text-center w-28" onClick={() => handleSort('status')}>
                <div className="flex items-center justify-center gap-1">
                  STATUS <ArrowUpDown className="w-3 h-3 text-gray-400" />
                </div>
              </th>
              <th className="py-3 px-4 text-center w-16">AKSI</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 text-xs text-gray-700">
            {paginatedItems.length === 0 ? (
              <tr>
                <td colSpan={10} className="py-12 text-center text-gray-400">
                  <div className="flex flex-col items-center justify-center gap-2">
                    <AlertCircle className="w-8 h-8 text-gray-300" />
                    <p className="text-sm font-semibold text-gray-500">Tidak ada aset inventaris cocok dengan kriteria pencarian</p>
                    <button onClick={handleClearFilters} className="text-xs text-indigo-600 hover:underline font-bold cursor-pointer mt-1">
                      Reset Semua Pencarian & Filter
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              paginatedItems.map((item, index) => {
                const globalIndex = (activePage - 1) * itemsPerPage + index + 1;
                return (
                  <tr 
                    key={item.id} 
                    className="hover:bg-gray-50/80 transition-colors group cursor-pointer"
                    onClick={() => onSelectItem(item)}
                    id={`table-row-${item.id.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
                  >
                    <td className="py-3 px-4 text-center font-mono text-[11px] text-gray-400">{globalIndex}</td>
                    <td className="py-3 px-4 font-mono text-[11px] font-bold text-gray-900 group-hover:text-indigo-600 transition-colors">
                      {item.code || "-"}
                    </td>
                    <td className="py-3 px-4">
                      <div>
                        <span className="font-semibold text-gray-800 block truncate max-w-[200px]" title={item.name}>
                          {item.name}
                        </span>
                        {item.spec && (
                          <span className="text-[10px] text-gray-400 font-medium block truncate max-w-[200px]" title={item.spec}>
                            {item.spec}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className="px-2 py-0.5 rounded bg-gray-100 text-gray-600 text-[10px] font-semibold">
                        {item.category}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center font-semibold text-gray-900">{item.qty}</td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] text-gray-600">
                      {formatRupiah(item.priceUnit)}
                    </td>
                    <td className="py-3 px-4 text-right font-mono text-[11px] font-bold text-gray-900">
                      {formatRupiah(item.priceTotal)}
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-extrabold bg-rose-50 text-rose-700 border border-rose-100" title={item.locationName}>
                        {item.locationCode}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold border ${getStatusStyle(item.status)}`}>
                        {item.status}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-center" onClick={(e) => e.stopPropagation()}>
                      <div className="flex items-center justify-center gap-1">
                        <button
                          onClick={() => onSelectItem(item)}
                          className="p-1 hover:bg-gray-100 text-gray-500 hover:text-indigo-600 rounded-md transition-colors cursor-pointer"
                          title="Lihat Detail"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => {
                            if (confirm(`Hapus asset "${item.name}" dari database?`)) {
                              onDelete(item.id);
                            }
                          }}
                          className="p-1 hover:bg-gray-100 text-gray-400 hover:text-rose-600 rounded-md transition-colors cursor-pointer"
                          title="Hapus Aset"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Controls */}
      {totalPages > 1 && (
        <div className="p-4 bg-gray-50 border-t border-gray-100 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500" id="table-pagination-controls">
          <div className="flex items-center gap-4">
            <span>
              Menampilkan <span className="font-bold text-gray-700">{Math.min(filteredAndSortedItems.length, (activePage - 1) * itemsPerPage + 1)}</span> - <span className="font-bold text-gray-700">{Math.min(filteredAndSortedItems.length, activePage * itemsPerPage)}</span> dari <span className="font-bold text-gray-700">{filteredAndSortedItems.length}</span> item
            </span>
            
            {/* Items Per Page Select */}
            <div className="flex items-center gap-1.5">
              <span>Baris:</span>
              <select
                value={itemsPerPage}
                onChange={(e) => {
                  setItemsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="border border-gray-200 bg-white rounded-md px-1.5 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-indigo-500 font-medium text-gray-700"
                id="select-rows-per-page"
              >
                <option value={10}>10</option>
                <option value={25}>25</option>
                <option value={50}>50</option>
                <option value={100}>100</option>
              </select>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={activePage === 1}
              className="p-1.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Pertama"
            >
              <ChevronsLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(activePage - 1)}
              disabled={activePage === 1}
              className="p-1.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Sebelumnya"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            
            {/* Page info */}
            <span className="px-3 py-1 bg-white border border-gray-200 rounded-lg font-semibold text-gray-700">
              {activePage} <span className="text-gray-400 font-normal">/ {totalPages}</span>
            </span>

            <button
              onClick={() => setCurrentPage(activePage + 1)}
              disabled={activePage === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Selanjutnya"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={activePage === totalPages}
              className="p-1.5 border border-gray-200 rounded-lg bg-white text-gray-500 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Halaman Terakhir"
            >
              <ChevronsRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
