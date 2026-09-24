import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import {
  Building2,
  Sparkles,
  ChevronRight,
  ArrowLeft,
  CheckCircle2,
  TrendingUp,
  Users,
  Stethoscope,
  Calendar,
  ArrowUpDown,
  SlidersHorizontal,
  Activity,
  Check,
  MapPin
} from 'lucide-react';
import { getRegionalPerformanceApi } from '../../api/superAdmin';
import { isReducedMotion } from './amchartsTheme';

/**
 * Metric Configurations
 */
const METRICS = [
  { key: 'success', label: 'Appointment Success', unit: '%' },
  { key: 'volume', label: 'Appointment Volume', unit: '' },
  { key: 'reach', label: 'Patient Reach', unit: '' }
];

const TIMEFRAMES = [
  { key: '30D', label: '30D' },
  { key: '90D', label: '90D' },
  { key: '6M', label: '6M' },
  { key: 'ALL', label: 'All Time' }
];

/**
 * Abbreviate facility name for clean badges and chart labels
 */
const abbreviateFacilityName = (name = '') => {
  if (!name) return 'Facility';
  if (name.includes('Sri Vaigai')) return 'Sri Vaigai';
  if (name.includes('Meenakshi')) return 'Meenakshi';
  if (name.includes('Salem Varam')) return 'Salem Varam';
  if (name.includes('Cauvery')) return 'Cauvery';
  if (name.includes('Chennai Metro') || name.includes('Chennai')) return 'Chennai Metro';
  if (name.includes('Adyar')) return 'Adyar Anbu';
  if (name.includes('Kovai')) return 'Kovai Lakshmi';
  if (name.includes('Siruvani')) return 'Siruvani';
  return name.split(' ').slice(0, 2).join(' ');
};

/**
 * CareFlowRegionalPerformance
 *
 * Flagship Healthcare Intelligence Matrix:
 * PLATFORM (Median Reference) -> 5 REGIONS -> REGIONAL FACILITIES -> GLOBAL FILTER
 */
