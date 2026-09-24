import React from 'react';
import {
  BarChart2,
  TrendingUp,
  TrendingDown,
  Award,
  Calendar,
  Layers,
  Activity,
  ArrowUpRight,
  ArrowDownRight,
  Minus,
  CheckCircle2,
  Building2,
  Stethoscope,
  Sparkles
} from 'lucide-react';

export const AIAnalyticsResult = ({ result, data, summaryText, className = '' }) => {
  const payload = result || data;
  if (!payload) {
    return <div className="whitespace-pre-line leading-relaxed text-xs text-slate-700">{summaryText}</div>;
  }

  const title = payload.title || 'Healthcare Intelligence Breakdown';
  const scope = payload.scope || 'Platform Metrics';
  const period = payload.period || (payload.timeframe ? payload.timeframe.replace('_', ' ') : 'Current Period');
  const narrative = summaryText || payload.groundedNarrative || payload.summary || '';

  // Extract Primary Metric
  let primaryMetric = payload.primaryMetric;
  if (!primaryMetric && payload.stats) {
    primaryMetric = {
      label: 'Total Appointments',
      value: payload.stats.total ?? 0,
      growth: payload.growth || null
    };
  }

  // Extract Supporting Metrics
  let supportingMetrics = payload.supportingMetrics;
  if (!supportingMetrics && payload.stats) {
    supportingMetrics = [
      { label: 'Completed', value: `${payload.stats.completed ?? 0} (${payload.completionRate || payload.stats.completionRate || 0}%)` },
      { label: 'Cancelled', value: `${payload.stats.cancelled ?? 0} (${payload.cancellationRate || payload.stats.cancellationRate || 0}%)` },
      { label: 'Active Queue', value: payload.stats.activeQueue ?? 0 }
    ];
  }

  // Extract Trend Data
  const trendList = Array.isArray(payload.trend) ? payload.trend : [];
  const maxTrendVal = trendList.length > 0 ? Math.max(...trendList.map((t) => Number(t.value) || 0), 1) : 1;

  // Extract Ranking / Distribution List
  let rankingList = Array.isArray(payload.ranking) ? payload.ranking : [];
  if (rankingList.length === 0) {
    const rawList = payload.byDepartment || payload.byDoctor || payload.departments;
    if (Array.isArray(rawList)) {
      rankingList = rawList
        .map((item, idx) => ({
          rank: idx + 1,
          name: item.department || item.doctor || item.name || item.clinicName || item.specialty,
          volume: item.count || item.totalAppointments || item.volume || item.value || 0,
          details: item.cancellationRate ? `${item.cancellationRate}% cancellations` : undefined
        }))
        .filter((item) => item.name && item.volume > 0);
    }
  }

  // Determine Growth Pill Styling
  const growth = primaryMetric?.growth;
  const isCancellation = primaryMetric?.label?.toLowerCase().includes('cancel');
  // For cancellation, an increase is negative/bad
  const isGoodTrend = isCancellation ? !growth?.isPositive : growth?.isPositive;

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-sm space-y-3.5 my-2 text-slate-800 overflow-hidden ${className}`}>
      {/* 1. Header Bar: Title, Scope Badge & Period */}
      <div className="bg-slate-50/80 px-4 py-3 border-b border-slate-100 flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center shrink-0 border border-blue-200">
            <BarChart2 className="w-3.5 h-3.5" />
          </div>
          <span className="text-xs font-bold text-slate-900 tracking-tight">
            {title}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 text-[10px] font-bold uppercase tracking-wider border border-blue-100/80">
            {scope}
          </span>
          <span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-600 text-[10px] font-semibold border border-slate-200/70 flex items-center gap-1">
            <Calendar className="w-3 h-3 text-slate-400" />
            {period}
          </span>
        </div>
      </div>

      <div className="px-4 space-y-3.5 pb-3">
        {/* 2. Primary KPI Display & Comparison Pill */}
        {primaryMetric && (
          <div className="bg-linear-to-br from-slate-50 via-white to-blue-50/40 p-3.5 rounded-xl border border-slate-200/80 flex items-center justify-between gap-4">
            <div>
              <span className="text-[11px] font-semibold text-slate-500 block uppercase tracking-wider">
                {primaryMetric.label}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-slate-900 font-mono tracking-tight mt-0.5">
                {primaryMetric.value}
              </div>
            </div>

            {growth && (
              <div className="text-right shrink-0">
                <div
                  className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border ${
                    isGoodTrend
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-rose-50 text-rose-700 border-rose-200'
                  }`}
                >
                  {growth.isPositive ? (
                    <TrendingUp className="w-3.5 h-3.5" />
                  ) : growth.diff === 0 ? (
                    <Minus className="w-3.5 h-3.5 text-slate-400" />
                  ) : (
                    <TrendingDown className="w-3.5 h-3.5" />
                  )}
                  <span>
                    {growth.diff > 0 ? `+${growth.diff}` : growth.diff}{' '}
                    {growth.percentage ? `(${growth.percentage}%)` : ''}
                  </span>
                </div>
                <span className="text-[10px] text-slate-400 block mt-1 font-medium">
                  vs previous period
                </span>
              </div>
            )}
          </div>
        )}

        {/* 3. Supporting Metrics Grid */}
        {Array.isArray(supportingMetrics) && supportingMetrics.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {supportingMetrics.map((metric, idx) => (
              <div
                key={idx}
                className="bg-slate-50/70 px-3 py-2 rounded-lg border border-slate-100 text-left"
              >
                <span className="text-[10px] font-semibold text-slate-500 block truncate">
                  {metric.label}
                </span>
                <span className="text-sm font-bold text-slate-800 font-mono block mt-0.5">
                  {metric.value}
                </span>
              </div>
            ))}
          </div>
        )}

        {/* 4. Multi-Month Trend Chart Visualization */}
        {trendList.length > 0 && (
          <div className="bg-slate-50/60 p-3 rounded-xl border border-slate-200/70 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                <Activity className="w-3.5 h-3.5 text-blue-600" />
                Historical Trend
              </span>
              <span className="text-[10px] text-slate-400 font-medium">
                {trendList.length} points
              </span>
            </div>

            <div className="h-24 pt-4 pb-1 flex items-end justify-between gap-1 sm:gap-2">
              {trendList.map((t, idx) => {
                const val = Number(t.value) || 0;
                const heightPct = Math.max(12, Math.min(100, Math.round((val / maxTrendVal) * 100)));
                return (
                  <div key={idx} className="flex-1 flex flex-col items-center h-full justify-end group">
                    <span className="text-[9px] font-mono font-bold text-slate-600 opacity-80 group-hover:opacity-100 group-hover:text-blue-600 transition-opacity mb-1">
                      {val}
                    </span>
                    <div
                      style={{ height: `${heightPct}%` }}
                      className="w-full max-w-[28px] rounded-t-md bg-blue-500/80 group-hover:bg-blue-600 transition-all shadow-2xs"
                    />
                    <span className="text-[9px] font-semibold text-slate-500 mt-1.5 truncate max-w-full text-center">
                      {t.label?.replace(/^\d{4}-/, '') || `P${idx + 1}`}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 5. Structured Ranking / Breakdown Table */}
        {rankingList.length > 0 && (
          <div className="bg-slate-50/80 p-3 rounded-xl border border-slate-200/60 space-y-2">
            <h5 className="text-[11px] font-bold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Award className="w-3.5 h-3.5 text-amber-500" />
              Performance & Distribution Ranking
            </h5>

            <div className="space-y-1.5 text-xs">
              {rankingList.slice(0, 6).map((item, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-1.5 px-2 rounded-lg bg-white border border-slate-100 hover:border-blue-100 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className="w-5 h-5 rounded-full bg-slate-100 text-slate-600 text-[10px] font-black flex items-center justify-center shrink-0">
                      {item.rank || idx + 1}
                    </span>
                    <span className="font-semibold text-slate-800 truncate">
                      {item.name}
                    </span>
                  </div>

                  <div className="flex items-center gap-2 shrink-0">
                    {item.details && (
                      <span className="text-[10px] text-slate-500 font-medium hidden sm:inline">
                        {item.details}
                      </span>
                    )}
                    <span className="font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md text-[11px] border border-blue-100/70">
                      {item.volume}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 6. Grounded Intelligence Narrative Callout */}
        {narrative && (
          <div className="bg-blue-50/50 border border-blue-100 rounded-xl p-3 flex items-start gap-2.5">
            <Sparkles className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
            <p className="whitespace-pre-line text-xs leading-relaxed text-slate-700 font-medium">
              {narrative}
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIAnalyticsResult;
