import React from 'react';
import { CLINICAL_COLORS } from './amchartsTheme';
import { PieChart } from 'lucide-react';

export const CareFlowStatusChart = ({
  statuses,
  data,
  title,
  subtitle,
  activeStatus = null,
  onStatusClick = null,
  emptyMessage = 'No status metrics recorded for this period.',
  className = ''
}) => {
  const items = statuses || data || [
    { key: 'scheduled', label: 'Scheduled', count: 0, color: CLINICAL_COLORS.primary },
    { key: 'completed', label: 'Completed', count: 0, color: CLINICAL_COLORS.emerald },
    { key: 'cancelled', label: 'Cancelled', count: 0, color: CLINICAL_COLORS.rose }
  ];

  const total = items.reduce((sum, s) => sum + (Number(s.count) || 0), 0);

  const getPercent = (count) => {
    if (!total || total === 0) return 0;
    return Math.round(((Number(count) || 0) / total) * 100);
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {/* Header */}
      {(title || subtitle) && (
        <div className="mb-4 flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {onStatusClick && (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Click status to filter
            </span>
          )}
        </div>
      )}

      {total === 0 ? (
        <div className="py-8 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <PieChart className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Status breakdowns will generate as workflows progress.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Proportional Segmented Progress Bar */}
          <div className="w-full h-3.5 bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 shadow-inner">
            {items.map((s) => {
              const pct = getPercent(s.count);
              if (pct === 0) return null;
              const isSelected = activeStatus && activeStatus.toLowerCase() === s.key.toLowerCase();

              return (
                <div
                  key={s.key}
                  style={{
                    width: `${pct}%`,
                    backgroundColor: s.color
                  }}
                  onClick={() => onStatusClick && onStatusClick(s.key)}
                  title={`${s.label}: ${s.count} (${pct}%)`}
                  className={`h-full rounded-full transition-all duration-300 cursor-pointer ${
                    isSelected ? 'ring-2 ring-offset-1 ring-slate-900 scale-y-110' : 'hover:opacity-90'
                  }`}
                />
              );
            })}
          </div>

          {/* Interactive Status Tiles */}
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 pt-1">
            {items.map((s) => {
              const count = Number(s.count) || 0;
              const pct = getPercent(count);
              const isSelected = activeStatus && activeStatus.toLowerCase() === s.key.toLowerCase();

              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onStatusClick && onStatusClick(s.key)}
                  className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer flex flex-col justify-between space-y-1 ${
                    isSelected
                      ? 'bg-blue-50/80 border-blue-500 shadow-2xs'
                      : 'bg-slate-50/70 border-slate-200/80 hover:bg-slate-100/80 hover:border-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                      <span
                        className="w-2 h-2 rounded-full shrink-0"
                        style={{ backgroundColor: s.color }}
                      />
                      <span className="text-xs font-semibold text-slate-700 truncate">{s.label}</span>
                    </div>
                    <span className="text-[10px] font-mono font-medium text-slate-400">{pct}%</span>
                  </div>

                  <div className="flex items-baseline justify-between pt-0.5">
                    <span className="text-base font-bold text-slate-900 font-mono tracking-tight">{count}</span>
                    <span className="text-[10px] text-slate-400">records</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default CareFlowStatusChart;