export const CareFlowRegionalPerformance = ({
  initialData = null,
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  // State
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [timeframe, setTimeframe] = useState('6M');
  const [activeMetric, setActiveMetric] = useState('success'); // 'success' | 'volume' | 'reach'
  const [sortOrder, setSortOrder] = useState('highest'); // 'highest' | 'lowest' | 'alpha'
  const [selectedRegion, setSelectedRegion] = useState(null); // null = Region View, string = Facility View
  const [hoveredRowId, setHoveredRowId] = useState(null);
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0, visible: false, item: null });

  // amCharts refs
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);
  const medianRangeRef = useRef(null);

  // Fetch or sync regional performance data when timeframe changes
  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        const res = await getRegionalPerformanceApi({ timeframe });
        if (isMounted && res?.data) {
          setData(res.data);
        }
      } catch (err) {
        console.error('Failed to load regional clinical performance:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => {
      isMounted = false;
    };
  }, [timeframe]);

  // Sync initialData if provided and no timeframe has been triggered yet
  useEffect(() => {
    if (initialData && !data) {
      setData(initialData);
    }
  }, [initialData, data]);

  // Keyboard accessibility: ESC clears drill-down or facility filter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedRegion) {
          setSelectedRegion(null);
        } else if (selectedFacility && onFacilityClick) {
          onFacilityClick(null);
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedRegion, selectedFacility, onFacilityClick]);

  // Extract platform stats
  const platform = useMemo(() => {
    return (
      data?.platform || {
        totalAppointments: 460,
        completedAppointments: 400,
        cancelledAppointments: 15,
        scheduledAppointments: 45,
        completionRate: 87.0,
        medianCompletionRate: 87.7,
        activeClinicians: 48,
        patientsCount: 90,
        appointmentsPerDoctor: 9.6
      }
    );
  }, [data]);

  const platformMedianRate = platform.medianCompletionRate || platform.completionRate || 87.0;

  // Current active dataset depending on whether drilled down into a region
  const activeItems = useMemo(() => {
    const regions = data?.regions || [];
    if (!selectedRegion) {
      // Region View: 5 Regions
      return regions.map((r) => ({
        id: r.region,
        name: r.region,
        type: 'region',
        appointmentCount: r.appointmentCount,
        completedCount: r.completedCount,
        cancelledCount: r.cancelledCount,
        scheduledCount: r.scheduledCount,
        completionRate: r.completionRate,
        doctorCount: r.doctorCount,
        patientCount: r.patientCount,
        appointmentsPerDoctor: r.appointmentsPerDoctor,
        deltaVsPlatform: r.deltaVsPlatform,
        facilityCount: r.facilities?.length || 0,
        facilities: r.facilities || []
      }));
    } else {
      // Facility View: facilities inside selectedRegion
      const targetRegion = regions.find((r) => r.region === selectedRegion);
      if (!targetRegion) return [];
      return (targetRegion.facilities || []).map((f) => ({
        id: f._id,
        name: f.name,
        shortName: abbreviateFacilityName(f.name),
        type: 'facility',
        district: f.district || selectedRegion,
        city: f.city || selectedRegion,
        organizationLogo: f.organizationLogo,
        appointmentCount: f.appointmentCount,
        completedCount: f.completedCount,
        cancelledCount: f.cancelledCount,
        scheduledCount: f.scheduledCount,
        completionRate: f.completionRate,
        doctorCount: f.doctorCount,
        patientCount: f.patientCount,
        appointmentsPerDoctor: f.appointmentsPerDoctor,
        deltaVsPlatform: f.deltaVsPlatform,
        deltaVsRegion: f.deltaVsRegion
      }));
    }
  }, [data, selectedRegion]);

  // Sort active items
  const sortedItems = useMemo(() => {
    const items = [...activeItems];
    if (sortOrder === 'alpha') {
      return items.sort((a, b) => a.name.localeCompare(b.name));
    }

    const getMetricVal = (item) => {
      if (activeMetric === 'volume') return item.appointmentCount;
      if (activeMetric === 'reach') return item.patientCount;
      return item.completionRate;
    };

    return items.sort((a, b) => {
      const valA = getMetricVal(a);
      const valB = getMetricVal(b);
      return sortOrder === 'highest' ? valB - valA : valA - valB;
    });
  }, [activeItems, sortOrder, activeMetric]);

  // Generate dynamic clinical decision insight
  const dynamicInsight = useMemo(() => {
    if (data?.insight && !selectedRegion) {
      return data.insight;
    }
    if (selectedRegion && sortedItems.length > 0) {
      const topFac = sortedItems[0];
      const deltaSign = topFac.deltaVsRegion >= 0 ? `+${topFac.deltaVsRegion}` : `${topFac.deltaVsRegion}`;
      return `${topFac.shortName || topFac.name} leads ${selectedRegion} fulfillment by ${deltaSign}pp (${topFac.completionRate}%)`;
    }
    return `CareFlow platform fulfillment median is ${platformMedianRate}%`;
  }, [data, selectedRegion, sortedItems, platformMedianRate]);

  const activeMetricRef = useRef(activeMetric);
  const platformMedianRateRef = useRef(platformMedianRate);
  const onFacilityClickRef = useRef(onFacilityClick);

  useEffect(() => {
    activeMetricRef.current = activeMetric;
  }, [activeMetric]);

  useEffect(() => {
    platformMedianRateRef.current = platformMedianRate;
  }, [platformMedianRate]);

  useEffect(() => {
    onFacilityClickRef.current = onFacilityClick;
  }, [onFacilityClick]);

  // amCharts 5 Mount Effect: Create Root, Chart, Axes, Series ONCE
  useEffect(() => {
    if (!chartContainerRef.current) return;

    const root = am5.Root.new(chartContainerRef.current);
    rootRef.current = root;
    root._logo?.dispose();

    // Apply animation theme
    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    // Create chart
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingLeft: 10,
        paddingRight: 10,
        paddingTop: 5,
        paddingBottom: 5
      })
    );
    chartRef.current = chart;

    // X Axis: Categories (Regions or Facilities)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 40,
      cellStartLocation: 0.15,
      cellEndLocation: 0.85
    });

    xRenderer.labels.template.setAll({
      fontFamily: 'Poppins, sans-serif',
      fontSize: 11,
      fontWeight: '500',
      fill: am5.color(0x64748b),
      paddingTop: 6
    });

    xRenderer.grid.template.setAll({
      strokeOpacity: 0
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'name',
        renderer: xRenderer
      })
    );
    xAxisRef.current = xAxis;

    // Y Axis: Metric Value (Success Rate % or Volume or Reach)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1,
      stroke: am5.color(0xe2e8f0)
    });

    yRenderer.labels.template.setAll({
      fontFamily: 'Poppins, sans-serif',
      fontSize: 10,
      fill: am5.color(0x94a3b8)
    });

    yRenderer.grid.template.setAll({
      stroke: am5.color(0xe2e8f0),
      strokeOpacity: 0.6,
      strokeDasharray: [3, 3]
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 40,
        max: 100,
        strictMinMax: true,
        renderer: yRenderer
      })
    );
    yAxisRef.current = yAxis;

    // Create Series with Heatmap visual rules
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'Performance',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'value',
        categoryXField: 'name',
        tooltip: am5.Tooltip.new(root, {
          labelText: '{name}: {valueY}%',
          pointerOrientation: 'vertical'
        })
      })
    );
    seriesRef.current = series;

    // Column Styling with semantic colors
    series.columns.template.setAll({
      cornerRadiusTL: 6,
      cornerRadiusTR: 6,
      strokeOpacity: 0,
      cursorOverStyle: 'pointer',
      width: am5.percent(60)
    });

    // Dynamic Heat Rules / Adapters for semantic colors
    series.columns.template.adapters.add('fill', (fill, target) => {
      const dataContext = target.dataItem?.dataContext;
      if (!dataContext) return fill;

      const currentMetric = activeMetricRef.current;
      const medianRate = platformMedianRateRef.current;

      if (currentMetric === 'success') {
        const rate = dataContext.completionRate;
        const delta = rate - medianRate;
        if (delta >= 0.5) return am5.color(0x0d9488); // CareFlow teal/emerald
        if (delta >= -0.5) return am5.color(0x0284c7); // Neutral clinical blue
        if (delta >= -3.0) return am5.color(0xf59e0b); // Amber attention
        return am5.color(0xef4444); // Restrained red
      } else if (currentMetric === 'volume') {
        return am5.color(0x2563eb); // Clinical blue for volume
      } else {
        return am5.color(0x7c3aed); // Purple for patient cohort
      }
    });

    // Interactive Click: Drill down into region or filter facility
    series.columns.template.events.on('click', (ev) => {
      const dataContext = ev.target.dataItem?.dataContext;
      if (!dataContext) return;
      if (dataContext.type === 'region') {
        setSelectedRegion(dataContext.id);
      } else if (dataContext.type === 'facility' && onFacilityClickRef.current) {
        onFacilityClickRef.current(dataContext.name || dataContext.id);
      }
    });

    chart.appear(600, 100);

    return () => {
      root.dispose();
      rootRef.current = null;
      chartRef.current = null;
      seriesRef.current = null;
      xAxisRef.current = null;
      yAxisRef.current = null;
      medianRangeRef.current = null;
    };
  }, []);

  // amCharts 5 Data & Metric Update Effect: Smoothly updates series without disposing root
  useEffect(() => {
    if (!rootRef.current || !seriesRef.current || !xAxisRef.current || !yAxisRef.current) return;

    const isSuccessMetric = activeMetric === 'success';

    // Update Y-axis bounds
    if (isSuccessMetric) {
      yAxisRef.current.setAll({ min: 40, max: 100, strictMinMax: true });
      seriesRef.current.get('tooltip')?.set('labelText', '{name}: {valueY}%');
    } else {
      yAxisRef.current.setAll({ min: 0, max: undefined, strictMinMax: false });
      seriesRef.current.get('tooltip')?.set('labelText', '{name}: {valueY}');
    }

    // Update Median line
    if (medianRangeRef.current) {
      yAxisRef.current.axisRanges.removeValue(medianRangeRef.current);
      medianRangeRef.current = null;
    }

    if (isSuccessMetric) {
      const rangeDataItem = yAxisRef.current.makeDataItem({
        value: platformMedianRate
      });
      const range = yAxisRef.current.createAxisRange(rangeDataItem);
      medianRangeRef.current = range;

      range.get('grid').setAll({
        stroke: am5.color(0x0284c7),
        strokeWidth: 1.5,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.85
      });

      range.get('label').setAll({
        text: `Median ${platformMedianRate}%`,
        fill: am5.color(0x0284c7),
        fontFamily: 'Poppins, sans-serif',
        fontSize: 10,
        fontWeight: '600',
        inside: true,
        background: am5.Rectangle.new(rootRef.current, {
          fill: am5.color(0xffffff),
          fillOpacity: 0.9,
          cornerRadiusBL: 3,
          cornerRadiusBR: 3,
          cornerRadiusTL: 3,
          cornerRadiusTR: 3
        })
      });
    }

    // Format chart data
    const chartData = sortedItems.map((item) => {
      let val = item.completionRate;
      if (activeMetric === 'volume') val = item.appointmentCount;
      if (activeMetric === 'reach') val = item.patientCount;

      return {
        name: item.shortName || item.name,
        value: val,
        ...item
      };
    });

    xAxisRef.current.data.setAll(chartData);
    seriesRef.current.data.setAll(chartData);
    seriesRef.current.appear(400);
  }, [sortedItems, activeMetric, platformMedianRate]);

  // Floating cursor tooltip position handler
  const handleMouseMove = (e, item) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX,
      y: e.clientY - 10,
      visible: true,
      item
    });
  };

  const handleMouseLeave = () => {
    setHoveredRowId(null);
    setTooltipPos((prev) => ({ ...prev, visible: false, item: null }));
  };

  // Click handler for row
  const handleRowClick = (item) => {
    if (item.type === 'region') {
      setSelectedRegion(item.id);
    } else if (item.type === 'facility') {
      if (onFacilityClick) {
        onFacilityClick(selectedFacility === item.name || selectedFacility === item.id ? null : item.name);
      }
    }
  };

  return (
    <div
      className={`bg-white rounded-2xl border border-slate-200/80 shadow-xs p-6 space-y-6 transition-all ${className}`}
    >
      {/* 1. Header Section: Title, Subtitle, Breadcrumb & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-slate-100 pb-5">
        <div>
          {/* Breadcrumb Navigation when drilled down */}
          {selectedRegion ? (
            <div className="flex items-center gap-2 mb-1.5">
              <button
                type="button"
                onClick={() => setSelectedRegion(null)}
                className="inline-flex items-center gap-1 text-xs font-semibold text-blue-600 hover:text-blue-800 bg-blue-50/80 hover:bg-blue-100/80 px-2 py-0.5 rounded-md transition-colors cursor-pointer"
                title="Return to All Regions"
              >
                <ArrowLeft className="w-3 h-3" />
                <span>All Regions</span>
              </button>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
              <span className="text-xs font-bold text-slate-700">{selectedRegion}</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded-md">
                Platform Clinical Scope
              </span>
            </div>
          )}

          <h2 className="text-lg font-bold text-slate-900 tracking-tight flex items-center gap-2">
            {selectedRegion ? `${selectedRegion} · Facility Performance` : 'Regional Clinical Performance'}
          </h2>
          <p className="text-xs text-slate-500 max-w-2xl mt-0.5">
            {selectedRegion
              ? `Operational metrics and clinical realization across facilities in ${selectedRegion} district.`
              : 'Appointment success, clinical volume, and facility performance across the CareFlow regional network.'}
          </p>
        </div>

        {/* Top-Right Decision Insight & Controls */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-3">
          {/* Dynamic Insight Pill */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50/70 border border-blue-200/60 rounded-xl text-blue-900 shadow-2xs">
            <Sparkles className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span className="text-xs font-semibold tracking-tight">{dynamicInsight}</span>
          </div>

          {/* Timeframe Filter Selector */}
          <div className="flex items-center bg-slate-100/80 p-1 rounded-xl border border-slate-200/60 self-start sm:self-auto">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.key}
                type="button"
                onClick={() => setTimeframe(tf.key)}
                className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                  timeframe === tf.key
                    ? 'bg-white text-slate-900 shadow-2xs'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tf.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Controls Row: Secondary Metric Switcher + Sorting + Platform Benchmark Rail */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-50/70 p-3 rounded-xl border border-slate-200/60">
        {/* Metric Switcher */}
        <div className="flex items-center gap-1.5">
          <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider mr-1">
            Primary Metric:
          </span>
          {METRICS.map((m) => (
            <button
              key={m.key}
              type="button"
              onClick={() => setActiveMetric(m.key)}
              className={`px-3 py-1 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                activeMetric === m.key
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-white text-slate-600 hover:bg-slate-100/80 border border-slate-200/80'
              }`}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Sorting & Platform Benchmark Indicator */}
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs font-medium text-slate-600 bg-white px-3 py-1 rounded-lg border border-slate-200/80">
            <Activity className="w-3.5 h-3.5 text-blue-600" />
            <span>
              Platform Median: <strong className="text-slate-900 font-bold">{platformMedianRate}%</strong>
            </span>
          </div>

          <div className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg border border-slate-200/80 text-xs">
            <ArrowUpDown className="w-3 h-3 text-slate-400 mr-1" />
            <span className="text-slate-400 text-[11px] font-medium mr-1">Sort:</span>
            <button
              type="button"
              onClick={() => setSortOrder('highest')}
              className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                sortOrder === 'highest' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Highest
            </button>
            <span className="text-slate-200">|</span>
            <button
              type="button"
              onClick={() => setSortOrder('lowest')}
              className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                sortOrder === 'lowest' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Lowest
            </button>
            <span className="text-slate-200">|</span>
            <button
              type="button"
              onClick={() => setSortOrder('alpha')}
              className={`px-1.5 py-0.5 rounded font-semibold cursor-pointer ${
                sortOrder === 'alpha' ? 'bg-blue-50 text-blue-700' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              A–Z
            </button>
          </div>
        </div>
      </div>

      {/* 3. amCharts 5 Micro-Visualization Canvas (Dynamic Bar / Heat distribution) */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 px-1">
          <span className="uppercase tracking-wider">Comparative Distribution Visual</span>
          <span>Click any bar to drill down / filter</span>
        </div>
        <div
          ref={chartContainerRef}
          className="w-full h-36 bg-slate-50/40 rounded-xl border border-slate-100 overflow-hidden"
        />
      </div>

      {/* 4. Interactive Performance Matrix */}
      <div className="overflow-x-auto rounded-xl border border-slate-200/80 bg-white">
        <table className="w-full text-left text-xs border-collapse">
          <thead>
            <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              <th className="py-3 px-4 w-52">
                {selectedRegion ? 'Facility Name' : 'Region'}
              </th>
              <th className="py-3 px-4 text-center">
                Appointment Success %
              </th>
              <th className="py-3 px-3 text-right">Appointments</th>
              <th className="py-3 px-3 text-right">Completed</th>
              <th className="py-3 px-3 text-right">Cancelled</th>
              <th className="py-3 px-3 text-right">Clinicians</th>
              <th className="py-3 px-3 text-right">Patients</th>
              <th className="py-3 px-3 text-right">Appts/Doctor</th>
              <th className="py-3 px-4 text-center w-28">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {loading ? (
              // Premium Matrix Skeleton
              [1, 2, 3, 4, 5].map((idx) => (
                <tr key={idx} className="animate-pulse">
                  <td className="py-3.5 px-4">
                    <div className="h-4 bg-slate-100 rounded w-28" />
                  </td>
                  <td className="py-3.5 px-4 text-center">
                    <div className="h-6 bg-slate-100 rounded-lg w-20 mx-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-10 ml-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-10 ml-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-8 ml-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-8 ml-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-10 ml-auto" />
                  </td>
                  <td className="py-3.5 px-3">
                    <div className="h-4 bg-slate-100 rounded w-10 ml-auto" />
                  </td>
                  <td className="py-3.5 px-4">
                    <div className="h-5 bg-slate-100 rounded w-16 mx-auto" />
                  </td>
                </tr>
              ))
            ) : sortedItems.length === 0 ? (
              <tr>
                <td colSpan={9} className="py-8 text-center text-slate-400 font-medium">
                  No operational records found for this scope.
                </td>
              </tr>
            ) : (
              sortedItems.map((item) => {
                const isHovered = hoveredRowId === item.id;
                const isDimmed = hoveredRowId !== null && hoveredRowId !== item.id;
                const isFacilitySelected =
                  item.type === 'facility' &&
                  (selectedFacility === item.name || selectedFacility === item.id);

                // Semantic intensity for Success Cell
                const delta = item.deltaVsPlatform;
                let intensityBg = 'bg-sky-50 text-sky-700 border-sky-200';
                let dotColor = 'bg-sky-500';

                if (delta >= 0.5) {
                  intensityBg = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  dotColor = 'bg-emerald-500';
                } else if (delta < -3.0) {
                  intensityBg = 'bg-rose-50 text-rose-700 border-rose-200';
                  dotColor = 'bg-rose-500';
                } else if (delta < -0.5) {
                  intensityBg = 'bg-amber-50 text-amber-700 border-amber-200';
                  dotColor = 'bg-amber-500';
                }

                // Delta sign
                const deltaSign = delta >= 0 ? `+${delta}` : `${delta}`;

                return (
                  <motion.tr
                    key={item.id}
                    layout
                    tabIndex={0}
                    role="button"
                    onClick={() => handleRowClick(item)}
                    onMouseEnter={() => setHoveredRowId(item.id)}
                    onMouseMove={(e) => handleMouseMove(e, item)}
                    onMouseLeave={handleMouseLeave}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleRowClick(item);
                    }}
                    className={`transition-all duration-200 cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-blue-600 ${
                      isDimmed ? 'opacity-35' : 'opacity-100'
                    } ${
                      isFacilitySelected
                        ? 'bg-blue-50/90 font-medium'
                        : isHovered
                        ? 'bg-slate-50'
                        : 'bg-white'
                    }`}
                  >
                    {/* Col 1: Name / Entity */}
                    <td className="py-3 px-4">
                      <div className="flex items-center gap-2.5">
                        {item.type === 'region' ? (
                          <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                            <MapPin className="w-4 h-4" />
                          </div>
                        ) : (
                          <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 overflow-hidden font-bold text-xs border border-slate-200/60">
                            {item.organizationLogo?.url ? (
                              <img
                                src={item.organizationLogo.url}
                                alt={item.name}
                                className="w-full h-full object-cover"
                              />
                            ) : (
                              item.name.charAt(0)
                            )}
                          </div>
                        )}
                        <div className="truncate">
                          <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                            {item.name}
                          </h4>
                          <p className="text-[11px] text-slate-500 truncate">
                            {item.type === 'region'
                              ? `${item.facilityCount} ${item.facilityCount === 1 ? 'facility' : 'facilities'}`
                              : item.district}
                          </p>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Appointment Success % (Primary Semantic Intensity Cell) */}
                    <td className="py-3 px-4 text-center">
                      <div className="inline-flex items-center gap-2">
                        <div
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${intensityBg}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                          <span>{item.completionRate}%</span>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                            delta >= 0
                              ? 'text-emerald-700 bg-emerald-50'
                              : 'text-amber-700 bg-amber-50'
                          }`}
                          title={`Delta vs platform median (${platformMedianRate}%)`}
                        >
                          {deltaSign}pp
                        </span>
                      </div>
                    </td>

                    {/* Col 3: Total Appointments */}
                    <td
                      className={`py-3 px-3 text-right font-semibold ${
                        activeMetric === 'volume'
                          ? 'text-blue-700 bg-blue-50/50 rounded-md'
                          : 'text-slate-800'
                      }`}
                    >
                      {item.appointmentCount}
                    </td>

                    {/* Col 4: Completed */}
                    <td className="py-3 px-3 text-right text-emerald-700 font-semibold">
                      {item.completedCount}
                    </td>

                    {/* Col 5: Cancelled */}
                    <td className="py-3 px-3 text-right text-rose-600 font-medium">
                      {item.cancelledCount}
                    </td>

                    {/* Col 6: Clinicians */}
                    <td className="py-3 px-3 text-right text-slate-700 font-medium">
                      {item.doctorCount}
                    </td>

                    {/* Col 7: Patients Reach */}
                    <td
                      className={`py-3 px-3 text-right font-semibold ${
                        activeMetric === 'reach'
                          ? 'text-purple-700 bg-purple-50/50 rounded-md'
                          : 'text-slate-800'
                      }`}
                    >
                      {item.patientCount}
                    </td>

                    {/* Col 8: Appointments / Doctor */}
                    <td className="py-3 px-3 text-right text-slate-700 font-medium">
                      {item.appointmentsPerDoctor}
                    </td>

                    {/* Col 9: Action Button */}
                    <td className="py-3 px-4 text-center">
                      {item.type === 'region' ? (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedRegion(item.id);
                          }}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 px-2 py-1 rounded-md transition-colors cursor-pointer"
                        >
                          <span>Drill Down</span>
                          <ChevronRight className="w-3 h-3" />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (onFacilityClick) {
                              onFacilityClick(
                                isFacilitySelected ? null : item.name
                              );
                            }
                          }}
                          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-1 rounded-md transition-colors cursor-pointer ${
                            isFacilitySelected
                              ? 'bg-blue-600 text-white'
                              : 'text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50'
                          }`}
                        >
                          {isFacilitySelected ? (
                            <>
                              <Check className="w-3 h-3" />
                              <span>Filtered</span>
                            </>
                          ) : (
                            <span>Filter</span>
                          )}
                        </button>
                      )}
                    </td>
                  </motion.tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* 5. Compact Floating Cursor Tooltip */}
      {tooltipPos.visible && tooltipPos.item && (
        <div
          className="fixed pointer-events-none z-50 transform -translate-x-1/2 -translate-y-full mb-2 bg-slate-900/95 backdrop-blur-xs text-white p-3 rounded-xl shadow-xl text-xs space-y-1.5 border border-slate-700/60 min-w-44"
          style={{ left: `${tooltipPos.x}px`, top: `${tooltipPos.y}px` }}
        >
          <div className="border-b border-slate-800 pb-1.5 mb-1.5">
            <h5 className="font-bold text-white text-xs">{tooltipPos.item.name}</h5>
            <p className="text-[10px] text-slate-400">
              {tooltipPos.item.type === 'region' ? 'Tamil Nadu Regional Network' : tooltipPos.item.district}
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-[11px]">
            <span className="text-slate-400">Success Rate:</span>
            <span className="font-bold text-right text-emerald-400">
              {tooltipPos.item.completionRate}%
            </span>

            <span className="text-slate-400">Appointments:</span>
            <span className="font-semibold text-right text-slate-200">
              {tooltipPos.item.appointmentCount}
            </span>

            <span className="text-slate-400">Completed:</span>
            <span className="font-semibold text-right text-emerald-300">
              {tooltipPos.item.completedCount}
            </span>

            <span className="text-slate-400">Cancelled:</span>
            <span className="font-semibold text-right text-rose-400">
              {tooltipPos.item.cancelledCount}
            </span>

            <span className="text-slate-400">Clinicians:</span>
            <span className="font-semibold text-right text-slate-200">
              {tooltipPos.item.doctorCount}
            </span>

            <span className="text-slate-400">Patients:</span>
            <span className="font-semibold text-right text-purple-300">
              {tooltipPos.item.patientCount}
            </span>

            <span className="text-slate-400">vs Platform:</span>
            <span
              className={`font-bold text-right ${
                tooltipPos.item.deltaVsPlatform >= 0 ? 'text-emerald-400' : 'text-amber-400'
              }`}
            >
              {tooltipPos.item.deltaVsPlatform >= 0
                ? `+${tooltipPos.item.deltaVsPlatform}pp`
                : `${tooltipPos.item.deltaVsPlatform}pp`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
};

export default CareFlowRegionalPerformance;
