import React, { useState, useEffect } from 'react';
import { Pill, Check, Clock, Bell, AlertCircle, RefreshCw } from 'lucide-react';
import { getTodayMedicationsApi, recordDoseLogApi, getMedicationAdherenceApi } from '../../api/medication';

export const TodaysMedication = () => {
  const [medications, setMedications] = useState([]);
  const [adherence, setAdherence] = useState(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(null);
  const [error, setError] = useState('');

  const fetchMedications = async () => {
    try {
      setLoading(true);
      setError('');
      const [todayRes, adhRes] = await Promise.all([
        getTodayMedicationsApi().catch(() => ({ data: [] })),
        getMedicationAdherenceApi(7).catch(() => ({ data: null }))
      ]);

      const medsData = todayRes?.data?.medications || todayRes?.data || [];
      setMedications(Array.isArray(medsData) ? medsData : []);

      if (adhRes?.data) {
        setAdherence(adhRes.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load medication schedule');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchMedications();
  }, []);

  const handleAction = async (med, status) => {
    try {
      const actionKey = `${med.scheduleId}-${med.scheduledTime}-${status}`;
      setActionLoading(actionKey);

      let snoozedUntil = null;
      if (status === 'SNOOZED') {
        snoozedUntil = new Date(Date.now() + 30 * 60 * 1000).toISOString();
      }

      await recordDoseLogApi({
        medicationScheduleId: med.scheduleId,
        scheduledTime: med.scheduledTime,
        status,
        snoozedUntil
      });

      // Refresh data
      await fetchMedications();
    } catch (err) {
      alert(err.response?.data?.message || err.message || 'Action failed');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-3">
        <div className="flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div className="flex items-center gap-2">
            <Pill className="w-4 h-4 text-emerald-600 animate-pulse" />
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Today's Medication
            </h2>
          </div>
        </div>
        <div className="space-y-2 py-4">
          <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
          <div className="h-12 bg-slate-100 rounded-lg animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-2xs space-y-4">
      {/* Header & Adherence */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center border border-emerald-100">
            <Pill className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Today's Medication
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Daily prescribed doses and real-time adherence log
            </p>
          </div>
        </div>

        {adherence && adherence.scheduledDoses > 0 && (
          <div className="flex items-center gap-2 text-xs bg-emerald-50/70 border border-emerald-200/60 px-2.5 py-1 rounded-lg">
            <span className="text-emerald-800 font-bold">
              {adherence.takenDoses} / {adherence.scheduledDoses} doses completed
            </span>
            <span className="text-emerald-600 font-semibold text-[11px]">
              ({adherence.adherencePercentage}%)
            </span>
          </div>
        )}
      </div>

      {error ? (
        <div className="p-3 bg-rose-50 text-rose-700 text-xs rounded-lg flex items-center gap-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
          <button onClick={fetchMedications} className="ml-auto underline font-semibold">
            Retry
          </button>
        </div>
      ) : medications.length === 0 ? (
        <div className="py-6 text-center space-y-2">
          <div className="w-9 h-9 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center mx-auto">
            <Check className="w-4 h-4" />
          </div>
          <p className="text-xs font-semibold text-slate-700">No active medication due today</p>
          <p className="text-[11px] text-slate-400 max-w-sm mx-auto">
            Your approved medication schedules will appear here automatically with dose reminders.
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {medications.map((item, idx) => {
            const isTaken = item.status === 'TAKEN';
            const isSnoozed = item.status === 'SNOOZED';
            const isMissed = item.status === 'MISSED';
            const isDue = item.status === 'DUE' || item.status === 'OVERDUE';
            const key = `${item.scheduleId}-${item.scheduledTime}-${idx}`;

            return (
              <div
                key={key}
                className={`p-3 rounded-lg border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
                  isTaken
                    ? 'bg-emerald-50/40 border-emerald-200/80 text-emerald-950'
                    : isSnoozed
                    ? 'bg-amber-50/40 border-amber-200/80'
                    : isMissed
                    ? 'bg-rose-50/40 border-rose-200/80'
                    : 'bg-slate-50/70 border-slate-200/70 hover:border-blue-200'
                }`}
              >
                {/* Left: Info */}
                <div className="flex items-start gap-3 min-w-0">
                  <div
                    className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-xs font-bold mt-0.5 ${
                      isTaken
                        ? 'bg-emerald-600 text-white'
                        : isSnoozed
                        ? 'bg-amber-500 text-white'
                        : isMissed
                        ? 'bg-rose-500 text-white'
                        : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {isTaken ? '✓' : '○'}
                  </div>

                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-xs font-bold text-slate-900 truncate">
                        {item.medicineName}
                      </h4>
                      <span className="text-[11px] font-semibold text-slate-600 bg-white/80 px-1.5 py-0.5 rounded border border-slate-200/60">
                        {item.dosage}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 text-[11px] text-slate-500 mt-0.5 flex-wrap">
                      <span className="font-semibold text-slate-700 flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-400" />
                        {item.scheduledTime}
                      </span>
                      {item.withFood && (
                        <>
                          <span>·</span>
                          <span className="text-slate-600 font-medium">With Food</span>
                        </>
                      )}
                      {item.instructions && (
                        <>
                          <span>·</span>
                          <span className="text-slate-500 italic truncate max-w-[200px]">
                            {item.instructions}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Right: Actions / Status */}
                <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
                  {isTaken ? (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 text-[11px] font-bold">
                      <Check className="w-3 h-3" />
                      Taken at {new Date(item.takenTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  ) : (
                    <>
                      {isSnoozed && (
                        <span className="text-[10px] text-amber-700 font-semibold px-2 py-0.5 bg-amber-100/70 rounded">
                          Snoozed (30m)
                        </span>
                      )}
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => handleAction(item, 'TAKEN')}
                        className="px-2.5 py-1 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        Taken
                      </button>
                      <button
                        type="button"
                        disabled={actionLoading !== null}
                        onClick={() => handleAction(item, 'SNOOZED')}
                        className="px-2.5 py-1 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-300 rounded-md transition-colors disabled:opacity-50 flex items-center gap-1"
                      >
                        <Bell className="w-3.5 h-3.5 text-slate-500" />
                        Snooze
                      </button>
                    </>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Footer */}
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 font-medium">
        <span>Logged adherence updates automatically</span>
        <button
          onClick={fetchMedications}
          className="text-blue-600 hover:text-blue-800 font-semibold flex items-center gap-1"
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </button>
      </div>
    </div>
  );
};

export default TodaysMedication;
