import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { BarChart2 } from 'lucide-react';

export const PatientGrowthChart = ({
  data = [],
  loading = false,
  className = ''
}) => {
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const [hoveredData, setHoveredData] = useState(null);

  // Stable data key to prevent recreation on hover
  const chartDataKey = useMemo(() => {
    return data.map((d) => `${d.month}:${d.newRegistrations}:${d.cumulativePatients}`).join('|');
  }, [data]);

  useEffect(() => {
    if (!chartContainerRef.current || !data.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Dispose previous instance cleanly
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

    // Chart container with balanced padding for values & axes
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingLeft: 4,
        paddingRight: 16,
        paddingTop: 24,
        paddingBottom: 0
      })
    );

    // 1. X-Axis (Category: Months)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 45,
      cellStartLocation: 0.15,
      cellEndLocation: 0.85
    });

    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.45,
      strokeDasharray: [3, 3]
    });

    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif',
      paddingTop: 8
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'month',
        renderer: xRenderer
      })
    );

    xAxis.data.setAll(data.map((d) => ({ month: d.month })));

    // Calculate maximum values for scale padding
    const maxNew = Math.max(...data.map((d) => d.newRegistrations || 1));
    const maxCum = Math.max(...data.map((d) => d.cumulativePatients || 1));
    const leftScaleMax = Math.max(45, Math.ceil(maxNew * 1.65));
    const rightScaleMax = Math.max(100, Math.ceil(maxCum * 1.1));

    // 2. Left Y-Axis: New Registrations
    const yRendererLeft = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.05
    });

    yRendererLeft.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.5,
      strokeDasharray: [3, 3]
    });

    yRendererLeft.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10.5,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxisLeft = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: leftScaleMax,
        strictMinMax: true,
        renderer: yRendererLeft
      })
    );

    // Left Y-Axis Title
    yAxisLeft.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: 'New Registrations',
        y: am5.p50,
        centerX: am5.p50,
        fill: am5.color(0x64748B),
        fontSize: 10,
        fontFamily: 'Poppins, sans-serif',
        fontWeight: '500',
        paddingRight: 6
      })
    );

    // 3. Right Y-Axis: Cumulative Patients
    const yRendererRight = am5xy.AxisRendererY.new(root, {
      opposite: true,
      strokeOpacity: 0.05
    });

    yRendererRight.grid.template.set('visible', false); // Avoid overlapping grids

    yRendererRight.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10.5,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxisRight = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        max: rightScaleMax,
        strictMinMax: true,
        renderer: yRendererRight
      })
    );

    // Right Y-Axis Title
    yAxisRight.children.push(
      am5.Label.new(root, {
        rotation: 90,
        text: 'Cumulative Patients',
        y: am5.p50,
        centerX: am5.p50,
        fill: am5.color(0x64748B),
        fontSize: 10,
        fontFamily: 'Poppins, sans-serif',
        fontWeight: '500',
        paddingLeft: 6
      })
    );

    // 4. Dynamic Collision Avoidance Calculation for Every Data Point
    const getGreenLabelOffset = (dCtx) => {
      const vNew = dCtx?.newRegistrations || 0;
      const vCum = dCtx?.cumulativePatients || 0;
      const yBlueNorm = vNew / leftScaleMax;
      const yCumNorm = vCum / rightScaleMax;
      const deltaY = yCumNorm - yBlueNorm;

      // When the green point is well above the blue bar (> 10% vertical separation)
      if (deltaY >= 0.10) {
        return {
          dx: 0,
          dy: -15,
          centerX: am5.p50,
          centerY: am5.p100
        };
      }

      // Close collision proximity zone (-0.08 <= deltaY < 0.10) - shift left of marker
      if (deltaY >= -0.08 && deltaY < 0.10) {
        return {
          dx: -22,
          dy: -14,
          centerX: am5.p100,
          centerY: am5.p50
        };
      }

      // When green point is below the blue bar (deltaY < -0.08) - shift right of marker
      return {
        dx: 22,
        dy: -12,
        centerX: am5.p0,
        centerY: am5.p50
      };
    };

    // 5. Series 1: Blue Vertical Columns (New Registrations)
    const columnSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'New Registrations',
        xAxis: xAxis,
        yAxis: yAxisLeft,
        valueYField: 'newRegistrations',
        categoryXField: 'month',
        clustered: false
      })
    );

    columnSeries.columns.template.setAll({
      fill: am5.color(0x0066FF),
      strokeOpacity: 0,
      cornerRadiusTL: 6,
      cornerRadiusTR: 6,
      width: am5.percent(38),
      cursorOverStyle: 'pointer'
    });

    // Value Labels above Columns: Clean 10px vertical gap above bar
    columnSeries.bullets.push((bRoot) => {
      return am5.Bullet.new(bRoot, {
        locationY: 1,
        sprite: am5.Label.new(bRoot, {
          text: '{valueY}',
          fill: am5.color(0x0066FF),
          centerY: am5.p100,
          centerX: am5.p50,
          dy: -10, // Consistent 8-12px vertical gap above bar top
          fontSize: 11.5,
          fontWeight: '700',
          fontFamily: 'Poppins, sans-serif',
          populateText: true
        })
      });
    });

    columnSeries.data.setAll(data);

    // 6. Series 2: Smooth Green Curve (Cumulative Patients)
    const lineSeries = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: 'Cumulative Patients',
        xAxis: xAxis,
        yAxis: yAxisRight,
        valueYField: 'cumulativePatients',
        categoryXField: 'month',
        stroke: am5.color(0x10B981),
        strokeWidth: 2.4
      })
    );

    // Circular Bullet Marker on each month point
    lineSeries.bullets.push((bRoot, bSeries, dataItem) => {
      const circle = am5.Circle.new(bRoot, {
        radius: 4.5,
        fill: am5.color(0x10B981),
        stroke: am5.color(0xFFFFFF),
        strokeWidth: 2,
        cursorOverStyle: 'pointer'
      });

      // Pointer events on circle for tooltip
      circle.events.on('pointerover', (e) => {
        circle.set('radius', 6);
        const dCtx = dataItem.dataContext;
        if (dCtx && chartContainerRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          setHoveredData({
            ...dCtx,
            x: e.point.x,
            y: e.point.y,
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          columnSeries.columns.each((c) => {
            const isMatch = c.dataItem?.dataContext?.month === dCtx.month;
            c.set('opacity', isMatch ? 1.0 : 0.35);
          });
        }
      });

      circle.events.on('pointerout', () => {
        circle.set('radius', 4.5);
        setHoveredData(null);
        columnSeries.columns.each((c) => c.set('opacity', 1.0));
      });

      return am5.Bullet.new(bRoot, {
        sprite: circle
      });
    });

    // Dynamic Smart Value Label Bullet on Line Point (with subtle white pill background)
    lineSeries.bullets.push((bRoot, bSeries, dataItem) => {
      const dCtx = dataItem.dataContext;
      const offsets = getGreenLabelOffset(dCtx);

      const label = am5.Label.new(bRoot, {
        text: '{valueY}',
        fill: am5.color(0x047857),
        fontSize: 11,
        fontWeight: '700',
        fontFamily: 'Poppins, sans-serif',
        populateText: true,
        dx: offsets.dx,
        dy: offsets.dy,
        centerX: offsets.centerX,
        centerY: offsets.centerY,
        paddingLeft: 5,
        paddingRight: 5,
        paddingTop: 1.5,
        paddingBottom: 1.5,
        background: am5.RoundedRectangle.new(bRoot, {
          fill: am5.color(0xFFFFFF),
          fillOpacity: 0.95,
          stroke: am5.color(0x10B981),
          strokeWidth: 1,
          strokeOpacity: 0.45,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        })
      });

      return am5.Bullet.new(bRoot, {
        sprite: label
      });
    });

    lineSeries.data.setAll(data);

    // Interactive Hover: Custom high-fidelity non-clipping tooltip
    chart.series.each((s) => {
      s.columns?.template.events.on('pointerover', (e) => {
        const dCtx = e.target.dataItem?.dataContext;
        if (dCtx && chartContainerRef.current) {
          const rect = chartContainerRef.current.getBoundingClientRect();
          setHoveredData({
            ...dCtx,
            x: e.point.x,
            y: e.point.y,
            containerWidth: rect.width,
            containerHeight: rect.height
          });
          // Emphasize hovered column, dim others
          columnSeries.columns.each((c) => {
            const isMatch = c.dataItem?.dataContext?.month === dCtx.month;
            c.set('opacity', isMatch ? 1.0 : 0.35);
          });
        }
      });

      s.columns?.template.events.on('pointerout', () => {
        setHoveredData(null);
        columnSeries.columns.each((c) => c.set('opacity', 1.0));
      });
    });

    // Initial appearance animation only (runs once on data mount)
    if (!prefersReducedMotion) {
      columnSeries.appear(800, 80);
      lineSeries.appear(950, 100);
      chart.appear(900, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartDataKey]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative ${className}`}>
      {/* 1. Header */}
      <div>
        <div className="flex items-center justify-between gap-3 pb-3 border-b border-slate-100">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
              <BarChart2 className="w-4 h-4 stroke-[2.2]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Patient Growth & Registration
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                New registrations (monthly) and cumulative patients
              </p>
            </div>
          </div>
        </div>

        {/* 2. Legend */}
        <div className="flex items-center gap-5 mt-3 text-xs">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#0066FF]" />
            <span className="font-semibold text-slate-700">New Registrations</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-[#10B981]" />
            <span className="font-semibold text-slate-700">Cumulative Patients</span>
          </div>
        </div>
      </div>

      {/* 3. Chart Surface */}
      <div className="relative w-full flex-1 min-h-[300px] flex flex-col justify-center my-1">
        {loading && (
          <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-xl">
            <div className="h-6 w-6 border-2 border-blue-600 border-t-transparent rounded-full animate-spin" />
          </div>
        )}

        <div
          ref={chartContainerRef}
          className="w-full h-[300px] sm:h-[320px] select-none"
        />

        {/* 4. Non-clipping Dark Floating Tooltip matching reference design */}
        {hoveredData && (
          <div
            className="absolute z-40 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: Math.max(
                12,
                Math.min(
                  (hoveredData.containerWidth || 450) - 215,
                  hoveredData.x > (hoveredData.containerWidth || 450) - 180
                    ? hoveredData.x - 200
                    : hoveredData.x - 90
                )
              ),
              top: hoveredData.y < 125
                ? Math.min((hoveredData.containerHeight || 300) - 130, hoveredData.y + 24)
                : Math.max(10, hoveredData.y - 125)
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-3 border border-slate-700/60 min-w-[190px] font-sans">
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5 pb-1 border-b border-slate-800">
                {hoveredData.month}
              </div>

              <div className="space-y-1 text-xs">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#0066FF]" />
                    <span className="text-slate-300">New Registrations</span>
                  </div>
                  <span className="font-bold text-white">{hoveredData.newRegistrations}</span>
                </div>

                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-[#10B981]" />
                    <span className="text-slate-300">Cumulative Patients</span>
                  </div>
                  <span className="font-bold text-white">{hoveredData.cumulativePatients}</span>
                </div>

                {hoveredData.growth && (
                  <div className="flex items-center justify-between gap-3 pt-1.5 mt-1 border-t border-slate-800 text-[11px]">
                    <span className="text-slate-400">Growth</span>
                    <span className="font-bold text-emerald-400">{hoveredData.growth}</span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientGrowthChart;
