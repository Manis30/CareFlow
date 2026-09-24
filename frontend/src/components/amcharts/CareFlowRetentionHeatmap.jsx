import React from 'react';
import { motion } from 'framer-motion';
import { CLINICAL_TOKENS } from './amchartsTheme';

/**
 * CareFlowRetentionHeatmap
 * 
 * Longitudinal Patient Cohort Retention Matrix.
 * Maps Signup Month x Month Offset (M+0, M+1, M+2, M+3, M+4, M+5) with #2563EB monochromatic scale.
 * 
 * @param {Object} data - { cohorts: [], offsets: [], matrix: [] }
 */
export function CareFlowRetentionHeatmap({
  data = { cohorts: [], offsets: [], matrix: [] },
  title = 'Longitudinal Patient Cohort Retention',
  subtitle = 'Percentage of registered patient cohorts maintaining clinical encounter activity over trailing months',
  className = ''
}) {
  const cohorts = data?.cohorts || [];
  const offsets = data?.offsets || ['M+0', 'M+1', 'M+2', 'M+3', 'M+4', 'M+5'];
  const matrix = data?.matrix || [];

  // Helper to get item from matrix
  const getCellData = (cohort, offset) => {
    return matrix.find((m) => m.cohort === cohort && m.offset === offset);
  };

  // Color intensity calculator for #2563EB scale
  const getCellBg = (rate) => {
    if (rate === 0) return '#F8FAFC';
    if (rate >= 80) return '#1D4ED8'; // Deep royal blue
    if (rate >= 60) return '#2563EB'; // Primary brand blue
    if (rate >= 40) return '#3B82F6'; // Medium blue
    if (rate >= 20) return '#60A5FA'; // Light blue
    if (rate > 0) return '#93C5FD'; // Soft blue
    return '#EFF6FF';
  };

  const getTextColor = (rate) => {
    return rate >= 40 ? '#FFFFFF' : '#1E293B';
  };

  if (!cohorts.length) {
    return (
      <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans ${className}`}>
        <h3 className="text-sm font-semibold text-slate-900 tracking-tight">{title}</h3>
        <p className="text-xs text-slate-400 py-8 text-center">Patient cohort history aggregating...</p>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        {/* Legend */}
        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
          <span className="text-[11px] text-slate-400 mr-1">Retention:</span>
          <span className="w-3.5 h-3 rounded-xs bg-[#EFF6FF] border border-slate-200" />
          <span className="text-[10px]">0%</span>
          <span className="w-3.5 h-3 rounded-xs bg-[#93C5FD]" />
          <span className="w-3.5 h-3 rounded-xs bg-[#60A5FA]" />
          <span className="w-3.5 h-3 rounded-xs bg-[#3B82F6]" />
          <span className="w-3.5 h-3 rounded-xs bg-[#2563EB]" />
          <span className="w-3.5 h-3 rounded-xs bg-[#1D4ED8]" />
          <span className="text-[10px]">100%</span>
        </div>
      </div>

      {/* 2D Retention Table Grid */}
      <div className="overflow-x-auto">
        <table className="w-full text-xs text-left border-collapse">
          <thead>
            <tr className="border-b border-slate-100">
              <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] w-28">
                Cohort
              </th>
              <th className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] w-20 text-center">
                Size
              </th>
              {offsets.map((offset) => (
                <th
                  key={offset}
                  className="py-2.5 px-3 font-semibold text-slate-500 uppercase tracking-wider text-[10px] text-center"
                >
                  {offset}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {cohorts.map((cohortName, rowIdx) => {
              const rowData0 = getCellData(cohortName, 'M+0');
              const cohortSize = rowData0?.cohortSize || '—';

              return (
                <tr key={cohortName} className="hover:bg-slate-50/50 transition-colors">
                  <td className="py-2.5 px-3 font-semibold text-slate-800">
                    {cohortName}
                  </td>
                  <td className="py-2.5 px-3 text-slate-500 text-center font-medium">
                    {cohortSize}
                  </td>
                  {offsets.map((offset, colIdx) => {
                    const cell = getCellData(cohortName, offset);
                    const rate = cell ? cell.retentionRate : null;

                    if (rate === null || rate === undefined) {
                      return (
                        <td key={offset} className="py-1.5 px-1.5 text-center">
                          <div className="h-8 rounded-md bg-slate-50 border border-slate-100 flex items-center justify-center text-slate-300">
                            —
                          </div>
                        </td>
                      );
                    }

                    const bg = getCellBg(rate);
                    const textColor = getTextColor(rate);

                    return (
                      <td key={offset} className="py-1.5 px-1.5 text-center">
                        <motion.div
                          initial={{ opacity: 0, scale: 0.95 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ duration: 0.2, delay: (rowIdx * 6 + colIdx) * 0.02 }}
                          className="h-8 rounded-md flex items-center justify-center font-semibold text-xs shadow-2xs transition-transform hover:scale-105 cursor-default relative group"
                          style={{ backgroundColor: bg, color: textColor }}
                        >
                          <span>{rate}%</span>

                          {/* Hover Tooltip */}
                          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 hidden group-hover:block z-20 pointer-events-none">
                            <div className="bg-slate-900 text-white text-[10px] font-medium py-1 px-2 rounded shadow-md whitespace-nowrap">
                              {cohortName} ({offset}): {cell?.activeCount} of {cell?.cohortSize} patients ({rate}%)
                            </div>
                          </div>
                        </motion.div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default CareFlowRetentionHeatmap;
