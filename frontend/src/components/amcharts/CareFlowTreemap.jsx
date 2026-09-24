import React, { useEffect, useRef, useId, useState } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5hierarchy from '@amcharts/amcharts5/hierarchy';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { isReducedMotion, createTooltip, CLINICAL_TOKENS } from './amchartsTheme';
import { Layers } from 'lucide-react';

/**
 * CareFlowTreemap
 * 
 * Clinical Volume & Scale Squarified Treemap:
 *  - Tile area exclusively encodes ONE single unit: Total Consultation Volume (Appointments)
 *  - Supporting units (Doctor Count, Patient Reach) are shown strictly in tooltip metadata
 *  - Interactive click filters the page; Escape clears
 */
export const CareFlowTreemap = ({
  data = [],
  title = 'Tenant Volume & Clinical Scale',
  subtitle = 'Tile area: Total Encounters • Tooltip: Staffing & Patient cohort (click tile to filter)',
  height = 260,
  activeClinicFilter = null,
  onNodeClick = null,
  className = ''
}) => {
  const chartRef = useRef(null);
  const seriesRef = useRef(null);

  const formattedRoot = React.useMemo(() => {
    if (!data) return null;
    if (data.name && data.children) return data;
    if (Array.isArray(data)) {
      return {
        name: 'Overview',
        children: data
      };
    }
    return null;
  }, [data]);

  useEffect(() => {
    if (!chartRef.current || !formattedRoot) return;

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
      am5hierarchy.Treemap.new(root, {
        singleBranchOnly: false,
        downDepth: 1,
        upDepth: 1,
        initialDepth: 1,
        valueField: 'value',
        categoryField: 'name',
        childDataField: 'children',
        nodePaddingOuter: 3,
        nodePaddingInner: 3,
        tooltip: createTooltip(root)
      })
    );

    seriesRef.current = series;

    series.rectangles.template.setAll({
      stroke: am5.color(0xFFFFFF),
      strokeWidth: 2,
      cornerRadiusTL: 6,
      cornerRadiusTR: 6,
      cornerRadiusBL: 6,
      cornerRadiusBR: 6,
      cursorOverStyle: 'pointer'
    });

    // Monochromatic brand blue intensity fill based strictly on volume
    series.rectangles.template.adapters.add('fill', (fill, target) => {
      const ctx = target.dataItem?.dataContext;
      if (!ctx || ctx.name === 'Overview') return am5.color(CLINICAL_TOKENS.primary);

      const val = Number(ctx.value || 0);
      if (val >= 60) return am5.color(CLINICAL_TOKENS.primaryHover); // #1D4ED8
      if (val >= 40) return am5.color(CLINICAL_TOKENS.primary);      // #2563EB
      if (val >= 20) return am5.color(0x3B82F6);                     // Mid blue
      if (val >= 10) return am5.color(0x60A5FA);                     // Soft blue
      return am5.color(CLINICAL_TOKENS.secondaryText);               // Slate
    });

    // Opacity Adapter for cross-filtering
    series.rectangles.template.adapters.add('fillOpacity', (opacity, target) => {
      const ctx = target.dataItem?.dataContext;
      if (!ctx || ctx.name === 'Overview') return 1;

      if (activeClinicFilter) {
        const isMatch =
          (ctx.name && ctx.name.toLowerCase().includes(activeClinicFilter.toLowerCase())) ||
          (ctx.id && String(ctx.id) === String(activeClinicFilter));
        return isMatch ? 1 : 0.28;
      }
      return 0.95;
    });

    // Single-unit area tooltip with supporting metadata
    series.rectangles.template.adapters.add('tooltipText', (text, target) => {
      const ctx = target.dataItem?.dataContext;
      if (!ctx || ctx.name === 'Overview') return '';
      const docCount = ctx.doctorCount ?? (ctx.doctors ? Object.keys(ctx.doctors).length : 0);
      const patCount = ctx.patientCount ?? 0;
      return `[bold]{name}[/]\n{value} consultations\nStaffing: ${docCount} clinicians • Cohort: ${patCount} patients`;
    });

    series.labels.template.setAll({
      fill: am5.color(0xFFFFFF),
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'Poppins, sans-serif'
    });

    if (onNodeClick) {
      series.rectangles.template.events.on('click', (ev) => {
        const ctx = ev.target.dataItem?.dataContext;
        if (ctx && ctx.name !== 'Overview') {
          onNodeClick(ctx);
        }
      });
    }

    series.data.setAll([formattedRoot]);
    series.appear(750, 100);

    return () => {
      root.dispose();
    };
  }, [formattedRoot, activeClinicFilter, onNodeClick]);

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs font-sans ${className}`}>
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center">
            <Layers className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              {title}
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              {subtitle}
            </p>
          </div>
        </div>

        {activeClinicFilter && (
          <span className="text-[10px] font-semibold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            Filtered: {activeClinicFilter}
          </span>
        )}
      </div>

      <div ref={chartRef} style={{ width: '100%', height }} />
    </div>
  );
};

export default CareFlowTreemap;
