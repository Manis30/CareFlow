import React, { useMemo } from 'react';
import { Calendar, ChevronLeft, ChevronRight } from 'lucide-react';

/**
 * CareFlowCalendarDensity
 * 
 * Consultation Calendar Density Grid:
 * Displays daily encounter density over recent weeks with click-to-filter capability.
 */
export const CareFlowCalendarDensity = ({
  appointments = [],
  selectedDate = null,
  onDateSelect = null,
  className = ''
}) => {
  // Aggregate appointments by date
  const { dateMap, maxCount, daysList } = useMemo(() => {
    const map = {};
    let max = 1;

    appointments.forEach((a) => {
      if (!a.appointmentDate) return;
      const d = new Date(a.appointmentDate);
      if (isNaN(d.getTime())) return;
      const dateKey = d.toISOString().split('T')[0];
      map[dateKey] = (map[dateKey] || 0) + 1;
      if (map[dateKey] > max) max = map[dateKey];
    });

    // Generate recent 35 days (5 weeks)
    const now = new Date();
    const days = [];
    for (let i = 27; i >= -7; i--) {
      const d = new Date(now);
      d.setDate(d.getDate() - i);
      const key = d.toISOString().split('T')[0];
      days.push({
        date: d,
        dateKey: key,
        dayNum: d.getDate(),
        dayOfWeek: d.getDay(),
        month: d.toLocaleDateString('en-US', { month: 'short' }),
        count: map[key] || 0,
        isToday: i === 0,
        isFuture: i < 0
      });
    }

    return { dateMap: map, maxCount: max, daysList: days };
  }, [appointments]);

  // Color intensity scale
  const getIntensityClass = (count) => {
    if (count === 0) return 'bg-slate-50 text-slate-400 border-slate-100 hover:border-slate-300';
    const ratio = count / maxCount;
    if (ratio < 0.25) return 'bg-blue-50 text-blue-700 border-blue-100 hover:border-blue-300';
    if (ratio < 0.5) return 'bg-blue-100 text-blue-800 border-blue-200 hover:border-blue-400';
    if (ratio < 0.75) return 'bg-blue-500 text-white border-blue-600';
    return 'bg-blue-700 text-white border-blue-800 font-bold';
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Calendar className="w-4 h-4 text-blue-600" />
            Clinical Calendar Encounter Density
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Daily consultation load across rolling 5-week platform schedule
          </p>
        </div>

        {selectedDate && (
          <button
            type="button"
            onClick={() => onDateSelect && onDateSelect(null)}
            className="text-xs font-semibold text-blue-600 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200 hover:bg-blue-100"
          >
            Clear Date: {selectedDate} ×
          </button>
        )}
      </div>

      {/* Days Grid (7 columns: Sun to Sat) */}
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
          <div key={day} className="text-[10px] font-bold text-slate-400 uppercase py-1">
            {day}
          </div>
        ))}

        {daysList.map((day) => {
          const isSelected = selectedDate === day.dateKey;

          return (
            <div
              key={day.dateKey}
              onClick={() => onDateSelect && onDateSelect(isSelected ? null : day.dateKey)}
              title={`${day.dateKey}: ${day.count} encounters`}
              className={`p-2 rounded-xl border text-center cursor-pointer transition-all duration-150 flex flex-col justify-between min-h-[56px] relative ${
                getIntensityClass(day.count)
              } ${isSelected ? 'ring-2 ring-blue-600 shadow-md scale-105 z-10' : ''}`}
            >
              <div className="flex items-center justify-between text-[10px]">
                <span className="opacity-75">{day.month}</span>
                {day.isToday && (
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="Today" />
                )}
              </div>

              <span className="text-sm font-bold my-0.5">
                {day.dayNum}
              </span>

              <span className="text-[10px] opacity-85 font-mono">
                {day.count > 0 ? `${day.count} appts` : '—'}
              </span>
            </div>
          );
        })}
      </div>

      {/* Footer Legend */}
      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span>Click any day to filter appointments ledger</span>
        <div className="flex items-center gap-1.5 text-[11px]">
          <span>Less</span>
          <span className="w-2.5 h-2.5 rounded bg-slate-100" />
          <span className="w-2.5 h-2.5 rounded bg-blue-100" />
          <span className="w-2.5 h-2.5 rounded bg-blue-500" />
          <span className="w-2.5 h-2.5 rounded bg-blue-700" />
          <span>More</span>
        </div>
      </div>
    </div>
  );
};

export default CareFlowCalendarDensity;
