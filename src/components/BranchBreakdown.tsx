import { useState } from "react";
import { motion } from "motion/react";
import { MapPin, Building, ChevronDown, ChevronUp, Search } from "lucide-react";
import { BranchStat } from "../types";
import { formatRupiah } from "../dataService";

interface BranchBreakdownProps {
  branches: BranchStat[];
  selectedBranch: string;
  onSelectBranch: (branchCode: string) => void;
  totalCompanyValue: number;
}

export default function BranchBreakdown({
  branches,
  selectedBranch,
  onSelectBranch,
  totalCompanyValue
}: BranchBreakdownProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [isExpanded, setIsExpanded] = useState(false);

  // Filter branches by search query
  const filteredBranches = branches.filter(branch => 
    branch.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    branch.code.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Determine how many branches to show initially
  const visibleBranches = isExpanded ? filteredBranches : filteredBranches.slice(0, 5);

  const maxBranchValue = Math.max(...branches.map(b => b.totalValue), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4" id="branch-breakdown-card">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg">
            <Building className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-gray-900 text-base">Sebaran Aset per Cabang</h3>
            <p className="text-xs text-gray-500">Distribusi aset inventaris di seluruh cabang & outlet</p>
          </div>
        </div>
        
        {/* Branch search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Cari cabang..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 pr-4 py-1.5 w-full sm:w-48 text-xs border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-indigo-500"
            id="branch-search-input"
          />
        </div>
      </div>

      <div className="space-y-2.5 max-h-[420px] overflow-y-auto pr-1" id="branch-list-container">
        {visibleBranches.length === 0 ? (
          <p className="text-center text-xs text-gray-400 py-6">Tidak ada cabang ditemukan</p>
        ) : (
          visibleBranches.map((branch, index) => {
            const isSelected = selectedBranch === branch.code;
            const valuePercentage = Math.round((branch.totalValue / totalCompanyValue) * 100);
            const relativeFillPercentage = Math.round((branch.totalValue / maxBranchValue) * 100);

            return (
              <motion.button
                key={branch.code}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.25, delay: index * 0.05 }}
                onClick={() => onSelectBranch(isSelected ? "" : branch.code)}
                className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col gap-2 relative overflow-hidden group cursor-pointer ${
                  isSelected
                    ? "ring-2 ring-indigo-600 bg-indigo-50/30 border-indigo-200"
                    : "border-gray-100 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-200"
                }`}
                id={`branch-button-${branch.code.toLowerCase()}`}
              >
                <div className="flex items-start justify-between z-10">
                  <div className="flex items-center gap-2">
                    <div className={`p-1.5 rounded-md ${isSelected ? "bg-indigo-100 text-indigo-700" : "bg-white text-gray-500 border border-gray-100"}`}>
                      <MapPin className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-gray-800">{branch.name}</h4>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-gray-500">
                        <span>{branch.itemCount} jenis barang</span>
                        <span className="w-1 h-1 rounded-full bg-gray-300" />
                        <span>{branch.itemQty} unit total</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-bold text-gray-900 block">
                      {formatRupiah(branch.totalValue)}
                    </span>
                    <span className="text-[10px] font-medium text-indigo-600 mt-0.5 inline-block">
                      {valuePercentage}% dari total
                    </span>
                  </div>
                </div>

                {/* Progress bar visualizer */}
                <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden z-10">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSelected ? "bg-indigo-600" : "bg-indigo-400"
                    }`}
                    style={{ width: `${relativeFillPercentage}%` }}
                  />
                </div>
              </motion.button>
            );
          })
        )}
      </div>

      {filteredBranches.length > 5 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full py-2 border border-gray-150 rounded-xl text-xs font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex items-center justify-center gap-1 cursor-pointer mt-2"
          id="toggle-branches-button"
        >
          {isExpanded ? (
            <>
              Tampilkan Sedikit <ChevronUp className="w-4 h-4" />
            </>
          ) : (
            <>
              Tampilkan Semua ({filteredBranches.length} Cabang) <ChevronDown className="w-4 h-4" />
            </>
          )}
        </button>
      )}
    </div>
  );
}
