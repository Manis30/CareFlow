import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Target, TrendingUp, TrendingDown, Building2, CheckCircle2, ChevronRight, X } from 'lucide-react';
import { useReducedMotion } from '../../hooks/useReducedMotion';

/**
 * CareFlowBenchmarkList
 * Replaces redundant single benchmark and radial gauge.
 * Displays horizontal bullet rows comparing each facility's completed consultation rate
 * against a live, dynamically computed platform cohort median (zero hardcoding).
 */
export const CareFlowBenchmarkList = ({
  clinics = [],
  title = 'Facility Case Fulfillment Benchmark',
  subtitle = 'Clinic completion rates evaluated against dynamic platform cohort median',
  activeClinicFilter = null,
  onClinicClick = null,
  height = 320,
  className = ''
}) => {
  const prefersReduced = useReducedMotion();

  // Process clinic metrics
  const processedClinics = useMemo(() => {
    if (!clinics || clinics.length === 0) return [];

    return clinics.map((clinic, idx) => {
      const id = String(clinic._id || clinic.id || `clinic-${idx}`);
      const name = clinic.name || 'Healthcare Facility';
      const district = clinic.district || clinic.city || '';
      const total = Number(clinic.appointmentCount || clinic.totalAppointments || clinic.total || 0);
      const completed = Number(clinic.completedCount || clinic.completedAppointments || clinic.completed || 0);
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const doctors = Number(clinic.doctorCount || clinic.doctors || 0);

      return {
        id,
        name,
        district,
        total,
        completed,
        rate,
        doctors,
        raw: clinic
      };
    });
  }, [clinics]);

  // Compute live dynamic platform median (zero hardcoding)
  const platformMedian = useMemo(() => {
    if (processedClinics.length === 0) return 0;
    const rates = processedClinics.map((c) => c.rate).sort((a, b) => a - b);
    const mid = Math.floor(rates.length / 2);
    return rates.length % 2 !== 0
      ? rates[mid]
      : Math.round((rates[mid - 1] + rates[mid]) / 2);
  }, [processedClinics]);

  // Sort clinics by completion rate descending
  const sortedClinics = useMemo(() => {
    return [...processedClinics].sort((a, b) => b.rate - a.rate);
  }, [processedClinics]);

  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}
      style={{ minHeight: height }}
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>

        {/* Dynamic Median Badge */}
        <div className="flex items-center gap-2">
          <div className="px-2.5 py-1 rounded-lg bg-slate-100 border border-slate-200/70 text-right">
            <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block">
              Cohort Median
            </span>
            <span className="text-xs font-extrabold text-slate-900 font-mono">
              {platformMedian}%
            </span>
          </div>
          {activeClinicFilter && (
            <button
              type="button"
              onClick={() => onClinicClick && onClinicClick(null)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-2 py-1 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-3 h-3" /> Clear
            </button>
          )}
        </div>
      </div>

      {/* Benchmarks List */}
      {sortedClinics.length === 0 ? (
        <div className="py-12 text-center text-xs text-slate-400 font-medium">
          No clinic completion data available.
        </div>
      ) : (
        <div className="space-y-3 overflow-y-auto pr-1 flex-1">
          {sortedClinics.map((clinic, idx) => {
            const isSelected =
              activeClinicFilter &&
              (activeClinicFilter.toLowerCase() === clinic.name.toLowerCase() ||
                activeClinicFilter === clinic.id);
            const delta = clinic.rate - platformMedian;
            const isAboveOrEqual = delta >= 0;

            const MotionWrapper = prefersReduced ? 'div' : motion.div;
            const motionProps = prefersReduced
              ? {}
              : {
                  initial: { opacity: 0, x: -10 },
                  animate: { opacity: 1, x: 0 },
                  transition: { duration: 0.3, delay: idx * 0.04 }
                };

            return (
              <MotionWrapper
                key={clinic.id}
                {...motionProps}
                onClick={() => onClinicClick && onClinicClick(clinic.raw || clinic)}
                className={`group p-2.5 rounded-xl border transition-all cursor-pointer ${
                  isSelected
                    ? 'bg-blue-50/80 border-blue-400 ring-2 ring-blue-500/20 shadow-xs'
                    : 'bg-white border-slate-200/70 hover:bg-slate-50/80 hover:border-slate-300'
                }`}
              >
                {/* Meta Row */}
                <div className="flex items-center justify-between gap-3 text-xs mb-1.5">
                  <div className="flex items-center gap-2 truncate">
                    <span className="w-4 text-center font-mono text-[10px] font-bold text-slate-400">
                      {idx + 1}
                    </span>
                    <span className="font-bold text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                      {clinic.name}
                    </span>
                    {clinic.district && (
                      <span className="text-[10px] text-slate-400 font-medium shrink-0">
                        • {clinic.district}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] text-slate-500 font-medium">
                      {clinic.completed}/{clinic.total} visits
                    </span>
                    <span className="font-extrabold text-slate-900 font-mono text-xs">
                      {clinic.rate}%
                    </span>

                    {/* Delta Pill vs Dynamic Platform Median */}
                    <span
                      className={`inline-flex items-center gap-0.5 text-[10px] font-bold px-1.5 py-0.5 rounded-md border ${
                        isAboveOrEqual
                          ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}
                    >
                      {isAboveOrEqual ? (
                        <TrendingUp className="w-2.5 h-2.5 text-emerald-600" />
                      ) : (
                        <TrendingDown className="w-2.5 h-2.5 text-amber-600" />
                      )}
                      <span>{isAboveOrEqual ? `+${delta}%` : `${delta}%`}</span>
                    </span>
                  </div>
                </div>

                {/* Horizontal Bullet Track */}
                <div className="relative w-full h-3 bg-slate-100 rounded-full overflow-hidden border border-slate-200/60">
                  {/* Realized Completion Bar */}
                  <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${
                      isSelected
                        ? 'bg-gradient-to-r from-blue-600 to-indigo-600'
                        : isAboveOrEqual
                        ? 'bg-gradient-to-r from-blue-500 to-emerald-500'
                        : 'bg-gradient-to-r from-blue-400 to-amber-400'
                    }`}
                    style={{ width: `${Math.min(100, Math.max(2, clinic.rate))}%` }}
                  />

                  {/* Dynamic Platform Median Guideline */}
                  {platformMedian > 0 && (
                    <div
                      className="absolute top-0 bottom-0 w-0.5 bg-slate-800 z-10"
                      style={{ left: `${platformMedian}%` }}
                      title={`Dynamic Platform Median: ${platformMedian}%`}
                    />
                  )}
                </div>
              </MotionWrapper>
            );
          })}
        </div>
      )}

      {/* Footer Support Info */}
      <div className="pt-2.5 mt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Showing {sortedClinics.length} healthcare facilities</span>
        <span className="text-blue-600 font-semibold flex items-center gap-1">
          Click row to filter dashboard <ChevronRight className="w-3 h-3" />
        </span>
      </div>
    </div>
  );
};

export default CareFlowBenchmarkList;
