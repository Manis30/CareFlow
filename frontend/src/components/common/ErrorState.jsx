import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';
import Button from './Button';

export const ErrorState = ({
  title = 'Service Notice',
  message = 'CareFlow was unable to complete this request. The system state remains preserved.',
  onRetry,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-7 text-center bg-white rounded-xl border border-rose-200 shadow-2xs ${className}`}
    >
      <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center mb-3 border border-rose-100">
        <AlertCircle className="w-5 h-5 text-rose-600" />
      </div>
      <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed font-medium">
        {message}
      </p>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry} icon={RotateCcw}>
          Retry Action
        </Button>
      )}
    </div>
  );
};

export default ErrorState;
