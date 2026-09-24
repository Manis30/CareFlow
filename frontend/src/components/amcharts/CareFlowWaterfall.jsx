import React, { useLayoutEffect, useRef } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5xy from '@amcharts/amcharts5/xy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { CLINICAL_TOKENS, isReducedMotion, createTooltip } from './amchartsTheme';

/**
 * CareFlowWaterfall
 * 
 * Organization Growth & Net Change Waterfall Chart.
 * Tracks: Starting Count -> +Approvals (Green) -> -Suspensions (Red) -> Ending Count (Blue).
 * 
 * @param {Array} data - Array of { category, start, approvals, suspensions, netChange, end }
 * @param {number} height - Chart height (default: 260)
 */
export function CareFlowWaterfall({
  data = [],
  title = 'Organization Network Growth Waterfall',
  subtitle = 'Monthly tenant provisioning, approvals, and compliance status changes',
  height = 260,
  className = ''
}) {
  const chartRef = useRef(null);

  useLayoutEffect(() => {
    if (!chartRef.current || !data || data.length === 0) return;

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
        paddingRight: 10,
        paddingTop: 8,
        paddingBottom: 0
      })
    );

    // Prepare waterfall series data
    const chartData = [];
    data.forEach((step) => {
      // Step: Approvals
      if (step.approvals > 0) {
        chartData.push({
          category: `${step.category} +`,
          displayCategory: step.category,
          open: step.start,
          close: step.start + step.approvals,
          value: step.approvals,
          type: 'gain',
          label: `+${step.approvals}`
        });
      }
      // Step: Suspensions
      if (step.suspensions < 0) {
        const afterApprovals = step.start + (step.approvals || 0);
        chartData.push({
          category: `${step.category} -`,
          displayCategory: step.category,
          open: afterApprovals,
          close: afterApprovals + step.suspensions,
          value: step.suspensions,
          type: 'loss',
          label: `${step.suspensions}`
        });
      }
      // Step: Month Net Balance
      chartData.push({
        category: `${step.category} Total`,
        displayCategory: step.category,
        open: 0,
        close: step.end,
        value: step.end,
        type: 'total',
        label: `${step.end}`
      });
    });

    // Category Axis
    const xRenderer = am5xy.AxisRendererX.new(root, {
      minGridDistance: 35,
      cellStartLocation: 0.15,
      cellEndLocation: 0.85
    });
    xRenderer.grid.template.set('visible', false);
    xRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.secondaryText),
      fontSize: 11,
      fontFamily: 'Poppins, sans-serif'
    });

    const xAxis = chart.xAxes.push(
      am5xy.CategoryAxis.new(root, {
        categoryField: 'category',
        renderer: xRenderer
      })
    );

    // Format display labels
    xRenderer.labels.template.adapters.add('text', (text, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        return dataItem.dataContext.displayCategory || text;
      }
      return text;
    });

    // Value Axis
    const yRenderer = am5xy.AxisRendererY.new(root, {});
    yRenderer.grid.template.setAll({
      stroke: am5.color(CLINICAL_TOKENS.border),
      strokeDasharray: [3, 3]
    });
    yRenderer.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.mutedText),
      fontSize: 10,
      fontFamily: 'Poppins, sans-serif'
    });

    const yAxis = chart.yAxes.push(
      am5xy.ValueAxis.new(root, {
        min: 0,
        renderer: yRenderer
      })
    );

    // Waterfall Column Series
    const series = chart.series.push(
      am5xy.ColumnSeries.new(root, {
        xAxis,
        yAxis,
        valueYField: 'close',
        openValueYField: 'open',
        categoryXField: 'category',
        tooltip: createTooltip(root)
      })
    );

    series.columns.template.setAll({
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4,
      strokeWidth: 0,
      width: am5.percent(70),
      tooltipText: '{displayCategory}: {label} facilities'
    });

    // Color adapter based on gain / loss / total
    series.columns.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const type = dataItem.dataContext.type;
        if (type === 'gain') return am5.color(CLINICAL_TOKENS.success); // Emerald
        if (type === 'loss') return am5.color(CLINICAL_TOKENS.danger); // Red
        return am5.color(CLINICAL_TOKENS.primary); // Blue for total
      }
      return fill;
    });

    xAxis.data.setAll(chartData);
    series.data.setAll(chartData);

    series.appear(700, 100);
    chart.appear(700, 100);

    return () => {
      root.dispose();
    };
  }, [data]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
            {title}
          </h3>
          {subtitle && (
            <p className="text-xs text-slate-500 font-medium">
              {subtitle}
            </p>
          )}
        </div>

        <div className="flex items-center gap-3 text-xs font-medium text-slate-500">
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CLINICAL_TOKENS.success }} />
            <span>New Provisioned</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CLINICAL_TOKENS.danger }} />
            <span>Suspended</span>
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: CLINICAL_TOKENS.primary }} />
            <span>Net Operating</span>
          </span>
        </div>
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
}

export default CareFlowWaterfall;
