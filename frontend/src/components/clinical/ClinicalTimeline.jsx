import React from 'react';

/**
 * ClinicalTimeline
 * Vertical clinical marker timeline for appointments, records, and patient history.
 * Example: 09:30 │ ● Consultation │ ● Prescription │ ● Follow-up
 */
export const ClinicalTimeline = ({
  items = [],
  className = ''
}) => {
  if (!items || items.length === 0) return null;

  return (
    <div className={`space-y-4 ${className}`}>
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        return (
          <div key={idx} className="flex items-start gap-3.5">
            {/* Timestamp Column */}
            <div className="w-16 sm:w-20 shrink-0 text-right pt-0.5">
              <span className="text-xs font-bold text-blue-600 block font-mono">
                {item.time || item.date}
              </span>
              {item.duration && (
                <span className="text-[10px] text-slate-400 block font-medium">
                  {item.duration}
                </span>
              )}
            </div>

            {/* Vertical Marker */}
            <div className="flex flex-col items-center shrink-0 self-stretch">
              <div
                className={`w-3 h-3 rounded-full border-2 ${
                  item.active
                    ? 'bg-blue-600 border-blue-600 shadow-xs shadow-blue-500/30'
                    : item.completed
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'bg-white border-slate-300'
                }`}
              />
              {!isLast && <div className="w-0.5 flex-1 bg-slate-200 my-1" />}
            </div>

            {/* Content Body */}
            <div className="flex-1 pb-4 min-w-0">
              <div className="bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs hover:border-blue-400 transition-colors space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <h4 className="text-xs font-bold text-slate-900 truncate">
                    {item.title}
                  </h4>
                  {item.status && <div>{item.status}</div>}
                </div>
                {item.subtitle && (
                  <p className="text-[11px] text-slate-500 truncate font-normal">
                    {item.subtitle}
                  </p>
                )}
                {item.description && (
                  <p className="text-xs text-slate-700 pt-1 font-normal">
                    {item.description}
                  </p>
                )}
                {item.actions && (
                  <div className="pt-2 flex items-center gap-2">
                    {item.actions}
                  </div>
                )}
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
};

export default ClinicalTimeline;
