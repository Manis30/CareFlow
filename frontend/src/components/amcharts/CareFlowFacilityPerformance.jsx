import React, { useEffect, useRef, useId, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip } from './amchartsTheme';
import { Activity, X, Filter } from 'lucide-react';

/**
 * Concise clinic abbreviation/short name helper
 */
const getShortName = (name = '') => {
  if (!name) return '';
  if (/chennai metropolitan/i.test(name)) return 'CMHI';
  if (/adyar anbu/i.test(name)) return 'Adyar Anbu';
  if (/kovai lakshmi/i.test(name)) return 'Kovai Lakshmi';
  if (/siruvani/i.test(name)) return 'Siruvani';
  if (/sri vaigai/i.test(name)) return 'Sri Vaigai';
  if (/meenakshi care/i.test(name)) return 'Meenakshi';
  if (/salem varam/i.test(name)) return 'Salem Varam';
  if (/cauvery/i.test(name)) return 'Cauvery';
  
  const cleaned = name
    .replace(/\b(Multispeciality|Healthcare|Medical|Centre|Center|Hospital|Institute|Clinic)\b/gi, '')
    .trim();
  return cleaned.length > 14 ? `${cleaned.substring(0, 12)}...` : (cleaned || name);
};

/**
 * CareFlowFacilityPerformance
 * Premium amCharts 5 XY Bubble / Quadrant chart for Super Admin
 *
 * Dimensions:
 * - X-axis: Total Appointments
 * - Y-axis: Appointments per Doctor
 * - Bubble radius: Total Doctors
 * - Entity: Healthcare Organizations
 * - Dynamic Medians: Vertical & Horizontal platform crosshairs
 * - 4 Subtle Quadrants with clinical operational guidance
 * - Click-to-filter cross-filtering with highlight/dim states
 */
