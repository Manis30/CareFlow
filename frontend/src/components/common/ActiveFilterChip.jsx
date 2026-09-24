import React from 'react';
import { X, Filter } from 'lucide-react';

/**
 * ActiveFilterChip
 * Reusable cross-filter badge display for CareFlow interactive analytics.
 * Pattern: SELECT -> ACTIVE FILTER -> UPDATE
 */
export const ActiveFilterChip = ({
  filters = [], // [{ key: 'doctor', label: 'Clinician', value: 'Dr. Priya', onRemove: () => {} }]
  onClearAll = null,
  className = ''
}) => {
  const activeFilters = filters.filter((f) => f && f.value && f.value !== 'ALL' && f.value !== 'all');

  if (activeFilters.length === 0) return null;

  return (
    <div className={`p-2.5 bg-blue-50/80 border border-blue-200/90 rounded-xl flex items-center justify-between gap-3 text-xs shadow-2xs ${className}`}>
      <div className="flex items-center gap-2 flex-wrap min-w-0">
        <div className="flex items-center gap-1.5 text-blue-700 font-bold text-[11px] uppercase tracking-wider shrink-0">
          <Filter className="w-3.5 h-3.5" />
          <span>Active Filters:</span>
        </div>

        {activeFilters.map((f, idx) => (
          <span
            key={f.key || idx}
            className="inline-flex items-center gap-1.5 bg-white text-slate-800 px-2.5 py-1 rounded-lg border border-blue-200 text-xs font-medium shadow-2xs"
          >
            <span className="text-slate-400 font-semibold">{f.label}:</span>
            <strong className="text-blue-900 font-bold">{f.value}</strong>
            {f.onRemove && (
              <button
                type="button"
                onClick={f.onRemove}
                className="text-slate-400 hover:text-rose-600 transition-colors cursor-pointer ml-0.5"
                title={`Remove ${f.label} filter`}
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </span>
        ))}
      </div>

      {onClearAll && activeFilters.length > 0 && (
        <button
          type="button"
          onClick={onClearAll}
          className="shrink-0 inline-flex items-center gap-1 text-[11px] font-bold text-blue-700 hover:text-blue-900 bg-white px-2.5 py-1 rounded-lg border border-blue-200 hover:border-blue-300 transition-colors cursor-pointer shadow-2xs"
        >
          <X className="w-3 h-3" />
          <span>Clear All</span>
        </button>
      )}
    </div>
  );
};

export default ActiveFilterChip;
