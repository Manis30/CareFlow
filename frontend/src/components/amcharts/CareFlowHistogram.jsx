import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_COLORS } from './amchartsTheme';
import { BarChart3 } from 'lucide-react';

/**
 * CareFlowHistogram
 * Distribution visualization for patient consultation volume bins.
 * Built with amCharts 5 XY.
 */
export const CareFlowHistogram = ({
  data = [], // [{ bin: '0 Visits', count: 12, pct: '24%' }]
  title = 'Consultations per Patient Cohort',
  subtitle = 'Frequency distribution of lifetime appointment encounters per patient profile',
  height = 240,
  onBinClick = null,
  emptyMessage = 'No patient consultation distribution records available.',
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

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
        paddingRight: 10,
        paddingTop: 10,
        paddingBottom: 0
      })
    );

    // X Axis: Category (Bin)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 30,
      cellStartLocation: 0.1,
      cellEndLocation: 0.9,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontWeight: '500',
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'bin',
        renderer: xRenderer,
        tooltip: createTooltip(root)
      })
    );

    // Y Axis: Value (Patient Count)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 25,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
        extraMax: 0.15
      })
    );

    // Column Series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: 'count',
        categoryXField: 'bin',
        tooltip: createTooltip(root)
      })
    );

    series.columns.template.setAll({
      cornerRadiusTL: 6,
      cornerRadiusTR: 6,
      fill: am5.color(CLINICAL_COLORS.primary),
      strokeOpacity: 0,
      width: am5.percent(85),
      tooltipText: '{categoryX}: [bold]{valueY} patients[/]'
    });

    // Hover state
    series.columns.template.states.create('hover', {
      fill: am5.color(CLINICAL_COLORS.primaryDark || 0x1D4ED8),
      fillOpacity: 0.9
    });

    if (onBinClick) {
      series.columns.template.set('cursorOverStyle', 'pointer');
      series.columns.template.events.on('click', (ev) => {
        onBinClick(ev.target.dataItem?.dataContext);
      });
    }

    xAxis.data.setAll(data);
    series.data.setAll(data);
    series.appear(800);
    chart.appear(800, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <BarChart3 className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>
      </div>

      {/* Chart Canvas */}
      {!data || data.length === 0 ? (
        <div className="flex items-center justify-center text-xs text-slate-400 py-12 font-medium">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={chartRef}
          id={`histogram-${chartId}`}
          style={{ height: `${height}px`, width: '100%' }}
        />
      )}
    </div>
  );
};

export default CareFlowHistogram;
