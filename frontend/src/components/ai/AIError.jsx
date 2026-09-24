import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from '../common/Button';

export const AIError = ({
  errorText = 'CareFlow Intelligence was unable to complete this action.',
  details = null,
  onRetry = null,
  className = ''
}) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-rose-200 p-4 shadow-xs space-y-2.5 my-2.5 text-slate-900 ${className}`}
    >
      <div className="flex items-center gap-2 border-b border-rose-100 pb-2">
        <div className="w-6 h-6 rounded-lg bg-rose-50 text-rose-600 flex items-center justify-center">
          <AlertCircle className="w-3.5 h-3.5 text-rose-600" />
        </div>
        <span className="text-[11px] font-bold uppercase tracking-wider text-rose-700">
          Intelligence Notice
        </span>
      </div>

      <p className="text-xs text-slate-700 font-medium leading-relaxed">
        {errorText}
      </p>

      {details && (
        <p className="text-[11px] text-slate-500 bg-slate-50 p-2.5 rounded-xl font-mono border border-slate-200">
          {details}
        </p>
      )}

      {onRetry && (
        <div className="pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={onRetry}
            icon={RotateCcw}
            className="text-xs"
          >
            Retry Request
          </Button>
        </div>
      )}
    </div>
  );
};

export default AIError;
