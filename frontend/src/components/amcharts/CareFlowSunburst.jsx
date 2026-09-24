import React, { useEffect, useRef, useId } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_PALETTE } from './amchartsTheme';
import { Network } from 'lucide-react';

/**
 * CareFlowSunburst
 * Multi-tier hierarchical sunburst visualization (e.g. Department -> Doctor volume).
 * Features amCharts 5 Hierarchy module with full root disposal and reduced motion.
 */
export const CareFlowSunburst = ({
  data = null,
  title,
  subtitle,
  height = 280,
  onNodeClick = null,
  emptyMessage = 'No multi-tier hierarchical data available.',
  className = ''
}) => {
  const chartRef = useRef(null);
  const chartId = useId().replace(/:/g, '');

  const hasData = Boolean(data && (data.children?.length > 0 || data.value > 0));

  useEffect(() => {
    if (!chartRef.current || !hasData) return;

    const root = am5.Root.new(chartRef.current);
    root._logo?.dispose();

    if (!isReducedMotion()) {
      root.setThemes([am5themes_Animated.new(root)]);
    }

    const container = root.container.children.push(
      am5.Container.new(root, {
        width: am5.percent(100),
        height: am5.percent(100),
        layout: root.verticalLayout
      })
    );

    const series = container.children.push(
      am5hierarchy.Sunburst.new(root, {
        singleBranchOnly: false,
        downDepth: 2,
        initialDepth: 2,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        tooltip: createTooltip(root)
      })
    );

    series.get('colors').set('colors', CLINICAL_PALETTE);

    series.slices.template.setAll({
      stroke: am5.color(0xFFFFFF),
      strokeWidth: 1.5,
      cornerRadius: 4,
      tooltipText: '{category}: [bold]{value}[/]'
    });

    series.labels.template.setAll({
      fill: am5.color(0xFFFFFF),
      fontSize: 10,
      fontFamily: 'Poppins, system-ui, sans-serif',
      text: '{category}'
    });

    if (onNodeClick) {
      series.slices.template.events.on('click', (ev) => {
        const item = ev.target.dataItem?.dataContext;
        if (item) onNodeClick(item);
      });
    }

    series.data.setAll([data]);

    if (!isReducedMotion()) {
      series.appear(600, 100);
    }

    return () => {
      root.dispose();
    };
  }, [data, hasData, onNodeClick]);

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs flex flex-col justify-between ${className}`}>
      {(title || subtitle) && (
        <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-2.5">
          <div>
            {title && <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>}
            {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
          </div>
          {onNodeClick && (
            <span className="text-[11px] font-semibold text-slate-400 bg-slate-100 px-2 py-0.5 rounded-md">
              Click slice to drilldown
            </span>
          )}
        </div>
      )}

      {!hasData ? (
        <div className="py-12 flex flex-col items-center justify-center text-center p-6 bg-slate-50/60 rounded-lg border border-dashed border-slate-200">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-2">
            <Network className="w-5 h-5" />
          </div>
          <p className="text-xs font-medium text-slate-600">{emptyMessage}</p>
          <p className="text-[11px] text-slate-400 mt-0.5">Hierarchical distribution populates when departments and doctors accumulate volume.</p>
        </div>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height }} />
      )}
    </div>
  );
};

export default CareFlowSunburst;
