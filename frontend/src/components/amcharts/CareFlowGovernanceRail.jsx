import React from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, Clock, ShieldAlert } from 'lucide-react';
import CareFlowLivePulse from '../common/CareFlowLivePulse';
import { CLINICAL_TOKENS } from './amchartsTheme';

/**
 * CareFlowGovernanceRail
 * 
 * Platform Tenant Governance & Compliance Rail:
 *  - Segmented horizontal rail using strict palette tokens
 *  - Live pulse dot on the largest segment (Active & Operating)
 *  - Interactive click-to-filter
 */
export const CareFlowGovernanceRail = ({
  approved = 0,
  pending = 0,
  suspended = 0,
  selectedFacility = null,
  onStatusClick = null,
  activeStatus = null,
  className = ''
}) => {
  const total = approved + pending + suspended;
  const approvedPct = total > 0 ? Math.round((approved / total) * 100) : 100;
  const pendingPct = total > 0 ? Math.round((pending / total) * 100) : 0;
  const suspendedPct = total > 0 ? Math.round((suspended / total) * 100) : 0;

  const statuses = [
    {
      id: 'approved',
      label: selectedFacility ? 'Operating Entity' : 'Active & Operating',
      count: approved,
      pct: approvedPct,
      colorHex: CLINICAL_TOKENS.success,
      colorClass: 'bg-emerald-500',
      textColor: 'text-emerald-700',
      bgLight: 'bg-emerald-50/80',
      borderLight: 'border-emerald-200/80',
      icon: ShieldCheck,
      isLargest: approved >= pending && approved >= suspended
    },
    {
      id: 'pending',
      label: 'Pending Verification',
      count: pending,
      pct: pendingPct,
      colorHex: CLINICAL_TOKENS.warning,
      colorClass: 'bg-amber-500',
      textColor: 'text-amber-700',
      bgLight: 'bg-amber-50/80',
      borderLight: 'border-amber-200/80',
      icon: Clock,
      isLargest: pending > approved && pending >= suspended
    },
    {
      id: 'suspended',
      label: 'Suspended / Review',
      count: suspended,
      pct: suspendedPct,
      colorHex: CLINICAL_TOKENS.danger,
      colorClass: 'bg-rose-500',
      textColor: 'text-rose-700',
      bgLight: 'bg-rose-50/80',
      borderLight: 'border-rose-200/80',
      icon: ShieldAlert,
      isLargest: suspended > approved && suspended > pending
    }
  ];

  const facilityName = selectedFacility?.name || (typeof selectedFacility === 'string' ? selectedFacility : null);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans ${className}`}>
      {/* Top Details */}
      <div>
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-600 shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div className="truncate">
              <div className="flex items-center gap-2 flex-wrap">
                <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                  Tenant Governance & Operational Compliance
                </h3>
                <CareFlowLivePulse color="#10B981" label="Live Policy Status" />
                {facilityName && (
                  <span className="text-[10px] font-semibold px-2 py-0.2 rounded-md bg-blue-50 text-blue-700 border border-blue-200">
                    {facilityName}
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-500 truncate mt-0.5 font-medium">
                {facilityName
                  ? `${facilityName} · Active operational standing in platform registry`
                  : 'Multi-tenant facility licensing, operational status, and clinical compliance'}
              </p>
            </div>
          </div>

          <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 shrink-0">
            {facilityName ? '1 / 1 Operating' : `${total} Total Facilities`}
          </span>
        </div>

        {/* Proportional Segmented Progress Rail with Live Pulse on Largest Segment */}
        <div className="mt-3.5 mb-3">
          <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5">
            {statuses.map((s) => (
              <motion.div
                key={s.id}
                initial={{ width: 0 }}
                animate={{ width: `${Math.max(0, s.pct)}%` }}
                transition={{ duration: 0.6, ease: 'easeOut' }}
                style={{ backgroundColor: s.colorHex }}
                className="h-full rounded-full transition-all duration-300 relative group cursor-pointer"
                onClick={() => onStatusClick && onStatusClick(s.id)}
                title={`${s.label}: ${s.count} facilities (${s.pct}%)`}
              />
            ))}
          </div>
        </div>
      </div>

      {/* Metric Breakdown Badges with live pulse on active segment */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-100">
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => onStatusClick && onStatusClick(s.id)}
            className={`p-2.5 rounded-xl border text-left transition-all duration-150 flex items-center justify-between ${
              activeStatus === s.id
                ? 'ring-2 ring-blue-400 shadow-xs'
                : 'hover:border-slate-300'
            } ${s.bgLight} ${s.borderLight} cursor-pointer`}
          >
            <div className="flex items-center gap-2">
              <s.icon className={`w-3.5 h-3.5 ${s.textColor}`} />
              <div>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-semibold text-slate-800">
                    {s.label}
                  </span>
                  {s.isLargest && (
                    <CareFlowLivePulse color="#10B981" />
                  )}
                </div>
                <div className="text-[10px] text-slate-500 font-medium">
                  {s.pct}% of network
                </div>
              </div>
            </div>
            <span className={`text-sm font-bold ${s.textColor}`}>
              {s.count}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
};

export default CareFlowGovernanceRail;
