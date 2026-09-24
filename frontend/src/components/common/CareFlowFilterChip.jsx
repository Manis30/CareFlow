import React, { useEffect } from 'react';
import { Filter, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

/**
 * CareFlowFilterChip
 * 
 * Standard dismissible cross-filter chip for all 12 portals.
 * Renders an active filter pill with an 'x' to remove, plus a global Escape listener.
 * 
 * @param {Array<{ label: string, value: string, onRemove: Function }>} filters - List of active filters
 * @param {Function} onClearAll - Clear all active filters
 */
export function CareFlowFilterChip({
  filters = [],
  onClearAll = null,
  className = ''
}) {
  // Global Escape keydown listener
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (typeof onClearAll === 'function') {
          onClearAll();
        } else if (filters.length > 0 && typeof filters[0].onRemove === 'function') {
          filters[0].onRemove();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [filters, onClearAll]);

  if (!filters || filters.length === 0) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: -6 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -6 }}
        transition={{ duration: 0.2 }}
        className={`flex flex-wrap items-center gap-2 p-3 bg-blue-50/80 border border-blue-200/80 rounded-xl ${className}`}
      >
        <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-800">
          <Filter className="w-3.5 h-3.5 text-blue-600" />
          <span>Active Analytical Filter:</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {filters.map((f, idx) => (
            <span
              key={f.id || f.label || idx}
              className="inline-flex items-center gap-1.5 pl-2.5 pr-1.5 py-1 rounded-lg bg-white border border-blue-200 text-xs font-medium text-slate-800 shadow-2xs"
            >
              <span className="text-slate-500">{f.label ? `${f.label}:` : ''}</span>
              <span className="font-semibold text-blue-900">{f.value}</span>
              <button
                type="button"
                onClick={f.onRemove}
                className="w-4 h-4 rounded-md flex items-center justify-center text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
                title="Remove filter"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>

        {onClearAll && (
          <button
            type="button"
            onClick={onClearAll}
            className="ml-auto text-xs font-semibold text-blue-700 hover:text-blue-900 underline underline-offset-2 cursor-pointer transition-colors"
          >
            Clear (Esc)
          </button>
        )}
      </motion.div>
    </AnimatePresence>
  );
}

export default CareFlowFilterChip;
