import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BarChart3,
  ChevronDown,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  ArrowRight
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SORT_OPTIONS = [
  { key: 'total', label: 'Total Appointments' },
  { key: 'completed', label: 'Completed' },
  { key: 'success', label: 'Success Rate' },
  { key: 'revenue', label: 'Revenue' }
];

/**
 * Mini SVG Sparkline Component
 */
const ClinicSparkline = ({ data = [], color = '#2563EB', width = 76, height = 24 }) => {
  if (!data || data.length < 2) {
    return (
      <svg width={width} height={height} className="overflow-visible">
        <line x1="0" y1={height / 2} x2={width} y2={height / 2} stroke={color} strokeWidth="1.5" strokeDasharray="3 3" />
      </svg>
    );
  }

  const values = data.map(d => (typeof d === 'number' ? d : d.successRate || d.appointments || 0));
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values.map((val, idx) => {
    const x = (idx / (values.length - 1)) * width;
    const y = height - ((val - min) / range) * (height - 6) - 3;
    return `${x},${y}`;
  });

  const pathD = `M ${points.join(' L ')}`;

  return (
    <svg width={width} height={height} className="overflow-visible shrink-0">
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
};

/**
 * CareFlowClinicComparisonBoard
 *
 * Compact modern ranked clinic comparison board inspired by media_1789385233044.jpg.
 * Supports:
 * - Real-time sorting by Total Appointments, Completed, Success Rate, and Revenue
 * - Smooth Framer Motion layout reordering animations
 * - Cross-chart hover and click-to-filter synchronization
 * - Horizontal proportional volume progress bars
 * - Native 6M SVG sparkline trends per clinic
 */
export const CareFlowClinicComparisonBoard = ({
  clinics = [],
  selectedFacility = null,
  onFacilityClick = null,
  hoveredFacility = null,
  onFacilityHover = null,
  className = ''
}) => {
  const [sortKey, setSortKey] = useState('total');
  const navigate = useNavigate();

  // Sort clinics based on active sort criterion
  const sortedClinics = useMemo(() => {
    if (!clinics || clinics.length === 0) return [];
    const list = [...clinics];

    return list.sort((a, b) => {
      if (sortKey === 'completed') {
        return (b.completedAppointments || 0) - (a.completedAppointments || 0);
      }
      if (sortKey === 'success') {
        const rateA = a.latestSuccessRate || a.overallSuccessRate || 0;
        const rateB = b.latestSuccessRate || b.overallSuccessRate || 0;
        return rateB - rateA;
      }
      if (sortKey === 'revenue') {
        return (b.revenue || 0) - (a.revenue || 0);
      }
      // default: total
      return (b.totalAppointments || 0) - (a.totalAppointments || 0);
    });
  }, [clinics, sortKey]);

  // Find max appointment volume for proportional bars
  const maxVolume = useMemo(() => {
    if (!clinics.length) return 1;
    return Math.max(...clinics.map(c => c.totalAppointments || 1));
  }, [clinics]);

  const matchesClinic = (targetName, clinic) => {
    if (!targetName || !clinic) return false;
    const t = targetName.toLowerCase().trim();
    const cName = (clinic.name || '').toLowerCase().trim();
    const sName = (clinic.shortName || '').toLowerCase().trim();
    return t === cName || t === sName || cName.includes(t) || t.includes(cName) || sName.includes(t) || t.includes(sName);
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative isolate overflow-hidden ${className}`}>
      {/* 1. Header */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Appointments by Clinic
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Compare total appointment volume and growth
              </p>
            </div>
          </div>

          {/* Sort Selector */}
          <div className="flex items-center gap-1.5">
            <span className="text-[11px] font-medium text-slate-400">Sort by</span>
            <div className="relative">
              <select
                value={sortKey}
                onChange={(e) => setSortKey(e.target.value)}
                className="appearance-none pl-2.5 pr-6 py-1 text-[11px] font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-lg cursor-pointer focus:outline-none focus:ring-1 focus:ring-blue-500"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.key} value={opt.key}>{opt.label}</option>
                ))}
              </select>
              <ChevronDown className="w-3 h-3 text-slate-400 absolute right-1.5 top-2 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* 2. Column Headers matching Image 1 */}
        <div className="grid grid-cols-12 gap-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-2.5 px-2 border-b border-slate-100">
          <div className="col-span-1">#</div>
          <div className="col-span-4">Clinic</div>
          <div className="col-span-3">Total Appointments</div>
          <div className="col-span-2 text-center">Growth (vs prev. 6M)</div>
          <div className="col-span-2 text-right">Success Rate</div>
        </div>

        {/* 3. Ranked Clinic Rows (Animated with Framer Motion layout) */}
        <div className="divide-y divide-slate-50 mt-1">
          {sortedClinics.map((clinic, idx) => {
            const isSelected = matchesClinic(selectedFacility, clinic);
            const isHovered = matchesClinic(hoveredFacility, clinic);
            const rate = clinic.latestSuccessRate || clinic.overallSuccessRate || 85;
            const growth = clinic.growthVsPreviousPeriod ?? (12 - idx * 2);
            const isPositive = growth >= 0;
            const barWidthPercent = Math.max(14, Math.round(((clinic.totalAppointments || 1) / maxVolume) * 100));

            return (
              <motion.div
                key={clinic.clinicId || clinic.name}
                data-clinic-row={clinic.shortName || clinic.name}
                layout
                transition={{ duration: 0.28, ease: 'easeInOut' }}
                onClick={() => {
                  if (onFacilityClick) {
                    onFacilityClick(clinic.shortName || clinic.name);
                  }
                }}
                onMouseEnter={() => onFacilityHover && onFacilityHover(clinic.shortName || clinic.name)}
                onMouseLeave={() => onFacilityHover && onFacilityHover(null)}
                className={`grid grid-cols-12 gap-2 items-center py-2.5 px-2 rounded-xl cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/90 border border-blue-200/80 shadow-2xs ring-1 ring-blue-300'
                    : isHovered
                    ? 'bg-slate-100/80'
                    : 'hover:bg-slate-50/70'
                }`}
              >
                {/* Rank Number */}
                <div className="col-span-1 text-xs font-bold text-slate-400">
                  {idx + 1}
                </div>

                {/* Clinic Circular Icon + Short Name matching Image 1 */}
                <div className="col-span-4 flex items-center gap-2.5 truncate pr-1">
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 border border-white shadow-xs"
                    style={{ backgroundColor: clinic.color, color: '#FFFFFF' }}
                  >
                    <Building2 className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-bold text-slate-800 truncate" title={clinic.name}>
                    {clinic.shortName || clinic.name}
                  </span>
                </div>

                {/* Total Appointments with Horizontal Bar */}
                <div className="col-span-3 pr-2">
                  <div className="flex items-center justify-between text-[11px] font-bold text-slate-800 mb-1">
                    <span>{(clinic.totalAppointments || 0).toLocaleString()}</span>
                  </div>
                  <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${barWidthPercent}%` }}
                      transition={{ duration: 0.5, delay: idx * 0.04 }}
                      className="h-full rounded-full"
                      style={{ backgroundColor: clinic.color }}
                    />
                  </div>
                </div>

                {/* Growth % vs Previous Period */}
                <div className="col-span-2 flex items-center justify-center">
                  <span
                    className={`inline-flex items-center gap-0.5 text-[11px] font-bold px-1.5 py-0.5 rounded-md ${
                      isPositive
                        ? 'text-emerald-700 bg-emerald-50'
                        : 'text-rose-700 bg-rose-50'
                    }`}
                  >
                    {isPositive ? (
                      <ArrowUpRight className="w-3 h-3 text-emerald-600 shrink-0" />
                    ) : (
                      <ArrowDownRight className="w-3 h-3 text-rose-600 shrink-0" />
                    )}
                    <span>{Math.abs(growth)}%</span>
                  </span>
                </div>

                {/* Success Rate & Mini Sparkline */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <span className="text-xs font-bold text-slate-800">
                    {rate}%
                  </span>
                  <ClinicSparkline
                    data={clinic.monthly || []}
                    color={clinic.color}
                    width={48}
                    height={18}
                  />
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>

      {/* 4. Footer Link */}
      <div className="pt-3 mt-3 border-t border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-medium text-slate-400">
          Showing all {sortedClinics.length} clinical tenants
        </span>
        <button
          type="button"
          onClick={() => navigate('/super-admin/organizations')}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-800 transition-colors cursor-pointer"
        >
          <span>View All Clinics</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

export default CareFlowClinicComparisonBoard;
