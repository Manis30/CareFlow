import React from 'react';

/**
 * Base clinical skeleton pulse block
 */
export const Skeleton = ({ className = '', ...props }) => (
  <div
    className={`animate-pulse bg-slate-200/70 rounded-xl ${className}`}
    aria-hidden="true"
    {...props}
  />
);

/**
 * Skeleton for KPI / Stat tiles
 */
export const KpiSkeleton = ({ count = 4, className = '' }) => (
  <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="rounded-xl border border-slate-200/80 bg-white p-5 shadow-xs space-y-3"
      >
        <div className="flex items-center justify-between">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-9 w-9 rounded-xl" />
        </div>
        <Skeleton className="h-8 w-24 rounded-lg" />
        <Skeleton className="h-3.5 w-36 rounded-md" />
      </div>
    ))}
  </div>
);

/**
 * Skeleton for clinical data tables
 */
export const TableSkeleton = ({ rows = 5, columns = 5, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200/80 shadow-xs overflow-hidden ${className}`}>
    <div className="p-4 border-b border-slate-100 flex items-center justify-between">
      <Skeleton className="h-5 w-40 rounded-md" />
      <Skeleton className="h-8 w-24 rounded-lg" />
    </div>
    <div className="p-4 space-y-3">
      {/* Table Header */}
      <div className="flex items-center gap-4 py-2 border-b border-slate-100">
        {Array.from({ length: columns }).map((_, colIdx) => (
          <Skeleton key={colIdx} className="h-3.5 flex-1 rounded" />
        ))}
      </div>
      {/* Table Rows */}
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div key={rowIdx} className="flex items-center gap-4 py-3 border-b border-slate-50 last:border-0">
          <div className="flex items-center gap-2.5 flex-1">
            <Skeleton className="w-8 h-8 rounded-full shrink-0" />
            <div className="space-y-1.5 flex-1">
              <Skeleton className="h-3.5 w-3/4 rounded" />
              <Skeleton className="h-2.5 w-1/2 rounded" />
            </div>
          </div>
          {Array.from({ length: columns - 1 }).map((_, colIdx) => (
            <Skeleton key={colIdx} className="h-3.5 flex-1 rounded" />
          ))}
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton for clinical cards / detail widgets
 */
export const CardSkeleton = ({ className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-3.5 ${className}`}>
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <div className="flex items-center gap-2.5">
        <Skeleton className="w-8 h-8 rounded-lg" />
        <Skeleton className="h-4 w-32 rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-full" />
    </div>
    <div className="space-y-2">
      <Skeleton className="h-3.5 w-full rounded" />
      <Skeleton className="h-3.5 w-4/5 rounded" />
      <Skeleton className="h-3.5 w-3/5 rounded" />
    </div>
  </div>
);

/**
 * Skeleton for analytics charts
 */
export const ChartSkeleton = ({ height = 240, className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-xs space-y-4 ${className}`}>
    <div className="flex items-center justify-between pb-3 border-b border-slate-100">
      <div className="space-y-1">
        <Skeleton className="h-4 w-32 rounded-md" />
        <Skeleton className="h-3 w-48 rounded-md" />
      </div>
      <Skeleton className="h-6 w-16 rounded-lg" />
    </div>
    <div className="flex items-end gap-3 pt-4 px-2" style={{ height }}>
      {Array.from({ length: 7 }).map((_, i) => (
        <div key={i} className="flex-1 flex flex-col items-center gap-2 h-full justify-end">
          <Skeleton
            className="w-full rounded-t-md"
            style={{ height: `${25 + ((i * 19) % 60)}%` }}
          />
          <Skeleton className="h-2.5 w-6 rounded" />
        </div>
      ))}
    </div>
  </div>
);

/**
 * Skeleton for daily schedule / appointment feeds
 */
export const ScheduleSkeleton = ({ count = 3, className = '' }) => (
  <div className={`space-y-3 ${className}`}>
    {Array.from({ length: count }).map((_, i) => (
      <div
        key={i}
        className="p-3.5 bg-white rounded-xl border border-slate-200/80 shadow-xs flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3 min-w-0 flex-1">
          <Skeleton className="w-10 h-10 rounded-xl shrink-0" />
          <div className="space-y-1.5 flex-1 min-w-0">
            <Skeleton className="h-4 w-36 rounded" />
            <Skeleton className="h-3 w-48 rounded" />
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

/**
 * Skeleton for user / clinician profiles
 */
export const ProfileSkeleton = ({ className = '' }) => (
  <div className={`bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5 ${className}`}>
    <div className="flex items-center gap-4">
      <Skeleton className="w-16 h-16 rounded-full shrink-0" />
      <div className="space-y-2 flex-1">
        <Skeleton className="h-5 w-48 rounded-md" />
        <Skeleton className="h-3.5 w-32 rounded-md" />
      </div>
    </div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t border-slate-100">
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
      <Skeleton className="h-10 rounded-xl" />
    </div>
  </div>
);

export default Skeleton;
