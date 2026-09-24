import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import {
  Activity,
  RotateCcw,
  AlertCircle,
  RefreshCw
} from 'lucide-react';
import { getRegionalPerformanceApi } from '../../api/superAdmin';

/**
 * Standard CareFlow Timeframes
 */
const TIMEFRAMES = [
  { key: '30D', label: '30D' },
  { key: '90D', label: '90D' },
  { key: '6M', label: '6M' },
  { key: 'ALL', label: 'All Time' }
];

/**
 * CareFlow Clinic Palette matching the reference image exactly
 */
const CLINIC_COLOR_MAP = {
  'Sri Vaigai Hospital': '#0066FF',
  'Chennai Metro Health': '#10B981',
  'Adyar Anbu Centre': '#8B5CF6',
  'Kovai Lakshmi Centre': '#F59E0B',
  'Siruvani Clinic': '#06B6D4',
  'Salem Varam Clinic': '#EF4444',
  'Cauvery Medical': '#EC4899',
  'Meenakshi Care': '#6366F1'
};

const DEFAULT_PALETTE = [
  '#0066FF',
  '#10B981',
  '#8B5CF6',
  '#F59E0B',
  '#EF4444',
  '#06B6D4',
  '#EC4899',
  '#6366F1'
];

export const CareFlowClinicPerformance = ({
  initialData = null,
  selectedFacility = null,
  onFacilityClick = null,
  hoveredFacility = null,
  onFacilityHover = null,
  className = ''
}) => {
  // Telemetry state
  const [data, setData] = useState(initialData);
  const [loading, setLoading] = useState(!initialData);
  const [error, setError] = useState(null);

  // Timeframe filter (Default: ALL)
  const [timeframe, setTimeframe] = useState('ALL');

  // Floating tooltip data state (isolated from chart creation)
  const [hoveredPointData, setHoveredPointData] = useState(null);

  // Keep callback and prop references stable for amCharts event listeners
  const onFacilityClickRef = useRef(onFacilityClick);
  onFacilityClickRef.current = onFacilityClick;

  const onFacilityHoverRef = useRef(onFacilityHover);
  onFacilityHoverRef.current = onFacilityHover;

  const selectedFacilityRef = useRef(selectedFacility);
  selectedFacilityRef.current = selectedFacility;

  const hoveredFacilityRef = useRef(hoveredFacility);
  hoveredFacilityRef.current = hoveredFacility;

  // DOM & amCharts references
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesMapRef = useRef(new Map());
  const clinicsMapRef = useRef(new Map());
  const medianRangeRef = useRef(null);
  const medianLabelRef = useRef(null);

  // Fetch real backend data whenever timeframe changes
  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRegionalPerformanceApi({ timeframe });
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      console.error('Failed to load clinic performance telemetry:', err);
      setError(err?.message || 'Failed to fetch clinical performance trends');
    } finally {
      setLoading(false);
    }
  }, [timeframe]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Sync initialData if provided initially
  useEffect(() => {
    if (initialData && !data) {
      setData(initialData);
    }
  }, [initialData, data]);

  // Derived clinics & months from actual backend data, excluding any future months
  const currentMonthKey = `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}`;

  const months = useMemo(() => {
    return (data?.months || []).filter((m) => !m.monthKey || m.monthKey <= currentMonthKey);
  }, [data, currentMonthKey]);

  const rawClinics = useMemo(() => data?.clinics || [], [data]);

  // Normalize clinics with consistent colors and short names, filtering future months from each clinic's monthly points
  const clinics = useMemo(() => {
    return rawClinics.map((c, idx) => {
      const shortName = c.shortName || c.name || `Clinic ${idx + 1}`;
      const color = CLINIC_COLOR_MAP[shortName] || c.color || DEFAULT_PALETTE[idx % DEFAULT_PALETTE.length];
      const filteredMonthly = Array.isArray(c.monthly)
        ? c.monthly.filter((m) => !m.monthKey || m.monthKey <= currentMonthKey)
        : [];
      return {
        ...c,
        shortName,
        color,
        monthly: filteredMonthly
      };
    });
  }, [rawClinics, currentMonthKey]);

  // Maintain clinics map ref for quick O(1) lookup
  useEffect(() => {
    clinicsMapRef.current.clear();
    clinics.forEach((c) => clinicsMapRef.current.set(c.clinicId, c));
  }, [clinics]);

  // Check if a clinic matches a given facility filter
  const matchesFacility = useCallback((targetFacility, clinic) => {
    if (!targetFacility || !clinic) return false;
    const t = (typeof targetFacility === 'string' ? targetFacility : targetFacility.name || '').toLowerCase().trim();
    const cName = (clinic.name || '').toLowerCase().trim();
    const sName = (clinic.shortName || '').toLowerCase().trim();
    const cId = String(clinic.clinicId || clinic._id || '');
    return t === cName || t === sName || t === cId || cName.includes(t) || t.includes(cName) || sName.includes(t) || t.includes(sName);
  }, []);

  // Compute Platform Median, Best Performer, Needs Attention from REAL Data
  const { platformMedian, medianDelta, firstMonthName, bestPerformer, worstPerformer } = useMemo(() => {
    if (!clinics.length) {
      return {
        platformMedian: 0,
        medianDelta: 0,
        firstMonthName: '',
        bestPerformer: null,
        worstPerformer: null
      };
    }

    const firstMonthStr = months[0] || '';

    // Sort clinics by latest success rate
    const sorted = [...clinics].sort((a, b) => {
      const rateA = a.monthly?.[a.monthly.length - 1]?.successRate ?? a.latestSuccessRate ?? 0;
      const rateB = b.monthly?.[b.monthly.length - 1]?.successRate ?? b.latestSuccessRate ?? 0;
      return rateB - rateA;
    });

    const best = sorted[0];
    const worst = sorted[sorted.length - 1];

    // Compute Platform Median for latest month
    const latestRates = sorted.map((c) => {
      const monthly = c.monthly || [];
      return monthly.length > 0 ? (monthly[monthly.length - 1]?.successRate ?? 0) : (c.latestSuccessRate ?? 0);
    }).sort((a, b) => a - b);

    const mid = Math.floor(latestRates.length / 2);
    const currMedian = latestRates.length % 2 !== 0
      ? latestRates[mid]
      : Number(((latestRates[mid - 1] + latestRates[mid]) / 2).toFixed(1));

    // Compute Platform Median for first month
    const firstRates = clinics.map((c) => {
      const monthly = c.monthly || [];
      return monthly.length > 0 ? (monthly[0]?.successRate ?? 0) : 0;
    }).sort((a, b) => a - b);

    const firstMid = Math.floor(firstRates.length / 2);
    const initialMedian = firstRates.length % 2 !== 0
      ? firstRates[firstMid]
      : Number(((firstRates[firstMid - 1] + firstRates[firstMid]) / 2).toFixed(1));

    const pDelta = Number((currMedian - initialMedian).toFixed(1));

    return {
      platformMedian: currMedian,
      medianDelta: pDelta,
      firstMonthName: firstMonthStr,
      bestPerformer: best ? {
        shortName: best.shortName || best.name,
        color: best.color,
        rate: best.monthly?.[best.monthly.length - 1]?.successRate ?? best.latestSuccessRate ?? 0
      } : null,
      worstPerformer: worst ? {
        shortName: worst.shortName || worst.name,
        color: worst.color,
        rate: worst.monthly?.[worst.monthly.length - 1]?.successRate ?? worst.latestSuccessRate ?? 0
      } : null
    };
  }, [clinics, months]);

  // Helper to handle visual highlight on hover or selection without re-animating chart
  const applyHighlight = useCallback((targetFacilityIdOrName) => {
    seriesMapRef.current.forEach((series, clinicId) => {
      if (!series || series.isDisposed()) return;
      const clinic = clinicsMapRef.current.get(clinicId);
      const isTarget = targetFacilityIdOrName && clinic && (
        clinic.clinicId === targetFacilityIdOrName ||
        clinic.shortName === targetFacilityIdOrName ||
        clinic.name === targetFacilityIdOrName ||
        matchesFacility(targetFacilityIdOrName, clinic)
      );

      const strokeWidth = targetFacilityIdOrName ? (isTarget ? 3.4 : 1.4) : 2.0;
      const strokeOpacity = targetFacilityIdOrName ? (isTarget ? 1.0 : 0.22) : 0.95;

      try {
        if (series.strokes && !series.strokes.isDisposed()) {
          series.strokes.each((stroke) => {
            if (stroke && !stroke.isDisposed()) {
              stroke.setAll({ strokeWidth, strokeOpacity });
            }
          });
        }
      } catch (e) {
        // Safe fallback
      }


    });
  }, [matchesFacility]);

  // Sync external selectedFacility / hoveredFacility changes without re-creating chart
  useEffect(() => {
    const activeTarget = hoveredFacility || selectedFacility;
    applyHighlight(activeTarget);
  }, [selectedFacility, hoveredFacility, applyHighlight]);

  // Unique stable key that changes ONLY on actual data or timeframe change
  const chartDataKey = useMemo(() => {
    return `${timeframe}-${clinics.length}-${months.join(',')}`;
  }, [timeframe, clinics.length, months]);

  // =========================================================================
  // amCharts 5 Core Implementation (INITIAL LOAD / TIMEFRAME CHANGE ONLY)
  // Strictly isolated from hover, tooltip, and mouse movement states!
  // =========================================================================
  useEffect(() => {
    if (!chartContainerRef.current) return;
    if (!clinics.length || !months.length) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // Dispose previous instance cleanly
    if (rootRef.current) {
      rootRef.current.dispose();
      rootRef.current = null;
    }

    seriesMapRef.current.clear();

    const root = am5.Root.new(chartContainerRef.current);
    rootRef.current = root;
    root._logo?.dispose();

    if (!prefersReducedMotion) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    // Chart container
    const chart = root.container.children.push(
      am5xy.XYChart.new(root, {
        panX: false,
        panY: false,
        wheelX: 'none',
        wheelY: 'none',
        layout: root.verticalLayout,
        paddingLeft: 6,
        paddingRight: 64, // Space for right endpoint percentage labels
        paddingTop: 12,
        paddingBottom: 0
      })
    );
    chartRef.current = chart;

    // X-Axis (Monthly Category Axis)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 45,
      cellStartLocation: 0,
      cellEndLocation: 1
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
      paddingTop: 6
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'month',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, { themeTags: ['axis'] })
      })
    );

    const xData = months.map((m) => ({ month: m }));
    xAxis.data.setAll(xData);

    // INTELLIGENT DYNAMIC Y-AXIS SCALING:
    // Focus tightly around the real visible clinic values, avoiding huge empty spaces.
    let minSuccess = Infinity;
    let maxSuccess = -Infinity;

    clinics.forEach((c) => {
      (c.monthly || []).forEach((m) => {
        const r = Number(m.successRate || 0);
        if (r > 0) {
          if (r < minSuccess) minSuccess = r;
          if (r > maxSuccess) maxSuccess = r;
        }
      });
    });

    if (minSuccess === Infinity) {
      minSuccess = 72;
      maxSuccess = 92;
    }

    const pad = Math.max(1.5, (maxSuccess - minSuccess) * 0.08);
    const computedMin = Math.max(0, Math.floor(minSuccess - pad));
    const computedMax = Math.min(100, Math.ceil(maxSuccess + pad));

    const yRenderer = am5xy.AxisRendererY.new(root, {
      strokeOpacity: 0.1
    });

    yRenderer.grid.template.setAll({
      stroke: am5.color(0xE2E8F0),
      strokeOpacity: 0.55
    });

    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif',
      paddingRight: 6
    });

    // Clean percentage ticks (e.g. 75%, 80%, 85%, 90%)
    yRenderer.labels.template.adapters.add('text', (text, target) => {
      const val = target.dataItem?.get('value');
      if (val !== undefined && val !== null) {
        return `${Math.round(val)}%`;
      }
      return text;
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: computedMin,
        max: computedMax,
        strictMinMax: true,
        renderer: yRenderer,
        numberFormat: "#'%'",
        extraTooltipPrecision: 1
      })
    );

    // Y-Axis Title
    yAxis.children.unshift(
      am5.Label.new(root, {
        rotation: -90,
        text: 'Appointment Success Rate',
        y: am5.p50,
        centerX: am5.p50,
        fill: am5.color(0x64748B),
        fontSize: 10.5,
        fontFamily: 'Poppins, sans-serif',
        fontWeight: '500',
        paddingRight: 8
      })
    );

    // Subtle horizontal Platform Median reference line
    if (platformMedian > 0) {
      const medianRangeDataItem = yAxis.makeDataItem({
        value: platformMedian
      });
      const medianRange = yAxis.createAxisRange(medianRangeDataItem);
      medianRangeRef.current = medianRange;

      medianRange.get('grid').setAll({
        stroke: am5.color(0x64748B),
        strokeWidth: 1.4,
        strokeDasharray: [4, 4],
        strokeOpacity: 0.65,
        visible: true
      });

      // Right label for Platform Median
      medianRange.get('label').setAll({
        text: `${platformMedian.toFixed(1)}% Platform Median`,
        fill: am5.color(0x64748B),
        fontSize: 10.5,
        fontWeight: '600',
        fontFamily: 'Poppins, sans-serif',
        location: 1,
        dx: 6,
        centerY: am5.p50,
        visible: true
      });
    }

    // Cursor for vertical hover guidance
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
      strokeWidth: 1.2
    });



    // Create a smooth bezier line series for each clinic
    clinics.forEach((clinic) => {
      const clinicColor = clinic.color;
      const clinicId = clinic.clinicId;

      const series = chart.series.push(
        am5xy.SmoothedXLineSeries.new(root, {
          name: clinic.shortName || clinic.name,
          xAxis: xAxis,
          yAxis: yAxis,
          valueYField: 'successRate',
          categoryXField: 'month',
          stroke: am5.color(clinicColor),
          strokeWidth: 2,
          visible: true
        })
      );

      seriesMapRef.current.set(clinicId, series);

      // Map series data points from real monthly array
      const monthlyData = clinic.monthly || [];
      const seriesData = months.map((monthLabel, mIdx) => {
        const found = monthlyData.find((m) => m.monthLabel === monthLabel) || monthlyData[mIdx] || {};
        const successRate = found.successRate ?? 0;
        const appointments = found.appointments ?? 0;
        const completed = found.completed ?? 0;
        const cancelled = found.cancelled ?? 0;
        const prevMonth = mIdx > 0 ? monthlyData[mIdx - 1] : null;

        return {
          month: monthLabel,
          successRate: Number(successRate),
          appointments,
          completed,
          cancelled,
          clinicName: clinic.shortName || clinic.name,
          clinicId: clinic.clinicId,
          clinicColor: clinic.color,
          isLast: mIdx === months.length - 1,
          prevMonthRate: prevMonth ? Number(prevMonth.successRate) : null,
          prevMonthLabel: prevMonth ? prevMonth.monthLabel : null
        };
      });

      series.data.setAll(seriesData);

      // Circular Bullet on each month point
      series.bullets.push((bRoot, bSeries, dataItem) => {
        const circle = am5.Circle.new(bRoot, {
          radius: 3.5,
          fill: am5.color(clinicColor),
          stroke: am5.color(0xFFFFFF),
          strokeWidth: 1.5,
          cursorOverStyle: 'pointer'
        });

        // Native Hover interaction on point: updates stroke emphasis without restarting chart!
        circle.events.on('pointerover', (e) => {
          circle.set('radius', 5.5);
          applyHighlight(clinic.clinicId);

          const dataCtx = dataItem.dataContext;
          if (chartContainerRef.current) {
            const rect = chartContainerRef.current.getBoundingClientRect();
            setHoveredPointData({
              ...dataCtx,
              x: e.point.x,
              y: e.point.y,
              containerWidth: rect.width,
              containerHeight: rect.height
            });
          }

          if (onFacilityHoverRef.current) {
            onFacilityHoverRef.current(clinic.shortName || clinic.name);
          }
        });

        circle.events.on('pointerout', () => {
          circle.set('radius', 3.5);
          applyHighlight(selectedFacilityRef.current);
          setHoveredPointData(null);

          if (onFacilityHoverRef.current) {
            onFacilityHoverRef.current(null);
          }
        });

        circle.events.on('click', () => {
          if (onFacilityClickRef.current) {
            const isSelected = selectedFacilityRef.current && (
              selectedFacilityRef.current === clinic.shortName ||
              selectedFacilityRef.current === clinic.name
            );
            onFacilityClickRef.current(isSelected ? null : (clinic.shortName || clinic.name));
          }
        });

        return am5.Bullet.new(bRoot, {
          sprite: circle
        });
      });


      // Series line click selects the clinic
      series.strokes.template.set('cursorOverStyle', 'pointer');
      series.strokes.template.events.on('click', () => {
        if (onFacilityClickRef.current) {
          const isSelected = selectedFacilityRef.current && (
            selectedFacilityRef.current === clinic.shortName ||
            selectedFacilityRef.current === clinic.name
          );
          onFacilityClickRef.current(isSelected ? null : (clinic.shortName || clinic.name));
        }
      });

      // Line hover highlighting
      series.strokes.template.events.on('pointerover', () => {
        applyHighlight(clinic.clinicId);
        if (onFacilityHoverRef.current) {
          onFacilityHoverRef.current(clinic.shortName || clinic.name);
        }
      });

      series.strokes.template.events.on('pointerout', () => {
        applyHighlight(selectedFacilityRef.current);
        if (onFacilityHoverRef.current) {
          onFacilityHoverRef.current(null);
        }
      });

      // INITIAL ANIMATION ONLY (Runs once on data load / timeframe change)
      if (!prefersReducedMotion) {
        series.appear(900, 70);
      }
    });

    if (!prefersReducedMotion) {
      chart.appear(950, 100);
    }

    // Cleanup strictly when chartDataKey changes or component unmounts
    return () => {
      seriesMapRef.current.clear();
      medianRangeRef.current = null;
      medianLabelRef.current = null;
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, [chartDataKey]); // DEPENDS ONLY ON STABLE DATA KEY — NEVER RUNS ON HOVER!

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative isolate overflow-hidden ${className}`}>
      {/* 1. Card Header: Aligned with right card */}
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
          {/* Left: Icon & Title */}
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
              <Activity className="w-4 h-4 text-blue-600 stroke-[2.4]" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
                Clinic Performance Trends
              </h3>
              <p className="text-[11px] text-slate-500 font-medium">
                Track monthly appointment success rate across all clinics
              </p>
            </div>
          </div>

          {/* Right: Live Badge */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold select-none">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
              <span>Live</span>
            </div>
          </div>
        </div>

        {/* 2. Compact Insight Strip (Single clean horizontal bar) */}
        <div className="flex flex-wrap items-center justify-between gap-2.5 px-3 py-2 mt-2.5 mb-1.5 rounded-xl bg-slate-50/80 border border-slate-100/90 text-xs">
          {/* Platform Median */}
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="text-[11px] font-medium text-slate-500">Platform Median</span>
            <span className="text-xs font-bold text-slate-900">
              {platformMedian > 0 ? `${platformMedian.toFixed(1)}%` : '--'}
            </span>
            {firstMonthName && medianDelta !== 0 && (
              <span className={`text-[10.5px] font-semibold flex items-center ${medianDelta >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                {medianDelta >= 0 ? '↑ +' : '↓ '}{Math.abs(medianDelta)}pp vs {firstMonthName}
              </span>
            )}
          </div>

          <div className="hidden md:block w-px h-3.5 bg-slate-200" />

          {/* Best Performer */}
          {bestPerformer && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-slate-500">Best Performer</span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: bestPerformer.color }} />
              <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">{bestPerformer.shortName}</span>
              <span className="text-xs font-semibold text-emerald-600">· {bestPerformer.rate.toFixed(1)}%</span>
            </div>
          )}

          <div className="hidden md:block w-px h-3.5 bg-slate-200" />

          {/* Needs Attention */}
          {worstPerformer && (
            <div className="flex items-center gap-1.5 min-w-0">
              <span className="text-[11px] font-medium text-slate-500">Needs Attention</span>
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: worstPerformer.color }} />
              <span className="text-xs font-bold text-slate-800 truncate max-w-[130px]">{worstPerformer.shortName}</span>
              <span className="text-xs font-semibold text-rose-600">· {worstPerformer.rate.toFixed(1)}%</span>
            </div>
          )}
        </div>
      </div>

      {/* 3. Main Chart Surface (Dominates the card height) */}
      <div className="relative w-full flex-1 min-h-[340px] flex flex-col justify-center my-1">
        {/* Loading Spinner */}
        {loading && !clinics.length && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/75 backdrop-blur-xs rounded-xl">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-600">Loading performance trends...</span>
            </div>
          </div>
        )}

        {/* Error State */}
        {error && !clinics.length && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 backdrop-blur-xs rounded-xl p-4">
            <div className="flex flex-col items-center gap-2 max-w-xs text-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              <p className="text-xs font-semibold text-slate-700">{error}</p>
              <button
                type="button"
                onClick={fetchData}
                className="mt-1 px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Retry</span>
              </button>
            </div>
          </div>
        )}

        {/* amCharts DOM Container */}
        <div
          ref={chartContainerRef}
          className="w-full h-[340px] sm:h-[370px] relative select-none"
        />

        {/* 4. Intelligent Floating Non-Clipping Tooltip (Completely independent from chart lifecycle) */}
        {hoveredPointData && chartContainerRef.current && (
          <div
            className="absolute z-40 pointer-events-none transition-transform duration-75 ease-out"
            style={{
              left: Math.max(
                10,
                Math.min(
                  (hoveredPointData.containerWidth || 500) - 225,
                  hoveredPointData.x - 110
                )
              ),
              top: hoveredPointData.y < 140
                ? Math.min((hoveredPointData.containerHeight || 400) - 150, hoveredPointData.y + 16)
                : Math.max(10, hoveredPointData.y - 145)
            }}
          >
            <div className="bg-slate-900/95 backdrop-blur-md text-white rounded-xl shadow-2xl p-3 border border-slate-700/60 min-w-[210px] font-sans">
              {/* Header: Month and Year */}
              <div className="text-[11px] font-semibold text-slate-400 mb-1.5">
                {hoveredPointData.month}
              </div>

              {/* Clinic Name & Rate */}
              <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-800">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: hoveredPointData.clinicColor }}
                  />
                  <span className="text-xs font-bold text-white truncate">
                    {hoveredPointData.clinicName}
                  </span>
                </div>
                <span className="text-xs font-bold text-white shrink-0">
                  {Number(hoveredPointData.successRate).toFixed(1)}%
                </span>
              </div>

              {/* Data Table */}
              <div className="mt-1.5 space-y-1 text-[11px]">
                <div className="flex items-center justify-between text-slate-300">
                  <span>Total Appointments</span>
                  <span className="font-semibold text-white">{hoveredPointData.appointments}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Completed</span>
                  <span className="font-semibold text-emerald-400">{hoveredPointData.completed}</span>
                </div>
                <div className="flex items-center justify-between text-slate-300">
                  <span>Cancelled</span>
                  <span className="font-semibold text-rose-400">{hoveredPointData.cancelled}</span>
                </div>
              </div>

              {/* MoM Trend Delta */}
              {hoveredPointData.prevMonthRate !== null && (
                <div className="mt-2 pt-1.5 border-t border-slate-800 text-[10.5px] font-medium flex items-center gap-1">
                  {hoveredPointData.successRate >= hoveredPointData.prevMonthRate ? (
                    <span className="text-emerald-400 font-semibold flex items-center">
                      ↑ +{(hoveredPointData.successRate - hoveredPointData.prevMonthRate).toFixed(1)}pp vs {hoveredPointData.prevMonthLabel}
                    </span>
                  ) : (
                    <span className="text-rose-400 font-semibold flex items-center">
                      ↓ {(hoveredPointData.successRate - hoveredPointData.prevMonthRate).toFixed(1)}pp vs {hoveredPointData.prevMonthLabel}
                    </span>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* 5. Clean Bottom Footer (All bottom clinic names removed) */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2.5 border-t border-slate-100 text-xs text-slate-500 select-none">
        <div className="flex items-center gap-2">
          <span className="w-4 h-0.5 border-b-2 border-dashed border-slate-400" />
          <span className="font-semibold text-slate-700">Platform Median:</span>
          <span className="font-bold text-slate-900">{platformMedian > 0 ? `${platformMedian.toFixed(1)}%` : '--'}</span>
        </div>
        <div className="text-[10.5px] text-slate-400">
          Calculated dynamically from real clinic records for the selected period
        </div>
      </div>
    </div>
  );
};

export default CareFlowClinicPerformance;
