import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { TrendingUp } from 'lucide-react';
import { formatDoctorName } from '../../utils/formatters';

/**
 * CareFlowDotPlot
 * Compact, lightweight benchmark comparison board.
 * Compares individual practitioner volume or department metrics against the real computed clinic benchmark.
 */
export const CareFlowDotPlot = ({
  title = 'Clinician Consultation Volume',
  subtitle = 'Individual volume distribution evaluated against clinic benchmark',
  items = [], // [{ label: "Dr. Smith", value: 34, sublabel: "Cardiology", id: "..." }]
  benchmark = null, // if null, computed dynamically from items!
  benchmarkLabel = 'Clinic Average',
  selectedItem = null,
  onItemClick = null,
  unit = 'visits',
  className = ''
}) => {
  // Compute true clinic benchmark if not explicitly passed
  const calculatedBenchmark = useMemo(() => {
    if (benchmark !== null && benchmark !== undefined) return benchmark;
    if (!items || items.length === 0) return 0;
    const sum = items.reduce((acc, item) => acc + (Number(item.value) || 0), 0);
    return Math.round(sum / items.length);
  }, [items, benchmark]);

  const maxVal = useMemo(() => {
    if (!items || items.length === 0) return 10;
    const highest = Math.max(...items.map((i) => Number(i.value) || 0), calculatedBenchmark);
    return Math.ceil(highest * 1.15) || 10;
  }, [items, calculatedBenchmark]);

  const benchmarkPct = Math.min(100, Math.max(0, (calculatedBenchmark / maxVal) * 100));

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="border-b border-slate-100 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            {title}
          </h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-md bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-700 border border-blue-100">
            {benchmarkLabel}: {calculatedBenchmark} {unit}
          </span>
        </div>
      </div>

      {/* Axis Scale Header */}
      <div className="flex justify-between items-center text-[10px] font-mono uppercase tracking-wider text-slate-400 pt-3 pb-1 border-b border-slate-50">
        <span>0</span>
        <span className="text-blue-600 font-bold">● Benchmark {calculatedBenchmark}</span>
        <span>{maxVal} {unit}</span>
      </div>

      {/* Items Rows */}
      <div className="my-3 space-y-2 flex-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            No benchmark comparison records available.
          </div>
        ) : (
          items.map((item, idx) => {
            const val = Number(item.value) || 0;
            const pct = Math.min(100, Math.max(0, (val / maxVal) * 100));
            const diff = val - calculatedBenchmark;
            const isSelected =
              selectedItem && (selectedItem === item.label || selectedItem === item.id);

            return (
              <motion.div
                key={item.id || item.label || idx}
                initial={{ opacity: 0, x: 6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.02 }}
                onClick={() => onItemClick && onItemClick(item)}
                className={`group p-2.5 rounded-lg border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-500 shadow-2xs'
                    : 'bg-white border-slate-100 hover:bg-slate-50/80 hover:border-slate-200'
                }`}
              >
                {/* Upper Label Row */}
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <div className="truncate pr-2">
                    <span className="font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {formatDoctorName(item.label)}
                    </span>
                    {item.sublabel && (
                      <span className="text-[11px] text-slate-400 font-normal ml-2">
                        {item.sublabel}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="font-bold font-mono text-slate-900 text-xs">
                      {val} {unit}
                    </span>
                    <span
                      className={`text-[10px] font-semibold font-mono px-1.5 py-0.5 rounded ${
                        diff >= 0
                          ? 'bg-emerald-50 text-emerald-700'
                          : 'bg-rose-50 text-rose-700'
                      }`}
                    >
                      {diff >= 0 ? `+${diff}` : diff}
                    </span>
                  </div>
                </div>

                {/* Track and Dot Position */}
                <div className="relative h-3 flex items-center">
                  {/* Track Background */}
                  <div className="w-full h-1 bg-slate-100 rounded-full" />

                  {/* Benchmark Vertical Tick */}
                  <div
                    style={{ left: `${benchmarkPct}%` }}
                    className="absolute h-3 w-0.5 bg-blue-300 -translate-x-1/2 z-0"
                    title={`Benchmark: ${calculatedBenchmark}`}
                  />

                  {/* Value Dot */}
                  <div
                    style={{ left: `${pct}%` }}
                    className={`absolute w-3.5 h-3.5 rounded-full -translate-x-1/2 transition-all duration-300 shadow-2xs ${
                      isSelected
                        ? 'bg-blue-700 ring-4 ring-blue-200'
                        : val >= calculatedBenchmark
                        ? 'bg-blue-600 group-hover:scale-125'
                        : 'bg-slate-400 group-hover:bg-blue-500 group-hover:scale-125'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      {onItemClick && (
        <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <span>Click any clinician row to filter dashboard roster</span>
          {selectedItem && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onItemClick(null);
              }}
              className="text-blue-600 font-semibold hover:underline"
            >
              Reset Filter
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CareFlowDotPlot;
