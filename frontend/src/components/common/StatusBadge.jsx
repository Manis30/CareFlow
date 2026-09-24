import React from 'react';

const STATUS_STYLES = {
  // Appointment & General Statuses
  booked: { bg: 'bg-blue-50 text-blue-700 border-blue-200/60', label: 'Booked', dot: 'bg-blue-600' },
  scheduled: { bg: 'bg-blue-50 text-blue-700 border-blue-200/60', label: 'Scheduled', dot: 'bg-blue-600' },
  checked_in: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Checked In', dot: 'bg-emerald-500' },
  waiting: { bg: 'bg-amber-50 text-amber-700 border-amber-200/60', label: 'Waiting', dot: 'bg-amber-500' },
  in_progress: { bg: 'bg-sky-50 text-sky-700 border-sky-200/60', label: 'In Consultation', dot: 'bg-sky-500' },
  completed: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Completed', dot: 'bg-emerald-500' },
  cancelled: { bg: 'bg-rose-50 text-rose-700 border-rose-200/60', label: 'Cancelled', dot: 'bg-rose-500' },
  no_show: { bg: 'bg-rose-50 text-rose-700 border-rose-200/60', label: 'No-Show', dot: 'bg-rose-500' },

  // Payment Statuses
  pending: { bg: 'bg-amber-50 text-amber-700 border-amber-200/60', label: 'Pending', dot: 'bg-amber-500' },
  paid: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Paid', dot: 'bg-emerald-500' },
  failed: { bg: 'bg-rose-50 text-rose-700 border-rose-200/60', label: 'Failed', dot: 'bg-rose-500' },

  // Organization & Account Statuses
  approved: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Approved', dot: 'bg-emerald-500' },
  active: { bg: 'bg-emerald-50 text-emerald-700 border-emerald-200/60', label: 'Active', dot: 'bg-emerald-500' },
  inactive: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Inactive', dot: 'bg-slate-400' },
  rejected: { bg: 'bg-rose-50 text-rose-700 border-rose-200/60', label: 'Rejected', dot: 'bg-rose-500' },
  suspended: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Suspended', dot: 'bg-slate-400' },

  // Consultation Modes
  online: { bg: 'bg-blue-50 text-blue-700 border-blue-200/60', label: 'Online Consultation', dot: 'bg-blue-600' },
  offline: { bg: 'bg-slate-100 text-slate-700 border-slate-200', label: 'In-Clinic', dot: 'bg-slate-500' },

  // Record Access
  shared: { bg: 'bg-blue-50 text-blue-700 border-blue-200/60', label: 'Shared Record', dot: 'bg-blue-600' },
  private: { bg: 'bg-slate-100 text-slate-600 border-slate-200', label: 'Private Record', dot: 'bg-slate-400' }
};

export const StatusBadge = ({ status, className = '' }) => {
  const normalizedKey = status ? String(status).toLowerCase().replace(/[\s-]/g, '_') : 'pending';
  const config = STATUS_STYLES[normalizedKey] || {
    bg: 'bg-slate-100 text-slate-600 border-slate-200',
    label: status || 'Unknown',
    dot: 'bg-slate-400'
  };

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border ${config.bg} ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${config.dot}`} aria-hidden="true" />
      <span>{config.label}</span>
    </span>
  );
};

export default StatusBadge;
