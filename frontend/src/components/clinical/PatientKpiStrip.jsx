import React from 'react';
import { Users, UserPlus, CheckCircle2, Activity, Building2, TrendingUp, TrendingDown } from 'lucide-react';

import { MiniSparkline } from '../common/ClinicalMetricCard';

export const PatientKpiStrip = ({ kpi = {}, loading = false }) => {
  const {
    totalPatients = 0,
    totalPatientsChange = 12,
    newPatients = 0,
    newPatientsChange = 18,
    activePatients = 0,
    activePatientsChange = 10,
    engagedPatients = '100%',
    engagedPatientsChange = 8,
    organizationsCount = 8,
    organizationsStatus = 'Active',
    sparklines = {}
  } = kpi;

  const cards = [
    {
      id: 'total',
      label: 'Total Patients',
      value: totalPatients.toLocaleString(),
      change: totalPatientsChange,
      subtext: 'vs previous 6 months',
      icon: Users,
      iconBg: 'bg-blue-50 text-blue-600',
      sparklineData: sparklines.totalPatients || [8, 19, 32, 47, 66, 90],
      sparklineColor: '#0066FF'
    },
    {
      id: 'new',
      label: 'New Patients',
      value: newPatients.toLocaleString(),
      change: newPatientsChange,
      subtext: 'vs previous 6 months',
      icon: UserPlus,
      iconBg: 'bg-purple-50 text-purple-600',
      sparklineData: sparklines.newPatients || [8, 11, 13, 15, 19, 24],
      sparklineColor: '#A855F7'
    },
    {
      id: 'active',
      label: 'Active Patients',
      value: activePatients.toLocaleString(),
      change: activePatientsChange,
      subtext: 'vs previous 6 months',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      sparklineData: sparklines.activePatients || [7, 17, 29, 42, 59, 81],
      sparklineColor: '#10B981'
    },
    {
      id: 'engaged',
      label: 'Engaged Patients',
      value: engagedPatients,
      change: engagedPatientsChange,
      subtext: 'vs previous 6 months',
      icon: Activity,
      iconBg: 'bg-rose-50 text-rose-600',
      sparklineData: sparklines.engagedPatients || [7, 16, 27, 40, 56, 77],
      sparklineColor: '#EF4444'
    },
    {
      id: 'orgs',
      label: 'Organizations',
      value: organizationsCount,
      badge: organizationsStatus,
      subtext: 'Facilities with registered patients',
      icon: Building2,
      iconBg: 'bg-blue-50 text-blue-600'
    }
  ];

  if (loading) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-[108px] bg-white rounded-2xl border border-slate-200/80 p-3.5 animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
      {cards.map((card) => {
        const Icon = card.icon;
        const isPositive = (card.change || 0) >= 0;

        return (
          <div
            key={card.id}
            className="h-[108px] p-3.5 bg-white rounded-2xl border border-slate-200/80 shadow-xs flex flex-col justify-between transition-all duration-200 hover:shadow-sm"
          >
            {/* Top Row: Icon + Title */}
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${card.iconBg}`}>
                <Icon className="w-3.5 h-3.5 stroke-[2.2]" />
              </div>
              <span className="text-xs font-semibold text-slate-500 tracking-tight truncate">
                {card.label}
              </span>
            </div>

            {/* Middle Row: Big Metric Value (+ optional Badge) */}
            <div className="flex items-center justify-between">
              <div className="flex items-baseline gap-2">
                <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none font-sans">
                  {card.value}
                </span>
                {card.badge && (
                  <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200/70 px-2 py-0.5 rounded-full leading-none">
                    {card.badge}
                  </span>
                )}
              </div>

              {/* Sparkline (for cards 1-4) */}
              {card.sparklineData && (
                <MiniSparkline
                  data={card.sparklineData}
                  color={card.sparklineColor}
                  width={68}
                  height={24}
                />
              )}
            </div>

            {/* Bottom Row: Indicator & Subtext */}
            <div className="flex items-center text-[11px] leading-none truncate">
              {card.change !== undefined ? (
                <>
                  <span
                    className={`font-bold inline-flex items-center gap-0.5 shrink-0 ${
                      isPositive ? 'text-emerald-600' : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? '↑' : '↓'} {Math.abs(card.change)}%
                  </span>
                  <span className="text-slate-400 font-medium ml-1.5 truncate">
                    {card.subtext}
                  </span>
                </>
              ) : (
                <span className="text-slate-400 font-medium truncate">
                  {card.subtext}
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default PatientKpiStrip;
