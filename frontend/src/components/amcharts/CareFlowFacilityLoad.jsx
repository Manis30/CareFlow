import React, { useEffect, useRef, useId, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_COLORS } from './amchartsTheme';
import { Sparkles, Building2, Crosshair } from 'lucide-react';

/**
 * CareFlowFacilityLoad
 * 
 * Flagship clinical command center visualization:
 *  - X-axis: Patient Cohort (distinct patients)
 *  - Y-axis: Workload Intensity (Appointments per Doctor)
 *  - Radius: Total Consultation Volume
 *  - Dynamic Platform Median Crosshairs
 *  - 4 Subtle Clinical Quadrants
 *  - Interactive click-to-filter & hover focus
 */
export const CareFlowFacilityLoad = ({
  facilities = [],
  selectedFacility = null,
  onFacilityClick = null,
  height = 360,
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  // Prepare normalized chart data
  const data = useMemo(() => {
    if (!facilities || facilities.length === 0) return [];
    return facilities.map((f) => {
      const docCount = Number(f.doctorCount) || 1;
      const apptCount = Number(f.appointmentCount) || 0;
      const workload = Number((apptCount / docCount).toFixed(1));
      const cohort = Number(f.patientCount) || 0;
      const completed = Number(f.completedCount) || 0;
      const rate = apptCount > 0 ? Math.round((completed / apptCount) * 100) : 0;

      return {
        id: f._id,
        name: f.name || 'Healthcare Facility',
        district: f.district || f.city || 'Tamil Nadu',
        x: cohort,
        y: workload,
        radiusValue: apptCount,
        doctorCount: docCount,
        completedCount: completed,
        completionRate: rate,
        raw: f
      };
    });
  }, [facilities]);

  const hasData = data.length > 0;

  // Compute Platform Medians
  const medianCohort = useMemo(() => {
    if (!data.length) return 0;
    const sorted = data.map((d) => d.x).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    return sorted.length % 2 !== 0 ? sorted[mid] : Math.round((sorted[mid - 1] + sorted[mid]) / 2);
  }, [data]);

  const medianWorkload = useMemo(() => {
    if (!data.length) return 0;
    const sorted = data.map((d) => d.y).sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);
    const val = sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
    return Number(val.toFixed(1));
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
        paddingRight: 24,
        paddingTop: 16,
        paddingBottom: 4
      })
    );

    // X Axis: Patient Cohort
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 45,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: 0,
        extraMax: 0.15,
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Y Axis: Workload Intensity (Appts / Doctor)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 35,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
        extraMax: 0.18,
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Add Median Guide on X (Vertical line)
    if (medianCohort > 0) {
      const xRange = xAxis.createAxisRange(xAxis.makeDataItem({ value: medianCohort }));
      xRange.get('grid').setAll({
        stroke: am5.color(0x3B82F6),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.45
      });
      xRange.get('label').setAll({
        text: `Median: ${medianCohort} patients`,
        fill: am5.color(0x2563EB),
        fontSize: 10,
        inside: true,
        valign: 'top',
        dy: 8,
        background: am5.Rectangle.new(root, {
          fill: am5.color(0xEFF6FF),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        })
      });
    }

    // Add Median Guide on Y (Horizontal line)
    if (medianWorkload > 0) {
      const yRange = yAxis.createAxisRange(yAxis.makeDataItem({ value: medianWorkload }));
      yRange.get('grid').setAll({
        stroke: am5.color(0x3B82F6),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.45
      });
      yRange.get('label').setAll({
        text: `Median: ${medianWorkload} appts/doc`,
        fill: am5.color(0x2563EB),
        fontSize: 10,
        inside: true,
        align: 'right',
        dx: -8,
        background: am5.Rectangle.new(root, {
          fill: am5.color(0xEFF6FF),
          fillOpacity: 0.9,
          cornerRadiusTL: 4,
          cornerRadiusTR: 4,
          cornerRadiusBL: 4,
          cornerRadiusBR: 4
        })
      });
    }

    // Bubble Series
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Facilities',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'y',
        valueXField: 'x',
        valueField: 'radiusValue',
        calculateAggregates: true,
        stroke: am5.color(0x000000),
        strokeOpacity: 0
      })
    );

    // Dynamic Bubble Bullets
    const minVal = Math.min(...data.map((d) => d.radiusValue || 0), 10);
    const maxVal = Math.max(...data.map((d) => d.radiusValue || 0), 60);

    const calcRadius = (val) => {
      if (maxVal === minVal) return 16;
      const normalized = (val - minVal) / (maxVal - minVal);
      return Math.max(12, Math.min(28, 12 + normalized * 16));
    };

    series.bullets.push((root, series, dataItem) => {
      const item = dataItem.dataContext;
      const isSelected = selectedFacility && (selectedFacility === item.name || selectedFacility === item.id);
      const isDimmed = selectedFacility && !isSelected;

      const container = am5.Container.new(root, {
        cursorOverStyle: 'pointer'
      });

      const radius = calcRadius(item.radiusValue);

      // Outer glow/ring for selected facility
      if (isSelected) {
        container.children.push(
          am5.Circle.new(root, {
            radius: radius + 5,
            fill: am5.color(0x2563EB),
            fillOpacity: 0.25,
            stroke: am5.color(0x2563EB),
            strokeWidth: 2
          })
        );
      }

      // Main Circle
      const circle = container.children.push(
        am5.Circle.new(root, {
          radius: radius,
          fill: isSelected
            ? am5.color(0x1D4ED8)
            : am5.color(0x2563EB),
          fillOpacity: isDimmed ? 0.35 : 0.82,
          stroke: am5.color(0xFFFFFF),
          strokeWidth: 2,
          tooltipText: `[bold]{name}[/]\nDistrict: {district}\n• Cohort: [bold]{x} patients[/]\n• Workload: [bold]{y} appts/doctor[/]\n• Total Volume: [bold]{radiusValue} encounters[/]\n• Completion Rate: [bold]{completionRate}%[/]`,
          tooltip: createTooltip(root)
        })
      );

      // Hover Animation
      circle.states.create('hover', {
        fillOpacity: 1,
        strokeWidth: 3,
        stroke: am5.color(0x0F172A)
      });

      // Click Interaction
      circle.events.on('click', () => {
        if (onFacilityClick) {
          onFacilityClick(item);
        }
      });

      // Center initial or label
      container.children.push(
        am5.Label.new(root, {
          text: item.name ? item.name.split(' ')[0].slice(0, 3).toUpperCase() : '',
          fill: am5.color(0xFFFFFF),
          fontSize: 9,
          fontWeight: '600',
          fontFamily: 'Poppins, system-ui, sans-serif',
          centerX: am5.p50,
          centerY: am5.p50,
          populateText: true
        })
      );

      return am5.Bullet.new(root, { sprite: container });
    });

    series.data.setAll(data);
    series.appear(800);
    chart.appear(800, 100);

    return () => {
      root.dispose();
    };
  }, [data, hasData, medianCohort, medianWorkload, selectedFacility, onFacilityClick]);

  if (!hasData) {
    return (
      <div className={`p-6 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col items-center justify-center text-center ${className}`} style={{ minHeight: height }}>
        <Crosshair className="w-8 h-8 text-slate-300 mb-2" />
        <p className="text-sm font-medium text-slate-600">No Facility Operational Data Available</p>
        <p className="text-xs text-slate-400 mt-1">Operational metrics will appear here once consultations are logged.</p>
      </div>
    );
  }

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs relative flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
              <Crosshair className="w-4 h-4 text-blue-600" />
              Facility Clinical Load & Workload Distribution
            </h3>
            {selectedFacility && (
              <span className="text-[11px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                Filtered: {selectedFacility}
              </span>
            )}
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            X: Active Patient Cohort • Y: Appointments / Clinician • Bubble Size: Total Encounters
          </p>
        </div>

        {/* Legend / Baseline Badges */}
        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-0.5 border-t border-dashed border-blue-500" />
            <span>Medians (Cohort: <strong className="text-slate-700">{medianCohort}</strong>, Load: <strong className="text-slate-700">{medianWorkload}</strong>)</span>
          </div>
        </div>
      </div>

      {/* Quadrant Helper Watermarks */}
      <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-medium uppercase tracking-wider py-1 px-2 bg-slate-50/60 rounded-lg mb-2">
        <div className="flex items-center justify-between">
          <span>↖ Focused Cohort · High Load</span>
          <span className="text-right">High Cohort · High Load ↗</span>
        </div>
        <div className="flex items-center justify-between">
          <span>↙ Emerging Cohort · Headroom</span>
          <span className="text-right">Broad Cohort · Balanced Load ↘</span>
        </div>
      </div>

      {/* amCharts Container */}
      <div
        id={chartId}
        ref={chartRef}
        style={{ width: '100%', height: `${height}px` }}
        className="relative"
      />

      {/* Footer hint */}
      <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
        <span>Click any facility bubble to cross-filter platform views</span>
        <span>Tamil Nadu Clinical Network</span>
      </div>
    </div>
  );
};

export default CareFlowFacilityLoad;
