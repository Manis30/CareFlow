import React, { useEffect, useRef, useId, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_COLORS } from './amchartsTheme';
import { UserPlus, TrendingUp } from 'lucide-react';

/**
 * CareFlowCohortGrowth
 * 
 * Patient Cohort Growth:
 * Dual-axis chart with Monthly New Patient Registrations (Columns) +
 * Total Cumulative Cohort (Line).
 */
export const CareFlowCohortGrowth = ({
  patients = [],
  height = 300,
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  // Aggregate patients by registration month
  const data = useMemo(() => {
    if (!patients || patients.length === 0) return [];

    const monthMap = {};
    patients.forEach((p) => {
      const d = p.createdAt ? new Date(p.createdAt) : new Date();
      const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
      monthMap[monthKey] = (monthMap[monthKey] || 0) + 1;
    });

    const sortedMonths = Object.keys(monthMap).sort();
    let cumulative = 0;

    return sortedMonths.map((m) => {
      const newCount = monthMap[m];
      cumulative += newCount;
      const [year, month] = m.split('-');
      const d = new Date(Number(year), Number(month) - 1, 1);
      const label = d.toLocaleDateString('en-US', { month: 'short', year: '2-digit' });

      return {
        month: label,
        newPatients: newCount,
        cumulativePatients: cumulative
      };
    });
  }, [patients]);

  const hasData = data.length > 0;

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
        paddingRight: 16,
        paddingTop: 10,
        paddingBottom: 0
      })
    );

    // X Axis: Categories (Months)
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 40,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    xRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'month',
        renderer: xRenderer,
        tooltip: am5.Tooltip.new(root, {})
      })
    );

    // Y Axis: New Registrations (Left)
    const yRenderer = am5xy.AxisRendererY.new(root, {
      minGridDistance: 30,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer,
        min: 0,
        extraMax: 0.15
      })
    );

    // Y Axis 2: Cumulative Cohort (Right)
    const yRenderer2 = am5xy.AxisRendererY.new(root, {
      opposite: true,
      minGridDistance: 30,
      strokeOpacity: 0.1,
      stroke: am5.color(0x94A3B8)
    });
    yRenderer2.labels.template.setAll({
      fill: am5.color(0x64748B),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    const yAxis2 = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        renderer: yRenderer2,
        min: 0,
        extraMax: 0.15
      })
    );

    // Column Series: New Patients
    const columnSeries = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        name: 'New Registrations',
        xAxis: xAxis,
        yAxis: yAxis,
        valueYField: 'newPatients',
        categoryXField: 'month',
        fill: am5.color(0x3B82F6),
        tooltip: createTooltip(root)
      })
    );

    columnSeries.columns.template.setAll({
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      fillOpacity: 0.85,
      strokeWidth: 0,
      tooltipText: `[bold]{categoryX}[/]\n• New Enrollments: [bold]{valueY}[/]`
    });

    // Line Series: Cumulative Cohort
    const lineSeries = chart.series.push(
      am5xy.SmoothedXLineSeries.new(root, {
        name: 'Cumulative Cohort',
        xAxis: xAxis,
        yAxis: yAxis2,
        valueYField: 'cumulativePatients',
        categoryXField: 'month',
        stroke: am5.color(0x10B981),
        tooltip: createTooltip(root)
      })
    );

    lineSeries.strokes.template.setAll({
      strokeWidth: 2.5
    });

    lineSeries.bullets.push(() => {
      return am5.Bullet.new(root, {
        sprite: am5.Circle.new(root, {
          radius: 4,
          fill: am5.color(0x10B981),
          stroke: am5.color(0xFFFFFF),
          strokeWidth: 2,
          tooltipText: `[bold]Total Cohort: {valueY} Patients[/]`
        })
      });
    });

    xAxis.data.setAll(data);
    columnSeries.data.setAll(data);
    lineSeries.data.setAll(data);

    columnSeries.appear(700);
    lineSeries.appear(700);
    chart.appear(700, 100);

    return () => {
      root.dispose();
    };
  }, [data, hasData]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <TrendingUp className="w-4 h-4 text-blue-600" />
            Patient Cohort Growth & Registration Dynamics
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Monthly enrollment intake columns with cumulative cohort accumulation curve
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs text-slate-500 font-medium">
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-2.5 rounded bg-blue-500" />
            <span>New Enrollments</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2.5 h-0.5 bg-emerald-500" />
            <span>Cumulative Cohort</span>
          </span>
        </div>
      </div>

      {/* amCharts Container */}
      <div
        id={chartId}
        ref={chartRef}
        style={{ width: '100%', height: `${height}px` }}
        className="relative"
      />
    </div>
  );
};

export default CareFlowCohortGrowth;
