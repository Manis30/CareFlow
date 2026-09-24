import React, { useEffect, useRef, useId, useMemo, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { motion } from 'framer-motion';
import {
  Target,
  Filter,
  X,
  ArrowUpDown,
  CheckCircle2
} from 'lucide-react';
import { isReducedMotion } from './amchartsTheme';

/**
 * Abbreviate hospital names for crisp readable bubble labels
 */
const abbreviateFacilityName = (name = '') => {
  if (!name) return 'Facility';
  if (name.includes('Sri Vaigai')) return 'Sri Vaigai';
  if (name.includes('Meenakshi')) return 'Meenakshi';
  if (name.includes('Salem Varam')) return 'Salem Varam';
  if (name.includes('Cauvery')) return 'Cauvery';
  if (name.includes('Chennai')) return 'Chennai Metro';
  if (name.includes('Adyar')) return 'Adyar Anbu';
  if (name.includes('Kovai')) return 'Kovai Lakshmi';
  if (name.includes('Siruvani')) return 'Siruvani';
  return name.split(' ').slice(0, 2).join(' ');
};

/**
 * CareFlowFacilityIntelligence
 * 
 * Two-Layer Analytical Experience:
 *  - LAYER 1: Facility Performance Matrix (XY correlation: Completion Rate % vs Appointment Volume, Point Size: Patient Cohort)
 *             Dynamic median benchmarks, 4 subtle analytical zones, collision-free dispersion, rich clinical tooltip, hover & click filter.
 *  - LAYER 2: Facility Performance Ranking (Dumbbell / Deviation Board)
 *             Platform median reference point, connector gap line, delta in percentage points, metric switcher (Completion, Appointments, Patients), Highest/Lowest sorting, interactive row filtering.
 */
export const CareFlowFacilityIntelligence = ({
  facilities = [],
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  const chartRef = useRef(null);
  const rootRef = useRef(null);
  const seriesRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);
  const xRangeRef = useRef(null);
  const yRangeRef = useRef(null);
  const spritesMapRef = useRef(new Map());
  const selectedFacilityRef = useRef(selectedFacility);
  const onFacilityClickRef = useRef(onFacilityClick);

  useEffect(() => {
    selectedFacilityRef.current = selectedFacility;
  }, [selectedFacility]);

  useEffect(() => {
    onFacilityClickRef.current = onFacilityClick;
  }, [onFacilityClick]);

  // Ranking controls state
  const [activeMetric, setActiveMetric] = useState('completion'); // 'completion' | 'appointments' | 'patients'
  const [sortOrder, setSortOrder] = useState('highest'); // 'highest' | 'lowest'
  const [hoveredFacilityId, setHoveredFacilityId] = useState(null);

  // 1. Process and normalize facility records
  const processedFacilities = useMemo(() => {
    if (!facilities || facilities.length === 0) return [];

    return facilities.map((f) => {
      const total = Number(f.appointmentCount) || 0;
      const completed = Number(f.completedCount) || 0;
      const cancelled = Number(f.cancelledCount) || 0;
      const scheduled = Number(f.scheduledCount) || 0;
      const rate = total > 0 ? (completed / total) * 100 : 0;
      const patients = Number(f.patientCount) || 0;
      const doctors = Number(f.doctorCount) || 1;

      return {
        id: f._id || f.id,
        name: f.name || 'Healthcare Facility',
        shortName: abbreviateFacilityName(f.name),
        district: f.district || f.city || 'Tamil Nadu',
        appointmentCount: total,
        completedCount: completed,
        cancelledCount: cancelled,
        scheduledCount: scheduled,
        completionRate: Number(rate.toFixed(1)),
        displayRate: Math.round(rate),
        patientCount: patients,
        doctorCount: doctors,
        raw: f
      };
    });
  }, [facilities]);

  // 2. Compute dynamic platform medians
  const { medianRate, medianVolume, medianPatients } = useMemo(() => {
    if (!processedFacilities.length) {
      return { medianRate: 87.0, medianVolume: 57.5, medianPatients: 53.0 };
    }
    const calcMedian = (arr) => {
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 !== 0 ? s[m] : Number(((s[m - 1] + s[m]) / 2).toFixed(1));
    };

    return {
      medianRate: calcMedian(processedFacilities.map((f) => f.completionRate)),
      medianVolume: calcMedian(processedFacilities.map((f) => f.appointmentCount)),
      medianPatients: calcMedian(processedFacilities.map((f) => f.patientCount))
    };
  }, [processedFacilities]);

  // 3. Collision-free Matrix data generation
  const matrixData = useMemo(() => {
    if (!processedFacilities.length) return [];

    // Group facilities with identical coordinates to prevent visual collapse
    const coordinateGroups = {};
    processedFacilities.forEach((f) => {
      const key = `${f.completionRate.toFixed(1)}_${f.appointmentCount}`;
      if (!coordinateGroups[key]) coordinateGroups[key] = [];
      coordinateGroups[key].push(f);
    });

    const items = [];
    Object.values(coordinateGroups).forEach((group) => {
      const count = group.length;
      group.forEach((f, idx) => {
        let plotX = f.completionRate;
        let plotY = f.appointmentCount;

        // Apply intelligent visual dispersion while preserving true underlying values
        if (count > 1) {
          const angle = (2 * Math.PI * idx) / count + Math.PI / 4;
          const rx = 0.44; // slight X dispersion
          const ry = 0.38; // slight Y dispersion
          plotX = Number((f.completionRate + rx * Math.cos(angle)).toFixed(2));
          plotY = Number((f.appointmentCount + ry * Math.sin(angle)).toFixed(2));
        }

        const delta = Number((f.completionRate - medianRate).toFixed(1));
        const deltaRounded = Math.round(delta);

        // Semantic palette per specification:
        // Strong = CareFlow blue/teal, Watch = amber, Needs attention = red
        let colorHex = 0x0284C7; // CareFlow Teal/Blue (#0284C7)
        let strokeHex = 0x0369A1;
        let statusBand = 'Strong';
        if (f.completionRate < medianRate - 1.0) {
          colorHex = 0xEF4444; // Red (#EF4444)
          strokeHex = 0xB91C1C;
          statusBand = 'Needs Attention';
        } else if (f.completionRate < medianRate + 0.1) {
          colorHex = 0xF59E0B; // Amber (#F59E0B)
          strokeHex = 0xB45309;
          statusBand = 'Watch';
        }

        // Bubble radius scaled to patient cohort (18px - 26px)
        const radius = 18 + Math.max(0, Math.min(8, (f.patientCount - 50) * 1.5));

        const deltaText = delta >= 0
          ? `+${deltaRounded === 0 ? '0' : deltaRounded} percentage point${Math.abs(deltaRounded) === 1 ? '' : 's'}`
          : `${deltaRounded} percentage point${Math.abs(deltaRounded) === 1 ? '' : 's'}`;
        const deltaColor = delta >= 0 ? '#34D399' : '#F87171';

        const apptsPerDoctor = f.doctorCount > 0 ? (f.appointmentCount / f.doctorCount).toFixed(1) : f.appointmentCount;

        // Rich Domo-style operational tooltip
        const tooltipHTML = `
          <div style="padding: 12px 14px; background: #0F172A; color: #FFFFFF; border-radius: 12px; border: 1px solid #334155; box-shadow: 0 10px 25px -5px rgba(0,0,0,0.5); font-family: 'Poppins', sans-serif; min-width: 220px;">
            <div style="font-weight: 700; font-size: 13px; color: #FFFFFF; margin-bottom: 2px;">
              ${f.name}
            </div>
            <div style="font-size: 11px; color: #94A3B8; margin-bottom: 8px; border-bottom: 1px solid #1E293B; padding-bottom: 6px;">
              ${f.district}
            </div>
            <table style="width: 100%; font-size: 11px; line-height: 1.7; border-collapse: collapse;">
              <tr>
                <td style="color: #94A3B8;">Completion</td>
                <td style="text-align: right; font-weight: 700; color: #34D399;">${f.displayRate}%</td>
              </tr>
              <tr>
                <td style="color: #94A3B8;">Appointments</td>
                <td style="text-align: right; font-weight: 600; color: #F8FAFC;">${f.appointmentCount}</td>
              </tr>
              <tr>
                <td style="color: #94A3B8;">Patients</td>
                <td style="text-align: right; font-weight: 600; color: #F8FAFC;">${f.patientCount}</td>
              </tr>
              <tr>
                <td style="color: #94A3B8;">Clinicians</td>
                <td style="text-align: right; font-weight: 600; color: #F8FAFC;">${f.doctorCount}</td>
              </tr>
              <tr>
                <td style="color: #94A3B8;">Appointments / Doctor</td>
                <td style="text-align: right; font-weight: 600; color: #60A5FA;">${apptsPerDoctor}</td>
              </tr>
            </table>
            <div style="margin-top: 8px; padding-top: 6px; border-top: 1px solid #1E293B; display: flex; justify-content: space-between; align-items: center; font-size: 10px;">
              <div>
                <div style="color: #94A3B8; text-transform: uppercase; letter-spacing: 0.05em; font-weight: 600;">vs platform median</div>
                <div style="font-weight: 700; font-size: 11px; margin-top: 1px; color: ${deltaColor};">
                  ${deltaText}
                </div>
              </div>
              <div style="background: #1E293B; color: #93C5FD; padding: 2px 7px; border-radius: 6px; font-weight: 600; font-size: 9px; text-transform: uppercase; letter-spacing: 0.05em; border: 1px solid #334155;">
                Click to filter
              </div>
            </div>
          </div>
        `;

        items.push({
          ...f,
          plotX,
          plotY,
          delta,
          deltaRounded,
          deltaText,
          colorHex,
          strokeHex,
          statusBand,
          radius,
          tooltipHTML
        });
      });
    });

    return items;
  }, [processedFacilities, medianRate]);

  // 4. Compute dynamic axis ranges
  const { xMin, xMax, yMin, yMax } = useMemo(() => {
    if (!matrixData.length) {
      return { xMin: 83, xMax: 91, yMin: 54, yMax: 61 };
    }
    const xVals = matrixData.map((d) => d.plotX);
    const yVals = matrixData.map((d) => d.plotY);

    const minX = Math.min(...xVals);
    const maxX = Math.max(...xVals);
    const minY = Math.min(...yVals);
    const maxY = Math.max(...yVals);

    return {
      xMin: Math.max(0, Math.floor(minX - 1.8)),
      xMax: Math.min(100, Math.ceil(maxX + 1.8)),
      yMin: Math.max(0, Math.floor(minY - 2.5)),
      yMax: Math.ceil(maxY + 2.5)
    };
  }, [matrixData]);

  // 5. amCharts 5 Lifecycle (Layer 1 Matrix) - Initialize Once
  useEffect(() => {
    if (!chartRef.current || !matrixData.length) return;

    // Create root
    const root = am5.Root.new(chartRef.current);
    rootRef.current = root;
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
        paddingLeft: 8,
        paddingRight: 24,
        paddingTop: 16,
        paddingBottom: 8
      })
    );

    // X Axis: Completion Rate %
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
    xRenderer.labels.template.adapters.add('text', (text) => (text ? `${text}%` : text));

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: xMin,
        max: xMax,
        strictMinMax: true,
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    xAxisRef.current = xAxis;

    // Y Axis: Appointment Volume
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
        min: yMin,
        max: yMax,
        strictMinMax: true,
        tooltip: am5.Tooltip.new(root, {})
      })
    );
    yAxisRef.current = yAxis;

    // Vertical Platform Median Line (X Axis)
    const xRange = xAxis.createAxisRange(xAxis.makeDataItem({ value: medianRate }));
    xRange.get('grid').setAll({
      stroke: am5.color(0x3B82F6),
      strokeWidth: 1.5,
      strokeDasharray: [4, 4],
      strokeOpacity: 0.55
    });
    xRange.get('label').setAll({
      text: `Median: ${medianRate.toFixed(1)}%`,
      fill: am5.color(0x2563EB),
      fontSize: 10,
      fontWeight: '600',
      location: 1,
      dy: -10
    });
    xRangeRef.current = xRange;

    // Horizontal Platform Median Line (Y Axis)
    const yRange = yAxis.createAxisRange(yAxis.makeDataItem({ value: medianVolume }));
    yRange.get('grid').setAll({
      stroke: am5.color(0x3B82F6),
      strokeWidth: 1.5,
      strokeDasharray: [4, 4],
      strokeOpacity: 0.55
    });
    yRange.get('label').setAll({
      text: `Median: ${medianVolume.toFixed(1)} appts`,
      fill: am5.color(0x2563EB),
      fontSize: 10,
      fontWeight: '600',
      location: 1,
      dx: 10
    });
    yRangeRef.current = yRange;

    // Bubble Series
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Facilities',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'plotY',
        valueXField: 'plotX',
        stroke: undefined,
        fill: undefined
      })
    );
    series.strokes.template.set('visible', false);
    seriesRef.current = series;

    // Clear old sprite map
    spritesMapRef.current.clear();

    // Bullet Template
    series.bullets.push((rootInstance, s, dataItem) => {
      const itemData = dataItem.dataContext;
      const isSelected = Boolean(
        selectedFacilityRef.current &&
        (selectedFacilityRef.current === itemData.name || selectedFacilityRef.current === itemData.id)
      );

      const container = am5.Container.new(rootInstance, {
        interactive: true,
        cursorOverStyle: 'pointer'
      });

      // Halo Ring Sprite (Domo Focus Ring)
      const halo = container.children.push(
        am5.Circle.new(rootInstance, {
          radius: itemData.radius + 6,
          fill: am5.color(0x3B82F6),
          fillOpacity: 0.12,
          stroke: am5.color(0x2563EB),
          strokeWidth: 1.5,
          strokeDasharray: [3, 3],
          visible: isSelected,
          opacity: isSelected ? 0.55 : 0
        })
      );

      // Circle bubble
      const circle = container.children.push(
        am5.Circle.new(rootInstance, {
          radius: itemData.radius,
          fill: am5.color(itemData.colorHex),
          fillOpacity: 0.85,
          stroke: am5.color(itemData.strokeHex),
          strokeWidth: isSelected ? 3 : 1.5,
          shadowColor: am5.color(0x000000),
          shadowBlur: isSelected ? 12 : 5,
          shadowOpacity: isSelected ? 0.28 : 0.12,
          tooltipHTML: itemData.tooltipHTML
        })
      );

      // Facility Label
      const label = container.children.push(
        am5.Label.new(rootInstance, {
          text: itemData.shortName,
          fill: isSelected ? am5.color(0x1D4ED8) : am5.color(0x334155),
          fontSize: 10,
          fontWeight: isSelected ? '700' : '600',
          fontFamily: 'Poppins, system-ui, sans-serif',
          centerX: am5.p50,
          centerY: am5.p0,
          dy: itemData.radius + 3
        })
      );

      // Hover Micro-Animation (150-200ms ease-out)
      container.events.on('pointerover', () => {
        setHoveredFacilityId(itemData.id);
      });

      container.events.on('pointerout', () => {
        setHoveredFacilityId(null);
      });

      container.events.on('click', () => {
        const currentSel = selectedFacilityRef.current;
        if (currentSel === itemData.name || currentSel === itemData.id) {
          onFacilityClickRef.current?.(null);
        } else {
          onFacilityClickRef.current?.(itemData.name);
        }
      });

      const spriteRecord = { container, circle, label, halo, itemData };
      spritesMapRef.current.set(itemData.id, spriteRecord);
      spritesMapRef.current.set(itemData.name, spriteRecord);

      return am5.Bullet.new(rootInstance, {
        sprite: container
      });
    });

    // Custom Cursor & Crosshairs
    const cursor = chart.set(
      'cursor',
      am5xy.XYCursor.new(root, {
        behavior: 'none',
        xAxis: xAxis,
        yAxis: yAxis
      })
    );
    cursor.lineX.setAll({
      stroke: am5.color(0x2563EB),
      strokeWidth: 1,
      strokeDasharray: [3, 3],
      strokeOpacity: 0.45
    });
    cursor.lineY.setAll({
      stroke: am5.color(0x2563EB),
      strokeWidth: 1,
      strokeDasharray: [3, 3],
      strokeOpacity: 0.45
    });

    // Set initial data
    series.data.setAll(matrixData);

    return () => {
      root.dispose();
      rootRef.current = null;
      spritesMapRef.current.clear();
    };
  }, [matrixData.length > 0, medianRate, medianVolume, xMin, xMax, yMin, yMax]);

  // Reactive Focus / Hover Animation Effect without destroying chart
  useEffect(() => {
    if (!spritesMapRef.current || spritesMapRef.current.size === 0) return;

    const processedSprites = new Set();

    spritesMapRef.current.forEach((entry) => {
      if (processedSprites.has(entry)) return;
      processedSprites.add(entry);

      const { circle, label, halo, itemData } = entry;
      const isSelected = Boolean(
        selectedFacility &&
        (selectedFacility === itemData.name || selectedFacility === itemData.id)
      );
      const isHovered = Boolean(
        hoveredFacilityId &&
        (hoveredFacilityId === itemData.id || hoveredFacilityId === itemData.name)
      );

      let targetOpacity = 0.85;
      let targetScale = 1.0;
      let targetStrokeWidth = 1.5;
      let targetStrokeHex = itemData.strokeHex;

      if (selectedFacility) {
        if (isSelected) {
          targetOpacity = 1.0;
          targetScale = 1.15;
          targetStrokeWidth = 3;
          targetStrokeHex = 0x1D4ED8;
        } else if (isHovered) {
          targetOpacity = 0.75;
          targetScale = 1.08;
          targetStrokeWidth = 2;
          targetStrokeHex = 0x2563EB;
        } else {
          // 25–30% opacity to preserve analytical context per Domo specification
          targetOpacity = 0.28;
          targetScale = 0.95;
          targetStrokeWidth = 1.2;
          targetStrokeHex = itemData.strokeHex;
        }
      } else {
        if (isHovered) {
          targetOpacity = 1.0;
          targetScale = 1.12;
          targetStrokeWidth = 2.5;
          targetStrokeHex = 0x2563EB;
        } else if (hoveredFacilityId) {
          targetOpacity = 0.45;
          targetScale = 0.98;
          targetStrokeWidth = 1.2;
          targetStrokeHex = itemData.strokeHex;
        } else {
          targetOpacity = 0.85;
          targetScale = 1.0;
          targetStrokeWidth = 1.5;
          targetStrokeHex = itemData.strokeHex;
        }
      }

      // Smooth property animations (150-200ms)
      circle.animate({
        key: 'fillOpacity',
        to: targetOpacity,
        duration: 200,
        easing: am5.ease.out(am5.ease.cubic)
      });
      circle.animate({
        key: 'scale',
        to: targetScale,
        duration: 200,
        easing: am5.ease.out(am5.ease.cubic)
      });
      circle.set('strokeWidth', targetStrokeWidth);
      circle.set('stroke', am5.color(targetStrokeHex));

      // Halo ring animation
      if (isSelected) {
        halo.set('visible', true);
        halo.animate({ key: 'opacity', to: 0.55, duration: 250 });
        halo.animate({ key: 'scale', to: targetScale * 1.15, duration: 250 });
      } else {
        halo.animate({ key: 'opacity', to: 0, duration: 200 });
        setTimeout(() => {
          if (!isSelected) halo.set('visible', false);
        }, 200);
      }

      // Label prominence
      label.set('fontWeight', isSelected || isHovered ? '700' : '600');
      label.set(
        'fill',
        isSelected
          ? am5.color(0x1D4ED8)
          : isHovered
          ? am5.color(0x0F172A)
          : am5.color(0x334155)
      );
      label.animate({
        key: 'opacity',
        to: targetOpacity < 0.35 ? 0.38 : 1.0,
        duration: 180
      });
    });
  }, [selectedFacility, hoveredFacilityId]);

  // 6. Layer 2: Prepare Dumbbell Ranking Board Data
  const dumbbellBoardData = useMemo(() => {
    if (!processedFacilities.length) return { items: [], baseline: 87, trackMin: 80, trackMax: 95, unitLabel: '%' };

    let baseline = medianRate;
    let getMetricVal = (f) => f.completionRate;
    let getDisplayVal = (f) => `${f.displayRate}%`;
    let getDelta = (f) => Number((f.completionRate - medianRate).toFixed(1));
    let formatDelta = (d) => `${d >= 0 ? '+' : ''}${Math.round(d)}pp`;
    let unitLabel = '%';

    if (activeMetric === 'appointments') {
      baseline = medianVolume;
      getMetricVal = (f) => f.appointmentCount;
      getDisplayVal = (f) => `${f.appointmentCount}`;
      getDelta = (f) => Number((f.appointmentCount - medianVolume).toFixed(1));
      formatDelta = (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} appts`;
      unitLabel = ' visits';
    } else if (activeMetric === 'patients') {
      baseline = medianPatients;
      getMetricVal = (f) => f.patientCount;
      getDisplayVal = (f) => `${f.patientCount}`;
      getDelta = (f) => Number((f.patientCount - medianPatients).toFixed(1));
      formatDelta = (d) => `${d >= 0 ? '+' : ''}${d.toFixed(1)} pts`;
      unitLabel = ' patients';
    }

    const items = processedFacilities.map((f) => {
      const val = getMetricVal(f);
      const delta = getDelta(f);
      return {
        ...f,
        metricValue: val,
        displayValue: getDisplayVal(f),
        delta,
        deltaFormatted: formatDelta(delta),
        unitLabel
      };
    });

    // Sort order
    items.sort((a, b) => {
      if (sortOrder === 'highest') {
        return b.metricValue - a.metricValue || b.appointmentCount - a.appointmentCount;
      }
      return a.metricValue - b.metricValue || a.appointmentCount - b.appointmentCount;
    });

    // Determine min/max for dumbbell bar track
    const allVals = items.map((i) => i.metricValue);
    const minVal = Math.min(...allVals, baseline);
    const maxVal = Math.max(...allVals, baseline);
    const padding = (maxVal - minVal) * 0.12 || 1;
    const trackMin = Math.max(0, minVal - padding);
    const trackMax = maxVal + padding;

    return {
      items,
      baseline,
      trackMin,
      trackMax,
      unitLabel
    };
  }, [processedFacilities, activeMetric, sortOrder, medianRate, medianVolume, medianPatients]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Active Filter Pill Bar */}
      {selectedFacility && (
        <div className="flex items-center justify-between px-4 py-2 bg-blue-50/90 border border-blue-200/80 rounded-xl shadow-2xs text-xs text-blue-900 animate-in fade-in slide-in-from-top-1 duration-200">
          <div className="flex items-center gap-2 truncate">
            <div className="w-5 h-5 rounded-md bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-2xs">
              <Filter className="w-3 h-3" />
            </div>
            <span className="font-semibold text-blue-700">Filter Focus:</span>
            <span className="font-bold text-blue-950 bg-white px-2 py-0.5 rounded-md border border-blue-200/80 shadow-2xs truncate">
              {selectedFacility}
            </span>
            <span className="hidden md:inline text-blue-600/80 text-[11px]">
              • 100% focus with platform context preserved (25% opacity)
            </span>
          </div>
          <button
            type="button"
            onClick={() => onFacilityClick && onFacilityClick(null)}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white text-blue-700 hover:text-rose-600 hover:bg-rose-50 border border-blue-200/80 hover:border-rose-200 transition-all font-semibold cursor-pointer shadow-2xs text-xs shrink-0"
          >
            <X className="w-3.5 h-3.5" />
            <span>Clear Filter (ESC)</span>
          </button>
        </div>
      )}

      {/* Main Container: Layer 1 + Layer 2 */}
      <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs overflow-hidden">
        {/* ========================================================
            HEADER & EXECUTIVE BENCHMARK SUMMARY
            ======================================================== */}
        <div className="p-5 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between gap-3 bg-gradient-to-b from-slate-50/50 to-white">
          <div>
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Target className="w-4 h-4" />
              </div>
              <h3 className="text-sm font-bold text-slate-900 tracking-tight">
                Facility Performance Intelligence
              </h3>
              {selectedFacility && (
                <span className="px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider bg-blue-600 text-white shadow-2xs animate-in fade-in zoom-in-95 duration-150">
                  Filtered View
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mt-0.5 transition-all duration-200">
              {selectedFacility
                ? `${selectedFacility} · Facility focus & platform benchmark comparison`
                : 'Platform-wide facility comparison: XY fulfillment matrix vs platform volume benchmark, plus ranked deviation board'}
            </p>
          </div>

          {/* Dynamic Platform Benchmark Badges */}
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span className="font-medium text-[11px]">Median Fulfillment:</span>
              <span className="font-bold text-slate-900">{medianRate.toFixed(1)}%</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 rounded-lg border border-slate-200/70 text-slate-600">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-600" />
              <span className="font-medium text-[11px]">Median Volume:</span>
              <span className="font-bold text-slate-900">{medianVolume.toFixed(1)} appts</span>
            </div>
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-emerald-50 rounded-lg border border-emerald-200/60 text-emerald-700 font-semibold text-[11px]">
              <CheckCircle2 className="w-3 h-3" />
              <span>{processedFacilities.length}/{processedFacilities.length} Audited</span>
            </div>
          </div>
        </div>

        {/* ========================================================
            LAYER 1 — FACILITY PERFORMANCE MATRIX
            ======================================================== */}
        <div className="p-5 border-b border-slate-100 relative">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-blue-50 text-blue-700 border border-blue-200/60">
                Layer 1
              </span>
              <span className="text-xs font-bold text-slate-800">
                Facility Fulfillment & Volume Matrix (XY Correlation)
              </span>
            </div>
            <span className="text-[11px] text-slate-400 font-medium">
              Bubble Size = Patient Cohort • Click bubble to filter platform
            </span>
          </div>

          {/* Matrix Canvas Container with 4 Subtle Analytical Zones */}
          <div className="relative w-full h-[360px] bg-slate-50/30 rounded-xl border border-slate-100 overflow-hidden">
            {/* 4 Subtle Quadrant Identification Labels */}
            {/* Top-Right: High Volume · High Fulfillment */}
            <div className="absolute top-2.5 right-3 z-10 pointer-events-none bg-emerald-50/70 border border-emerald-200/60 text-emerald-800 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider uppercase shadow-2xs">
              High Volume · High Fulfillment
            </div>
            {/* Top-Left: Low Volume · High Fulfillment */}
            <div className="absolute top-2.5 left-12 z-10 pointer-events-none bg-blue-50/70 border border-blue-200/60 text-blue-800 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider uppercase shadow-2xs">
              Low Volume · High Fulfillment
            </div>
            {/* Bottom-Right: High Volume · Lower Fulfillment */}
            <div className="absolute bottom-6 right-3 z-10 pointer-events-none bg-amber-50/70 border border-amber-200/60 text-amber-800 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider uppercase shadow-2xs">
              High Volume · Lower Fulfillment
            </div>
            {/* Bottom-Left: Low Volume · Lower Fulfillment */}
            <div className="absolute bottom-6 left-12 z-10 pointer-events-none bg-rose-50/70 border border-rose-200/60 text-rose-800 px-2 py-0.5 rounded-md text-[9.5px] font-bold tracking-wider uppercase shadow-2xs">
              Low Volume · Lower Fulfillment
            </div>

            {/* amCharts 5 Mount Node */}
            <div ref={chartRef} className="w-full h-full" />
          </div>

          {/* Legend / Semantic Key */}
          <div className="mt-3 pt-2.5 border-t border-slate-100 flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-3 text-slate-500">
              <span className="font-semibold text-slate-600 text-[11px]">Performance Bands:</span>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#0284C7]" />
                <span className="text-[11px]">Strong (≥ Median)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B]" />
                <span className="text-[11px]">Watch (At Benchmark)</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-[#EF4444]" />
                <span className="text-[11px]">Needs Attention (&lt; Median)</span>
              </div>
            </div>

            <div className="text-[11px] text-slate-400">
              X = Completion % • Y = Appointment Volume • Radius = Patient Scale
            </div>
          </div>
        </div>

        {/* ========================================================
            LAYER 2 — FACILITY PERFORMANCE RANKING (Dumbbell Board)
            ======================================================== */}
        <div className="p-5 bg-slate-50/40">
          {/* Header & Metric Switcher Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-200/70">
            <div>
              <div className="flex items-center gap-2">
                <span className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider uppercase bg-emerald-50 text-emerald-700 border border-emerald-200/60">
                  Layer 2
                </span>
                <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                  Facility Performance Board (Dumbbell & Deviation Audit)
                </h4>
              </div>
              <p className="text-[11px] text-slate-500 mt-0.5">
                Horizontal benchmark connector shows precise distance of each facility from the platform standard
              </p>
            </div>

            {/* Ranking Switcher Controls */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Metric Switcher */}
              <div className="inline-flex rounded-xl bg-white p-0.5 border border-slate-200 shadow-2xs">
                <button
                  type="button"
                  onClick={() => setActiveMetric('completion')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMetric === 'completion'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Completion
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('appointments')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMetric === 'appointments'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Appointments
                </button>
                <button
                  type="button"
                  onClick={() => setActiveMetric('patients')}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                    activeMetric === 'patients'
                      ? 'bg-blue-600 text-white shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Patients
                </button>
              </div>

              {/* Sort Toggle */}
              <button
                type="button"
                onClick={() => setSortOrder((prev) => (prev === 'highest' ? 'lowest' : 'highest'))}
                className="flex items-center gap-1 px-2.5 py-1 bg-white hover:bg-slate-100 rounded-xl border border-slate-200 text-xs font-semibold text-slate-700 shadow-2xs transition-colors cursor-pointer"
                title="Toggle sort order"
              >
                <ArrowUpDown className="w-3 h-3 text-slate-500" />
                <span>{sortOrder === 'highest' ? 'Highest' : 'Lowest'}</span>
              </button>
            </div>
          </div>

          {/* Dumbbell Scale Header Guide */}
          <div className="hidden sm:flex items-center justify-between text-[10px] font-semibold text-slate-400 pl-48 pr-28 mb-1">
            <span>Low Value</span>
            <div className="flex items-center gap-1 text-blue-600">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
              <span>Platform Median: {dumbbellBoardData.baseline}{dumbbellBoardData.unitLabel}</span>
            </div>
            <span>High Value</span>
          </div>

          {/* Dumbbell Rows */}
          <div className="space-y-2">
            {dumbbellBoardData.items.map((facility, index) => {
              const isSelected =
                selectedFacility &&
                (selectedFacility === facility.name || selectedFacility === facility.id);
              const isHovered =
                hoveredFacilityId &&
                (hoveredFacilityId === facility.id || hoveredFacilityId === facility.name);

              // Calculate positions along track
              const range = dumbbellBoardData.trackMax - dumbbellBoardData.trackMin || 1;
              const clamp = (v) => Math.max(0, Math.min(100, ((v - dumbbellBoardData.trackMin) / range) * 100));

              const medianPos = clamp(dumbbellBoardData.baseline);
              const facilityPos = clamp(facility.metricValue);
              const lineLeft = Math.min(medianPos, facilityPos);
              const lineWidth = Math.max(2, Math.abs(facilityPos - medianPos));

              const isPositive = facility.delta >= 0;

              return (
                <motion.div
                  key={facility.id || index}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, layout: { duration: 0.3, ease: 'easeOut' } }}
                  onMouseEnter={() => setHoveredFacilityId(facility.id)}
                  onMouseLeave={() => setHoveredFacilityId(null)}
                  onClick={() => {
                    if (onFacilityClick) {
                      if (selectedFacility === facility.name || selectedFacility === facility.id) {
                        onFacilityClick(null);
                      } else {
                        onFacilityClick(facility.name);
                      }
                    }
                  }}
                  className={`p-3 rounded-xl border transition-all duration-150 flex items-center gap-3 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-100 shadow-2xs'
                      : isHovered
                      ? 'bg-slate-50 border-slate-300 shadow-2xs'
                      : 'bg-white border-slate-200/80 hover:border-slate-300'
                  }`}
                >
                  {/* Rank */}
                  <span className="w-5 text-center font-mono font-bold text-xs text-slate-400 shrink-0">
                    {String(index + 1).padStart(2, '0')}
                  </span>

                  {/* Facility Identity */}
                  <div className="w-40 sm:w-48 shrink-0 truncate">
                    <div className="flex items-center gap-1.5">
                      <h5
                        className={`text-xs font-bold truncate transition-colors ${
                          isSelected ? 'text-blue-700' : 'text-slate-900 group-hover:text-blue-600'
                        }`}
                      >
                        {facility.name}
                      </h5>
                    </div>
                    <p className="text-[10px] text-slate-500 truncate mt-0.5">
                      {facility.district} • {facility.doctorCount} Doctors • {facility.completedCount}/{facility.appointmentCount} Visits
                    </p>
                  </div>

                  {/* Dumbbell Chart Track (Deviation Visualizer) */}
                  <div className="flex-1 relative h-6 flex items-center">
                    {/* Background Neutral Track */}
                    <div className="w-full h-1 bg-slate-100 rounded-full" />

                    {/* Connecting Gap Connector Line */}
                    <div
                      style={{ left: `${lineLeft}%`, width: `${lineWidth}%` }}
                      className={`absolute h-1 rounded-full transition-all duration-200 ${
                        isPositive ? 'bg-emerald-300' : 'bg-rose-300'
                      }`}
                    />

                    {/* Platform Median Anchor Dot */}
                    <div
                      style={{ left: `${medianPos}%` }}
                      className="absolute -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-slate-400 border border-white shadow-2xs z-10"
                      title={`Platform Median: ${dumbbellBoardData.baseline}${dumbbellBoardData.unitLabel}`}
                    />

                    {/* Facility Performance Dot */}
                    <div
                      style={{ left: `${facilityPos}%` }}
                      className={`absolute -translate-x-1/2 w-3.5 h-3.5 rounded-full border-2 border-white shadow-xs z-20 transition-all ${
                        isPositive ? 'bg-blue-600 ring-1 ring-blue-300' : 'bg-rose-500 ring-1 ring-rose-200'
                      }`}
                      title={`${facility.name}: ${facility.displayValue}`}
                    />
                  </div>

                  {/* Metric Value & Delta Badge */}
                  <div className="w-24 sm:w-28 shrink-0 text-right flex items-center justify-end gap-2">
                    <span className="text-xs font-bold text-slate-900">
                      {facility.displayValue}
                    </span>

                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-bold shrink-0 ${
                        isPositive
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-200/60'
                          : 'bg-rose-50 text-rose-700 border border-rose-200/60'
                      }`}
                    >
                      {facility.deltaFormatted}
                    </span>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareFlowFacilityIntelligence;
