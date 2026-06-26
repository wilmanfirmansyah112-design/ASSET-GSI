import { motion } from "motion/react";
import { FolderHeart, ChevronRight } from "lucide-react";
import { CategoryStat } from "../types";
import { formatRupiah } from "../dataService";

interface CategoryBreakdownProps {
  categories: CategoryStat[];
  selectedCategory: string;
  onSelectCategory: (category: string) => void;
  totalCompanyValue: number;
}

export default function CategoryBreakdown({
  categories,
  selectedCategory,
  onSelectCategory,
  totalCompanyValue
}: CategoryBreakdownProps) {
  const maxCatValue = Math.max(...categories.map(c => c.totalValue), 1);

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm space-y-4" id="category-breakdown-card">
      <div className="flex items-center gap-2">
        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg">
          <FolderHeart className="w-5 h-5" />
        </div>
        <div>
          <h3 className="font-bold text-gray-900 text-base">Nilai Aset per Kategori</h3>
          <p className="text-xs text-gray-500">Breakdown finansial aset berdasarkan kategori barang</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-1 gap-3 max-h-[420px] overflow-y-auto pr-1" id="category-list-container">
        {categories.map((cat, index) => {
          const isSelected = selectedCategory === cat.name;
          const valuePercentage = Math.round((cat.totalValue / totalCompanyValue) * 100);
          const relativeFillPercentage = Math.round((cat.totalValue / maxCatValue) * 100);

          return (
            <motion.button
              key={cat.name}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: index * 0.04 }}
              onClick={() => onSelectCategory(isSelected ? "" : cat.name)}
              className={`w-full text-left p-3.5 rounded-xl border transition-all duration-200 flex flex-col gap-1.5 relative overflow-hidden group cursor-pointer ${
                isSelected
                  ? "ring-2 ring-emerald-600 bg-emerald-50/20 border-emerald-200"
                  : "border-gray-100 bg-gray-50/50 hover:bg-gray-50 hover:border-gray-200"
              }`}
              id={`category-button-${cat.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}`}
            >
              <div className="flex items-center justify-between z-10 w-full">
                <div className="space-y-0.5">
                  <h4 className="text-xs font-bold text-gray-800">{cat.name}</h4>
                  <p className="text-[10px] text-gray-400 font-medium">
                    {cat.itemCount.toLocaleString("id-ID")} jenis aset
                  </p>
                </div>
                <div className="text-right flex items-center gap-1">
                  <div>
                    <span className="text-xs font-bold text-gray-900 block">
                      {formatRupiah(cat.totalValue)}
                    </span>
                    <span className="text-[10px] font-medium text-emerald-600">
                      {valuePercentage}% dari total
                    </span>
                  </div>
                  <ChevronRight className={`w-4 h-4 text-gray-400 group-hover:translate-x-0.5 transition-transform ${isSelected ? "text-emerald-600" : ""}`} />
                </div>
              </div>

              {/* Progress bar visualizer */}
              <div className="w-full bg-gray-100 rounded-full h-1.5 mt-1 overflow-hidden z-10">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    isSelected ? "bg-emerald-600" : "bg-emerald-400"
                  }`}
                  style={{ width: `${relativeFillPercentage}%` }}
                />
              </div>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
