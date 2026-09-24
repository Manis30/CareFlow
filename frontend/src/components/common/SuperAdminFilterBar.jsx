import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Building2, X, RotateCcw, Calendar, Layers } from 'lucide-react';

/**
 * SuperAdminFilterBar
 * 
 * Compact enterprise analytics filter bar for CareFlow Command Center.
 * Implements Domo-style filter state presentation:
 * - Default: "All Facilities"
 * - Filtered: Animated filter chips [ Facility: Name × ] with smooth enter/exit (180-250ms)
 * - Reset button [ Clear Filters (ESC) ] visible only when filtered
 */
export const SuperAdminFilterBar = ({
  facilityFilter = null,
  dateRange = { key: 'ALL', label: 'All Time' },
  onFacilityRemove = () => {},
  onDateReset = () => {},
  onClearAll = () => {},
  totalFacilitiesCount = 8,
  className = ''
}) => {
  const isFiltered = Boolean(facilityFilter || (dateRange?.key && dateRange.key !== 'ALL'));

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 px-4 py-2.5 shadow-2xs flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs transition-all duration-200 ${className}`}
    >
      {/* Left: Active Filters Segment */}
      <div className="flex items-center gap-2.5 flex-wrap min-w-0">
        {/* Platform / Scope Baseline Label */}
        <div className="flex items-center gap-1.5 text-slate-400 font-semibold uppercase tracking-wider text-[10.5px] shrink-0 pr-1 border-r border-slate-200">
          <Layers className="w-3.5 h-3.5 text-blue-600" />
          <span>Scope</span>
        </div>

        {/* Unfiltered State: "All Facilities" */}
        {!facilityFilter && (
          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-50 border border-slate-200/70 text-slate-700 font-medium">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
            <span className="font-semibold text-slate-900">All Facilities</span>
            <span className="text-[10px] text-slate-400">({totalFacilitiesCount} clinics)</span>
          </div>
        )}

        {/* Filter Chips Container with Framer Motion AnimatePresence */}
        <AnimatePresence mode="popLayout">
          {/* Facility Filter Chip */}
          {facilityFilter && (
            <motion.div
              key="facility-filter-chip"
              layout
              initial={{ opacity: 0, scale: 0.96, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -2 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-blue-50 text-blue-900 border border-blue-200/90 font-medium shadow-2xs"
            >
              <Building2 className="w-3 h-3 text-blue-600" />
              <span className="text-[11px] text-blue-600 font-semibold">Facility:</span>
              <span className="font-bold text-blue-950 truncate max-w-[200px] sm:max-w-[280px]">
                {facilityFilter}
              </span>
              <button
                type="button"
                onClick={onFacilityRemove}
                className="p-0.5 rounded text-blue-500 hover:text-rose-600 hover:bg-blue-100/60 transition-colors cursor-pointer ml-0.5"
                title="Remove facility filter"
                aria-label="Remove facility filter"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}

          {/* Date Range Chip (if custom) */}
          {dateRange?.key && dateRange.key !== 'ALL' && (
            <motion.div
              key="date-filter-chip"
              layout
              initial={{ opacity: 0, scale: 0.96, y: -2 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96, y: -2 }}
              transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-slate-100 text-slate-800 border border-slate-200 font-medium shadow-2xs"
            >
              <Calendar className="w-3 h-3 text-slate-500" />
              <span className="text-[11px] text-slate-500 font-semibold">Period:</span>
              <span className="font-bold text-slate-900">{dateRange.label || dateRange.key}</span>
              <button
                type="button"
                onClick={onDateReset}
                className="p-0.5 rounded text-slate-400 hover:text-rose-600 hover:bg-slate-200 transition-colors cursor-pointer ml-0.5"
                title="Reset date filter"
                aria-label="Reset date filter"
              >
                <X className="w-3 h-3" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Right: Actions & Analytical Context */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Analytical Mode Context */}
        <span className="text-[11px] text-slate-400 hidden md:inline font-medium">
          {facilityFilter
            ? 'Cross-Filtered Focus Mode active'
            : 'Platform Aggregate Mode'}
        </span>

        {/* Reset / Clear Filters Control: ONLY visible when filters are active */}
        <AnimatePresence>
          {isFiltered && (
            <motion.button
              key="clear-filters-btn"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.18 }}
              type="button"
              onClick={onClearAll}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100/80 text-rose-700 border border-rose-200/80 hover:border-rose-300 text-xs font-semibold cursor-pointer transition-colors shadow-2xs"
              title="Clear all active filters (ESC)"
            >
              <RotateCcw className="w-3 h-3 text-rose-600" />
              <span>Clear Filters</span>
              <kbd className="hidden sm:inline text-[9.5px] font-mono px-1 py-0.2 bg-white rounded border border-rose-200 text-rose-500 ml-0.5">
                ESC
              </kbd>
            </motion.button>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

export default SuperAdminFilterBar;
