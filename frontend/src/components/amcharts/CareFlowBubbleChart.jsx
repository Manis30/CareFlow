import React, { useEffect, useRef, useId, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_TOKENS } from './amchartsTheme';
import { Sparkles, Building2 } from 'lucide-react';

/**
 * CareFlowBubbleChart
 * 
 * 4-Quadrant Clinical Load vs Capacity Scatter Matrix:
 *  - X: Assigned Clinicians
 *  - Y: Patient Cohort Reach
 *  - Bubble Radius: Consultation Volume
 *  - Bubble Color: Status (#10B981 Approved, #F59E0B Pending, #EF4444 Suspended)
 *  - Shaded quadrant backgrounds with clear in-chart labels
 */
export const CareFlowBubbleChart = ({
  data = [], // [{ name, x, y, value, id, status }]
  title = 'Clinical Load & Workload Distribution',
  subtitle = 'X: Assigned Clinicians • Y: Patient Cohort • Bubble: Consultation Volume (click bubble to filter)',
  xLabel = 'Clinicians',
  yLabel = 'Registered Patients',
  valueLabel = 'Consultations',
  height = 300,
  onBubbleClick = null,
  selectedItem = null,
  emptyMessage = 'No multidimensional operational metrics available.',
  className = ''
}) => {
  const chartRef = useRef(null);

  const hasData = Boolean(data && data.length > 0 && data.some((d) => d.x > 0 || d.y > 0 || d.value > 0));

  const medianX = useMemo(() => {
    if (!data || data.length === 0) return 6;
    const xs = data.map((d) => Number(d.x) || 0).sort((a, b) => a - b);
    const mid = Math.floor(xs.length / 2);
    return xs.length % 2 !== 0 ? xs[mid] : Math.round((xs[mid - 1] + xs[mid]) / 2) || 6;
  }, [data]);

  const medianY = useMemo(() => {
    if (!data || data.length === 0) return 50;
    const ys = data.map((d) => Number(d.y) || 0).sort((a, b) => a - b);
    const mid = Math.floor(ys.length / 2);
    return ys.length % 2 !== 0 ? ys[mid] : Math.round((ys[mid - 1] + ys[mid]) / 2) || 50;
  }, [data]);

  useEffect(() => {
    if (!chartRef.current || !hasData) return;

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
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 0
      })
    );

    // X Axis
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 40,
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
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: 0,
        extraMax: 0.18
      })
    );

    // Y Axis
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 30,
      strokeOpacity: 0
    });
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
        renderer: yRenderer,
        min: 0,
        extraMax: 0.18
      })
    );

    // Dynamic Median Guide Lines
    const createMedianGuide = (axis, value, labelText) => {
      const rangeDataItem = axis.makeDataItem({ value });
      const range = axis.createAxisRange(rangeDataItem);
      range.get('grid').setAll({
        stroke: am5.color(CLINICAL_TOKENS.primary),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.65
      });
      range.get('label').setAll({
        text: labelText,
        fill: am5.color(CLINICAL_TOKENS.primary),
        fontSize: 9,
        fontWeight: '600',
        fontFamily: 'Poppins, sans-serif',
        inside: true
      });
    };

    if (medianX > 0) createMedianGuide(xAxis, medianX, `Median ${medianX} Docs`);
    if (medianY > 0) createMedianGuide(yAxis, medianY, `Median ${medianY} Pts`);

    // Line Series with Bubble Bullets
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: 'y',
        valueXField: 'x',
        strokeOpacity: 0,
        tooltip: createTooltip(root)
      })
    );

    series.set('tooltip', createTooltip(root));

    series.bullets.push((root, series, dataItem) => {
      const dataContext = dataItem.dataContext;
      if (!dataContext) return undefined;

      const rawVal = Number(dataContext.value || 1);
      const radius = Math.min(26, Math.max(9, Math.sqrt(rawVal) * 3));

      // Color mapping strictly by status token
      const st = (dataContext.status || '').toLowerCase();
      let fillColor = am5.color(CLINICAL_TOKENS.success); // Default approved
      if (st === 'pending') fillColor = am5.color(CLINICAL_TOKENS.warning);
      else if (st === 'suspended') fillColor = am5.color(CLINICAL_TOKENS.danger);
      else if (st === 'approved' || st === 'active') fillColor = am5.color(CLINICAL_TOKENS.success);
      else fillColor = am5.color(CLINICAL_TOKENS.primary);

      const isSelected = selectedItem && dataContext.name?.toLowerCase().includes(selectedItem.toLowerCase());

      const circle = am5.Circle.new(root, {
        radius,
        fill: fillColor,
        fillOpacity: isSelected ? 0.95 : (selectedItem ? 0.25 : 0.72),
        stroke: isSelected ? am5.color(CLINICAL_TOKENS.primaryHover) : am5.color(0xFFFFFF),
        strokeWidth: isSelected ? 3 : 1.5,
        cursorOverStyle: 'pointer',
        tooltipText: `[bold]{name}[/]\n${xLabel}: {x}\n${yLabel}: {y}\n${valueLabel}: {value} cases`
      });

      if (onBubbleClick) {
        circle.events.on('click', () => {
          onBubbleClick(dataContext);
        });
      }

      circle.states.create('hover', {
        scale: 1.15,
        fillOpacity: 1
      });

      return am5.Bullet.new(root, { sprite: circle });
    });

    series.data.setAll(data);
    series.appear(800, 100);

    return () => {
      root.dispose();
    };
  }, [data, medianX, medianY, selectedItem, onBubbleClick]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans flex flex-col justify-between ${className}`}>
      {/* Header with Quadrant Labels */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                {title}
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                {subtitle}
              </p>
            </div>
          </div>

          {selectedItem && (
            <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
              Selected: {selectedItem}
            </span>
          )}
        </div>

        {/* Quadrant Legend Bar */}
        <div className="flex items-center justify-between gap-2 text-[10px] font-semibold text-slate-500 py-1 px-2.5 bg-slate-50 rounded-lg mb-2">
          <span className="text-emerald-700">Q1: Scale Leaders (High Staff, High Cohort)</span>
          <span className="text-blue-700">Q2: High Load (High Cohort, Low Staff)</span>
          <span className="text-slate-600">Q3: Emerging</span>
          <span className="text-amber-700">Q4: High Capacity</span>
        </div>
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />

      {/* Bubble Status Token Legend */}
      <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[11px] text-slate-500">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.success }} />
            <span>Approved</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.warning }} />
            <span>Pending</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: CLINICAL_TOKENS.danger }} />
            <span>Suspended</span>
          </span>
        </div>
        <span className="text-[10px] text-slate-400">
          Median Threshold: {medianX} clinicians / {medianY} patients
        </span>
      </div>
    </div>
  );
};

export default CareFlowBubbleChart;
