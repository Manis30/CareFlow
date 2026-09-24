import React from 'react';
import { Target, CheckCircle2, TrendingUp, TrendingDown } from 'lucide-react';

/**
 * CareFlowBenchmark
 * True bullet/benchmark visualization comparing a current clinical rate (e.g. completion rate)
 * against a real, dynamically-computed platform median or benchmark.
 * Never uses hardcoded or fabricated targets.
 */
export const CareFlowBenchmark = ({
  title = 'Platform Completion Performance',
  subtitle = 'Actual case completion rate evaluated against platform cohort median',
  value = 0, // e.g. 84
  benchmark = null, // e.g. 78 (real dynamic benchmark)
  unit = '%',
  height = 140,
  className = ''
}) => {
  const numericVal = Math.min(100, Math.max(0, Number(value) || 0));
  const numericBench = benchmark !== null && benchmark !== undefined ? Math.min(100, Math.max(0, Number(benchmark))) : null;

  const delta = numericBench !== null ? numericVal - numericBench : null;
  const isPositive = delta !== null ? delta >= 0 : true;

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-4 flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="w-4 h-4 text-emerald-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>

        {delta !== null && (
          <span className={`inline-flex items-center gap-1 text-xs font-bold px-2.5 py-1 rounded-full border ${
            isPositive
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : 'bg-amber-50 text-amber-700 border-amber-200'
          }`}>
            {isPositive ? <TrendingUp className="w-3.5 h-3.5 text-emerald-600" /> : <TrendingDown className="w-3.5 h-3.5 text-amber-600" />}
            <span>{delta >= 0 ? `+${delta}` : delta}{unit} vs Median</span>
          </span>
        )}
      </div>

      {/* Main Metric Display & Bullet Track */}
      <div className="space-y-2.5">
        <div className="flex items-baseline justify-between">
          <div className="flex items-baseline gap-1.5">
            <span className="text-3xl font-extrabold text-slate-900 font-sans tracking-tight">
              {numericVal}{unit}
            </span>
            <span className="text-xs font-semibold text-slate-500">Realized Rate</span>
          </div>

          {numericBench !== null && (
            <div className="text-right text-xs">
              <span className="text-slate-400 block text-[10px] uppercase font-bold">Platform Median</span>
              <span className="font-bold text-slate-700">{numericBench}{unit}</span>
            </div>
          )}
        </div>

        {/* Bullet Progress Bar */}
        <div className="relative w-full h-7 bg-slate-100 rounded-lg overflow-hidden border border-slate-200/80">
          {/* Qualitative Background Zones */}
          <div className="absolute inset-0 flex">
            <div className="w-[60%] h-full bg-slate-100/60 border-r border-slate-200/40" title="Developing (<60%)" />
            <div className="w-[25%] h-full bg-slate-50/60 border-r border-slate-200/40" title="Expected (60-85%)" />
            <div className="w-[15%] h-full bg-emerald-50/30" title="Optimal (>85%)" />
          </div>

          {/* Actual Value Bar */}
          <div
            className="absolute top-1 bottom-1 left-1 bg-gradient-to-r from-blue-600 to-emerald-600 rounded-md transition-all duration-1000 ease-out shadow-xs"
            style={{ width: `calc(${numericVal}% - 8px)` }}
          />

          {/* Benchmark Needle Line */}
          {numericBench !== null && (
            <div
              className="absolute top-0 bottom-0 w-1 bg-slate-900 z-10 transition-all duration-700 shadow-sm"
              style={{ left: `${numericBench}%` }}
              title={`Platform Median: ${numericBench}%`}
            >
              <div className="w-2.5 h-1.5 bg-slate-900 absolute -top-0.5 -left-[3px] rounded-xs" />
              <div className="w-2.5 h-1.5 bg-slate-900 absolute -bottom-0.5 -left-[3px] rounded-xs" />
            </div>
          )}
        </div>

        {/* Scale Ticks */}
        <div className="flex justify-between text-[10px] font-semibold text-slate-400 font-mono px-0.5">
          <span>0%</span>
          <span>25%</span>
          <span>50%</span>
          <span>75%</span>
          <span>100%</span>
        </div>
      </div>
    </div>
  );
};

export default CareFlowBenchmark;
