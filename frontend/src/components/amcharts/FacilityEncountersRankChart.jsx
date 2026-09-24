import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { Building2, ChevronDown } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const DEFAULT_PALETTE = [
  '#0066FF', // 1. Royal Blue
  '#0284C7', // 2. Cyan Blue
  '#0EA5E9', // 3. Sky Blue
  '#14B8A6', // 4. Mint/Teal
  '#22C55E', // 5. Emerald Green
  '#84CC16', // 6. Soft Green/Lime
  '#F59E0B', // 7. Amber
  '#EF4444'  // 8. Coral Red
];

export const FacilityEncountersRankChart = ({
  data = [],
  selectedFacility = 'ALL',
  onFacilityClick = null,
  loading = false,
  className = ''
}) => {
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const [sortBy, setSortBy] = useState('total'); // 'total' | 'rate'
  const [hoveredFacility, setHoveredFacility] = useState(null);
  const navigate = useNavigate();

  // Process and sort data
  const sortedData = useMemo(() => {
    const list = [...(data || [])];
    if (sortBy === 'rate') {
      list.sort((a, b) => b.completionRate - a.completionRate);
    } else {
      list.sort((a, b) => b.totalAppointments - a.totalAppointments);
    }
    return list.map((item, idx) => ({
      ...item,
      color: item.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length]
    }));
  }, [data, sortBy]);

  // Chart data key
  const chartDataKey = useMemo(() => {
    return `${sortBy}-${sortedData.map((d) => `${d.organizationId}:${d.totalAppointments}:${d.completionRate}`).join('|')}`;
  }, [sortBy, sortedData]);

  useEffect(() => {
    if (!chartContainerRef.current || !sortedData.length) return;

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
        paddingRight: 64, // Space for right-side completion rate labels
        paddingTop: 4,
        paddingBottom: 0
      })
    );

    // 1. Y Axis (Clinics)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      inversed: true,
      minGridDistance: 24,
      strokeOpacity: 0.05
    });

    yRenderer.labels.template.setAll({
      fill: am5.color(0x334155),
      fontSize: 11,
      fontWeight: '500',
      fontFamily: 'Poppins, sans-serif',
      paddingRight: 12,
      maxWidth: 180,
      oversizedBehavior: 'truncate'
    });

    yRenderer.grid.template.set('visible', false);

    const yAxis = chart.yAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'name',
        renderer: yRenderer
      })
    );
    yAxis.data.setAll(sortedData);

    // 2. X Axis (Counts)
    const maxVal = Math.max(...sortedData.map((d) => d.totalAppointments || 1));
    const xRenderer = am5xy.AxisRendererX.new(root, {
      strokeOpacity: 0.05
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(0x94A3B8),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.4,
      strokeDasharray: [2, 2]
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: Math.ceil(maxVal * 1.25),
        renderer: xRenderer
      })
    );

    // 3. Series 1: Background Track
    const trackSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueXField: 'trackMax',
        categoryYField: 'name',
        clustered: false
      })
    );

    trackSeries.columns.template.setAll({
      height: 14,
      cornerRadiusTL: 7,
      cornerRadiusTR: 7,
      cornerRadiusBL: 7,
      cornerRadiusBR: 7,
      fill: am5.color(0xF1F5F9),
      strokeOpacity: 0
    });

    trackSeries.data.setAll(sortedData.map((d) => ({ ...d, trackMax: Math.ceil(maxVal * 1.12) })));

    // 4. Series 2: Primary Ranked Columns
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Appointments',
        xAxis,
        yAxis,
        valueXField: 'totalAppointments',
        categoryYField: 'name',
        clustered: false
      })
    );

    series.columns.template.setAll({
      height: 14,
      cornerRadiusTL: 7,
      cornerRadiusTR: 7,
      cornerRadiusBL: 7,
      cornerRadiusBR: 7,
      strokeOpacity: 0,
      cursorOverStyle: 'pointer'
    });

    // Color adapter per row
    series.columns.template.adapters.add('fill', (fill, target) => {
      const dCtx = target.dataItem?.dataContext;
      if (dCtx?.color) {
        return am5.color(dCtx.color);
      }
      return fill;
    });

    // Total Count Label at End of Bar
    series.bullets.push((bRoot) => {
      return am5.Bullet.new(bRoot, {
        locationX: 1,
        sprite: am5.Label.new(bRoot, {
          text: '{valueX}',
          fill: am5.color(0x1E293B),
          fontSize: 11,
          fontWeight: '700',
          fontFamily: 'Poppins, sans-serif',
          centerY: am5.p50,
          dx: 8,
          populateText: true
        })
      });
    });

    // Completion Rate Badge to the right
    series.bullets.push((bRoot) => {
      return am5.Bullet.new(bRoot, {
        locationX: 1,
        sprite: am5.Label.new(bRoot, {
          text: '{completionRate}%',
          fill: am5.color(0x059669),
          fontSize: 11,
          fontWeight: '700',
          fontFamily: 'Poppins, sans-serif',
          centerY: am5.p50,
          dx: 48,
          populateText: true
        })
      });
    });

    // Hover Events
    series.columns.template.events.on('pointerover', (e) => {
      const dCtx = e.target.dataItem?.dataContext;
      if (dCtx && chartContainerRef.current) {
        const rect = chartContainerRef.current.getBoundingClientRect();
        setHoveredFacility({
          ...dCtx,
          x: e.point.x,
          y: e.point.y,
          containerWidth: rect.width,
          containerHeight: rect.height
        });

        // Highlight hovered bar
        series.columns.each((c) => {
          const isMatch = c.dataItem?.dataContext?.organizationId === dCtx.organizationId;
          c.set('opacity', isMatch ? 1.0 : 0.35);
        });
      }
    });

    series.columns.template.events.on('pointerout', () => {
      setHoveredFacility(null);
      series.columns.each((c) => c.set('opacity', 1.0));
    });

    // Click handler for cross-filtering
    if (onFacilityClick) {
      series.columns.template.events.on('click', (e) => {
        const dCtx = e.target.dataItem?.dataContext;
        if (dCtx) {
          onFacilityClick(dCtx);
        }
      });
    }

    series.data.setAll(sortedData);

    if (!prefersReducedMotion) {
      series.appear(700, 60);
      chart.appear(700, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartDataKey, onFacilityClick]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative ${className}`}>
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
              <Building2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Encounters by Facility
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Total appointments with completion rate by clinic
              </p>
            </div>
          </div>

          {/* Sort selector */}
          <div className="flex items-center gap-1.5 text-xs text-slate-500">
            <span>Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="py-1 px-2.5 rounded-lg border border-slate-200 bg-slate-50/70 text-xs font-semibold text-slate-700 focus:outline-none focus:border-blue-500 transition-colors"
            >
              <option value="total">Total Appointments</option>
              <option value="rate">Completion Rate</option>
            </select>
          </div>
        </div>
      </div>

      {/* 2. Chart Surface */}
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

        {/* 3. Non-clipping Dark Floating Tooltip */}
        {hoveredFacility && (
          <div
            className="absolute z-40 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: Math.max(
                10,
                Math.min(
                  (hoveredFacility.containerWidth || 450) - 220,
                  hoveredFacility.x > (hoveredFacility.containerWidth || 450) - 180
                    ? hoveredFacility.x - 210
                    : hoveredFacility.x - 80
                )
              ),
              top: hoveredFacility.y < 130
                ? Math.min((hoveredFacility.containerHeight || 270) - 160, hoveredFacility.y + 20)
                : Math.max(10, hoveredFacility.y - 155)
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-3 border border-slate-700/60 min-w-[210px] font-sans">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
                {hoveredFacility.name}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Total Appointments</span>
                  <span className="font-bold text-white">{hoveredFacility.totalAppointments}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Completed</span>
                  <span className="font-semibold text-emerald-400">{hoveredFacility.completed}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Scheduled</span>
                  <span className="font-semibold text-blue-400">{hoveredFacility.scheduled}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Cancelled</span>
                  <span className="font-semibold text-rose-400">{hoveredFacility.cancelled}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <span className="text-slate-300">Completion Rate</span>
                  <span className="font-bold text-emerald-400">{hoveredFacility.completionRate}%</span>
                </div>

                <div className="flex items-center justify-between gap-3 pt-1 border-t border-slate-800 text-[11px]">
                  <span className="text-slate-400">Unique Patients</span>
                  <span className="font-semibold text-purple-300">{hoveredFacility.uniquePatients}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 4. Footer Legend */}
      <div className="flex items-center justify-between text-xs text-slate-500 pt-2.5 border-t border-slate-100">
        <div className="flex items-center gap-4 text-[11px]">
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF]" />
            <span className="font-medium text-slate-600">Total Appointments</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-full border-2 border-emerald-500 bg-transparent" />
            <span className="font-medium text-slate-600">Completion Rate</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => navigate('/super-admin/organizations')}
          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors cursor-pointer hover:underline"
        >
          View All Clinics →
        </button>
      </div>
    </div>
  );
};

export default FacilityEncountersRankChart;
