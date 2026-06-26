import { motion } from "motion/react";
import { Package, Coins, CheckCircle, AlertTriangle, XCircle, HelpCircle, Layers } from "lucide-react";
import { InventoryStats } from "../types";
import { formatRupiah } from "../dataService";

interface StatsOverviewProps {
  stats: InventoryStats;
  selectedStatus: string;
  onSelectStatus: (status: string) => void;
}

export default function StatsOverview({ stats, selectedStatus, onSelectStatus }: StatsOverviewProps) {
  // Find specific condition counts
  const statusCounts = stats.statuses.reduce((acc, curr) => {
    acc[curr.name] = curr.count;
    return acc;
  }, {} as Record<string, number>);

  const baikCount = statusCounts["Baik"] || 0;
  const rusakRinganCount = statusCounts["Rusak Ringan"] || 0;
  const rusakBeratCount = statusCounts["Rusak Berat"] || 0;
  const unknownCount = statusCounts["Tidak Diketahui"] || 0;

  // Percentage calculations
  const total = stats.totalItems || 1;
  const baikPct = Math.round((baikCount / total) * 100);
  const rusakRinganPct = Math.round((rusakRinganCount / total) * 100);
  const rusakBeratPct = Math.round((rusakBeratCount / total) * 100);
  const unknownPct = Math.round((unknownCount / total) * 100);

  const kpis = [
    {
      id: "total_items",
      title: "Total Line Item Aset",
      value: stats.totalItems.toLocaleString("id-ID"),
      sub: `${stats.totalQty.toLocaleString("id-ID")} unit barang fisik`,
      icon: Package,
      color: "from-blue-500/10 to-indigo-500/10 border-blue-100",
      iconColor: "text-blue-600 bg-blue-50",
    },
    {
      id: "total_value",
      title: "Total Nilai Perolehan",
      value: formatRupiah(stats.totalValue),
      sub: "Akumulasi nilai seluruh aset cabang",
      icon: Coins,
      color: "from-emerald-500/10 to-teal-500/10 border-emerald-100",
      iconColor: "text-emerald-600 bg-emerald-50",
    },
    {
      id: "average_value",
      title: "Rata-rata Nilai per Item",
      value: formatRupiah(Math.round(stats.totalValue / (stats.totalQty || 1))),
      sub: "Nilai perolehan rata-rata per unit",
      icon: Layers,
      color: "from-purple-500/10 to-pink-500/10 border-purple-100",
      iconColor: "text-purple-600 bg-purple-50",
    }
  ];

  const conditionMetrics = [
    {
      name: "Baik",
      count: baikCount,
      percentage: baikPct,
      color: "bg-emerald-500",
      textColor: "text-emerald-700",
      bgColor: "bg-emerald-50 hover:bg-emerald-100/70 border-emerald-100",
      icon: CheckCircle,
    },
    {
      name: "Rusak Ringan",
      count: rusakRinganCount,
      percentage: rusakRinganPct,
      color: "bg-amber-500",
      textColor: "text-amber-700",
      bgColor: "bg-amber-50 hover:bg-amber-100/70 border-amber-100",
      icon: AlertTriangle,
    },
    {
      name: "Rusak Berat",
      count: rusakBeratCount,
      percentage: rusakBeratPct,
      color: "bg-rose-500",
      textColor: "text-rose-700",
      bgColor: "bg-rose-50 hover:bg-rose-100/70 border-rose-100",
      icon: XCircle,
    },
    {
      name: "Tidak Diketahui",
      count: unknownCount,
      percentage: unknownPct,
      color: "bg-gray-400",
      textColor: "text-gray-600",
      bgColor: "bg-gray-50 hover:bg-gray-100/70 border-gray-100",
      icon: HelpCircle,
    }
  ];

  return (
    <div className="space-y-6" id="stats-overview-container">
      {/* KPI Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {kpis.map((kpi, index) => {
          const IconComponent = kpi.icon;
          return (
            <motion.div
              key={kpi.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className={`p-6 rounded-2xl border bg-gradient-to-br ${kpi.color} shadow-sm flex items-start justify-between`}
              id={`kpi-card-${kpi.id}`}
            >
              <div className="space-y-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-gray-500">
                  {kpi.title}
                </span>
                <h3 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900">
                  {kpi.value}
                </h3>
                <p className="text-xs text-gray-500 font-medium">
                  {kpi.sub}
                </p>
              </div>
              <div className={`p-3 rounded-xl ${kpi.iconColor}`}>
                <IconComponent className="w-6 h-6" />
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Condition Status Selector Cards */}
      <div className="space-y-2">
        <h4 className="text-sm font-semibold text-gray-600">Status Kondisi Aset (Klik untuk memfilter)</h4>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {conditionMetrics.map((item, index) => {
            const IconComp = item.icon;
            const isSelected = selectedStatus === item.name;
            return (
              <motion.button
                key={item.name}
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.3, delay: index * 0.05 }}
                onClick={() => onSelectStatus(isSelected ? "" : item.name)}
                className={`p-4 rounded-xl border text-left transition-all duration-200 flex flex-col justify-between cursor-pointer shadow-sm relative overflow-hidden group ${
                  isSelected 
                    ? "ring-2 ring-indigo-600 bg-indigo-50/20 border-indigo-200" 
                    : item.bgColor
                }`}
                id={`status-filter-card-${item.name.toLowerCase().replace(/\s+/g, "-")}`}
              >
                <div className="flex items-center justify-between mb-3">
                  <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${item.color} text-white`}>
                    {item.percentage}%
                  </span>
                  <IconComp className={`w-5 h-5 ${item.textColor} opacity-80 group-hover:scale-110 transition-transform`} />
                </div>
                <div>
                  <p className="text-xs font-medium text-gray-500">{item.name}</p>
                  <p className="text-xl font-bold text-gray-900 mt-0.5">
                    {item.count.toLocaleString("id-ID")}{" "}
                    <span className="text-xs text-gray-400 font-normal">item</span>
                  </p>
                </div>
                {/* Horizontal status mini bar inside card bottom */}
                <div className="absolute bottom-0 left-0 right-0 h-1 bg-gray-100">
                  <div className={`h-full ${item.color}`} style={{ width: `${item.percentage}%` }} />
                </div>
              </motion.button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