export const CareFlowFacilityPerformance = ({
  data = [],
  activeClinicFilter = null,
  onClinicSelect = null,
  height = 350,
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  const hasData = Boolean(data && data.length > 0);

  // Dynamic Platform Median X (Total Appointments)
  const medianX = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const sorted = data.map((d) => Number(d.appointmentCount || 0)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
  }, [data]);

  // Dynamic Platform Median Y (Appointments per Doctor)
  const medianY = useMemo(() => {
    if (!data || data.length === 0) return 0;
    const sorted = data.map((d) => Number(d.appointmentsPerDoctor || 0)).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Number(((sorted[mid - 1] + sorted[mid]) / 2).toFixed(1));
  }, [data]);

  // Process data with micro-dispersion for overlapping points to ensure all 8 organizations remain distinct & clickable
  const processedData = useMemo(() => {
    if (!data || data.length === 0) return [];

    // Group identical coordinates to disperse overlapping bubbles
    const coordMap = {};
    data.forEach((item) => {
      const key = `${item.appointmentCount}_${item.appointmentsPerDoctor}`;
      if (!coordMap[key]) coordMap[key] = [];
      coordMap[key].push(item);
    });

    return data.map((item) => {
      const key = `${item.appointmentCount}_${item.appointmentsPerDoctor}`;
      const group = coordMap[key];
      let plotX = Number(item.appointmentCount || 0);
      let plotY = Number(item.appointmentsPerDoctor || 0);

      if (group && group.length > 1) {
        const idx = group.findIndex((g) => (g.id || g.name) === (item.id || item.name));
        const total = group.length;
        // Even angular distribution around base point
        const angle = (2 * Math.PI * idx) / total;
        const radiusDispersionX = 0.45;
        const radiusDispersionY = 0.08;
        plotX = Number((plotX + Math.cos(angle) * radiusDispersionX).toFixed(2));
        plotY = Number((plotY + Math.sin(angle) * radiusDispersionY).toFixed(2));
      }

      return {
        ...item,
        plotX,
        plotY,
        shortName: getShortName(item.name)
      };
    });
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
        paddingLeft: 12,
        paddingRight: 24,
        paddingTop: 16,
        paddingBottom: 8
      })
    );

    // Calculate axis boundaries with comfortable padding around medians & points
    const xValues = processedData.map((d) => d.plotX);
    const yValues = processedData.map((d) => d.plotY);
    const minX = Math.min(...xValues);
    const maxX = Math.max(...xValues);
    const minY = Math.min(...yValues);
    const maxY = Math.max(...yValues);

    const xSpan = Math.max(maxX - minX, 1.0);
    const ySpan = Math.max(maxY - minY, 0.3);

    const axisMinX = Math.max(0, Math.floor((minX - xSpan * 0.45) * 10) / 10);
    const axisMaxX = Math.ceil((maxX + xSpan * 0.45) * 10) / 10;
    const axisMinY = Math.max(0, Math.floor((minY - ySpan * 0.45) * 10) / 10);
    const axisMaxY = Math.ceil((maxY + ySpan * 0.45) * 10) / 10;

    // X-Axis (Total Appointments)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 50,
      strokeOpacity: 0.12,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif',
      fontWeight: '500'
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.7
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: axisMinX,
        max: axisMaxX,
        strictMinMax: true
      })
    );

    // Y-Axis (Appointments per Doctor)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 35,
      strokeOpacity: 0.12,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif',
      fontWeight: '500'
    });
    yRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.7
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: axisMinY,
        max: axisMaxY,
        strictMinMax: true
      })
    );

    // Platform Median X Crosshair Line
    if (medianX > 0) {
      const rangeX = xAxis.createAxisRange(xAxis.makeDataItem({ value: medianX }));
      rangeX.get('grid')?.setAll({
        stroke: am5.color(0x64748B),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.75
      });
      rangeX.get('label')?.setAll({
        text: `Platform Median: ${medianX} Appts`,
        fill: am5.color(0x475569),
        fontSize: 9,
        fontWeight: 'bold',
        fontFamily: 'Poppins, system-ui, sans-serif',
        inside: true,
        location: 1,
        dy: -4
      });
    }

    // Platform Median Y Crosshair Line
    if (medianY > 0) {
      const rangeY = yAxis.createAxisRange(yAxis.makeDataItem({ value: medianY }));
      rangeY.get('grid')?.setAll({
        stroke: am5.color(0x64748B),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.75
      });
      rangeY.get('label')?.setAll({
        text: `Median: ${medianY} / Doctor`,
        fill: am5.color(0x475569),
        fontSize: 9,
        fontWeight: 'bold',
        fontFamily: 'Poppins, system-ui, sans-serif',
        inside: true,
        location: 1,
        dx: 6
      });
    }

    // Scatter Series (Bubbles)
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        calculateAggregates: true,
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: 'plotX',
        valueYField: 'plotY',
        valueField: 'doctorCount',
        stroke: am5.color(0x000000),
        strokeOpacity: 0,
        tooltip: createTooltip(root)
      })
    );

    // Circle Bullets
    series.bullets.push(() => {
      const circle = am5.Circle.new(root, {
        cursorOverStyle: 'pointer'
      });

      // Dynamic radius based on clinician team size (15px to 26px)
      circle.adapters.add('radius', (currentRadius, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return 17;
        const docs = Number(ctx.doctorCount || 1);
        const base = 15 + Math.min(Math.max((docs - 1) * 2, 0), 12);
        const isSelected = activeClinicFilter && (ctx.name === activeClinicFilter || ctx.id === activeClinicFilter);
        return isSelected ? base + 3 : base;
      });

      // Responsive fill color reflecting selection state
      circle.adapters.add('fill', (currentFill, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return am5.color(0x2563EB);
        if (!activeClinicFilter) return am5.color(0x2563EB);
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? am5.color(0x1D4ED8) : am5.color(0x94A3B8);
      });

      // Opacity: high for selected or default, dimmed for others
      circle.adapters.add('fillOpacity', (currentOpacity, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return 0.75;
        if (!activeClinicFilter) return 0.75;
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? 0.95 : 0.22;
      });

      // Border stroke
      circle.adapters.add('stroke', (currentStroke, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return am5.color(0xFFFFFF);
        if (!activeClinicFilter) return am5.color(0xFFFFFF);
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? am5.color(0x1E3A8A) : am5.color(0xCBD5E1);
      });

      circle.adapters.add('strokeWidth', (currentWidth, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return 2;
        if (!activeClinicFilter) return 2;
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? 3 : 1;
      });

      // Hover interaction
      circle.states.create('hover', {
        fillOpacity: 1.0,
        scale: 1.12
      });

      // Click-to-filter interaction
      if (onClinicSelect) {
        circle.events.on('click', (ev) => {
          const item = ev.target.dataItem?.dataContext;
          if (!item) return;
          if (activeClinicFilter === item.name || activeClinicFilter === item.id) {
            onClinicSelect(null);
          } else {
            onClinicSelect(item);
          }
        });
      }

      return am5.Bullet.new(root, {
        sprite: circle
      });
    });

    // Concise Clinic Name Labels (positioned directly below each bubble)
    series.bullets.push(() => {
      const label = am5.Label.new(root, {
        text: '{shortName}',
        fontSize: 10,
        fontFamily: 'Poppins, system-ui, sans-serif',
        centerX: am5.p50,
        centerY: am5.p0,
        populateText: true,
        cursorOverStyle: 'pointer'
      });

      label.adapters.add('dy', (dy, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return 18;
        const docs = Number(ctx.doctorCount || 1);
        const radius = 15 + Math.min(Math.max((docs - 1) * 2, 0), 12);
        return radius + 3;
      });

      label.adapters.add('fill', (fill, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return am5.color(0x334155);
        if (!activeClinicFilter) return am5.color(0x334155);
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? am5.color(0x1E40AF) : am5.color(0x94A3B8);
      });

      label.adapters.add('fontWeight', (weight, target) => {
        const ctx = target.dataItem?.dataContext;
        if (!ctx) return '600';
        const isSelected = ctx.name === activeClinicFilter || ctx.id === activeClinicFilter;
        return isSelected ? '700' : '600';
      });

      if (onClinicSelect) {
        label.events.on('click', (ev) => {
          const item = ev.target.dataItem?.dataContext;
          if (!item) return;
          if (activeClinicFilter === item.name || activeClinicFilter === item.id) {
            onClinicSelect(null);
          } else {
            onClinicSelect(item);
          }
        });
      }

      return am5.Bullet.new(root, {
        sprite: label
      });
    });

    // Rich Operational Tooltip
    series.get('tooltip').label.adapters.add('text', (text, target) => {
      const ctx = target.dataItem?.dataContext;
      if (!ctx) return text;

      const district = ctx.district ? `\n[fontSize: 10px; fill: #94A3B8]Location: ${ctx.district}[/]` : '';
      const docs = ctx.doctorCount ? `\n[fontSize: 11px]Total Doctors: [bold]${ctx.doctorCount}[/][/]` : '';
      const patients = ctx.patientCount ? `\n[fontSize: 11px]Total Patients: [bold]${ctx.patientCount}[/][/]` : '';
      const completion = ctx.completionRate !== undefined
        ? `\n[fontSize: 11px; fill: #86EFAC]Completion Rate: [bold]${ctx.completionRate}%[/][/]`
        : '';
      const hint = activeClinicFilter === ctx.name
        ? `\n\n[fontSize: 10px; fill: #F87171]Click to clear facility filter[/]`
        : `\n\n[fontSize: 10px; fill: #38BDF8]Click bubble to filter dashboard[/]`;

      return `[bold fontSize: 13px]{name}[/]${district}\n[fontSize: 11px]Total Appointments: [bold]{appointmentCount}[/]\n[fontSize: 11px; fill: #93C5FD]Appointments / Doctor: [bold]{appointmentsPerDoctor}[/]${docs}${patients}${completion}${hint}`;
    });

    // Cursor for axis tracking
    chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        xAxis: xAxis,
        yAxis: yAxis,
        behavior: 'none',
        lineX: { strokeOpacity: 0.25, strokeDasharray: [3, 3] },
        lineY: { strokeOpacity: 0.25, strokeDasharray: [3, 3] }
      })
    );

    series.data.setAll(processedData);

    if (!isReducedMotion()) {
      series.appear(600);
      chart.appear(600, 100);
    }

    return () => {
      root.dispose();
    };
  }, [processedData, hasData, activeClinicFilter, onClinicSelect, medianX, medianY]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3 mb-2">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Activity className="w-4 h-4 text-blue-600" />
            Facility Performance
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Appointments vs. Clinician Throughput • Bubble size indicates Total Doctors
          </p>
        </div>

        <div className="flex items-center gap-2">
          {medianX > 0 && medianY > 0 && (
            <span className="text-[10px] font-bold text-slate-500 bg-slate-50 px-2.5 py-1 rounded-md border border-slate-200/70">
              Platform Medians: {medianX} appts • {medianY} / doctor
            </span>
          )}

          {activeClinicFilter ? (
            <button
              onClick={() => onClinicSelect && onClinicSelect(null)}
              className="flex items-center gap-1 text-[11px] font-semibold text-blue-700 bg-blue-50 px-2.5 py-1 rounded-md border border-blue-200 hover:bg-blue-100 transition-colors"
              title="Click to reset facility filter"
            >
              <Filter className="w-3 h-3" />
              <span>Filtered: {activeClinicFilter}</span>
              <X className="w-3 h-3 ml-0.5 text-blue-500" />
            </button>
          ) : (
            <span className="text-[10px] font-medium text-slate-400 bg-slate-50/80 px-2 py-1 rounded border border-slate-200/60 hidden sm:inline-block">
              Click bubble to filter
            </span>
          )}
        </div>
      </div>

      {/* Canvas Area */}
      {!hasData ? (
        <div
          style={{ height }}
          className="flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200"
        >
          <p className="text-xs font-medium text-slate-600">No facility operational metrics available.</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Facility quadrants generate as encounters and doctor staffing accumulate.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {/* Chart Plot Area with 4 Subtle Quadrant Guides */}
          <div className="relative">
            <div ref={chartRef} style={{ width: '100%', height }} />

            {/* Subtle Quadrant Labels in Plot Area */}
            <div className="absolute top-2 left-14 pointer-events-none select-none text-[9px] font-semibold text-slate-400/80 bg-slate-50/70 px-1.5 py-0.5 rounded border border-slate-200/50">
              Lower Volume • High Productivity
            </div>
            <div className="absolute top-2 right-6 pointer-events-none select-none text-[9px] font-semibold text-blue-700/80 bg-blue-50/70 px-1.5 py-0.5 rounded border border-blue-200/60">
              High Volume • High Productivity
            </div>
            <div className="absolute bottom-8 left-14 pointer-events-none select-none text-[9px] font-semibold text-slate-400/70 bg-slate-50/70 px-1.5 py-0.5 rounded border border-slate-200/50">
              Lower Volume • Lower Productivity
            </div>
            <div className="absolute bottom-8 right-6 pointer-events-none select-none text-[9px] font-semibold text-slate-400/80 bg-slate-50/70 px-1.5 py-0.5 rounded border border-slate-200/50">
              High Volume • Lower Productivity
            </div>
          </div>

          {/* Dynamic 4-Quadrant Executive Guidance Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 border-t border-slate-100 text-[10px] text-slate-500">
            <div className="bg-slate-50/80 p-1.5 rounded-md border border-slate-200/60">
              <span className="font-bold text-blue-800 block">High Vol • High Prod</span>
              <span className="text-[9px] text-slate-500">Star facilities with heavy demand & high doctor output</span>
            </div>
            <div className="bg-slate-50/80 p-1.5 rounded-md border border-slate-200/60">
              <span className="font-bold text-slate-700 block">Low Vol • High Prod</span>
              <span className="text-[9px] text-slate-500">Specialized efficiency & concentrated doctor throughput</span>
            </div>
            <div className="bg-slate-50/80 p-1.5 rounded-md border border-slate-200/60">
              <span className="font-bold text-slate-700 block">High Vol • Low Prod</span>
              <span className="text-[9px] text-slate-500">Capacity reserve with large clinical staffing distribution</span>
            </div>
            <div className="bg-slate-50/80 p-1.5 rounded-md border border-slate-200/60">
              <span className="font-bold text-slate-700 block">Low Vol • Low Prod</span>
              <span className="text-[9px] text-slate-500">Emerging clinical schedules & developing caseloads</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareFlowFacilityPerformance;
