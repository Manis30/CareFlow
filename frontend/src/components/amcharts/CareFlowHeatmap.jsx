import React, { useEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip } from './amchartsTheme';
import { Calendar, Info } from 'lucide-react';

const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00'
];

/**
 * CareFlowHeatmap
 * Day × Hour Activity Heatmap built with @amcharts/amcharts5
 * Strict lifecycle management (root.dispose) and responsive resizing.
 */
export const CareFlowHeatmap = ({
  data = [],
  title = 'Consultation Density (Day × Hour)',
  subtitle = 'Appointment volume distribution across operating hours',
  days = DEFAULT_DAYS,
  hours = DEFAULT_HOURS,
  height = 240,
  emptyMessage = 'No appointment density recorded for this timeframe.',
  onCellClick = null,
  className = ''
}) => {
  const chartRef = useRef(null);

  const normalizedData = (data || []).map((item) => ({
    ...item,
    count: Number(item.count ?? item.value ?? 0)
  }));

  const totalCount = normalizedData.reduce((sum, item) => sum + item.count, 0);

  useEffect(() => {
    if (!chartRef.current || !normalizedData || normalizedData.length === 0 || totalCount === 0) return;

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
        paddingTop: 5,
        paddingBottom: 0
      })
    );

    // Y Axis (Days)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      inversed: true,
      minGridDistance: 15,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x475569),
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingRight: 8
    });
    yRenderer.grid.template.setAll({ strokeOpacity: 0.05 });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'day',
        renderer: yRenderer
      })
    );
    yAxis.data.setAll(days.map((d) => ({ day: d })));

    // X Axis (Hours)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 35,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif',
      paddingTop: 6
    });
    xRenderer.grid.template.setAll({ strokeOpacity: 0.05 });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'hour',
        renderer: xRenderer
      })
    );
    xAxis.data.setAll(hours.map((h) => ({ hour: h })));

    // Series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis: xAxis,
        yAxis: yAxis,
        categoryXField: 'hour',
        categoryYField: 'day',
        valueField: 'count',
        clustered: false,
        tooltip: createTooltip(root)
      })
    );

    series.columns.template.setAll({
      width: am5.percent(92),
      height: am5.percent(92),
      cornerRadiusTL: 3,
      cornerRadiusTR: 3,
      cornerRadiusBL: 3,
      cornerRadiusBR: 3,
      strokeOpacity: 0.1,
      stroke: am5.color(0xFFFFFF),
      tooltipText: '{day} {hour}: [bold]{count} consultations[/]'
    });

    // Heat rule calculation (gradient darkness based on appointment count)
    const maxVal = Math.max(...normalizedData.map((d) => d.count || 0), 1);

    series.columns.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      const val = dataItem?.dataContext?.count ?? dataItem?.dataContext?.value ?? 0;
      if (!val || val === 0) {
        return am5.color(0xF1F5F9); // Clean subtle slate-100 empty cell
      }
      const ratio = Math.min(val / maxVal, 1);
      // Smooth gradient from 0xBAE6FD (soft sky-blue) to 0x1D4ED8 (deep rich clinical blue)
      const r = Math.round(186 + (29 - 186) * ratio);
      const g = Math.round(230 + (78 - 230) * ratio);
      const b = Math.round(253 + (216 - 253) * ratio);
      return am5.color((r << 16) + (g << 8) + b);
    });

    series.columns.template.states.create('hover', {
      stroke: am5.color(0x0066FF),
      strokeWidth: 2,
      strokeOpacity: 1
    });

    if (onCellClick) {
      series.columns.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem?.dataContext) {
          onCellClick(dataItem.dataContext);
        }
      });
    }

    series.data.setAll(normalizedData);

    if (!isReducedMotion()) {
      series.appear(500);
      chart.appear(500, 100);
    }

    return () => {
      root.dispose();
    };
  }, [data, days, hours, totalCount, onCellClick]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {(title || subtitle) && (
        <div className="mb-4 flex items-center justify-between border-b border-slate-100 pb-3">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 border border-blue-100 px-2 py-0.5 rounded-md shadow-2xs">
            {totalCount} Total Encounters
          </span>
        </div>
      )}

      {totalCount === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Calendar className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Heatmap density populates as scheduled consultations accumulate.</p>
        </div>
      ) : (
        <>
          <div ref={chartRef} style={{ width: '100%', height }} />
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5 text-slate-400 font-medium">
              <Info className="w-3.5 h-3.5" />
              Darker color indicates higher number of appointments
            </span>
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-medium">Low</span>
              <div className="w-20 h-2 rounded-full bg-gradient-to-r from-sky-200 to-blue-700" />
              <span className="text-slate-700 font-bold">High</span>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default CareFlowHeatmap;
