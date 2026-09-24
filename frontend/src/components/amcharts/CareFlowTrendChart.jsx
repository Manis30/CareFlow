import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_COLORS } from './amchartsTheme';
import { Activity } from 'lucide-react';

export const CareFlowTrendChart = ({
  data = [],
  series = [
    { key: 'value', name: 'Volume', color: CLINICAL_COLORS.primary }
  ],
  categoryField = 'date',
  height = 280,
  title,
  subtitle,
  emptyMessage = 'No trend activity available for this time range.',
  showLegend = true,
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  useEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose(); // clean watermark if present

    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        paddingLeft: 6,
        paddingRight: 12,
        paddingTop: 14,
        paddingBottom: 14,
        layout: root.verticalLayout
      })
    );

    // X Axis
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 45,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingTop: 8
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.5,
      strokeDasharray: [3, 3]
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: categoryField,
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {
          forceHidden: true
        })
      })
    );
    xAxis.data.setAll(data);

    // Y Axis
    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingRight: 8
    });
    yRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.5,
      strokeDasharray: [3, 3]
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: yRenderer
      })
    );

    // Legend
    let legend = null;
    if (showLegend && series.length > 1) {
      legend = chart.children.unshift(
        am5.Legend.new(root, {
          centerX: am5.percent(50),
          x: am5.percent(50),
          layout: root.horizontalLayout,
          marginBottom: 12
        })
      );
      legend.labels.template.setAll({
        fontSize: 11,
        fontFamily: 'Poppins, system-ui, sans-serif',
        fill: am5.color(0x475569),
        fontWeight: '500'
      });
      legend.markers.template.setAll({
        width: 12,
        height: 12
      });
    }

    // Single unified dark tooltip for all series
    const unifiedTooltip = createTooltip(root);
    unifiedTooltip.set('pointerOrientation', 'vertical');
    unifiedTooltip.set('dy', -12);

    unifiedTooltip.label.setAll({
      fill: am5.color(0xFFFFFF),
      fontSize: 12,
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingTop: 8,
      paddingBottom: 8,
      paddingLeft: 12,
      paddingRight: 12
    });

    // Add Series
    series.forEach((s) => {
      const colorHex = s.color || CLINICAL_COLORS.primary;
      const amColor = am5.color(colorHex);

      const lineSeries = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: s.name || s.key,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: s.key,
          categoryXField: categoryField,
          stroke: amColor,
          fill: amColor,
          connectNulls: true
        })
      );

      // Attach unified tooltip with all metrics to each series
      lineSeries.set('tooltip', unifiedTooltip);
      lineSeries.set('tooltipText', ' ');
      lineSeries.adapters.add('tooltipText', (_text, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return '';
        const monthLabel = ctx[categoryField] || ctx.date || '';
        const rows = series
          .map((item) => {
            const count = ctx[item.key] ?? 0;
            const hex = item.color || CLINICAL_COLORS.primary;
            return `[${hex}]●[/] [#94A3B8]${item.name || item.key}:[/] [bold #FFFFFF]${count}[/]`;
          })
          .join('\n');
        return `[bold #FFFFFF]${monthLabel}[/]\n\n${rows}`;
      });

      lineSeries.strokes.template.setAll({
        strokeWidth: 2.4,
        shadowColor: amColor,
        shadowBlur: 6,
        shadowOffsetY: 3,
        shadowOpacity: 0.15
      });

      // Area gradient
      lineSeries.fills.template.setAll({
        fillOpacity: 1,
        visible: true,
        fillGradient: am5.LinearGradient.new(root, {
          stops: [
            { color: amColor, opacity: 0.2 },
            { color: amColor, opacity: 0.01 }
          ]
        })
      });

      // Bullet / Point
      lineSeries.bullets.push(() => {
        const circle = am5.Circle.new(root, {
          radius: 4,
          fill: root.interfaceColors.get('background'),
          stroke: amColor,
          strokeWidth: 2
        });
        return am5.Bullet.new(root, {
          sprite: circle
        });
      });

      lineSeries.data.setAll(data);
      if (!isReducedMotion()) {
        lineSeries.appear(1000);
      }
      if (legend) legend.data.push(lineSeries);
    });

    // Cursor
    const cursor = chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        behavior: 'none',
        xAxis: xAxis
      })
    );
    cursor.lineY.set('visible', false);
    cursor.lineX.setAll({
      stroke: am5.color(0x94A3B8),
      strokeDasharray: [3, 3],
      strokeOpacity: 0.4
    });

    if (!isReducedMotion()) {
      chart.appear(1000, 100);
    }

    return () => {
      root.dispose();
    };
  }, [data, series, categoryField, showLegend]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3.5 flex items-center justify-between">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
        </div>
      )}

      {(!data || data.length === 0) ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200"
        >
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Activity className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Live metrics will appear as consultations occur.</p>
        </div>
      ) : (
        <div
          id={`trend-chart-${chartId}`}
          ref={chartRef}
          style={{ width: '100%', height }}
          className="w-full"
        />
      )}
    </div>
  );
};

export default CareFlowTrendChart;
