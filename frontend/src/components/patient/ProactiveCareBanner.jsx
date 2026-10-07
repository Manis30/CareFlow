import React, { useState, useEffect } from 'react';
import { AlertCircle, Calendar, Pill, DollarSign, Clock, X } from 'lucide-react';
import { getMyProactiveAlertsApi } from '../../api/medication';

export const ProactiveCareBanner = () => {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState({});

  useEffect(() => {
    getMyProactiveAlertsApi()
      .then((res) => {
        if (Array.isArray(res?.data)) {
          setAlerts(res.data);
        }
      })
      .catch(() => {});
  }, []);

  const activeAlerts = alerts.filter((_, idx) => !dismissed[idx]);

  if (activeAlerts.length === 0) return null;

  return (
    <div className="space-y-2">
      {activeAlerts.map((alert, idx) => {
        const isUrgent = alert.severity === 'high';
        let Icon = AlertCircle;
        if (alert.category === 'APPOINTMENT') Icon = Calendar;
        if (alert.category === 'MEDICATION') Icon = Pill;
        if (alert.category === 'PAYMENT') Icon = DollarSign;
        if (alert.category === 'FOLLOW_UP') Icon = Clock;

        return (
          <div
            key={idx}
            className={`p-3.5 rounded-xl border flex items-start justify-between gap-3 text-xs shadow-2xs transition-all ${
              isUrgent
                ? 'bg-rose-50/70 border-rose-200 text-rose-950'
                : 'bg-amber-50/70 border-amber-200 text-amber-950'
            }`}
          >
            <div className="flex items-start gap-2.5 min-w-0">
              <div
                className={`w-6 h-6 rounded-md flex items-center justify-center shrink-0 mt-0.5 ${
                  isUrgent ? 'bg-rose-100 text-rose-700' : 'bg-amber-100 text-amber-700'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-bold">{alert.title}</span>
                  <span
                    className={`text-[10px] uppercase font-bold px-1.5 py-0.2 rounded ${
                      isUrgent ? 'bg-rose-200/80 text-rose-800' : 'bg-amber-200/80 text-amber-800'
                    }`}
                  >
                    Proactive Care
                  </span>
                </div>
                <p className="text-[11px] opacity-90 mt-0.5">{alert.message}</p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDismissed((prev) => ({ ...prev, [idx]: true }))}
              className="p-1 rounded hover:bg-black/5 text-slate-400 hover:text-slate-600 transition-colors shrink-0"
              title="Dismiss"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ProactiveCareBanner;
