import React from 'react';
import { CalendarDays, CheckCircle2, Users, Clock, AlertTriangle } from 'lucide-react';

import { MiniSparkline } from '../common/ClinicalMetricCard';

export const AppointmentKpiStrip = ({ kpi = {}, loading = false }) => {
  const {
    totalAppointments = 0,
    totalAppointmentsChange = 14,
    completedAppointments = 0,
    completedAppointmentsChange = 12,
    uniquePatients = 0,
    uniquePatientsChange = 11,
    averageWaitTime = '25 min',
    averageWaitTimeChange = -22,
    noShowRate = '0.0%',
    noShowRateChange = -1.8,
    sparklines = {}
  } = kpi;

  const cards = [
    {
      id: 'total',
      label: 'Total Appointments',
      value: totalAppointments.toLocaleString(),
      change: totalAppointmentsChange,
      subtext: 'vs previous 6 months',
      icon: CalendarDays,
      iconBg: 'bg-blue-50 text-blue-600',
      sparklineData: sparklines.totalAppointments || [32, 54, 76, 92, 105, totalAppointments],
      sparklineColor: '#0066FF'
    },
    {
      id: 'completed',
      label: 'Completed Appointments',
      value: completedAppointments.toLocaleString(),
      change: completedAppointmentsChange,
      subtext: 'vs previous 6 months',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      sparklineData: sparklines.completedAppointments || [28, 48, 66, 80, 92, completedAppointments],
      sparklineColor: '#10B981'
    },
    {
      id: 'patients',
      label: 'Unique Patients',
      value: uniquePatients.toLocaleString(),
      change: uniquePatientsChange,
      subtext: 'vs previous 6 months',
      icon: Users,
      iconBg: 'bg-purple-50 text-purple-600',
      sparklineData: sparklines.uniquePatients || [15, 28, 45, 62, 78, uniquePatients],
      sparklineColor: '#A855F7'
    },
    {
      id: 'waitTime',
      label: 'Average Wait Time',
      value: averageWaitTime,
      change: averageWaitTimeChange,
      subtext: 'vs previous 6 months',
      icon: Clock,
      iconBg: 'bg-amber-50 text-amber-600',
      sparklineData: sparklines.averageWaitTime || [28, 26, 25, 24, 22, 18],
      sparklineColor: '#F59E0B'
    },
    {
      id: 'noShow',
      label: 'No-Show Rate',
      value: noShowRate,
      change: noShowRateChange,
      subtext: 'vs previous 6 months',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-600',
      sparklineData: sparklines.noShowRate || [2, 1, 1, 0, 0, 0],
      sparklineColor: '#EF4444'
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

            {/* Middle Row: Big Metric Value */}
            <div className="flex items-center justify-between">
              <span className="text-2xl font-bold text-slate-900 tracking-tight leading-none font-sans">
                {card.value}
              </span>

              {/* Sparkline */}
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
                      card.id === 'waitTime' || card.id === 'noShow'
                        ? !isPositive
                          ? 'text-emerald-600'
                          : 'text-rose-600'
                        : isPositive
                        ? 'text-emerald-600'
                        : 'text-rose-600'
                    }`}
                  >
                    {isPositive ? '↑' : '↓'} {Math.abs(card.change)}
                    {card.id === 'noShow' ? 'pp' : '%'}
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

export default AppointmentKpiStrip;
