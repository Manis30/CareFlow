import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Award, ArrowUpDown, ChevronRight, Stethoscope } from 'lucide-react';

/**
 * CareFlowPerformanceBoard
 * 
 * Upgraded Clinical Leaderboard:
 * Uses Framer Motion layout animations for smooth reordering when switching sorting criteria.
 */
export const CareFlowPerformanceBoard = ({
  doctors = [],
  onDoctorClick = null,
  className = ''
}) => {
  const [metric, setMetric] = useState('completed'); // 'completed' | 'total' | 'rate'

  const sortedDoctors = useMemo(() => {
    if (!doctors || doctors.length === 0) return [];

    const list = doctors.map((doc) => {
      const total = doc.stats?.appointmentsCount || 0;
      const completed = doc.stats?.completedCount || 0;
      const rate = total > 0 ? Math.round((completed / total) * 100) : 0;
      const fee = doc.consultationFee || 500;
      const revenue = completed * fee;

      return {
        id: doc._id,
        name: doc.userId?.name || 'Dr. Specialist',
        specialization: doc.specialization || doc.departmentId?.name || 'General Medicine',
        orgName: doc.organizationId?.name || 'CareFlow Facility',
        profileImage: doc.userId?.profileImage?.url,
        total,
        completed,
        rate,
        revenue,
        raw: doc
      };
    });

    return list.sort((a, b) => {
      if (metric === 'rate') return b.rate - a.rate;
      if (metric === 'total') return b.total - a.total;
      return b.completed - a.completed;
    }).slice(0, 10);
  }, [doctors, metric]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Award className="w-4 h-4 text-amber-500" />
            Clinical Practitioner Performance Board
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Ranked practitioner consultation fulfillment & throughput
          </p>
        </div>

        {/* Metric Toggles */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setMetric('completed')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              metric === 'completed' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Completed Visits
          </button>
          <button
            type="button"
            onClick={() => setMetric('rate')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              metric === 'rate' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Fulfillment %
          </button>
          <button
            type="button"
            onClick={() => setMetric('total')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              metric === 'total' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            Total Scheduled
          </button>
        </div>
      </div>

      {/* Animated Reordering List with Framer Motion layout */}
      <div className="space-y-2">
        {sortedDoctors.map((doc, idx) => (
          <motion.div
            key={doc.id}
            layout
            transition={{ type: 'spring', stiffness: 280, damping: 26 }}
            onClick={() => onDoctorClick && onDoctorClick(doc.raw)}
            className="p-3 rounded-xl border border-slate-100 hover:border-slate-300 hover:shadow-xs bg-slate-50/40 hover:bg-white flex items-center justify-between gap-3 cursor-pointer group transition-colors"
          >
            {/* Rank & Practitioner */}
            <div className="flex items-center gap-3 min-w-0">
              <span className={`w-5 text-center text-xs font-bold ${
                idx === 0 ? 'text-amber-600' :
                idx === 1 ? 'text-slate-500' :
                idx === 2 ? 'text-amber-700' : 'text-slate-400'
              }`}>
                #{idx + 1}
              </span>

              <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-blue-100">
                {doc.profileImage ? (
                  <img src={doc.profileImage} alt={doc.name} className="w-full h-full object-cover" />
                ) : (
                  doc.name.replace('Dr. ', '').charAt(0)
                )}
              </div>

              <div className="min-w-0">
                <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                  {doc.name}
                </h4>
                <p className="text-[11px] text-slate-500 truncate">
                  {doc.specialization} • <span className="text-slate-400">{doc.orgName}</span>
                </p>
              </div>
            </div>

            {/* Score & Progress */}
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <span className="text-xs font-bold text-slate-900">
                  {metric === 'rate'
                    ? `${doc.rate}%`
                    : metric === 'total'
                    ? `${doc.total} appts`
                    : `${doc.completed} visits`}
                </span>
                <p className="text-[10px] text-slate-400">
                  {doc.completed}/{doc.total} fulfilled
                </p>
              </div>

              <ChevronRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors" />
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
};

export default CareFlowPerformanceBoard;
