import React, { useEffect, useRef, useMemo } from 'react';
import * as am5 from '@amcharts/amcharts5';
import * as am5flow from '@amcharts/amcharts5/flow';
import am5themes_Animated from '@amcharts/amcharts5/themes/Animated';
import { CLINICAL_TOKENS, isReducedMotion, createTooltip } from './amchartsTheme';
import { formatCurrency } from '../../utils/formatters';

/**
 * CareFlowSankey
 * 
 * Consolidated Multi-Stage Financial Flow Sankey diagram.
 * Supports stages={3} (Super Admin: Gross -> Facilities -> Gateways -> Statuses)
 * and stages={2} (Org Admin: Gross -> Gateways -> Statuses).
 */
export function CareFlowSankey({
  payments = [],
  data = null,
  stages = 3,
  title = 'Multi-Stage Financial Settlement Flow',
  subtitle = 'Trace gross invoiced fees through collection channels to clearance status (click node to filter)',
  height = 340,
  onNodeClick = null,
  className = ''
}) {
  const chartRef = useRef(null);

  // Build multi-stage links from payment records if explicit data not provided
  const { sankeyLinks, totalGross } = useMemo(() => {
    if (Array.isArray(data) && data.length > 0) {
      const targetSet = new Set(data.map((d) => d.to));
      const rootSources = data.filter((d) => !targetSet.has(d.from));
      const total = rootSources.length > 0
        ? rootSources.reduce((sum, item) => sum + (Number(item.value) || 0), 0)
        : Math.round(data.reduce((sum, item) => sum + (Number(item.value) || 0), 0) / 2);
      return { sankeyLinks: data, totalGross: total };
    }

    if (!payments || payments.length === 0) {
      return { sankeyLinks: [], totalGross: 0 };
    }

    let gross = 0;
    const links = [];

    if (stages === 3) {
      // 3-Stage: Gross Invoiced -> Facilities -> Gateways -> Statuses
      const facilityTotals = {};
      const facilityGatewayTotals = {};
      const gatewayStatusTotals = {};

      payments.forEach((p) => {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;
        gross += amt;

        const facName = p.organizationId?.name || 'CareFlow Facility';
        const gateway = (p.paymentMethod === 'online' || p.razorpayPaymentId) ? 'Online Razorpay' : 'Clinic Desk (POS)';
        const statusLabel = p.status === 'paid' ? 'Settled (Paid)' : (p.status === 'pending' ? 'Pending Clearance' : 'Failed Billing');

        facilityTotals[facName] = (facilityTotals[facName] || 0) + amt;

        const fgKey = `${facName}__${gateway}`;
        facilityGatewayTotals[fgKey] = (facilityGatewayTotals[fgKey] || 0) + amt;

        const gsKey = `${gateway}__${statusLabel}`;
        gatewayStatusTotals[gsKey] = (gatewayStatusTotals[gsKey] || 0) + amt;
      });

      // Stage 1: Gross -> Facilities
      Object.entries(facilityTotals).forEach(([fac, amt]) => {
        links.push({ from: 'Gross Invoiced', to: fac, value: amt });
      });

      // Stage 2: Facilities -> Gateways
      Object.entries(facilityGatewayTotals).forEach(([key, amt]) => {
        const [fac, gw] = key.split('__');
        links.push({ from: fac, to: gw, value: amt });
      });

      // Stage 3: Gateways -> Statuses
      Object.entries(gatewayStatusTotals).forEach(([key, amt]) => {
        const [gw, st] = key.split('__');
        links.push({ from: gw, to: st, value: amt });
      });
    } else {
      // 2-Stage: Gross Invoiced -> Gateways -> Statuses
      const gatewayTotals = {};
      const gatewayStatusTotals = {};

      payments.forEach((p) => {
        const amt = Number(p.amount) || 0;
        if (amt <= 0) return;
        gross += amt;

        const gateway = (p.paymentMethod === 'online' || p.razorpayPaymentId) ? 'Online Portal' : 'Clinic Desk';
        const statusLabel = p.status === 'paid' ? 'Settled Fees' : (p.status === 'pending' ? 'Pending Clearance' : 'Failed Billing');

        gatewayTotals[gateway] = (gatewayTotals[gateway] || 0) + amt;

        const gsKey = `${gateway}__${statusLabel}`;
        gatewayStatusTotals[gsKey] = (gatewayStatusTotals[gsKey] || 0) + amt;
      });

      Object.entries(gatewayTotals).forEach(([gw, amt]) => {
        links.push({ from: 'Gross Invoiced', to: gw, value: amt });
      });

      Object.entries(gatewayStatusTotals).forEach(([key, amt]) => {
        const [gw, st] = key.split('__');
        links.push({ from: gw, to: st, value: amt });
      });
    }

    return { sankeyLinks: links, totalGross: gross };
  }, [payments, data, stages]);

  useEffect(() => {
    if (!chartRef.current || !sankeyLinks.length || totalGross === 0) return;

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
      am5flow.Sankey.new(root, {
        sourceIdField: 'from',
        targetIdField: 'to',
        valueField: 'value',
        nodePadding: 12,
        nodeWidth: 14,
        tooltip: createTooltip(root)
      })
    );

    // Color adapter strictly following design tokens
    series.nodes.rectangles.template.adapters.add('fill', (fill, target) => {
      const dataItem = target.dataItem;
      if (dataItem && dataItem.dataContext) {
        const name = (dataItem.dataContext.id || dataItem.dataContext.name || '').toLowerCase();
        if (name.includes('settled') || name.includes('paid')) return am5.color(CLINICAL_TOKENS.success); // Emerald
        if (name.includes('pending')) return am5.color(CLINICAL_TOKENS.warning); // Amber
        if (name.includes('failed')) return am5.color(CLINICAL_TOKENS.danger); // Red
        if (name.includes('gross') || name.includes('platform')) return am5.color(CLINICAL_TOKENS.primaryText); // Navy
        if (name.includes('online') || name.includes('portal') || name.includes('razorpay')) return am5.color(CLINICAL_TOKENS.primary); // Blue
        return am5.color(CLINICAL_TOKENS.secondaryText); // Slate
      }
      return fill;
    });

    series.nodes.rectangles.template.setAll({
      stroke: am5.color(0xFFFFFF),
      strokeWidth: 2,
      cornerRadiusTL: 4,
      cornerRadiusTR: 4,
      cornerRadiusBL: 4,
      cornerRadiusBR: 4
    });

    // Rich Node Tooltips: ₹ Value + % of Total Gross
    series.nodes.rectangles.template.adapters.add('tooltipText', (text, target) => {
      const dataItem = target.dataItem;
      if (!dataItem) return text;
      const val = Number(dataItem.get('value') || 0);
      const pct = totalGross > 0 ? ((val / totalGross) * 100).toFixed(1) : '100.0';
      return `[bold]{name}[/]\n${formatCurrency(val)} (${pct}% of gross)`;
    });

    // Node Labels
    series.nodes.labels.template.setAll({
      fill: am5.color(CLINICAL_TOKENS.primaryText),
      fontSize: 11,
      fontWeight: '600',
      fontFamily: 'Poppins, system-ui, sans-serif'
    });

    // Links with animated gradient flow
    series.links.template.setAll({
      fillStyle: 'gradient',
      fillOpacity: 0.32,
      strokeOpacity: 0
    });

    series.links.template.states.create('hover', {
      fillOpacity: 0.65
    });

    // Interactive Click-to-filter
    if (onNodeClick) {
      series.nodes.rectangles.template.events.on('click', (ev) => {
        const dataItem = ev.target.dataItem;
        if (dataItem && dataItem.dataContext) {
          onNodeClick(dataItem.dataContext);
        }
      });
    }

    series.data.setAll(sankeyLinks);
    series.appear(850, 100);

    return () => {
      root.dispose();
    };
  }, [sankeyLinks, totalGross, onNodeClick]);

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

        <div className="flex items-center gap-3">
          <span className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold border border-emerald-100 shadow-2xs">
            {formatCurrency(totalGross)} Total Flow
          </span>
          <span className="text-xs text-slate-400 font-medium hidden sm:inline">
            Click node to filter
          </span>
        </div>
      </div>

      {!sankeyLinks.length ? (
        <p className="text-xs text-slate-400 py-12 text-center font-medium">
          No settlement flow records available for this period.
        </p>
      ) : (
        <div ref={chartRef} style={{ width: '100%', height }} />
      )}
    </div>
  );
}

export default CareFlowSankey;
