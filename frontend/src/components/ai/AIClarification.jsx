import React from 'react';
import { HelpCircle, ChevronRight } from 'lucide-react';

export const AIClarification = ({
  question,
  options = [],
  onSelectOption,
  className = ''
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs space-y-3 my-2 text-slate-800 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
        <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center border border-blue-100">
          <HelpCircle className="w-3.5 h-3.5 text-blue-600" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-slate-900">
          Clinical Clarification Required
        </span>
      </div>

      <p className="text-xs text-slate-700 font-medium leading-relaxed">
        {question || 'Please specify further details to proceed accurately.'}
      </p>

      {Array.isArray(options) && options.length > 0 && (
        <div className="space-y-1.5 pt-1">
          {options.map((opt, idx) => {
            const label = typeof opt === 'string' ? opt : opt.label || opt.text;
            return (
              <button
                key={idx}
                type="button"
                onClick={() => onSelectOption && onSelectOption(opt)}
                className="w-full flex items-center justify-between p-2.5 rounded-xl border border-slate-200/70 bg-slate-50/70 hover:bg-blue-50/70 hover:border-blue-300 text-xs font-semibold text-slate-800 hover:text-blue-700 transition-colors cursor-pointer text-left"
              >
                <span>{label}</span>
                <ChevronRight className="w-4 h-4 text-blue-600" />
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default AIClarification;
