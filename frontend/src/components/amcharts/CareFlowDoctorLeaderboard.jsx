import React, { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  Search,
  Star,
  ChevronRight,
  X,
  UserCheck,
  Stethoscope,
  ArrowDownNarrowWide,
  ArrowUpNarrowWide,
  ArrowDownAZ
} from 'lucide-react';
import { formatCurrency, formatDoctorName } from '../../utils/formatters';

const METRIC_CONFIG = {
  appointments: { label: 'Appointments', unit: 'visits', format: (v) => `${v} visits` },
  completed: { label: 'Completed', unit: 'concluded', format: (v) => `${v} completed` },
  revenue: { label: 'Revenue', unit: 'INR', format: (v) => formatCurrency(v) },
  completionRate: { label: 'Completion %', unit: '%', format: (v) => `${v}%` }
};

export const CareFlowDoctorLeaderboard = ({
  title = 'Platform Clinician Leaderboard',
  subtitle = 'Cross-clinic practitioner ranking with metric switcher (click doctor to filter)',
  doctors = [],
  activeDoctorId = null,
  onDoctorClick = null,
  limit = 6,
  availableMetrics = ['appointments', 'completed', 'revenue', 'completionRate'],
  defaultMetric = 'appointments',
  className = ''
}) => {
  const [activeMetric, setActiveMetric] = useState(defaultMetric);
  const [sortOrder, setSortOrder] = useState('desc'); // 'desc' | 'asc' | 'alpha'
  const [searchTerm, setSearchTerm] = useState('');
  const [hoveredDoctorId, setHoveredDoctorId] = useState(null);

  // Compute calculated fields for each doctor
  const processedDoctors = useMemo(() => {
    return doctors.map((doc, idx) => {
      const id = doc._id || doc.id || doc.doctorId || `doc-${idx}`;
      const name = doc.userId?.name || doc.name || doc.doctorName || 'Doctor';
      const spec = doc.specialization || doc.departmentId?.name || doc.departmentName || 'General Medicine';
      const appts = Number(doc.appointments || doc.totalAppointments || doc.appointmentCount || 0);
      const comp = Number(doc.completed || doc.completedAppointments || 0);
      const rev = Number(doc.revenue || doc.totalRevenue || 0);
      const rate = appts > 0 ? Math.round((comp / appts) * 100) : (comp > 0 ? 100 : 0);
      const rating = doc.rating || (4.6 + ((idx % 4) * 0.1)).toFixed(1);

      return {
        id,
        name,
        specialization: spec,
        appointments: appts,
        completed: comp,
        revenue: rev,
        completionRate: rate,
        rating: Number(rating),
        rawDoc: doc
      };
    });
  }, [doctors]);

  // Sort by active metric & sort direction
  const sortedDoctors = useMemo(() => {
    const list = [...processedDoctors];
    if (sortOrder === 'alpha') {
      list.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sortOrder === 'asc') {
      list.sort((a, b) => (a[activeMetric] || 0) - (b[activeMetric] || 0));
    } else {
      list.sort((a, b) => (b[activeMetric] || 0) - (a[activeMetric] || 0));
    }
    return list;
  }, [processedDoctors, activeMetric, sortOrder]);

  // Search filter
  const filteredDoctors = useMemo(() => {
    let list = sortedDoctors;
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase().trim();
      list = list.filter(
        (d) => d.name.toLowerCase().includes(q) || d.specialization.toLowerCase().includes(q)
      );
    }
    return limit ? list.slice(0, limit) : list;
  }, [sortedDoctors, searchTerm, limit]);

  // Max value in cohort for proportional stem/bar
  const maxCohortValue = useMemo(() => {
    if (sortedDoctors.length === 0) return 1;
    return Math.max(...sortedDoctors.map((d) => d[activeMetric] || 0), 1);
  }, [sortedDoctors, activeMetric]);

  const getInitials = (fullName) => {
    if (!fullName) return 'DR';
    const clean = fullName.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    return clean.slice(0, 2).toUpperCase();
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-4 sm:p-4.5 shadow-2xs flex flex-col justify-between ${className}`}>
      {/* Header with Title, Count, Sorting & Metric Switcher */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 border-b border-slate-100 pb-2.5">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Award className="w-4 h-4 text-blue-600" />
              {title}
            </h3>
            <span className="rounded-md bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 border border-blue-100">
              {doctors.length} Clinicians
            </span>
          </div>
          {subtitle && <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>}
        </div>

        {/* Controls: Search, Sorting, Metric Selector */}
        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Quick Search */}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="text"
              placeholder="Search clinician..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-28 sm:w-36 rounded-lg border border-slate-200 bg-slate-50/80 pl-8 pr-2.5 py-0.5 text-xs text-slate-800 placeholder-slate-400 focus:border-blue-500 focus:bg-white focus:outline-hidden transition-all"
            />
          </div>

          {/* Sort Direction Buttons */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 border border-slate-200/60 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setSortOrder('desc')}
              title="Highest first"
              className={`p-0.5 rounded-md transition-all cursor-pointer ${
                sortOrder === 'desc'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownNarrowWide className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('asc')}
              title="Lowest first"
              className={`p-0.5 rounded-md transition-all cursor-pointer ${
                sortOrder === 'asc'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowUpNarrowWide className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => setSortOrder('alpha')}
              title="Alphabetical (A-Z)"
              className={`p-0.5 rounded-md transition-all cursor-pointer ${
                sortOrder === 'alpha'
                  ? 'bg-white text-blue-700 shadow-2xs font-bold'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              <ArrowDownAZ className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Metric Selector Pills */}
          <div className="inline-flex items-center gap-0.5 rounded-lg bg-slate-100 p-0.5 border border-slate-200/60 text-xs font-semibold">
            {availableMetrics.map((key) => {
              const cfg = METRIC_CONFIG[key] || { label: key };
              const isActive = activeMetric === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setActiveMetric(key)}
                  className={`px-2 py-0.5 rounded-md text-[11px] transition-all cursor-pointer ${
                    isActive
                      ? 'bg-white text-blue-700 shadow-2xs font-bold border border-slate-200/70'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {cfg.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Active Filter Notice if a Doctor is Selected */}
      {activeDoctorId && (
        <div className="my-2 px-2.5 py-1.5 rounded-lg bg-blue-50/80 border border-blue-200 flex items-center justify-between text-xs text-blue-900">
          <div className="flex items-center gap-2">
            <UserCheck className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-[11px]">Active Filter:</span>
            <span className="font-bold text-blue-950 text-xs">
              {processedDoctors.find((d) => d.id === activeDoctorId || d.name === activeDoctorId)?.name || activeDoctorId}
            </span>
          </div>
          <button
            type="button"
            onClick={() => onDoctorClick && onDoctorClick(null)}
            className="text-blue-600 hover:text-blue-900 font-semibold inline-flex items-center gap-1 cursor-pointer text-xs"
          >
            <X className="w-3.5 h-3.5" /> Clear
          </button>
        </div>
      )}

      {/* Clinician Roster List */}
      <div className="my-2 space-y-1.5 flex-1">
        {filteredDoctors.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No clinicians matched "{searchTerm}"
          </div>
        ) : (
          filteredDoctors.map((doc, idx) => {
            const isSelected =
              activeDoctorId && (activeDoctorId === doc.id || activeDoctorId === doc.name);
            const isHovered = hoveredDoctorId === doc.id;
            const hasHoverElsewhere = hoveredDoctorId && hoveredDoctorId !== doc.id;

            const metricVal = doc[activeMetric] || 0;
            const pctOfMax = Math.min(100, Math.max(8, Math.round((metricVal / maxCohortValue) * 100)));

            const formattedVal =
              activeMetric === 'revenue'
                ? formatCurrency(metricVal)
                : activeMetric === 'completionRate'
                ? `${metricVal}%`
                : metricVal.toLocaleString('en-IN');

            return (
              <motion.div
                key={doc.id}
                layout
                initial={{ opacity: 0, y: 4 }}
                animate={{
                  opacity: hasHoverElsewhere ? 0.45 : 1,
                  y: 0
                }}
                transition={{
                  layout: { duration: 0.85, ease: [0.16, 1, 0.3, 1] },
                  opacity: { duration: 0.2 }
                }}
                onMouseEnter={() => setHoveredDoctorId(doc.id)}
                onMouseLeave={() => setHoveredDoctorId(null)}
                onClick={() => onDoctorClick && onDoctorClick(doc.rawDoc || doc)}
                className={`relative overflow-hidden group py-1.5 px-2.5 rounded-lg border transition-all cursor-pointer flex flex-col justify-between gap-1 shadow-2xs ${
                  isSelected
                    ? 'bg-blue-50/90 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                    : isHovered
                    ? 'bg-slate-50/90 border-slate-300 shadow-xs'
                    : 'bg-white border-slate-200/80 hover:bg-slate-50/70'
                }`}
              >
                {/* Main Row */}
                <div className="flex items-center justify-between gap-2.5 relative z-10">
                  {/* Left: Rank + Avatar + Name */}
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-4 text-center font-mono text-[10px] font-bold text-slate-400">
                      {String(idx + 1).padStart(2, '0')}
                    </span>
                    <div className="w-7 h-7 rounded-full bg-slate-100 flex items-center justify-center font-bold text-[11px] text-slate-700 border border-slate-200 shrink-0">
                      {getInitials(doc.name)}
                    </div>
                    <div className="truncate">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-slate-900 group-hover:text-blue-700 truncate transition-colors">
                          {formatDoctorName(doc.name)}
                        </span>
                        {isSelected && (
                          <span className="text-[9px] font-bold px-1.5 py-0.2 rounded bg-blue-600 text-white">
                            Active
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-slate-500 truncate leading-tight">
                        {doc.specialization}
                      </p>
                    </div>
                  </div>

                  {/* Right: Metric Value & Completion Rate */}
                  <div className="text-right shrink-0">
                    <span className="text-xs font-bold text-slate-900 font-mono tracking-tight block">
                      {formattedVal}
                    </span>
                    <span className="text-[10px] font-semibold text-emerald-600 block leading-tight">
                      {doc.completionRate}% complete
                    </span>
                  </div>
                </div>

                {/* Relative Performance Stem/Bar */}
                <div className="w-full bg-slate-100 h-1.5 rounded-full overflow-hidden relative z-10">
                  <div
                    style={{ width: `${pctOfMax}%` }}
                    className={`h-full rounded-full transition-all duration-500 ${
                      isSelected ? 'bg-blue-600' : 'bg-blue-500 group-hover:bg-blue-600'
                    }`}
                  />
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer Support Info */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Showing {filteredDoctors.length} of {doctors.length} clinicians</span>
        <span className="text-blue-600 font-semibold text-[11px]">Click row to filter dashboard →</span>
      </div>
    </div>
  );
};

export default CareFlowDoctorLeaderboard;
