import React from 'react';
import { ArrowLeft, Activity } from 'lucide-react';

/**
 * AdminPageContainer - Shared top-level container for all Organization Admin pages.
 * Enforces standardized Private Clinical spacing: max-width, fluid padding, and clean typography.
 */
export const AdminPageContainer = ({ children, className = '' }) => {
  return (
    <div className={`w-full max-w-[1600px] mx-auto space-y-6 pb-12 font-sans antialiased text-slate-800 ${className}`}>
      {children}
    </div>
  );
};

/**
 * AdminPageHeader - Editorial display header across all Organization Admin pages.
 * Features Source Serif 4 display title, subtitle, back button, and actions.
 */
export const AdminPageHeader = ({
  title,
  subtitle,
  onBack,
  backText = 'Back',
  actions,
  showPulse = false,
  className = ''
}) => {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-slate-200/80 shrink-0 ${className}`}>
      <div className="flex items-start gap-3.5">
        {onBack && (
          <button
            type="button"
            onClick={onBack}
            className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-white border border-slate-200/80 hover:bg-blue-50 hover:text-blue-600 text-slate-700 text-xs font-semibold shadow-xs transition-all cursor-pointer mt-1"
          >
            <ArrowLeft className="w-3.5 h-3.5 text-blue-600" />
            <span>{backText}</span>
          </button>
        )}
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">{title}</h1>
          {subtitle && <p className="text-xs sm:text-sm text-slate-500 font-medium">{subtitle}</p>}
        </div>
      </div>

      {actions ? (
        <div className="flex items-center gap-2.5 self-start sm:self-auto">{actions}</div>
      ) : showPulse ? (
        <div className="hidden sm:flex items-center justify-center w-10 h-10 rounded-xl bg-blue-50 border border-blue-100 text-blue-600 shadow-xs shrink-0">
          <Activity className="w-4 h-4 animate-pulse" />
        </div>
      ) : null}
    </div>
  );
};

/**
 * AdminCard - Standardized surface with 1px border, rounded-2xl corners, and clean shadows.
 */
export const AdminCard = ({ children, className = '', noPadding = false, leftAccent = false }) => {
  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden relative ${
        leftAccent ? 'border-l-4 border-l-blue-600' : ''
      } ${noPadding ? '' : 'p-5 sm:p-6'} ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * AdminSection - Section container with header, subtitle, optional actions, and vertical rhythm.
 */
export const AdminSection = ({ title, subtitle, actions, children, className = '' }) => {
  return (
    <div className={`space-y-4 ${className}`}>
      {(title || actions) && (
        <div className="flex items-center justify-between border-b border-slate-200/80 pb-3">
          <div>
            {title && <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">{title}</h2>}
            {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
          </div>
          {actions && <div className="flex items-center gap-2.5">{actions}</div>}
        </div>
      )}
      {children}
    </div>
  );
};

/**
 * FormField - Form field wrapper enforcing label typography and validation states.
 */
export const FormField = ({ label, required, error, children, className = '' }) => {
  return (
    <div className={`space-y-1.5 ${className}`}>
      {label && (
        <label className="block text-xs sm:text-sm font-semibold text-slate-900">
          {label} {required && <span className="text-rose-600">*</span>}
        </label>
      )}
      {children}
      {error && <p className="text-xs text-rose-600 font-medium mt-1">{error}</p>}
    </div>
  );
};

/**
 * AdminTable - Standardized table surface container with uppercase header typography.
 */
export const AdminTable = ({ headers, children, className = '' }) => {
  return (
    <div className={`border border-slate-200/80 rounded-2xl overflow-hidden bg-white shadow-xs ${className}`}>
      {headers && (
        <div className="bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-500 uppercase tracking-wider py-2.5 px-4 sm:px-5">
          {headers}
        </div>
      )}
      <div className="divide-y divide-slate-100">{children}</div>
    </div>
  );
};

/**
 * FilterBar - Standard search and filter control container across admin pages.
 */
export const FilterBar = ({ children, className = '' }) => {
  return (
    <div className={`bg-white rounded-2xl border border-slate-200/80 p-3.5 sm:p-4 shadow-xs flex flex-col sm:flex-row items-center justify-between gap-3 sm:gap-4 ${className}`}>
      {children}
    </div>
  );
};

/**
 * PageActionFooter - Standardized form footer action bar with subtle top border.
 */
export const PageActionFooter = ({ children, className = '' }) => {
  return (
    <div className={`pt-5 border-t border-slate-200/80 flex items-center justify-end gap-3 ${className}`}>
      {children}
    </div>
  );
};

export { StatCard, AnimatedCount } from '../common/StatCard';
