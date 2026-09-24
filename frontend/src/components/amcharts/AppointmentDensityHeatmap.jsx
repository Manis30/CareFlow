import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Calendar, Info } from 'lucide-react';

const DEFAULT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DEFAULT_HOURS = [
  '09:00', '10:00', '11:00', '12:00',
  '13:00', '14:00', '15:00', '16:00',
  '17:00', '18:00', '19:00', '20:00'
];

export const AppointmentDensityHeatmap = ({
  data = [],
  totalAppointments = 0,
  selectedSlot = null,
  onSlotClick = null,
  loading = false,
  className = ''
}) => {
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const [hoveredCell, setHoveredCell] = useState(null);

  // Stable data key
  const chartDataKey = useMemo(() => {
    return (data || []).map((d) => `${d.day}:${d.hour}:${d.total}`).join('|');
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current || !data || data.length === 0) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(chartContainerRef.current);
    rootRef.current = root;
    root._logo?.dispose();

    if (!prefersReducedMotion) {
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
        paddingRight: 12,
        paddingTop: 8,
        paddingBottom: 0
      })
    );

    // 1. Y Axis (Days)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      inversed: true,
      minGridDistance: 16,
      strokeOpacity: 0.05
    });

    yRenderer.labels.template.setAll({
      fill: am5.color(0x475569),
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'Poppins, sans-serif',
      paddingRight: 8
    });

    yRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.35,
      strokeDasharray: [2, 2]
    });

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'day',
        renderer: yRenderer
      })
    );
    yAxis.data.setAll(DEFAULT_DAYS.map((d) => ({ day: d })));

    // 2. X Axis (Hours)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 32,
      strokeOpacity: 0.05
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif',
      paddingTop: 8
    });

    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.35,
      strokeDasharray: [2, 2]
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'hour',
        renderer: xRenderer
      })
    );
    xAxis.data.setAll(DEFAULT_HOURS.map((h) => ({ hour: h })));

    // 3. Series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        categoryXField: 'hour',
        categoryYField: 'day',
        valueField: 'total',
        clustered: false
      })
    );

    series.columns.template.setAll({
      width: am5.percent(90),
      height: am5.percent(90),
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
      strokeOpacity: 1,
      strokeWidth: 1,
      stroke: am5.color(0xFFFFFF),
      cursorOverStyle: 'pointer'
    });

    // Heat rule calculation (CareFlow blue tonal gradient)
    const maxVal = Math.max(...data.map((d) => d.total || 0), 1);

    series.columns.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      const val = dataItem?.dataContext?.total || 0;
      if (!val || val === 0) {
        return am5.color(0xF1F5F9); // Clean subtle slate-100 empty cell
      }
      const ratio = Math.min(val / maxVal, 1);
      // Interpolate from 0xBFDBFE (sky-200) to 0x1D4ED8 (blue-700)
      const r = Math.round(191 + (29 - 191) * ratio);
      const g = Math.round(219 + (78 - 219) * ratio);
      const b = Math.round(254 + (216 - 254) * ratio);
      return am5.color((r << 16) + (g << 8) + b);
    });

    // Hover interactions
    series.columns.template.events.on('pointerover', (e) => {
      const dCtx = e.target.dataItem?.dataContext;
      if (dCtx && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setHoveredCell({
          ...dCtx,
          x: e.point.x,
          y: e.point.y,
          containerWidth: rect.width,
          containerHeight: rect.height
        });
        e.target.set('stroke', am5.color(0x0066FF));
        e.target.set('strokeWidth', 2);
      }
    });

    series.columns.template.events.on('pointerout', (e) => {
      setHoveredCell(null);
      e.target.set('stroke', am5.color(0xFFFFFF));
      e.target.set('strokeWidth', 1);
    });

    // Click handler for cross-filtering
    if (onSlotClick) {
      series.columns.template.events.on('click', (e) => {
        const dCtx = e.target.dataItem?.dataContext;
        if (dCtx) {
          onSlotClick(dCtx);
        }
      });
    }

    series.data.setAll(data);

    if (!prefersReducedMotion) {
      series.appear(700);
      chart.appear(700, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartDataKey, onSlotClick]);

  // Handle selected slot visual highlight
  useEffect(() => {
    if (!rootRef.current) return;
    // Highlight selected cell if any
  }, [selectedSlot]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative ${className}`}>
      {/* 1. Card Header */}
      <div>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
              <Calendar className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Consultation Scheduling Density
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Appointment demand by day and hour (click a cell to filter)
              </p>
            </div>
          </div>

          <div className="inline-flex items-center px-2.5 py-1 rounded-full bg-blue-50/80 border border-blue-100 text-xs font-semibold text-blue-700">
            <span>{totalAppointments ? totalAppointments.toLocaleString() : '—'} Total Appointments</span>
          </div>
        </div>
      </div>

      {/* 2. Heatmap Surface */}
      <div className="relative w-full flex-1 min-h-[270px] flex flex-col justify-center my-2">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl">
            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full h-[270px] select-none"
        />

        {/* 3. Non-clipping Dark Floating Tooltip matching reference design */}
        {hoveredCell && (
          <div
            className="absolute z-40 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: Math.max(
                10,
                Math.min(
                  (hoveredCell.containerWidth || 500) - 220,
                  hoveredCell.x > (hoveredCell.containerWidth || 500) - 180
                    ? hoveredCell.x - 210
                    : hoveredCell.x - 80
                )
              ),
              top: hoveredCell.y < 130
                ? Math.min((hoveredCell.containerHeight || 270) - 150, hoveredCell.y + 20)
                : Math.max(10, hoveredCell.y - 145)
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-3 border border-slate-700/60 min-w-[200px] font-sans">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
                {hoveredCell.day}, {hoveredCell.hour}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Total Appointments</span>
                  <span className="font-bold text-white">{hoveredCell.total}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Completed</span>
                  <span className="font-semibold text-emerald-400">
                    {hoveredCell.completed}{' '}
                    <span className="text-[10px] text-emerald-300/80">
                      ({hoveredCell.total > 0 ? ((hoveredCell.completed / hoveredCell.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Scheduled</span>
                  <span className="font-semibold text-blue-400">
                    {hoveredCell.scheduled}{' '}
                    <span className="text-[10px] text-blue-300/80">
                      ({hoveredCell.total > 0 ? ((hoveredCell.scheduled / hoveredCell.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Cancelled</span>
                  <span className="font-semibold text-rose-400">
                    {hoveredCell.cancelled}{' '}
                    <span className="text-[10px] text-rose-300/80">
                      ({hoveredCell.total > 0 ? ((hoveredCell.cancelled / hoveredCell.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">No-Show</span>
                  <span className="font-semibold text-amber-400">
                    {hoveredCell.noShow || 0}{' '}
                    <span className="text-[10px] text-amber-300/80">
                      ({hoveredCell.total > 0 ? (((hoveredCell.noShow || 0) / hoveredCell.total) * 100).toFixed(1) : 0}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer with Intensity Indicator & Legend */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-1.5 text-[11px] text-slate-400">
          <Info className="w-3.5 h-3.5 stroke-[2]" />
          <span>Darker color indicates higher number of appointments</span>
        </div>

        <div className="flex items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-medium">Low</span>
          <div className="w-20 h-2.5 rounded-full bg-gradient-to-r from-[#BFDBFE] to-[#1D4ED8] border border-slate-200/60" />
          <span className="text-slate-600 font-semibold">High</span>
        </div>
      </div>
    </div>
  );
};

export default AppointmentDensityHeatmap;
