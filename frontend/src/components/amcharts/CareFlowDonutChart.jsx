import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5percent from '@amcharts/amcharts5/percent';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_PALETTE } from './amchartsTheme';
import { PieChart as PieIcon } from 'lucide-react';

export const CareFlowDonutChart = ({
  data = [],
  categoryField = 'name',
  valueField = 'value',
  colorField = 'color',
  height = 280,
  title,
  subtitle,
  centerLabel,
  centerSubtext,
  onSliceClick = null,
  emptyMessage = 'No distribution data recorded.',
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  const total = data.reduce((sum, item) => sum + (Number(item[valueField]) || 0), 0);

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0 || total === 0) return;

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();

    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5percent.PieChart.new(root, {
        innerRadius: am5.percent(65),
        layout: root.verticalLayout,
        paddingTop: 5,
        paddingBottom: 0,
        paddingLeft: 0,
        paddingRight: 0
      })
    );

    const series = chart.series.push(
      am5percent.PieSeries.new(root, {
        valueField: valueField,
        categoryField: categoryField,
        alignLabels: false,
        tooltip: createTooltip(root)
      })
    );

    // Color palette
    series.get('colors').set('colors', CLINICAL_PALETTE);

    // Disable default outer labels for clean clinical aesthetic
    series.labels.template.set('visible', false);
    series.ticks.template.set('visible', false);

    // Slices styling
    series.slices.template.setAll({
      stroke: am5.color(0xFFFFFF),
      strokeWidth: 2,
      cornerRadius: 4,
      templateField: 'sliceSettings'
    });

    // Custom colors from data item if provided
    series.slices.template.adapters.add('fill', (fill, target) => {
      const customColor = target.dataItem?.dataContext?.[colorField];
      return customColor ? am5.color(customColor) : fill;
    });

    // Tooltip
    series.get('tooltip').label.set(
      'text',
      `[bold]{category}[/]: {value} ({valuePercentTotal.formatNumber('0.0')}%)`
    );

    // Slice click callback
    if (onSliceClick) {
      series.slices.template.set('cursorOverStyle', 'pointer');
      series.slices.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          onSliceClick(dataItem.dataContext);
        }
      });
    }

    series.data.setAll(data);

    // Legend
    const legend = chart.children.push(
      am5.Legend.new(root, {
        centerX: am5.percent(50),
        x: am5.percent(50),
        layout: root.horizontalLayout,
        marginTop: 15
      })
    );
    legend.labels.template.setAll({
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif',
      fill: am5.color(0x475569),
      fontWeight: '500'
    });
    legend.valueLabels.template.setAll({
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif',
      fill: am5.color(0x64748B),
      fontWeight: '600'
    });
    legend.markers.template.setAll({
      width: 10,
      height: 10
    });
    legend.data.setAll(series.dataItems);

    if (!isReducedMotion()) {
      series.appear(400);
      chart.appear(400, 50);
    }

    return () => {
      root.dispose();
    };
  }, [data, categoryField, valueField, colorField, total]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3 flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {onSliceClick && (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Click slice to filter
            </span>
          )}
        </div>
      )}

      {(!data || data.length === 0 || total === 0) ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <PieIcon className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Metrics populate as clinical activity is registered.</p>
        </div>
      ) : (
        <div className="relative flex-1 flex flex-col items-center justify-center">
          <div
            id={`donut-chart-${chartId}`}
            ref={chartRef}
            style={{ width: '100%', height }}
            className="w-full"
          />

          {/* Center Summary Label */}
          <div className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 text-center pointer-events-none">
            <span className="text-2xl font-extrabold text-slate-900 font-mono tracking-tight block">
              {centerLabel !== undefined ? centerLabel : total}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mt-0.5">
              {centerSubtext || 'Total'}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareFlowDonutChart;
