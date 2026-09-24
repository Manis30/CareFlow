import React, { useEffect, useRef, useId, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_PALETTE } from './amchartsTheme';
import { Layers, ArrowLeft, ChevronRight } from 'lucide-react';

/**
 * CareFlowPartition
 * amCharts 5 Partition / Icicle hierarchy chart for clinical taxonomy (Platform -> Org -> Specialty -> Doctor).
 * Replaces radial sunburst with readable rectangular partitions that scale cleanly across doctor leaves.
 */
export const CareFlowPartition = ({
  data = null,
  title = 'Platform Clinical Hierarchy',
  subtitle = 'Facility → Specialty → Practitioner icicle partition (click to drill down / cross-filter)',
  height = 300,
  onNodeClick = null,
  emptyMessage = 'No clinical hierarchy data available.',
  className = ''
}) => {
  const chartRef = useRef(null);
  const seriesRef = useRef(null);
  const chartId = useId().replace(/:/g, '');
  const [breadcrumbs, setBreadcrumbs] = useState([]);

  useEffect(() => {
    if (!chartRef.current || !data) return;

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
      am5hierarchy.Partition.new(root, {
        singleBranchOnly: false,
        downDepth: 1,
        initialDepth: 2,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        nodePaddingOuter: 2,
        nodePaddingInner: 2,
        orientation: 'horizontal',
        tooltip: createTooltip(root)
      })
    );

    seriesRef.current = series;

    // Clinical palette
    series.get('colors').set('colors', CLINICAL_PALETTE);

    // Node Rectangles
    series.rectangles.template.setAll({
      stroke: am5.color(0xFFFFFF),
      strokeWidth: 1.5,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4
    });

    // Node Labels
    series.labels.template.setAll({
      fill: am5.color(0xFFFFFF),
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    // Tooltip
    series.get('tooltip').label.set(
      'text',
      `[bold]{category}[/]: {value} clinician(s)`
    );

    // Hover state
    series.rectangles.template.states.create('hover', {
      fillOpacity: 0.85
    });

    // Click handler with drilldown and breadcrumb tracking
    series.rectangles.template.set('cursorOverStyle', 'pointer');
    series.rectangles.template.events.on('click', (ev) => {
      const dataItem = ev.target.dataItem;
      const dataContext = dataItem?.dataContext;
      if (dataContext) {
        if (dataContext.children && dataContext.children.length > 0) {
          setBreadcrumbs((prev) => {
            if (prev.some((b) => b.name === dataContext.name)) return prev;
            return [...prev, { name: dataContext.name, dataItem }];
          });
        }
        if (onNodeClick) {
          onNodeClick(dataContext);
        }
      }
    });

    // Set Data
    series.data.setAll([data]);

    return () => {
      root.dispose();
    };
  }, [data]);

  const handleResetBreadcrumbs = () => {
    if (seriesRef.current) {
      seriesRef.current.selectDataItem(seriesRef.current.dataItems[0]);
    }
    setBreadcrumbs([]);
    if (onNodeClick) {
      onNodeClick({ name: 'CareFlow Platform' });
    }
  };

  const handleBreadcrumbClick = (item, idx) => {
    if (seriesRef.current && item.dataItem) {
      seriesRef.current.selectDataItem(item.dataItem);
    }
    setBreadcrumbs((prev) => prev.slice(0, idx + 1));
    if (onNodeClick) {
      onNodeClick(item.dataItem?.dataContext);
    }
  };

  return (
    <div className={`bg-white rounded-xl border border-slate-200/80 p-5 shadow-2xs space-y-3 ${className}`}>
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-blue-600" />
            <h3 className="text-sm font-bold text-slate-900 tracking-tight">{title}</h3>
          </div>
          {subtitle && <p className="text-xs text-slate-500 font-medium mt-0.5">{subtitle}</p>}
        </div>

        {breadcrumbs.length > 0 && (
          <button
            type="button"
            onClick={handleResetBreadcrumbs}
            className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold text-blue-700 bg-blue-50 border border-blue-200 hover:bg-blue-100 transition-colors cursor-pointer shadow-2xs"
          >
            <ArrowLeft className="w-3 h-3" />
            <span>Overview</span>
          </button>
        )}
      </div>

      {/* Interactive Breadcrumb Bar */}
      {breadcrumbs.length > 0 && (
        <div className="flex items-center gap-1 text-xs text-slate-500 font-medium bg-slate-50 p-2 rounded-lg border border-slate-200/70 overflow-x-auto">
          <button
            type="button"
            onClick={handleResetBreadcrumbs}
            className="hover:text-blue-600 font-semibold cursor-pointer shrink-0"
          >
            Platform
          </button>
          {breadcrumbs.map((crumb, idx) => (
            <React.Fragment key={crumb.name}>
              <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
              <button
                type="button"
                onClick={() => handleBreadcrumbClick(crumb, idx)}
                className={`font-semibold shrink-0 cursor-pointer ${
                  idx === breadcrumbs.length - 1 ? 'text-blue-700 font-bold' : 'hover:text-blue-600 text-slate-600'
                }`}
              >
                {crumb.name}
              </button>
            </React.Fragment>
          ))}
        </div>
      )}

      {/* Chart Canvas */}
      {!data ? (
        <div className="flex items-center justify-center text-xs text-slate-400 py-12 font-medium">
          {emptyMessage}
        </div>
      ) : (
        <div
          ref={chartRef}
          id={`partition-${chartId}`}
          style={{ height: `${height}px`, width: '100%' }}
        />
      )}
    </div>
  );
};

export default CareFlowPartition;
