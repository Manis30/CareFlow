import React from 'react';
import { X } from 'lucide-react';

export const ContextPanel = ({
  isOpen = false,
  onClose,
  title = 'Clinical Context',
  subtitle = null,
  width = 'w-80 lg:w-96',
  children,
  className = ''
}) => {
  if (!isOpen) return null;

  return (
    <aside
      aria-label={title}
      className={`shrink-0 bg-white border-l border-slate-200/80 flex flex-col h-[calc(100vh-4rem)] sticky top-16 z-20 transition-all duration-200 ${width} ${className}`}
    >
      {/* Panel Header */}
      <div className="h-14 px-4 sm:px-5 flex items-center justify-between border-b border-slate-200/80 bg-slate-50/75">
        <div className="truncate">
          <h3 className="text-xs font-bold uppercase tracking-wider text-slate-900 truncate">
            {title}
          </h3>
          {subtitle && (
            <span className="text-[11px] text-slate-500 block truncate">
              {subtitle}
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close panel"
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Panel Content */}
      <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4">
        {children}
      </div>
    </aside>
  );
};

export default ContextPanel;
