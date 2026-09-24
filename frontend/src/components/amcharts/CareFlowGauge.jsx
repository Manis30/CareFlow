import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5radar from '@amcharts/amcharts5/radar';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, CLINICAL_COLORS } from './amchartsTheme';
import { Gauge as GaugeIcon } from 'lucide-react';

/**
 * CareFlowGauge
 * Semi-circular clinical performance gauge (e.g. completion rate, bed occupancy).
 * Uses @amcharts/amcharts5 RadarChart with proper root.dispose() cleanup.
 */
export const CareFlowGauge = ({
  value = 0,
  min = 0,
  max = 100,
  unit = '%',
  title,
  subtitle,
  height = 200,
  color = CLINICAL_COLORS.primary,
  emptyMessage = 'No capacity metrics available.',
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  const clampedValue = Math.min(Math.max(Number(value) || 0, min), max);

  useEffect(() => {
    if (!chartRef.current) return;

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();

    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const chart = root.container.children.push(
      am5radar.RadarChart.new(root, {
        panX: false,
        panY: false,
        startAngle: 180,
        endAngle: 360,
        innerRadius: am5.percent(75),
        layout: root.verticalLayout,
        paddingLeft: 0,
        paddingRight: 0,
        paddingTop: 10,
        paddingBottom: 0
      })
    );

    const axisRenderer = am5radar.AxisRendererCircular.new(root, {
      innerRadius: -10,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8),
      minGridDistance: 30
    });

    axisRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const axis = chart.xAxes.push(
      am5xy.ValueAxis.new(root, {
        maxDeviation: 0,
        min,
        max,
        strictMinMax: true,
        renderer: axisRenderer
      })
    );

    // Background track
    const axisDataItem = axis.makeDataItem({ value: min, endValue: max });
    const range = axis.createAxisRange(axisDataItem);
    range.get('axisFill').setAll({
      fill: am5.color(0xF1F5F9),
      fillOpacity: 1,
      visible: true
    });

    // Active value arc
    const valueDataItem = axis.makeDataItem({ value: min, endValue: clampedValue });
    const valueRange = axis.createAxisRange(valueDataItem);
    valueRange.get('axisFill').setAll({
      fill: am5.color(color === CLINICAL_COLORS.emerald ? 0x10B981 : 0x2563EB),
      fillOpacity: 1,
      visible: true
    });

    // Center metric label
    chart.seriesContainer.children.push(
      am5.Label.new(root, {
        text: `[bold text-2xl font-sans text-slate-900]${Math.round(clampedValue)}${unit}[/]\n[text-xs text-slate-400 font-medium]Completed[/]`,
        textAlign: 'center',
        centerX: am5.percent(50),
        centerY: am5.percent(75),
        populateText: true
      })
    );

    if (!isReducedMotion()) {
      chart.appear(600, 100);
    }

    return () => {
      root.dispose();
    };
  }, [clampedValue, min, max, unit, color]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {(title || subtitle) && (
        <div className="mb-2">
          {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
      )}

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};

export default CareFlowGauge;
