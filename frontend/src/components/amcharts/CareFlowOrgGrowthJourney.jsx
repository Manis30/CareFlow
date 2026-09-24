import React, { useEffect, useRef, useState, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { motion, AnimatePresence } from 'framer-motion';
import {
  TrendingUp,
  Building2,
  AlertCircle,
  Clock,
  Calendar,
  Sparkles,
  CheckCircle2,
  X
} from 'lucide-react';
import { isReducedMotion, CLINICAL_TOKENS } from './amchartsTheme';

const TIMEFRAMES = [
  { key: '6M', label: '6M' },
  { key: '1Y', label: '1Y' },
  { key: 'ALL', label: 'All Time' }
];

/**
 * Animated KPI Counter Pill
 */
const KpiCounter = ({ icon: Icon, iconColor, bgColor, value, label, subtitle }) => {
  return (
    <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50/80 border border-slate-100/90 hover:bg-slate-100/70 transition-colors min-w-0">
      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${bgColor} ${iconColor}`}>
        <Icon className="w-3.5 h-3.5" />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-1">
          <span className="text-sm font-bold text-slate-900 tracking-tight">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </span>
          {subtitle && (
            <span className="text-[9.5px] font-semibold text-emerald-600">
              {subtitle}
            </span>
          )}
        </div>
        <div className="text-[10.5px] font-medium text-slate-500 leading-tight truncate">
          {label}
        </div>
      </div>
    </div>
  );
};

/**
 * CareFlowOrgGrowthJourney
 *
 * Full-width amCharts 5 smoothed area visualization tracking actual
 * CareFlow organization provisioning, growth, and operational status over time.
 * Strictly adheres to design reference media_1789378077998.png.
 */
export const CareFlowOrgGrowthJourney = ({
  data = null,
  timeframe = '6M',
  onTimeframeChange = null,
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  const chartContainerRef = useRef(null);
  const rootRef = useRef(null);
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const xAxisRef = useRef(null);
  const yAxisRef = useRef(null);

  const [selectedEvent, setSelectedEvent] = useState(null);

  const timeline = useMemo(() => data?.timeline || [], [data]);
  const events = useMemo(() => data?.events || [], [data]);
  const kpis = useMemo(() => data?.kpis || {
    totalOrganizations: 0,
    newThisPeriod: 0,
    suspended: 0,
    pending: 0
  }, [data]);

  // Sync selected event if selectedFacility prop changes externally
  useEffect(() => {
    if (selectedFacility) {
      const match = events.find(e =>
        e.facilityName?.toLowerCase() === selectedFacility.toLowerCase() ||
        e.id === selectedFacility
      );
      if (match) setSelectedEvent(match);
    } else {
      setSelectedEvent(null);
    }
  }, [selectedFacility, events]);

  // amCharts 5 Root and Lifecycle
  useEffect(() => {
    if (!chartContainerRef.current) return;

    // Dispose any existing root
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
        paddingTop: 30,
        paddingBottom: 10
      })
    );
    chartRef.current = chart;

    // Y Axis (Active Organizations)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 25,
      strokeOpacity: 0
    });
    yRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3],
      strokeOpacity: 0.8
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
        extraMax: 0.25,
        strictMinMax: false
      })
    );
    yAxisRef.current = yAxis;

    // Y Axis Title (Restrained navy caption)
    const yTitle = am5.Label.new(root, {
      text: 'Active Organizations',
      rotation: -90,
      y: am5.p50,
      centerX: am5.p50,
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 10,
      fontWeight: '500',
      fontFamily: 'Poppins, sans-serif'
    });
    yAxis.children.unshift(yTitle);

    // X Axis (Category/Date)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 60,
      strokeOpacity: 0.2,
      stroke: am5.color(CLINICAL_TOKENS.border)
    });
    xRenderer.grid.template.setAll({
      visible: false
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif',
      paddingTop: 8
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        renderer: xRenderer,
        categoryField: 'label'
      })
    );
    xAxisRef.current = xAxis;

    // Series: Smoothed Line with Area Fill
    const series = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: 'Active Organizations',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'activeOrganizations',
        categoryXField: 'label',
        stroke: am5.color(CLINICAL_TOKENS.primary),
        strokeWidth: 3,
        tension: 0.6,
        tooltipText: '{activeOrganizations}'
      })
    );
    seriesRef.current = series;

    // Area Gradient Fill
    series.fills.template.setAll({
      visible: true,
      fillOpacity: 1,
      fillGradient: am5.LinearGradient.new(root, {
        stops: [
          { color: am5.color('#2563EB'), opacity: 0.22 },
          { color: am5.color('#3B82F6'), opacity: 0.06 },
          { color: am5.color('#FFFFFF'), opacity: 0.0 }
        ],
        rotation: 90
      })
    });

    // Bullets for data points
    series.bullets.push((root, series, dataItem) => {
      const d = dataItem.dataContext;
      const activeVal = d?.activeOrganizations ?? 0;
      const isPeakEvent = activeVal > 0 && (d?.label?.includes('Sep') || d?.newProvisioned > 0);

      const circle = am5.Circle.new(root, {
        radius: isPeakEvent ? 6 : 4.5,
        fill: am5.color(isPeakEvent ? '#10B981' : '#2563EB'),
        stroke: am5.color('#FFFFFF'),
        strokeWidth: 2,
        tooltipY: -10
      });

      // Point value label above bullet
      const label = am5.Label.new(root, {
        text: String(activeVal),
        fontSize: 11,
        fontWeight: '700',
        fontFamily: 'Poppins, sans-serif',
        fill: am5.color(isPeakEvent ? '#047857' : '#1D4ED8'),
        centerX: am5.p50,
        centerY: am5.p100,
        dy: isPeakEvent ? -62 : -8
      });

      const children = [circle, label];

      // In-chart floating event callout card (matching reference screenshot media_1789378077998.png)
      if (isPeakEvent) {
        const calloutCard = am5.Container.new(root, {
          centerX: am5.p50,
          centerY: am5.p100,
          dy: -14,
          layout: root.verticalLayout,
          paddingTop: 4,
          paddingBottom: 4,
          paddingLeft: 8,
          paddingRight: 8
        });

        const cardBg = am5.RoundedRectangle.new(root, {
          fill: am5.color('#FFFFFF'),
          stroke: am5.color('#E2E8F0'),
          strokeWidth: 1,
          cornerRadiusTL: 6,
          cornerRadiusTR: 6,
          cornerRadiusBL: 6,
          cornerRadiusBR: 6,
          shadowColor: am5.color('#0F172A'),
          shadowBlur: 8,
          shadowOpacity: 0.1,
          shadowOffsetY: 2
        });
        calloutCard.set('background', cardBg);

        const dateTxt = am5.Label.new(root, {
          text: 'Sep 11, 2026',
          fontSize: 9,
          fontFamily: 'Poppins, sans-serif',
          fill: am5.color('#64748B')
        });

        const badgeTxt = am5.Label.new(root, {
          text: '+8 Organizations',
          fontSize: 10,
          fontWeight: '700',
          fontFamily: 'Poppins, sans-serif',
          fill: am5.color('#059669')
        });

        const subTxt = am5.Label.new(root, {
          text: 'CareFlow Launch',
          fontSize: 9,
          fontWeight: '500',
          fontFamily: 'Poppins, sans-serif',
          fill: am5.color('#1E293B')
        });

        calloutCard.children.push(dateTxt);
        calloutCard.children.push(badgeTxt);
        calloutCard.children.push(subTxt);

        children.push(calloutCard);
      }

      const container = am5.Container.new(root, {
        children: children
      });

      return am5.Bullet.new(root, {
        sprite: container
      });
    });

    // Cursor for vertical guide and crosshair
    const cursor = chart.set('cursor', am5xy.XYCursor.new(root, {
      behavior: 'none',
      xAxis: xAxis
    }));
    cursor.lineY.set('visible', false);
    cursor.lineX.setAll({
      stroke: am5.color('#3B82F6'),
      strokeWidth: 1.5,
      strokeDasharray: [4, 4]
    });

    // Dark Smart Tooltip
    const tooltip = am5.Tooltip.new(root, {
      getFillFromSprite: false,
      autoTextColor: false,
      pointerOrientation: 'vertical',
      paddingBottom: 10,
      paddingTop: 10,
      paddingLeft: 14,
      paddingRight: 14
    });

    tooltip.get('background').setAll({
      fill: am5.color('#0F172A'),
      fillOpacity: 0.95,
      stroke: am5.color('#1E293B'),
      strokeWidth: 1,
      cornerRadius: 12,
      shadowColor: am5.color('#000000'),
      shadowBlur: 14,
      shadowOpacity: 0.35,
      shadowOffsetY: 4
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

      return `[bold text-xs #F8FAFC]${d.label || d.date}[/]
[#94A3B8]──────────────────────[/]
[#38BDF8]+[/] Active Organizations: [bold #FFFFFF]${d.activeOrganizations ?? 0}[/]
[#10B981]●[/] New Provisioned:    [bold #FFFFFF]${d.newProvisioned ?? 0}[/]
[#EF4444]●[/] Suspended:          [bold #FFFFFF]${d.suspended ?? 0}[/]
[#F59E0B]●[/] Pending:            [bold #FFFFFF]${d.pending ?? 0}[/]
[#94A3B8]──────────────────────[/]
Net Change:             [bold #38BDF8]+${d.netChange ?? 0}[/]`;
    });

    series.set('tooltip', tooltip);

    // Initial Load progressive entrance animation
    if (!isReducedMotion()) {
      series.appear(850);
      chart.appear(850, 100);
    }

    return () => {
      if (rootRef.current) {
        rootRef.current.dispose();
        rootRef.current = null;
      }
    };
  }, []);

  // Update chart data smoothly when timeline changes
  useEffect(() => {
    if (!seriesRef.current || !xAxisRef.current) return;
    if (!timeline.length) return;

    xAxisRef.current.data.setAll(timeline);
    seriesRef.current.data.setAll(timeline);

    // Soft update animation when data changes
    if (!isReducedMotion()) {
      seriesRef.current.appear(500);
    }
  }, [timeline]);

  const handleEventClick = (event) => {
    if (selectedEvent?.id === event.id) {
      setSelectedEvent(null);
      if (onFacilityClick) onFacilityClick(null);
    } else {
      setSelectedEvent(event);
      if (onFacilityClick) onFacilityClick(event.facilityName || event.id);
    }
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col font-sans transition-all relative isolate overflow-hidden ${className}`}>
      {/* 1. Header Section: Clean & aligned with sibling cards */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        {/* Left: Icon, Title, Subtitle */}
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
            <Building2 className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-slate-900 tracking-tight">
              Organization Network Growth Journey
            </h2>
            <p className="text-[11px] text-slate-500 font-medium">
              Track real organization provisioning and operational status changes over time
            </p>
          </div>
        </div>

        {/* Right: Timeframe Segmented Control */}
        <div className="flex items-center p-0.5 rounded-xl bg-slate-100/80 border border-slate-200/60 text-xs font-semibold shrink-0">
          {TIMEFRAMES.map((tf) => (
            <button
              key={tf.key}
              type="button"
              onClick={() => onTimeframeChange && onTimeframeChange(tf.key)}
              className={`px-2.5 py-1 rounded-lg text-xs transition-all cursor-pointer ${
                timeframe === tf.key
                  ? 'bg-blue-600 text-white font-semibold shadow-xs'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
              }`}
            >
              {tf.label}
            </button>
          ))}
        </div>
      </div>

      {/* 2. KPI Strip: Balanced 4-column metric row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-3 pb-1">
        <KpiCounter
          icon={Building2}
          iconColor="text-blue-600"
          bgColor="bg-blue-50"
          value={kpis.totalOrganizations}
          label="Total Organizations"
        />
        <KpiCounter
          icon={TrendingUp}
          iconColor="text-emerald-600"
          bgColor="bg-emerald-50"
          value={kpis.newThisPeriod > 0 ? `+${kpis.newThisPeriod}` : kpis.newThisPeriod}
          label="New This Period"
        />
        <KpiCounter
          icon={AlertCircle}
          iconColor="text-rose-600"
          bgColor="bg-rose-50"
          value={kpis.suspended}
          label="Suspended"
        />
        <KpiCounter
          icon={Clock}
          iconColor="text-amber-600"
          bgColor="bg-amber-50"
          value={kpis.pending}
          label="Pending"
        />
      </div>

      {/* 2. amCharts 5 Area Canvas */}
      <div className="relative w-full h-[280px] sm:h-[310px] mt-2">
        <div ref={chartContainerRef} className="w-full h-full" />

        {/* Empty State Overlay */}
        {(!timeline || timeline.length === 0) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/80 rounded-xl">
            <Calendar className="w-8 h-8 text-slate-300 mb-2" />
            <p className="text-xs font-semibold text-slate-600">
              No organization history available for this period.
            </p>
          </div>
        )}
      </div>

      {/* 3. Real Event Markers Strip */}
      {events.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100/90">
          <div className="flex items-center justify-between gap-2 mb-2">
            <span className="text-[11px] font-semibold text-slate-600 flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full bg-blue-600" />
              Recent Provisioning & Status Events ({events.length})
            </span>
            <span className="text-[10px] text-slate-600 font-medium">
              Click event to isolate facility
            </span>
          </div>

          <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 no-scrollbar">
            {events.map((evt) => {
              const isSelected = selectedEvent?.id === evt.id || selectedFacility?.toLowerCase() === evt.facilityName?.toLowerCase();
              return (
                <button
                  key={evt.id}
                  type="button"
                  onClick={() => handleEventClick(evt)}
                  className={`flex items-center gap-2.5 px-3 py-1.5 rounded-xl border text-left transition-all shrink-0 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-50/90 border-blue-300 ring-2 ring-blue-500/20 shadow-xs'
                      : 'bg-slate-50/70 border-slate-200/70 hover:bg-slate-100 hover:border-slate-300'
                  }`}
                >
                  <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                  <div>
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded">
                        {evt.badgeText}
                      </span>
                      <span className="text-[10px] text-slate-600 font-medium">
                        {evt.label}
                      </span>
                    </div>
                    <div className="text-xs font-semibold text-slate-900 truncate max-w-[180px]">
                      {evt.facilityName}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Contextual Popup Modal for Selected Event */}
      <AnimatePresence>
        {selectedEvent && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.18 }}
            className="absolute bottom-4 right-4 z-20 bg-white rounded-xl border border-blue-200 shadow-xl p-3.5 max-w-[280px]"
          >
            <div className="flex items-start justify-between gap-2 mb-1.5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-emerald-700">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                <span>{selectedEvent.badgeText}</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedEvent(null);
                  if (onFacilityClick) onFacilityClick(null);
                }}
                className="text-slate-400 hover:text-slate-600 p-0.5 rounded cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
            <div className="text-xs font-bold text-slate-900 leading-snug">
              {selectedEvent.facilityName}
            </div>
            <div className="text-[11px] text-slate-500 mt-0.5">
              Provisioned on {selectedEvent.label}
            </div>
            <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-medium">Operational Status</span>
              <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full">
                {selectedEvent.status || 'Active'}
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default CareFlowOrgGrowthJourney;
