import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_COLORS } from './amchartsTheme';
import { BarChart3 } from 'lucide-react';

export const CareFlowRankChart = ({
  data = [],
  categoryField = 'name',
  valueField = 'value',
  height = 280,
  title,
  subtitle,
  onItemClick = null,
  selectedItem = null,
  barColor = CLINICAL_COLORS.primary,
  emptyMessage = 'No ranking data available for this category.',
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
        paddingLeft: 0,
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 0,
        layout: root.verticalLayout
      })
    );

    // Y Axis (Categories - Names)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      inversed: true,
      minGridDistance: 20,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x475569),
      fontSize: 11,
      fontWeight: '500',
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingRight: 10
    });
    yRenderer.grid.template.setAll({
      visible: false
    });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: yRenderer
      })
    );
    // Reverse data so highest is at top
    const sortedData = [...data].sort((a, b) => (b[valueField] || 0) - (a[valueField] || 0));
    yAxis.data.setAll(sortedData);

    // X Axis (Values)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingTop: 6
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.5,
      strokeDasharray: [3, 3]
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: xRenderer
      })
    );

    // Series
    const baseColor = am5.color(barColor || CLINICAL_COLORS.primary);
    const highlightColor = am5.color(CLINICAL_COLORS.primaryHover || 0x1D4ED8);

    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: valueField,
        categoryYField: categoryField,
        tooltip: createTooltip(root)
      })
    );

    series.columns.template.setAll({
      height: am5.percent(60),
      cornerRadiusTR: 6,
      cornerRadiusBR: 6,
      fill: baseColor,
      strokeOpacity: 0,
      cursorOverStyle: 'pointer',
      tooltipText: '[bold]{categoryY}[/]\nEncounters: [bold]{valueX}[/]'
    });

    // Hover state for interactive highlight
    series.columns.template.states.create('hover', {
      fill: am5.color(0x1D4ED8),
      fillOpacity: 1,
      stroke: am5.color(0x0066FF),
      strokeWidth: 1.5,
      strokeOpacity: 1
    });

    // End of bar numerical bullet
    series.bullets.push(() =>
      am5.Bullet.new(root, {
        locationX: 1,
        sprite: am5.Label.new(root, {
          text: '{valueX}',
          fill: am5.color(0x334155),
          fontSize: 11,
          fontWeight: '600',
          fontFamily: 'Poppins, system-ui, sans-serif',
          centerY: am5.p50,
          dx: 6,
          populateText: true
        })
      })
    );

    // Click handler
    if (onItemClick) {
      series.columns.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          onItemClick(dataItem.dataContext);
        }
      });
    }

    // Dynamic fill if an item is selected
    series.columns.template.adapters.add('fill', (fill, target) => {
      if (!selectedItem) return baseColor;
      const ctx = target.dataItem?.dataContext;
      if (ctx && ctx[categoryField] === selectedItem) {
        return highlightColor;
      }
      return am5.color(0xCBD5E1); // Muted slate when another item is selected
    });

    series.data.setAll(sortedData);

    if (!isReducedMotion()) {
      series.appear(400);
      chart.appear(400, 50);
    }

    return () => {
      root.dispose();
    };
  }, [data, categoryField, valueField, barColor, selectedItem]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {onItemClick && (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Click bar to filter
            </span>
          )}
        </div>
      )}

      {(!data || data.length === 0) ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <BarChart3 className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Rankings update automatically based on operational activity.</p>
        </div>
      ) : (
        <div
          id={`rank-chart-${chartId}`}
          ref={chartRef}
          style={{ width: '100%', height }}
          className="w-full"
        />
      )}
    </div>
  );
};

export default CareFlowRankChart;
