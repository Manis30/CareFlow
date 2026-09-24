import React, { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Repeat, Users } from 'lucide-react';

/**
 * CareFlowFrequencyDistribution
 * 
 * Consultation Frequency Distribution:
 * Categorizes patient population by consultation recurrence tiers:
 * 1 visit • 2-3 visits • 4-5 visits • 6+ visits
 */
export const CareFlowFrequencyDistribution = ({
  patients = [],
  frequencyData = null,
  selectedTier = null,
  onTierClick = null,
  className = ''
}) => {
  const distribution = useMemo(() => {
    if (frequencyData && Array.isArray(frequencyData) && frequencyData.length > 0) {
      const total = frequencyData.reduce((acc, curr) => acc + (curr.patientCount || 0), 0);
      return frequencyData.map((item) => ({
        tier: item._id,
        count: item.patientCount,
        pct: total > 0 ? Math.round((item.patientCount / total) * 100) : 0
      }));
    }

    if (!patients || patients.length === 0) return [];

    const buckets = {
      '1 visit': 0,
      '2-3 visits': 0,
      '4-5 visits': 0,
      '6+ visits': 0
    };

    patients.forEach((p) => {
      const count = Number(p.completedConsultationsCount) || 1;
      if (count === 1) buckets['1 visit'] += 1;
      else if (count <= 3) buckets['2-3 visits'] += 1;
      else if (count <= 5) buckets['4-5 visits'] += 1;
      else buckets['6+ visits'] += 1;
    });

    const total = patients.length || 1;
    return Object.entries(buckets).map(([tier, count]) => ({
      tier,
      count,
      pct: Math.round((count / total) * 100)
    }));
  }, [patients, frequencyData]);

  const colors = {
    '1 visit': { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' },
    '2-3 visits': { bar: 'bg-teal-500', text: 'text-teal-700', bg: 'bg-teal-50' },
    '4-5 visits': { bar: 'bg-emerald-500', text: 'text-emerald-700', bg: 'bg-emerald-50' },
    '6+ visits': { bar: 'bg-purple-500', text: 'text-purple-700', bg: 'bg-purple-50' }
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Repeat className="w-4 h-4 text-teal-600" />
            Patient Consultation Recurrence & Loyalty
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Breakdown of unique patients by encounter frequency
          </p>
        </div>
      </div>

      {/* Proportional Stacked Rail */}
      <div className="my-3">
        <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex gap-0.5 p-0.5 shadow-inner">
          {distribution.map((item) => {
            const c = colors[item.tier] || { bar: 'bg-blue-500' };
            return (
              <div
                key={item.tier}
                style={{ width: `${Math.max(item.pct, item.count > 0 ? 5 : 0)}%` }}
                className={`h-full rounded-sm transition-all duration-300 ${c.bar}`}
                title={`${item.tier}: ${item.count} patients (${item.pct}%)`}
              />
            );
          })}
        </div>
      </div>

      {/* Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 mt-2">
        {distribution.map((item) => {
          const c = colors[item.tier] || { bar: 'bg-blue-500', text: 'text-blue-700', bg: 'bg-blue-50' };
          const isSelected = selectedTier === item.tier;
          return (
            <button
              key={item.tier}
              type="button"
              onClick={() => onTierClick && onTierClick(item.tier)}
              className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col justify-between ${
                isSelected
                  ? 'border-blue-500 ring-2 ring-blue-200 bg-white shadow-xs'
                  : `border-slate-200/60 ${c.bg} hover:border-slate-300 hover:shadow-2xs`
              }`}
            >
              <span className="text-[11px] font-semibold text-slate-600">
                {item.tier}
              </span>
              <div className="flex items-baseline gap-1 mt-1">
                <span className={`text-xl font-bold ${c.text}`}>
                  {item.count}
                </span>
                <span className="text-[11px] font-medium text-slate-500">
                  ({item.pct}%)
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
};

export default CareFlowFrequencyDistribution;
