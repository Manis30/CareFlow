import React, { useState } from 'react';
import { Clock3 } from 'lucide-react';
import { formatTime } from '../../utils/formatTime';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const getDurationHours = (openStr, closeStr) => {
  if (!openStr || !closeStr) return 0;
  const [openH, openM] = openStr.split(':').map(Number);
  const [closeH, closeM] = closeStr.split(':').map(Number);
  if (isNaN(openH) || isNaN(closeH)) return 0;
  const openMinutes = openH * 60 + (openM || 0);
  const closeMinutes = closeH * 60 + (closeM || 0);
  const diffMinutes = closeMinutes - openMinutes;
  return diffMinutes > 0 ? diffMinutes / 60 : 0;
};

const WeeklyAvailabilitySchedule = ({ doctor }) => {
  const availableSchedule = Array.isArray(doctor?.available) ? doctor.available : [];

  const [hoveredRowKey, setHoveredRowKey] = useState(null);
  const [hoverAnimCounters, setHoverAnimCounters] = useState({});

  const handleRowMouseEnter = (key) => {
    setHoveredRowKey(key);
    setHoverAnimCounters((prev) => ({
      ...prev,
      [key]: (prev[key] || 0) + 1
    }));
  };

  const scheduleList = DAYS_OF_WEEK.map(({ key, label }) => {
    const dayData = availableSchedule.find((item) => item?.day?.toLowerCase() === key);
    const isLeave = Boolean(
      dayData?.status === 'leave' ||
      dayData?.isLeave ||
      dayData?.onLeave ||
      (doctor?.onLeave && new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === key)
    );

    const isAvailable = Boolean(
      dayData?.isAvailable &&
      dayData?.status !== 'closed' &&
      dayData?.status !== 'off' &&
      !isLeave
    );

    const openTime = dayData?.open || '09:00';
    const closeTime = dayData?.close || '17:00';
    const durationHours = isAvailable ? getDurationHours(openTime, closeTime) : 0;

    let rawStatus = 'CLOSED';
    if (isLeave) {
      rawStatus = 'LEAVE';
    } else if (isAvailable) {
      rawStatus = durationHours <= 5 ? 'HALF_DAY' : 'OPEN';
    }

    return {
      key,
      label,
      rawStatus,
      openTime,
      closeTime,
      durationHours,
      isAvailable,
      isLeave
    };
  });

  const activeDurations = scheduleList
    .filter((s) => s.isAvailable && !s.isLeave && s.durationHours > 0)
    .map((s) => s.durationHours);

  const maxDoctorWorkingDuration = activeDurations.length > 0 ? Math.max(...activeDurations) : 0;
  const activeDaysCount = scheduleList.filter((s) => s.isAvailable).length;

  return (
    <div className="bg-white rounded-2xl border border-slate-200/80 p-5 sm:p-6 shadow-xs space-y-4">
      <style>{`
        .animate-width-fill {
          animation: widthFill 0.45s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes widthFill {
          from { width: 0%; }
          to { width: var(--target-width); }
        }
      `}</style>

      {/* 1. CARD HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-3.5">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
            <Clock3 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Weekly Operating Schedule
            </h2>
            <p className="text-[11px] text-slate-500 font-medium mt-0.5">
              Clinic availability and active consultation hours
            </p>
          </div>
        </div>

        {/* Dynamic Active Days Summary Badge */}
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100 shadow-2xs self-start sm:self-center">
          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse" />
          {activeDaysCount} Active Operating Days
        </span>
      </div>

      {/* 2. SCHEDULE TIMELINE TABLE */}
      <div className="space-y-1.5 pt-1 text-xs">
        <div className="hidden md:flex items-center justify-between px-4 sm:px-5 text-[10px] font-bold text-slate-400 uppercase tracking-wider py-1.5 pb-2">
          <div className="w-28 sm:w-32 shrink-0 text-left">DAY</div>
          <div className="flex-1 mx-4 sm:mx-6">
            <div className="flex justify-between items-center px-1 text-[10px] text-slate-400 font-semibold">
              <span>9 AM</span>
              <span>12 PM</span>
              <span>3 PM</span>
              <span>6 PM</span>
            </div>
          </div>
          <div className="w-40 sm:w-48 shrink-0 text-center">TIME RANGE</div>
          <div className="w-24 sm:w-28 shrink-0 text-center">STATUS</div>
        </div>

        <div className="divide-y divide-slate-100 border border-slate-200/80 bg-slate-50/40 rounded-xl overflow-hidden">
          {scheduleList.map(({ key, label, rawStatus, openTime, closeTime, durationHours }) => {
            const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
            const isToday = key === todayWeekday;

            const percentage = maxDoctorWorkingDuration > 0 && rawStatus !== 'CLOSED' && rawStatus !== 'LEAVE'
              ? (durationHours / maxDoctorWorkingDuration) * 100
              : 0;

            return (
              <div
                key={key}
                onMouseEnter={() => handleRowMouseEnter(key)}
                className={`p-3 px-4 sm:px-5 flex items-center justify-between gap-3 transition-all duration-200 group cursor-pointer ${
                  isToday
                    ? 'bg-blue-50/60 border-l-4 border-l-blue-600'
                    : rawStatus === 'LEAVE'
                    ? 'bg-amber-50/30 hover:bg-amber-50/50'
                    : rawStatus === 'CLOSED'
                    ? 'bg-slate-50/40 opacity-75'
                    : 'hover:bg-slate-50'
                }`}
              >
                {/* Column 1: DAY */}
                <div className="flex items-center gap-2 w-28 sm:w-32 shrink-0">
                  <span className={`font-semibold text-xs sm:text-sm ${isToday ? 'text-blue-700 font-bold' : rawStatus === 'CLOSED' ? 'text-slate-400 font-normal' : 'text-slate-800'}`}>
                    {label}
                  </span>
                  {isToday && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wider shadow-2xs">
                      Today
                    </span>
                  )}
                </div>

                {/* Column 2: AVAILABILITY TRACK & DURATION */}
                <div className="hidden md:flex items-center flex-1 mx-4 sm:mx-6 gap-3">
                  <div className="flex-1 h-2 rounded-full bg-slate-200/70 relative overflow-hidden flex items-center justify-start">
                    {rawStatus === 'LEAVE' ? (
                      <div className="h-full w-full bg-amber-100/70 border border-dashed border-amber-300 rounded-full" />
                    ) : rawStatus !== 'CLOSED' && durationHours > 0 && percentage > 0 ? (
                      <div
                        key={`track-fill-${key}-${hoverAnimCounters[key] || 0}`}
                        className={`h-full bg-blue-600 rounded-full shadow-2xs ${
                          hoveredRowKey === key ? 'animate-width-fill' : 'transition-all duration-500 ease-out'
                        }`}
                        style={{
                          '--target-width': `${percentage}%`,
                          width: `${percentage}%`,
                          marginLeft: 0,
                          marginRight: 'auto'
                        }}
                      />
                    ) : (
                      <div className="h-full w-full bg-slate-100 border border-dashed border-slate-200 rounded-full" />
                    )}
                  </div>

                  <span className="text-[11px] font-bold text-slate-500 w-14 shrink-0 text-right">
                    {durationHours > 0 ? `${durationHours}h` : '—'}
                  </span>
                </div>

                {/* Column 3: TIME RANGE */}
                <div className="w-40 sm:w-48 shrink-0 text-center font-medium text-slate-700">
                  {rawStatus !== 'CLOSED' && rawStatus !== 'LEAVE' ? (
                    <span className="text-xs font-semibold">
                      {formatTime(openTime)} – {formatTime(closeTime)}
                    </span>
                  ) : (
                    <span className="text-xs text-slate-400 font-normal">Not Scheduled</span>
                  )}
                </div>

                {/* Column 4: STATUS BADGE */}
                <div className="w-24 sm:w-28 shrink-0 text-center">
                  {rawStatus === 'OPEN' || rawStatus === 'HALF_DAY' ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                      {rawStatus === 'HALF_DAY' ? 'Half Day' : 'Available'}
                    </span>
                  ) : rawStatus === 'LEAVE' ? (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                      On Leave
                    </span>
                  ) : (
                    <span className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-100 text-slate-500 border border-slate-200">
                      Off Duty
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default WeeklyAvailabilitySchedule;
