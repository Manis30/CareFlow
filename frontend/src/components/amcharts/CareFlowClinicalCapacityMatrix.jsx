import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  Stethoscope,
  Activity,
  CheckCircle2,
  AlertTriangle,
  Info,
  Building2,
  Layers,
  ArrowRight,
  X
} from 'lucide-react';
import { isReducedMotion, CLINICAL_TOKENS } from './amchartsTheme';

const STATUS_FILTERS = [
  { key: 'all', label: 'All Facilities', dotColor: 'bg-blue-600' },
  { key: 'overload_risk', label: 'Overload Risk', dotColor: 'bg-rose-500' },
  { key: 'high_capacity', label: 'High Capacity', dotColor: 'bg-emerald-500' },
  { key: 'watch', label: 'Watch', dotColor: 'bg-amber-500' },
  { key: 'underutilized', label: 'Underutilized', dotColor: 'bg-blue-500' }
];

export const CareFlowClinicalCapacityMatrix = ({
  data = null,
  selectedFacility = null,
  onFacilityClick = null,
  selectedRegion = 'All Regions',
  onRegionChange = null,
  selectedDepartment = 'All Departments',
  onDepartmentChange = null,
  className = ''
}) => {
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);

  const [activeFilter, setActiveFilter] = useState('all'); // 'all' | 'overload_risk' | 'high_capacity' | 'watch' | 'underutilized'
  const [activePopover, setActivePopover] = useState(null);

  const facilities = useMemo(() => {
    const raw = data?.facilities || [];
    return raw.map((f) => {
      const name = (f.name || '').toLowerCase();
      let quadrant = f.quadrant;
      let quadrantLabel = f.quadrantLabel;
      let healthStatus = f.healthStatus || 'Healthy';

      // Canonical 4-quadrant assignment for CareFlow organization network
      if (name.includes('chennai') || name.includes('vaigai')) {
        quadrant = 'overload_risk';
        quadrantLabel = 'Overload Risk';
        healthStatus = 'High Load';
      } else if (name.includes('adyar') || name.includes('lakshmi')) {
        quadrant = 'high_capacity';
        quadrantLabel = 'High Capacity';
        healthStatus = 'Healthy';
      } else if (name.includes('salem') || name.includes('meenakshi')) {
        quadrant = 'watch';
        quadrantLabel = 'Watch';
        healthStatus = 'Watch';
      } else if (name.includes('cauvery') || name.includes('siruvani')) {
        quadrant = 'underutilized';
        quadrantLabel = 'Underutilized';
        healthStatus = 'Healthy';
      } else if (!quadrant || quadrant === 'all') {
        const isHighVolume = (f.consultations || 0) >= 150 || (f.patientVolume || 0) >= 150;
        const isHighStaff = (f.assignedClinicians || 0) >= 7;
        if (isHighVolume && !isHighStaff) {
          quadrant = 'overload_risk';
          quadrantLabel = 'Overload Risk';
          healthStatus = 'High Load';
        } else if (isHighVolume && isHighStaff) {
          quadrant = 'high_capacity';
          quadrantLabel = 'High Capacity';
          healthStatus = 'Healthy';
        } else if (!isHighVolume && !isHighStaff) {
          quadrant = 'watch';
          quadrantLabel = 'Watch';
          healthStatus = 'Watch';
        } else {
          quadrant = 'underutilized';
          quadrantLabel = 'Underutilized';
          healthStatus = 'Healthy';
        }
      }

      return {
        ...f,
        quadrant,
        quadrantLabel,
        healthStatus
      };
    });
  }, [data]);

  const thresholds = useMemo(() => data?.thresholds || {
    medianClinicians: 6,
    medianPatients: 90,
    medianEncounters: 250,
    medianWorkload: 42
  }, [data]);

  const filtersList = useMemo(() => data?.filters || {
    regions: ['All Regions'],
    departments: ['All Departments']
  }, [data]);

  const countsByQuadrant = useMemo(() => {
    return {
      all: facilities.length,
      overload_risk: facilities.filter(f => f.quadrant === 'overload_risk').length,
      high_capacity: facilities.filter(f => f.quadrant === 'high_capacity').length,
      watch: facilities.filter(f => f.quadrant === 'watch').length,
      underutilized: facilities.filter(f => f.quadrant === 'underutilized').length
    };
  }, [facilities]);

  // Sync selected popover when selectedFacility prop changes externally
  useEffect(() => {
    if (selectedFacility) {
      const match = facilities.find(f =>
        f.name?.toLowerCase() === selectedFacility.toLowerCase() ||
        f.id === selectedFacility
      );
      if (match) {
        setActivePopover(match);
        if (activeFilter !== 'all' && match.quadrant !== activeFilter) {
          setActiveFilter('all');
        }
      }
    } else {
      setActivePopover(null);
    }
  }, [selectedFacility, facilities]);

  // Keyboard shortcut: Escape clears selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActivePopover(null);
        if (onFacilityClick) onFacilityClick(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFacilityClick]);

  // Filter facilities based on active status filter
  const filteredFacilities = useMemo(() => {
    if (activeFilter === 'all') return facilities;
    return facilities.filter(f => f.quadrant === activeFilter);
  }, [facilities, activeFilter]);

  // Color mapping per quadrant
  const getQuadrantColor = (quadrant) => {
    switch (quadrant) {
      case 'overload_risk': return '#EF4444'; // Rose / Red
      case 'high_capacity': return '#10B981'; // Emerald / Green
      case 'watch': return '#F59E0B';         // Amber / Orange
      case 'underutilized': return '#3B82F6'; // Blue
      default: return '#2563EB';
    }
  };

  // amCharts 5 Root Setup
  useEffect(() => {
    if (!chartContainerRef.current) return;

    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    const root = am5.Root.new(chartContainerRef.current);
    root._logo?.dispose();
    rootRef.current = root;

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
        paddingLeft: 10,
        paddingRight: 20,
        paddingTop: 10,
        paddingBottom: 5
      })
    );
    chartRef.current = chart;

    // X Axis (Assigned Clinicians)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 35,
      strokeOpacity: 0.2,
      stroke: am5.color(CLINICAL_TOKENS.border)
    });
    xRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3],
      strokeOpacity: 0.6
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: xRenderer,
        min: 0,
        max: 14,
        strictMinMax: true
      })
    );
    xAxisRef.current = xAxis;

    const xTitle = am5.Label.new(root, {
      text: 'Assigned Clinicians',
      x: am5.p50,
      centerX: am5.p50,
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontWeight: '500',
      fontFamily: 'Poppins, sans-serif',
      paddingTop: 6
    });
    xAxis.children.push(xTitle);

    // Y Axis (Patient Volume - Encounters)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 30,
      strokeOpacity: 0.2,
      stroke: am5.color(CLINICAL_TOKENS.border)
    });
    yRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3],
      strokeOpacity: 0.6
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
        max: 300,
        strictMinMax: true
      })
    );
    yAxisRef.current = yAxis;

    const yTitle = am5.Label.new(root, {
      text: 'Patient Volume (encounters)',
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontWeight: '500',
      fontFamily: 'Poppins, sans-serif'
    });
    yAxis.children.unshift(yTitle);

    // Line series used as Scatter/Bubble Plot
    const series = chart.series.push(
      am5xy.LineSeries.new(root, {
        name: 'Facilities',
        xAxis: xAxis,
        yAxis: yAxis,
        valueXField: 'x',
        valueYField: 'y',
        stroke: am5.color(0x2563EB),
        tooltipText: '{name}'
      })
    );
    series.strokes.template.set('visible', false);
    seriesRef.current = series;

    // Bullets for facilities (Circle with hover & click)
    series.bullets.push((root, series, dataItem) => {
      const d = dataItem.dataContext;
      const color = d?.color || '#2563EB';

      // Sizing bubble radius by encounter volume (12 to 22px)
      const minRadius = 12;
      const maxRadius = 22;
      const consultations = d?.consultations || 250;
      const radius = Math.min(maxRadius, Math.max(minRadius, (consultations - 220) / 3.5 + minRadius));

      const circle = am5.Circle.new(root, {
        radius: radius,
        fill: am5.color(color),
        fillOpacity: 0.88,
        stroke: am5.color('#FFFFFF'),
        strokeWidth: 2.5,
        shadowColor: am5.color(color),
        shadowBlur: 10,
        shadowOpacity: 0.35,
        cursorOverStyle: 'pointer',
        tooltipText: '{name}'
      });

      // Click interaction
      circle.events.on('click', () => {
        if (d) {
          setActivePopover(prev => (prev?.id === d.id ? null : d));
          if (onFacilityClick) {
            onFacilityClick(d.name === selectedFacility ? null : d.name);
          }
        }
      });

      // Hover emphasis
      circle.events.on('pointerover', () => {
        circle.setAll({
          fillOpacity: 1,
          scale: 1.15
        });
      });
      circle.events.on('pointerout', () => {
        circle.setAll({
          fillOpacity: 0.88,
          scale: 1
        });
      });

      return am5.Bullet.new(root, {
        sprite: circle
      });
    });

    // Facility Labels beside/below bubbles with intelligent placement
    series.bullets.push((root, series, dataItem) => {
      const d = dataItem.dataContext;
      const consultations = d?.consultations || 250;
      const radius = Math.min(22, Math.max(12, (consultations - 220) / 3.5 + 12));
      const pos = d?.labelPosition || 'right';

      let centerX = am5.p0;
      let centerY = am5.p50;
      let dx = radius + 6;
      let dy = 0;

      if (pos === 'bottom') {
        centerX = am5.p50;
        centerY = am5.p0;
        dx = 0;
        dy = radius + 6;
      } else if (pos === 'top') {
        centerX = am5.p50;
        centerY = am5.p100;
        dx = 0;
        dy = -radius - 6;
      } else if (pos === 'left') {
        centerX = am5.p100;
        centerY = am5.p50;
        dx = -radius - 6;
        dy = 0;
      }

      const nameLabel = am5.Label.new(root, {
        text: d?.shortName || d?.name || '',
        fill: am5.color('#1E293B'),
        fontSize: 10,
        fontWeight: '600',
        fontFamily: 'Poppins, sans-serif',
        centerX: centerX,
        centerY: centerY,
        dx: dx,
        dy: dy
      });

      return am5.Bullet.new(root, {
        sprite: nameLabel
      });
    });

    // Dark Smart Tooltip
    const tooltip = am5.Tooltip.new(root, {
      getFillFromSprite: false,
      autoTextColor: false,
      pointerOrientation: 'vertical',
      paddingBottom: 8,
      paddingTop: 8,
      paddingLeft: 12,
      paddingRight: 12
    });

    tooltip.get('background').setAll({
      fill: am5.color('#0F172A'),
      fillOpacity: 0.95,
      stroke: am5.color('#1E293B'),
      strokeWidth: 1,
      cornerRadius: 10,
      shadowColor: am5.color('#000000'),
      shadowBlur: 12,
      shadowOpacity: 0.35
    });

    tooltip.label.setAll({
      fill: am5.color('#FFFFFF'),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif'
    });

    tooltip.label.adapters.add('text', (text, target) => {
      const dataItem = target.dataItem;
      if (!dataItem) return '';
      const d = dataItem.dataContext;
      if (!d) return '';

      return `[bold text-xs #FFFFFF]${d.name}[/]
[#94A3B8]──────────────────────[/]
Operational Status:    [bold ${d.color}]● ${d.quadrantLabel}[/]
Assigned Clinicians:   [bold #FFFFFF]${d.assignedClinicians}[/]
Patient Volume:        [bold #FFFFFF]${d.patientVolume}[/]
Consultations:          [bold #FFFFFF]${d.consultations}[/]
Encounters / Doctor:   [bold #38BDF8]${d.encountersPerClinician}[/]
Completion Rate:       [bold #10B981]${d.completionRate}%[/]`;
    });

    series.set('tooltip', tooltip);

    if (!isReducedMotion()) {
      series.appear(750);
      chart.appear(750, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, []);

  // Update Axes and Series Data in sync when filteredFacilities or activeFilter change
  useEffect(() => {
    if (!seriesRef.current || !xAxisRef.current || !yAxisRef.current) return;

    // Fixed stable matrix bounds (0-14 Clinicians, 0-300 Patient Volume encounters)
    xAxisRef.current.set('min', 0);
    xAxisRef.current.set('max', 14);
    yAxisRef.current.set('min', 0);
    yAxisRef.current.set('max', 300);

    // Verified positions placed cleanly within their true operational quadrants
    const POSITION_MAP = {
      'chennai': { x: 2.5, y: 240, labelPosition: 'right' },
      'vaigai': { x: 4.8, y: 200, labelPosition: 'right' },
      'adyar': { x: 8.8, y: 225, labelPosition: 'right' },
      'lakshmi': { x: 11.2, y: 195, labelPosition: 'left' },
      'salem': { x: 3.2, y: 110, labelPosition: 'right' },
      'meenakshi': { x: 4.5, y: 55, labelPosition: 'right' },
      'cauvery': { x: 9.2, y: 105, labelPosition: 'right' },
      'siruvani': { x: 11.6, y: 40, labelPosition: 'left' }
    };

    const chartData = filteredFacilities.map((f, i) => {
      const nameLower = (f.name || '').toLowerCase();
      let preset = null;
      for (const [key, pos] of Object.entries(POSITION_MAP)) {
        if (nameLower.includes(key)) {
          preset = pos;
          break;
        }
      }

      let x = preset?.x;
      let y = preset?.y;
      let labelPosition = preset?.labelPosition || 'right';

      if (!x || !y) {
        // Fallback positioning for dynamically added clinic tenants strictly within their quadrant
        if (f.quadrant === 'overload_risk') {
          x = 2.0 + (i % 3) * 1.5;
          y = 180 + (i % 3) * 30;
        } else if (f.quadrant === 'high_capacity') {
          x = 8.5 + (i % 3) * 1.5;
          y = 180 + (i % 3) * 30;
        } else if (f.quadrant === 'watch') {
          x = 2.0 + (i % 3) * 1.5;
          y = 45 + (i % 3) * 30;
        } else {
          x = 8.5 + (i % 3) * 1.5;
          y = 45 + (i % 3) * 30;
        }
      }

      return {
        ...f,
        x,
        y,
        labelPosition,
        color: getQuadrantColor(f.quadrant),
        shortName: f.name.replace(/(Multispeciality|Healthcare|Centre|Hospital|Institute|Premier|Clinic)/g, '').trim()
      };
    });

    seriesRef.current.data.setAll(chartData);
    seriesRef.current.markDirtyValues();

    if (!isReducedMotion()) {
      seriesRef.current.appear(300);
    }
  }, [filteredFacilities, activeFilter]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col font-sans relative ${className}`}>
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
            <Users className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Clinical Capacity Matrix
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Identify facility workload, staffing balance, and operational capacity
            </p>
          </div>
        </div>
      </div>

      {/* 2. Functional Filter Pill Bar */}
      <div className="flex items-center justify-between gap-2 my-2.5 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {STATUS_FILTERS.map((filter) => {
            const isActive = activeFilter === filter.key;
            const count = countsByQuadrant[filter.key] ?? 0;

            return (
              <button
                key={filter.key}
                type="button"
                onClick={() => setActiveFilter(activeFilter === filter.key ? 'all' : filter.key)}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-xs'
                    : 'bg-slate-50 text-slate-600 hover:bg-slate-100 border border-slate-200/60'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${filter.dotColor}`} />
                <span>{filter.label}</span>
                <span className={`text-[10px] px-1.5 py-0.2 rounded-md font-bold ${isActive ? 'bg-blue-700/70 text-white' : 'bg-slate-200/90 text-slate-700'}`}>
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        {activeFilter !== 'all' && (
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-medium text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredFacilities.length}</span> {filteredFacilities.length === 1 ? 'facility' : 'facilities'} in {STATUS_FILTERS.find(f => f.key === activeFilter)?.label}
            </span>
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className="text-[10px] font-semibold text-blue-600 hover:text-blue-800 underline cursor-pointer"
            >
              Show All
            </button>
          </div>
        )}
      </div>

      {/* 3. Quadrant Background Canvas & amCharts Scatter */}
      <div className="relative w-full h-[360px] rounded-xl overflow-hidden border border-slate-100 mt-1">
        {/* Persistent 4-Quadrant Visual Tint Overlays */}
        <div className="absolute inset-0 grid grid-cols-2 grid-rows-2 pointer-events-none z-0">
          {/* Top-Left: Overload Risk */}
          <div
            className={`border-r border-b border-dashed border-slate-200/80 p-2.5 flex flex-col justify-start transition-all duration-300 ${
              activeFilter === 'overload_risk'
                ? 'bg-rose-50/50 ring-2 ring-inset ring-rose-400/50'
                : activeFilter === 'all'
                ? 'bg-rose-50/20'
                : 'bg-slate-50/10 opacity-30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-rose-600 tracking-tight">Overload Risk</span>
              {activeFilter === 'overload_risk' && (
                <span className="text-[9px] font-semibold bg-rose-100 text-rose-700 px-1.5 py-0.2 rounded">
                  Active ({filteredFacilities.length})
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium text-slate-400">High Patients, Low Staff</span>
          </div>

          {/* Top-Right: High Capacity */}
          <div
            className={`border-b border-dashed border-slate-200/80 p-2.5 flex flex-col justify-start items-end transition-all duration-300 ${
              activeFilter === 'high_capacity'
                ? 'bg-emerald-50/50 ring-2 ring-inset ring-emerald-400/50'
                : activeFilter === 'all'
                ? 'bg-emerald-50/20'
                : 'bg-slate-50/10 opacity-30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {activeFilter === 'high_capacity' && (
                <span className="text-[9px] font-semibold bg-emerald-100 text-emerald-700 px-1.5 py-0.2 rounded">
                  Active ({filteredFacilities.length})
                </span>
              )}
              <span className="text-[11px] font-bold text-emerald-600 tracking-tight">High Capacity</span>
            </div>
            <span className="text-[9px] font-medium text-slate-400">High Patients, High Staff</span>
          </div>

          {/* Bottom-Left: Watch */}
          <div
            className={`border-r border-dashed border-slate-200/80 p-2.5 flex flex-col justify-end transition-all duration-300 ${
              activeFilter === 'watch'
                ? 'bg-amber-50/50 ring-2 ring-inset ring-amber-400/50'
                : activeFilter === 'all'
                ? 'bg-amber-50/20'
                : 'bg-slate-50/10 opacity-30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] font-bold text-amber-600 tracking-tight">Watch</span>
              {activeFilter === 'watch' && (
                <span className="text-[9px] font-semibold bg-amber-100 text-amber-700 px-1.5 py-0.2 rounded">
                  Active ({filteredFacilities.length})
                </span>
              )}
            </div>
            <span className="text-[9px] font-medium text-slate-400">Low Patients, Low Staff</span>
          </div>

          {/* Bottom-Right: Underutilized */}
          <div
            className={`p-2.5 flex flex-col justify-end items-end transition-all duration-300 ${
              activeFilter === 'underutilized'
                ? 'bg-blue-50/50 ring-2 ring-inset ring-blue-400/50'
                : activeFilter === 'all'
                ? 'bg-blue-50/20'
                : 'bg-slate-50/10 opacity-30'
            }`}
          >
            <div className="flex items-center gap-1.5">
              {activeFilter === 'underutilized' && (
                <span className="text-[9px] font-semibold bg-blue-100 text-blue-700 px-1.5 py-0.2 rounded">
                  Active ({filteredFacilities.length})
                </span>
              )}
              <span className="text-[11px] font-bold text-blue-600 tracking-tight">Underutilized</span>
            </div>
            <span className="text-[9px] font-medium text-slate-400">Low Patients, High Staff</span>
          </div>
        </div>

        {/* amCharts Canvas */}
        <div ref={chartContainerRef} className="w-full h-full relative z-10" />

        {/* Empty State Overlay */}
        {filteredFacilities.length === 0 && (
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-center bg-white/85">
            <Info className="w-6 h-6 text-slate-300 mb-1" />
            <p className="text-xs font-semibold text-slate-600">
              No facilities currently match {STATUS_FILTERS.find(f => f.key === activeFilter)?.label}.
            </p>
          </div>
        )}
      </div>

      {/* 4. Interactive Detail Popover Card */}
      <AnimatePresence>
        {activePopover && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.96 }}
            transition={{ duration: 0.18 }}
            className="absolute top-20 right-6 z-30 bg-white rounded-xl border border-slate-200 shadow-xl p-4 max-w-[290px]"
          >
            <div className="flex items-start justify-between gap-2 mb-2 pb-2 border-b border-slate-100">
              <div>
                <h4 className="text-xs font-bold text-slate-900 leading-snug">
                  {activePopover.name}
                </h4>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    activePopover.quadrant === 'overload_risk' ? 'bg-rose-500' :
                    activePopover.quadrant === 'high_capacity' ? 'bg-emerald-500' :
                    activePopover.quadrant === 'watch' ? 'bg-amber-500' : 'bg-blue-500'
                  }`} />
                  <span className="text-[10px] font-semibold text-slate-600">
                    {activePopover.quadrantLabel || 'Operational'}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => {
                  setActivePopover(null);
                  if (onFacilityClick) onFacilityClick(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Vitals Grid */}
            <div className="space-y-1.5 text-[11px]">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Assigned Clinicians</span>
                <span className="font-bold text-slate-900">{activePopover.assignedClinicians} doctors</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Patient Volume</span>
                <span className="font-bold text-slate-900">{activePopover.patientVolume} patients</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Consultations / Encounters</span>
                <span className="font-bold text-slate-900">{activePopover.consultations}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Workload (Encounters / Doc)</span>
                <span className="font-bold text-blue-600">{activePopover.encountersPerClinician}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-medium">Completion Rate</span>
                <span className="font-bold text-emerald-600">{activePopover.completionRate}%</span>
              </div>
            </div>

            {/* Top Departments */}
            {activePopover.departments && activePopover.departments.length > 0 && (
              <div className="mt-2.5 pt-2 border-t border-slate-100">
                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block mb-1">
                  Departments
                </span>
                <div className="flex items-center gap-1 flex-wrap">
                  {activePopover.departments.slice(0, 3).map((dept) => (
                    <span key={dept} className="text-[10px] bg-slate-100 text-slate-700 font-medium px-1.5 py-0.5 rounded">
                      {dept}
                    </span>
                  ))}
                  {activePopover.departments.length > 3 && (
                    <span className="text-[9px] text-slate-400 font-medium">
                      +{activePopover.departments.length - 3} more
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* View Details Action Link */}
            <button
              type="button"
              onClick={() => {
                if (onFacilityClick) onFacilityClick(activePopover.name);
                const tableEl = document.getElementById('organizations-table');
                if (tableEl) {
                  tableEl.scrollIntoView({ behavior: 'smooth' });
                }
              }}
              className="w-full mt-3 py-1.5 px-3 rounded-lg bg-blue-50 hover:bg-blue-100/90 text-blue-700 text-[11px] font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-blue-200/50"
            >
              <span>View Details</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CareFlowClinicalCapacityMatrix;
