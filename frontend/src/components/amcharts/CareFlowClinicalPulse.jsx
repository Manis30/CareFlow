import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_TOKENS } from './amchartsTheme';
import { Activity, AlertTriangle } from 'lucide-react';

/**
 * CareFlowClinicalPulse
 * 
 * Signature full-size clinical cardiac monitor chart:
 *  - 4-series ECG stroke language with low-opacity glow fills
 *  - Anomaly bullets in #EF4444 where cancellations exceed 2σ from rolling mean
 *  - Accepts dateRange or interactive timeframe toggle
 */
export function CareFlowClinicalPulse({
  trendData = [],
  dateRange = null,
  height = 260,
  className = ''
}) {
  const chartRef = useRef(null);
  const [internalTimeframe, setInternalTimeframe] = useState('90D');

  const activeTimeframe = dateRange?.key && dateRange.key !== 'ALL' ? dateRange.key : internalTimeframe;

  // Process data & compute 2-sigma anomaly bullets for cancellations
  const processedData = useMemo(() => {
    if (!trendData || trendData.length === 0) return { chartData: [], anomalyCount: 0 };

    const now = new Date();
    let daysToKeep = 90;
    if (activeTimeframe === '7D') daysToKeep = 7;
    else if (activeTimeframe === '30D') daysToKeep = 30;
    else if (activeTimeframe === '90D') daysToKeep = 90;
    else if (activeTimeframe === '6M' || activeTimeframe === '180D') daysToKeep = 180;
    else if (activeTimeframe === '1Y') daysToKeep = 365;

    const cutoff = new Date(now);
    cutoff.setDate(cutoff.getDate() - daysToKeep);
    cutoff.setHours(0, 0, 0, 0);

    const relevant = trendData.filter((item) => {
      const d = new Date(item.date);
      return !isNaN(d.getTime()) && d >= cutoff;
    }).sort((a, b) => new Date(a.date) - new Date(b.date));

    // Calculate rolling mean and standard deviation of cancellations
    const cancelValues = relevant.map((r) => Number(r.cancelled) || 0);
    const mean = cancelValues.length > 0
      ? cancelValues.reduce((s, v) => s + v, 0) / cancelValues.length
      : 0;
    const variance = cancelValues.length > 1
      ? cancelValues.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / (cancelValues.length - 1)
      : 0;
    const stdDev = Math.sqrt(variance);
    const threshold = mean + 2 * (stdDev || 1);

    let anomalyCount = 0;
    const chartData = relevant.map((item) => {
      const cancelled = Number(item.cancelled) || 0;
      const isAnomaly = cancelled > threshold && cancelled >= 2;
      if (isAnomaly) anomalyCount++;

      return {
        date: new Date(item.date).getTime(),
        displayDate: item.date,
        total: Number(item.total) || 0,
        completed: Number(item.completed) || 0,
        cancelled,
        scheduled: Number(item.scheduled) || 0,
        isAnomaly,
        anomalyBullet: isAnomaly ? cancelled : null,
        anomalyLabel: isAnomaly ? `! ${cancelled} cancelled` : ''
      };
    });

    return { chartData, anomalyCount };
  }, [trendData, activeTimeframe]);

  const { chartData, anomalyCount } = processedData;

  useEffect(() => {
    if (!chartRef.current || !chartData.length) return;

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();

    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingLeft: 0,
        paddingRight: 14,
        paddingTop: 8,
        paddingBottom: 0
      })
    );

    // Subtle crosshair cursor
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, {
      behavior: 'none'
    }));
    cursor.lineY.set('visible', false);
    cursor.lineX.setAll({
      stroke: am5.color(CLINICAL_TOKENS.mutedText),
      strokeDasharray: [3, 3]
    });

    // Date Axis
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 45,
      strokeOpacity: 0
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3]
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.DateAxis.new(root, {
        baseInterval: { timeUnit: 'day', count: 1 },
        renderer: xRenderer,
        tooltip: createTooltip(root)
      })
    );

    // Value Axis
    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3]
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.mutedText),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: yRenderer
      })
    );

    // Helper to create smoothed cardiac series
    const createCardiacSeries = (name, field, colorHex, strokeWidth = 2, withFill = true) => {
      const series = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name,
          xAxis,
          yAxis,
          valueYField: field,
          valueXField: 'date',
          stroke: am5.color(colorHex),
          fill: am5.color(colorHex),
          tooltip: createTooltip(root)
        })
      );

      series.strokes.template.setAll({
        strokeWidth,
        strokeLinecap: 'round',
        strokeLinejoin: 'round'
      });

      if (withFill) {
        series.fills.template.setAll({
          fillOpacity: 0.08,
          visible: true
        });
      }

      series.set('tooltip', createTooltip(root));
      series.get('tooltip').label.set('text', `[bold]{${field}}[/] ${name}`);

      series.data.setAll(chartData);
      series.appear(800, 150);
      return series;
    };

    // Series 1: Total Encounters (Primary brand blue)
    createCardiacSeries('Total Encounters', 'total', CLINICAL_TOKENS.primary, 2, true);

    // Series 2: Completed Visits (Success emerald)
    createCardiacSeries('Completed Encounters', 'completed', CLINICAL_TOKENS.success, 1.75, false);

    // Series 3: Scheduled / In Pipeline (Warning amber)
    createCardiacSeries('Upcoming Queue', 'scheduled', CLINICAL_TOKENS.warning, 1.5, false);

    // Series 4: Cancellations with Anomaly Bullets
    const cancelSeries = createCardiacSeries('Cancellations', 'cancelled', CLINICAL_TOKENS.danger, 1.75, false);

    // Add anomaly bullets where cancellations exceed 2-sigma
    cancelSeries.bullets.push((root, series, dataItem) => {
      const dataContext = dataItem?.dataContext;
      if (!dataContext || !dataContext.isAnomaly) return undefined;

      const container = am5.Container.new(root, {});

      // Pulsing alert pin
      const circle = container.children.push(
        am5.Circle.new(root, {
          radius: 5,
          fill: am5.color(CLINICAL_TOKENS.danger),
          stroke: am5.color(0xFFFFFF),
          strokeWidth: 2,
          tooltipText: `Anomaly: ${dataContext.cancelled} cancellations (>2σ variance)`
        })
      );

      return am5.Bullet.new(root, {
        sprite: container
      });
    });

    xAxis.data.setAll(chartData);

    return () => {
      root.dispose();
    };
  }, [chartData]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans flex flex-col justify-between ${className}`}>
      {/* Header with Title, Anomaly Badge & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Platform Clinical Activity Pulse
              </h3>
              {anomalyCount > 0 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.2 rounded-full text-[10px] font-semibold bg-rose-50 text-rose-700 border border-rose-200">
                  <AlertTriangle className="w-2.5 h-2.5" />
                  <span>{anomalyCount} Spikes (&gt;2σ)</span>
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-500 font-medium">
              180-day longitudinal vitals trace across multi-tenant consultations
            </p>
          </div>
        </div>

        {/* Series Indicators */}
        <div className="flex items-center gap-3 text-[11px] font-medium text-slate-500 flex-wrap">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.primary }} />
            <span>Total Encounters</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.success }} />
            <span>Completed</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.warning }} />
            <span>Queued</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.danger }} />
            <span>Cancellations</span>
          </span>
        </div>
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
}

export default CareFlowClinicalPulse;
