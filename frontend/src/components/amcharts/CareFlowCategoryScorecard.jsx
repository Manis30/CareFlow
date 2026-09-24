import React from 'react';
import { motion } from 'framer-motion';
import { Activity, Users, ArrowUpRight, CheckCircle2, AlertTriangle, AlertCircle } from 'lucide-react';
import { CLINICAL_TOKENS } from './amchartsTheme';

/**
 * CareFlowCategoryScorecard
 * 
 * Unified radial donut completion ring scorecard grid.
 * Replaces CareFlowSpecialtyMatrix and CareFlowDepartmentGrid across both Super Admin and Org Admin portals.
 * 
 * Thresholds:
 *  - Optimal: >= 85% (#10B981)
 *  - Monitor: 75% - 84% (#F59E0B)
 *  - Attention: < 75% (#EF4444)
 */
export function CareFlowCategoryScorecard({
  items = [],
  title = 'Clinical Category Operational Intelligence',
  subtitle = 'Workload throughput, completion realization, and clinician staffing by clinical discipline',
  selectedCategory = null,
  onCategoryClick = null,
  benchmark = 85,
  benchmarkLabel = 'Target Benchmark',
  showActions = false,
  onEdit = null,
  onDelete = null,
  onInspectRoster = null,
  className = ''
}) {
  const getStatus = (rate) => {
    if (rate >= 85) {
      return {
        label: 'Optimal Flow',
        color: CLINICAL_TOKENS.success,
        bgClass: 'bg-emerald-50 text-emerald-700 border-emerald-200/80',
        icon: CheckCircle2
      };
    }
    if (rate >= 75) {
      return {
        label: 'Monitor',
        color: CLINICAL_TOKENS.warning,
        bgClass: 'bg-amber-50 text-amber-700 border-amber-200/80',
        icon: AlertTriangle
      };
    }
    return {
      label: 'Attention Needed',
      color: CLINICAL_TOKENS.danger,
      bgClass: 'bg-rose-50 text-rose-700 border-rose-200/80',
      icon: AlertCircle
    };
  };

  return (
    <div className={`space-y-4 font-sans ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
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

        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.success }} />
            <span>Optimal (≥85%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.warning }} />
            <span>Monitor (75-84%)</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.danger }} />
            <span>Attention (&lt;75%)</span>
          </span>
        </div>
      </div>

      {/* Grid of Category Scorecard Tiles */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.map((cat, idx) => {
          const name = cat.name || cat.specialization || 'General Practice';
          const doctorCount = cat.doctorCount || cat.doctorsCount || 0;
          const appointmentCount = cat.appointmentCount || cat.appointmentsCount || cat.value || 0;
          const completedCount = cat.completedCount || 0;

          const completionRate = appointmentCount > 0
            ? Math.round((completedCount / appointmentCount) * 100)
            : (cat.completionRate || 85);

          const status = getStatus(completionRate);
          const isSelected = selectedCategory && selectedCategory.toLowerCase() === name.toLowerCase();

          // Donut SVG Math
          const radius = 22;
          const circumference = 2 * Math.PI * radius;
          const strokeDashoffset = circumference - (completionRate / 100) * circumference;

          return (
            <motion.div
              key={cat._id || cat.id || name || idx}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25, delay: idx * 0.04 }}
              onClick={() => onCategoryClick && onCategoryClick(cat)}
              className={`relative rounded-xl border p-4 bg-white transition-all duration-150 flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-100 shadow-sm'
                  : 'border-slate-200/80 shadow-xs hover:border-slate-300 hover:shadow-sm'
              } ${onCategoryClick ? 'cursor-pointer' : ''}`}
            >
              {/* Tile Header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                    {name}
                  </h4>
                  <p className="text-[11px] text-slate-400 font-medium">
                    Clinical Discipline
                  </p>
                </div>

                <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold border ${status.bgClass}`}>
                  <status.icon className="w-3 h-3" />
                  <span>{status.label}</span>
                </span>
              </div>

              {/* Middle Row: Radial Donut + Metrics */}
              <div className="flex items-center justify-between gap-4 py-2 border-y border-slate-100/80 my-2">
                {/* Donut Ring Meter */}
                <div className="flex items-center gap-3">
                  <div className="relative w-14 h-14 shrink-0 flex items-center justify-center">
                    <svg className="w-14 h-14 -rotate-90 transform" viewBox="0 0 54 54">
                      {/* Background track */}
                      <circle
                        cx="27"
                        cy="27"
                        r={radius}
                        stroke="#E2E8F0"
                        strokeWidth="4"
                        fill="transparent"
                      />
                      {/* Animated completion stroke */}
                      <motion.circle
                        cx="27"
                        cy="27"
                        r={radius}
                        stroke={status.color}
                        strokeWidth="4"
                        strokeDasharray={circumference}
                        initial={{ strokeDashoffset: circumference }}
                        animate={{ strokeDashoffset }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: idx * 0.05 }}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <span className="absolute text-[11px] font-bold text-slate-800">
                      {completionRate}%
                    </span>
                  </div>

                  <div>
                    <div className="text-[11px] font-semibold text-slate-700 uppercase tracking-wider">
                      Fulfillment
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium">
                      {benchmarkLabel}: {benchmark}%
                    </div>
                  </div>
                </div>

                {/* Right Side Volume & Staffing */}
                <div className="text-right space-y-1">
                  <div>
                    <span className="text-xs text-slate-400 font-medium">Volume: </span>
                    <span className="text-sm font-bold text-slate-900">{appointmentCount}</span>
                  </div>
                  <div className="text-[11px] text-slate-500 font-medium flex items-center justify-end gap-1">
                    <Users className="w-3 h-3 text-blue-600" />
                    <span>{doctorCount} {doctorCount === 1 ? 'Clinician' : 'Clinicians'}</span>
                  </div>
                </div>
              </div>

              {/* Bottom Row / Actions */}
              <div className="flex items-center justify-between pt-1 text-xs">
                {showActions ? (
                  <div className="flex items-center gap-2 w-full justify-between">
                    <div className="flex items-center gap-2 text-slate-500">
                      {onEdit && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onEdit(cat); }}
                          className="hover:text-blue-600 font-medium text-[11px] cursor-pointer"
                        >
                          Edit
                        </button>
                      )}
                      {onDelete && (
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); onDelete(cat); }}
                          className="hover:text-rose-600 font-medium text-[11px] cursor-pointer"
                        >
                          Delete
                        </button>
                      )}
                    </div>
                    {onInspectRoster && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); onInspectRoster(cat); }}
                        className="text-blue-600 hover:text-blue-800 font-semibold text-[11px] flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>Inspect Roster</span>
                        <ArrowUpRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="w-full flex items-center justify-between text-[11px] text-slate-400">
                    <span>{completedCount} concluded</span>
                    <span className="text-blue-600 font-semibold cursor-pointer flex items-center gap-0.5">
                      Filter cases →
                    </span>
                  </div>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

export default CareFlowCategoryScorecard;
