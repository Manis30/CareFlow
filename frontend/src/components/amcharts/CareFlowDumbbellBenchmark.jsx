import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, ArrowUpRight, ArrowDownRight, Minus, CheckCircle2 } from 'lucide-react';

/**
 * CareFlowDumbbellBenchmark
 * 
 * Horizontal Dumbbell Benchmark:
 *  - Platform Median Benchmark vs Facility Completion Rate
 *  - Connecting gap line showing distance from platform standard
 *  - Explicit Delta in percentage points (pp)
 *  - Click to select facility
 */
export const CareFlowDumbbellBenchmark = ({
  facilities = [],
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  // Calculate completion rates and platform median
  const { benchmarks, medianRate } = useMemo(() => {
    if (!facilities || facilities.length === 0) {
      return { benchmarks: [], medianRate: 85 };
    }

    const list = facilities.map((f) => {
      const total = Number(f.appointmentCount) || 0;
      const completed = Number(f.completedCount) || 0;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      return {
        id: f._id,
        name: f.name || 'Healthcare Facility',
        district: f.district || f.city || 'Tamil Nadu',
        total,
        completed,
        rate
      };
    });

    // Compute median
    const sortedRates = [...list].map((item) => item.rate).sort((a, b) => a - b);
    const mid = Math.floor(sortedRates.length / 2);
    const median = sortedRates.length % 2 !== 0
      ? sortedRates[mid]
      : Math.round((sortedRates[mid - 1] + sortedRates[mid]) / 2);

    // Compute delta vs median
    const enriched = list
      .map((item) => ({
        ...item,
        delta: item.rate - median
      }))
      .sort((a, b) => b.rate - a.rate);

    return { benchmarks: enriched, medianRate: median };
  }, [facilities]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Target className="w-4 h-4 text-emerald-600" />
            Facility Consultation Fulfillment Benchmark
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Completion rate comparison relative to the platform median baseline
          </p>
        </div>

        {/* Median Indicator */}
        <div className="flex items-center gap-2 px-3 py-1 bg-slate-50 rounded-lg border border-slate-200/60 text-xs">
          <span className="w-2 h-2 rounded-full bg-slate-400" />
          <span className="text-slate-500 font-medium">Platform Median:</span>
          <span className="font-bold text-slate-900">{medianRate}%</span>
        </div>
      </div>

      {/* Axis Scale (60% to 100%) */}
      <div className="relative mb-2 pl-36 sm:pl-48 pr-16 text-[10px] text-slate-400 font-medium flex justify-between">
        <span>60%</span>
        <span>70%</span>
        <span>80%</span>
        <span>90%</span>
        <span>100%</span>

        {/* Vertical Median Marker Line */}
        <div
          style={{ left: `calc(144px + ${(medianRate - 60) / 40} * (100% - 208px))` }}
          className="absolute top-0 bottom-0 w-px border-l border-dashed border-slate-300 pointer-events-none hidden sm:block"
        />
      </div>

      {/* Dumbbell Rows */}
      <div className="space-y-3.5 divide-y divide-slate-50">
        {benchmarks.map((item, idx) => {
          const isSelected = selectedFacility && (selectedFacility === item.name || selectedFacility === item.id);
          const minScale = 60;
          const maxScale = 100;
          const clamp = (val) => Math.max(0, Math.min(100, ((val - minScale) / (maxScale - minScale)) * 100));

          const medianPos = clamp(medianRate);
          const facilityPos = clamp(item.rate);
          const lineLeft = Math.min(medianPos, facilityPos);
          const lineWidth = Math.abs(facilityPos - medianPos);

          return (
            <motion.div
              key={item.id || idx}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.04, duration: 0.25 }}
              onClick={() => onFacilityClick && onFacilityClick(item)}
              className={`pt-3 first:pt-0 group flex items-center gap-3 cursor-pointer rounded-xl p-2 -mx-2 transition-all duration-150 ${
                isSelected
                  ? 'bg-blue-50/60 ring-1 ring-blue-300'
                  : 'hover:bg-slate-50/80'
              }`}
            >
              {/* Facility Name & Subtitle */}
              <div className="w-36 sm:w-48 shrink-0 truncate">
                <p className={`text-xs font-semibold truncate transition-colors ${
                  isSelected ? 'text-blue-700' : 'text-slate-800 group-hover:text-blue-600'
                }`}>
                  {item.name}
                </p>
                <p className="text-[10px] text-slate-400 truncate">
                  {item.district} • {item.completed}/{item.total} visits
                </p>
              </div>

              {/* Dumbbell Visualization Bar */}
              <div className="flex-1 relative h-6 flex items-center">
                {/* Background Track */}
                <div className="w-full h-1.5 bg-slate-100 rounded-full" />

                {/* Connecting Gap Line */}
                <div
                  style={{ left: `${lineLeft}%`, width: `${lineWidth}%` }}
                  className={`absolute h-1.5 rounded-full transition-all duration-300 ${
                    item.delta >= 0 ? 'bg-emerald-200' : 'bg-rose-200'
                  }`}
                />

                {/* Platform Median Dot */}
                <div
                  style={{ left: `${medianPos}%` }}
                  className="absolute -translate-x-1/2 w-3 h-3 rounded-full bg-slate-400 border-2 border-white shadow-xs z-10"
                  title={`Platform Median: ${medianRate}%`}
                />

                {/* Facility Rate Dot */}
                <div
                  style={{ left: `${facilityPos}%` }}
                  className={`absolute -translate-x-1/2 w-4 h-4 rounded-full border-2 border-white shadow-sm z-20 transition-transform group-hover:scale-125 ${
                    item.delta >= 0 ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  title={`${item.name}: ${item.rate}%`}
                />
              </div>

              {/* Rate & Delta Badge */}
              <div className="w-16 shrink-0 flex flex-col items-end">
                <span className="text-xs font-bold text-slate-900 font-mono">
                  {item.rate}%
                </span>
                <span className={`inline-flex items-center text-[10px] font-semibold ${
                  item.delta > 0
                    ? 'text-emerald-600'
                    : item.delta < 0
                    ? 'text-rose-600'
                    : 'text-slate-400'
                }`}>
                  {item.delta > 0 && <ArrowUpRight className="w-3 h-3 mr-0.5" />}
                  {item.delta < 0 && <ArrowDownRight className="w-3 h-3 mr-0.5" />}
                  {item.delta === 0 && <Minus className="w-3 h-3 mr-0.5" />}
                  {item.delta > 0 ? `+${item.delta}pp` : `${item.delta}pp`}
                </span>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

export default CareFlowDumbbellBenchmark;
