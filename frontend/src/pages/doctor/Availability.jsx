import React, { useEffect, useState } from 'react';
import { Save, Clock, CalendarCheck, Building2, CheckCircle2 } from 'lucide-react';
import { getMyDoctorProfileApi, updateMyAvailabilityApi } from '../../api/doctor';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { normalizeTimeTo24h, timeToMinutes } from '../../utils/timeUtils';

const DAYS = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const Availability = () => {
  const [schedule, setSchedule] = useState(() =>
    DAYS.map((d) => ({
      day: d.key,
      open: '09:00',
      close: '17:00',
      isAvailable: true
    }))
  );
  const [clinicHours, setClinicHours] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [hoveredRowKey, setHoveredRowKey] = useState(null);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyDoctorProfileApi();
      const doctorData = res.data?.doctor || res.data;

      // Extract clinic working hours
      const orgWH = doctorData?.organizationId?.workingHours || [];
      const hoursMap = {};
      if (Array.isArray(orgWH)) {
        orgWH.forEach((wh) => {
          if (wh && wh.day) {
            const rawOpen = wh.open || '';
            const rawClose = wh.close || wh.clode || '';
            const isOpen = wh.isOpen !== false && wh.status !== 'CLOSED';
            hoursMap[wh.day.toLowerCase().trim()] = {
              isOpen,
              open: isOpen && rawOpen ? normalizeTimeTo24h(rawOpen) : '',
              close: isOpen && rawClose ? normalizeTimeTo24h(rawClose) : ''
            };
          }
        });
      }
      setClinicHours(hoursMap);

      if (doctorData?.available && Array.isArray(doctorData.available) && doctorData.available.length > 0) {
        const merged = DAYS.map((d) => {
          const found = doctorData.available.find(
            (a) => (a.day || a.dayOfWeek || a.dayName || '').toLowerCase() === d.key
          );

          const cDay = hoursMap[d.key];
          const isClinicOpen = cDay ? cDay.isOpen : true;

          const defaultOpen = cDay?.open || '09:00';
          const defaultClose = cDay?.close || '17:00';

          if (found) {
            const normOpen = normalizeTimeTo24h(found.open || found.startTime) || defaultOpen;
            const normClose = normalizeTimeTo24h(found.close || found.endTime) || defaultClose;

            return {
              day: d.key,
              open: normOpen,
              close: normClose,
              isAvailable: isClinicOpen && found.isAvailable !== false
            };
          }

          return {
            day: d.key,
            open: defaultOpen,
            close: defaultClose,
            isAvailable: isClinicOpen && d.key !== 'sunday'
          };
        });
        setSchedule(merged);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch doctor profile');
    } finally {
      setLoading(false);
    }
  };

  const handleToggle = (index) => {
    const item = schedule[index];
    const cDay = clinicHours[item.day];
    if (cDay && !cDay.isOpen) {
      showErrorToast(`Clinic is closed on ${item.day.toUpperCase()}`);
      return;
    }
    const updated = [...schedule];
    updated[index].isAvailable = !updated[index].isAvailable;
    setSchedule(updated);
  };

  const handleTimeChange = (index, field, value) => {
    const updated = [...schedule];
    updated[index][field] = value;
    setSchedule(updated);
  };

  const handleSave = async () => {
    try {
      setSaving(true);

      for (const item of schedule) {
        if (item.isAvailable) {
          if (!item.open || !item.close) {
            showErrorToast(`Start and end times are required for ${item.day.toUpperCase()}`);
            setSaving(false);
            return;
          }

          const doctorStart = timeToMinutes(item.open);
          const doctorEnd = timeToMinutes(item.close);

          if (doctorStart < 0 || doctorEnd < 0) {
            showErrorToast(`Invalid time format for ${item.day.toUpperCase()}`);
            setSaving(false);
            return;
          }

          if (doctorStart >= doctorEnd) {
            showErrorToast(`Start time must be before end time for ${item.day.toUpperCase()}`);
            setSaving(false);
            return;
          }

          const cDay = clinicHours[item.day];
          if (cDay) {
            if (!cDay.isOpen) {
              showErrorToast(`Clinic is closed on ${item.day.toUpperCase()}`);
              setSaving(false);
              return;
            }

            const clinicStart = timeToMinutes(cDay.open);
            const clinicEnd = timeToMinutes(cDay.close);

            if (clinicStart >= 0 && doctorStart < clinicStart) {
              showErrorToast(
                `Availability on ${item.day.toUpperCase()} cannot start before clinic opens at ${cDay.open}`
              );
              setSaving(false);
              return;
            }

            if (clinicEnd >= 0 && doctorEnd > clinicEnd) {
              showErrorToast(
                `Availability on ${item.day.toUpperCase()} cannot end after clinic closes at ${cDay.close}`
              );
              setSaving(false);
              return;
            }
          }
        }
      }

      await updateMyAvailabilityApi({ available: schedule });
      showSuccessToast('Weekly availability schedule saved successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to save availability');
    } finally {
      setSaving(false);
    }
  };

  const availableDaysCount = schedule.filter((s) => s.isAvailable).length;
  const unavailableDaysCount = schedule.length - availableDaysCount;

  const calculateTotalWeeklyHours = () => {
    let totalMinutes = 0;
    schedule.forEach((item) => {
      if (item.isAvailable && item.open && item.close) {
        const start = timeToMinutes(item.open);
        const end = timeToMinutes(item.close);
        if (start >= 0 && end > start) {
          totalMinutes += end - start;
        }
      }
    });
    return (totalMinutes / 60).toFixed(1);
  };

  const maxWorkingMinsInWeek = Math.max(
    ...schedule.map((s) => {
      if (s.isAvailable && s.open && s.close) {
        const start = timeToMinutes(s.open);
        const end = timeToMinutes(s.close);
        return start >= 0 && end > start ? end - start : 0;
      }
      return 0;
    }),
    480
  );

  const todayWeekday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();
  const todaySchedule = schedule.find((s) => s.day === todayWeekday);
  const isTodayAvailable = Boolean(todaySchedule?.isAvailable);

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-12">
        <PageHeader
          subtitle="Loading schedule configuration..."
        />
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          <div className="lg:col-span-8">
            <CardSkeleton count={2} />
          </div>
          <div className="lg:col-span-4">
            <CardSkeleton count={1} />
          </div>
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer>
        <div className="py-12">
          <ErrorState message={error} onRetry={fetchProfile} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Configure your weekly consultation schedule within your clinic's working hours."
        actions={
          <Button
            variant="primary"
            icon={Save}
            onClick={handleSave}
            loading={saving}
            className="rounded-xl shadow-xs font-semibold"
          >
            Save Schedule
          </Button>
        }
      />

      {/* 2. Main Grid: Left 8 cols & Right 4 cols */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Weekly Schedule Timeline */}
        <div className="lg:col-span-8">
          <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-blue-600" />
                <h3 className="text-base font-bold text-slate-900">
                  Daily Consultation Slots
                </h3>
              </div>
              <span className="text-xs font-semibold text-blue-700 bg-blue-50 px-3 py-1 rounded-full border border-blue-100">
                {availableDaysCount} Days Active
              </span>
            </div>

            {/* Time Axis Header */}
            <div className="hidden md:flex items-center justify-between px-3 text-[10px] text-slate-400 font-bold uppercase tracking-wider pt-1">
              <div className="w-48 shrink-0">DAY OF WEEK</div>
              <div className="flex-1 mx-4 flex justify-between px-1">
                <span>9 AM</span>
                <span>12 PM</span>
                <span>3 PM</span>
                <span>6 PM</span>
              </div>
              <div className="w-64 shrink-0 text-center">CONSULTATION SLOTS</div>
            </div>

            {/* Schedule Rows */}
            <div className="divide-y divide-slate-100">
              {schedule.map((item, idx) => {
                const dayLabel = DAYS.find((d) => d.key === item.day)?.label || item.day;
                const cDay = clinicHours[item.day];
                const isClinicClosed = cDay ? !cDay.isOpen : false;
                const isToday = item.day === todayWeekday;

                const doctorWorkingMins =
                  item.isAvailable && item.open && item.close
                    ? Math.max(0, timeToMinutes(item.close) - timeToMinutes(item.open))
                    : 0;

                const percentage =
                  maxWorkingMinsInWeek > 0 && doctorWorkingMins > 0
                    ? Math.round((doctorWorkingMins / maxWorkingMinsInWeek) * 100)
                    : 0;

                return (
                  <div
                    key={item.day}
                    onMouseEnter={() => setHoveredRowKey(item.day)}
                    className={`py-3.5 px-3 rounded-xl transition-all duration-200 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border ${
                      isToday
                        ? 'bg-blue-50/40 border-l-4 border-l-blue-600 border-slate-200'
                        : item.isAvailable
                        ? 'bg-white border-transparent hover:bg-slate-50/70 hover:border-slate-200/80'
                        : 'bg-slate-50/50 border-transparent text-slate-400'
                    }`}
                  >
                    <div className="flex items-center gap-3 w-48 shrink-0">
                      <input
                        type="checkbox"
                        checked={item.isAvailable}
                        disabled={isClinicClosed}
                        onChange={() => handleToggle(idx)}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500 border-slate-300 cursor-pointer disabled:opacity-40"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <span
                            className={`text-sm tracking-tight ${
                              isToday
                                ? 'font-bold text-blue-950'
                                : item.isAvailable
                                ? 'font-semibold text-slate-800'
                                : 'text-slate-400 font-medium'
                            }`}
                          >
                            {dayLabel}
                          </span>
                          {isToday && (
                            <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wider shadow-2xs">
                              TODAY
                            </span>
                          )}
                        </div>
                        {cDay && (
                          <p className="text-[11px] text-slate-400 flex items-center gap-1 font-medium mt-0.5">
                            <Building2 className="w-3 h-3 text-slate-400 shrink-0 opacity-75" />
                            Facility: {isClinicClosed ? 'Closed' : `${cDay.open} – ${cDay.close}`}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Timeline Visual Track */}
                    <div className="hidden md:flex items-center flex-1 mx-4">
                      <div className="w-full h-2.5 rounded-full bg-slate-100 relative overflow-hidden flex items-center border border-slate-200/50">
                        {item.isAvailable &&
                        !isClinicClosed &&
                        doctorWorkingMins > 0 &&
                        percentage > 0 ? (
                          <div
                            className="h-full bg-blue-600 rounded-full transition-all duration-300 ease-out"
                            style={{ width: `${percentage}%` }}
                          />
                        ) : (
                          <div className="h-full w-full bg-slate-100" />
                        )}
                      </div>
                    </div>

                    {/* Time Selectors or Inactive Pill */}
                    {item.isAvailable ? (
                      <div className="flex items-center gap-2 text-xs shrink-0 font-medium">
                        <Input
                          type="time"
                          value={item.open}
                          onChange={(e) => handleTimeChange(idx, 'open', e.target.value)}
                          className="w-28 text-slate-900 border-slate-200 focus:border-blue-500 rounded-xl"
                        />
                        <span className="text-slate-400 text-xs px-0.5">to</span>
                        <Input
                          type="time"
                          value={item.close}
                          onChange={(e) => handleTimeChange(idx, 'close', e.target.value)}
                          className="w-28 text-slate-900 border-slate-200 focus:border-blue-500 rounded-xl"
                        />
                      </div>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl shrink-0 text-slate-500 bg-slate-100 border border-slate-200/60">
                        {isClinicClosed ? (
                          <>
                            <Building2 className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                            <span>Facility Closed</span>
                          </>
                        ) : (
                          <span>Unavailable</span>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Right Column: Schedule Summary */}
        <div className="lg:col-span-4 space-y-6">
          <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
            <h4 className="text-base font-bold text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
              <CalendarCheck className="w-4 h-4 text-blue-600" />
              Schedule Summary
            </h4>

            {/* Today's Status Banner */}
            <div
              className={`p-4 rounded-xl border ${
                isTodayAvailable
                  ? 'bg-blue-50/60 border-blue-200 text-blue-950'
                  : 'bg-slate-50 border-slate-200 text-slate-600'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <PulseIndicator active={isTodayAvailable} size="sm" color="#2563EB" />
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">
                    TODAY'S CLINICAL STATUS
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                    isTodayAvailable ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {isTodayAvailable ? 'On Duty' : 'Off Duty'}
                </span>
              </div>

              <p className="text-sm font-bold text-slate-900 mt-2">
                {isTodayAvailable ? 'Consultations Active' : 'No Consultations Scheduled Today'}
              </p>

              {isTodayAvailable && todaySchedule?.open && (
                <p className="text-xs font-semibold text-blue-700 mt-1">
                  Operating Window:{' '}
                  <span className="font-semibold">
                    {todaySchedule.open} – {todaySchedule.close}
                  </span>
                </p>
              )}
            </div>

            {/* Summary Statistics */}
            <div className="grid grid-cols-3 divide-x divide-slate-200 bg-slate-50 rounded-xl border border-slate-200 py-4 px-2 text-center">
              <div className="px-2">
                <span className="text-xl font-bold text-slate-900 block font-sans">
                  {availableDaysCount}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Days Active
                </span>
              </div>
              <div className="px-2">
                <span className="text-xl font-bold text-slate-400 block font-sans">
                  {unavailableDaysCount}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Days Off
                </span>
              </div>
              <div className="px-2">
                <span className="text-xl font-bold text-blue-600 block font-sans">
                  {calculateTotalWeeklyHours()}
                </span>
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">
                  Weekly Hrs
                </span>
              </div>
            </div>

            <div className="pt-2 text-xs text-slate-500 space-y-2 font-medium">
              <p className="flex items-start gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <span>Working windows determine available patient booking slots on the platform.</span>
              </p>
              <p className="flex items-start gap-2">
                <Building2 className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <span>Operating hours must reside within your healthcare clinic's master schedule.</span>
              </p>
            </div>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

export default Availability;
