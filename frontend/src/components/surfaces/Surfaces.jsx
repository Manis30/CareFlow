import React from 'react';
import { Activity, Sparkles } from 'lucide-react';

/**
 * 1. Information Surface
 * Purpose: Elevated clean container for standard application information.
 */
export const InformationSurface = ({
  children,
  className = '',
  padding = 'p-5 sm:p-6',
  onClick = null
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 shadow-xs transition-all ${
        onClick ? 'cursor-pointer hover:border-blue-400 hover:shadow-md' : ''
      } ${padding} ${className}`}
    >
      {children}
    </div>
  );
};

/**
 * 2. Clinical Surface
 * Purpose: Container dedicated to clinical content (visit context, vital stats, records, diagnosis).
 * Visual: Subtle blue left accent bar and clean clinical structure.
 */
export const ClinicalSurface = ({
  children,
  className = '',
  padding = 'p-5 sm:p-6',
  badge = null
}) => {
  return (
    <div
      className={`bg-white rounded-xl border border-slate-200/80 border-l-4 border-l-blue-600 shadow-xs relative ${padding} ${className}`}
    >
      {badge && (
        <div className="absolute top-4 right-4">
          {badge}
        </div>
      )}
      {children}
    </div>
  );
};

/**
 * 3. Metric Surface
 * Purpose: Compact DomoApp-style operational metric tile.
 */
export const MetricSurface = ({
  label,
  value,
  subtext = null,
  trend = null, // { value: '+8.4%', positive: true }
  icon: Icon = null,
  className = '',
  onClick = null
}) => {
  return (
    <div
      onClick={onClick}
      className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-3 transition-all duration-200 ${
        onClick ? 'cursor-pointer hover:border-blue-500 hover:shadow-md hover:-translate-y-0.5' : ''
      } ${className}`}
    >
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-500">
          {label}
        </span>
        {Icon && (
          <div className="w-8 h-8 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
            <Icon className="w-4 h-4 text-blue-600" />
          </div>
        )}
      </div>

      <div className="space-y-1">
        <div className="text-2xl sm:text-3xl font-black text-slate-900 tracking-tight">
          {value}
        </div>
        <div className="flex items-center gap-2">
          {trend && (
            <span
              className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${
                trend.positive ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}
            >
              {trend.positive ? '▲' : '▼'} {trend.value}
            </span>
          )}
          {subtext && (
            <span className="text-xs text-slate-500 truncate font-medium">
              {subtext}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

/**
 * 4. Action Surface
 * Purpose: Primary workflow launcher with clean hover state.
 */
export const ActionSurface = ({
  icon: Icon = null,
  title,
  description = null,
  actionText = 'View',
  onClick,
  className = ''
}) => {
  return (
    <div
      onClick={onClick}
      className={`group bg-white rounded-xl border border-slate-200/80 hover:border-blue-500 hover:shadow-md p-5 shadow-xs transition-all duration-200 cursor-pointer flex items-center justify-between gap-4 ${className}`}
    >
      <div className="flex items-center gap-3.5 min-w-0">
        {Icon && (
          <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100 group-hover:bg-blue-600 group-hover:text-white transition-colors">
            <Icon className="w-5 h-5 text-blue-600 group-hover:text-white transition-colors" />
          </div>
        )}
        <div className="truncate">
          <h4 className="text-sm font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
            {title}
          </h4>
          {description && (
            <p className="text-xs text-slate-500 truncate font-normal">
              {description}
            </p>
          )}
        </div>
      </div>

      <span className="text-xs font-bold text-blue-600 group-hover:translate-x-0.5 transition-transform shrink-0">
        {actionText} →
      </span>
    </div>
  );
};

/**
 * 5. Insight Surface
 * Purpose: Structured AI and clinical intelligence findings.
 */
export const InsightSurface = ({
  title = 'CareFlow Intelligence',
  children,
  badge = null,
  className = ''
}) => {
  return (
    <div className={`bg-indigo-50/60 rounded-xl border border-indigo-200/80 p-5 shadow-xs space-y-3 ${className}`}>
      <div className="flex items-center justify-between border-b border-indigo-200/60 pb-2.5">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-indigo-600" />
          <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-900">
            {title}
          </h4>
        </div>
        {badge && <div>{badge}</div>}
      </div>
      <div className="text-xs text-slate-800 leading-relaxed font-normal">
        {children}
      </div>
    </div>
  );
};

/**
 * 6. Timeline Surface
 * Purpose: Step or record inside a clinical timeline sequence.
 */
export const TimelineSurface = ({
  time,
  title,
  subtitle = null,
  status = null,
  children = null,
  isCurrent = false,
  className = ''
}) => {
  return (
    <div className={`relative flex items-start gap-4 pb-6 last:pb-0 ${className}`}>
      {/* Timeline Bar */}
      <div className="flex flex-col items-center shrink-0">
        <div
          className={`w-3.5 h-3.5 rounded-full border-2 ${
            isCurrent
              ? 'bg-blue-600 border-blue-600 shadow-sm shadow-blue-500/40'
              : 'bg-white border-slate-300'
          }`}
        />
        <div className="w-0.5 flex-1 bg-slate-200 my-1 min-h-[30px]" />
      </div>

      {/* Content */}
      <div className="flex-1 bg-white rounded-xl border border-slate-200/80 p-3.5 shadow-2xs space-y-1 min-w-0">
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-bold text-blue-600">{time}</span>
          {status && <div>{status}</div>}
        </div>
        <h5 className="text-xs font-bold text-slate-900 truncate">{title}</h5>
        {subtitle && <p className="text-[11px] text-slate-500 truncate font-normal">{subtitle}</p>}
        {children && <div className="pt-2">{children}</div>}
      </div>
    </div>
  );
};

/**
 * 7. Profile Surface
 * Purpose: Doctor, patient, or organization entity presentation.
 */
export const ProfileSurface = ({
  avatar,
  name,
  subtitle,
  tags = [],
  actions = null,
  className = ''
}) => {
  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div className="flex items-center gap-3.5 min-w-0">
        <div className="w-12 h-12 rounded-full overflow-hidden bg-blue-50 shrink-0 border border-blue-200 flex items-center justify-center font-bold text-blue-700">
          {avatar}
        </div>
        <div className="space-y-1 min-w-0">
          <h4 className="text-sm font-bold text-slate-900 truncate">{name}</h4>
          <p className="text-xs text-slate-500 truncate font-normal">{subtitle}</p>
          {tags.length > 0 && (
            <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
              {tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 text-[10px] font-bold"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  );
};

export default {
  InformationSurface,
  ClinicalSurface,
  MetricSurface,
  ActionSurface,
  InsightSurface,
  TimelineSurface,
  ProfileSurface
};
