import React from 'react';
import { HeartPulse } from 'lucide-react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = HeartPulse,
  title = 'No clinical activity on record',
  description = 'Your timeline is clear. New records and updates will be cataloged here as they occur.',
  actionText,
  onAction,
  className = ''
}) => {
  return (
    <div
      className={`flex flex-col items-center justify-center p-6 sm:p-7 text-center bg-white rounded-xl border border-slate-200/80 shadow-2xs ${className}`}
    >
      <div className="w-11 h-11 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center mb-3 border border-blue-100 shadow-2xs">
        <Icon className="w-5.5 h-5.5 text-blue-600" />
      </div>
      <h4 className="text-sm sm:text-base font-bold text-slate-900 mb-1">
        {title}
      </h4>
      <p className="text-xs text-slate-500 max-w-sm mb-4 leading-relaxed font-medium">
        {description}
      </p>
      {actionText && onAction && (
        <Button variant="primary" size="sm" onClick={onAction}>
          {actionText}
        </Button>
      )}
    </div>
  );
};

export default EmptyState;
