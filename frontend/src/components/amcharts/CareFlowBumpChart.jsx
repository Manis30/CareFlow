import React, { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Trophy, TrendingUp, Building2, Eye } from 'lucide-react';
import { CLINICAL_COLORS } from './amchartsTheme';

/**
 * CareFlowBumpChart
 * 
 * Facility Rank Evolution Bump Chart:
 * Tracks facility competitive ranking shifts across dimensions (Encounters, Patient Cohort, Revenue).
 * Implements smooth SVG cubic bezier rank curves, hover spotlighting, and active selection.
 */
export const CareFlowBumpChart = ({
  facilities = [],
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  const [hoveredFacility, setHoveredFacility] = useState(null);
  const [activeMetric, setActiveMetric] = useState('appointments'); // 'appointments' | 'patients' | 'revenue'

  // Dimensions to compare across
  const columns = [
    { key: 'appointments', label: 'Consultation Volume' },
    { key: 'patients', label: 'Patient Cohort' },
    { key: 'revenue', label: 'Realized Revenue' }
  ];

  // Compute ranks for each facility across the 3 columns
  const rankedFacilities = useMemo(() => {
    if (!facilities || facilities.length === 0) return [];

    // Sort for each metric
    const byAppts = [...facilities].sort((a, b) => (b.appointmentCount || 0) - (a.appointmentCount || 0));
    const byPatients = [...facilities].sort((a, b) => (b.patientCount || 0) - (a.patientCount || 0));
    const byRev = [...facilities].sort((a, b) => (b.revenue || 0) - (a.revenue || 0));

    const rankMap = {};
    byAppts.forEach((f, idx) => {
      rankMap[f._id] = { appointmentsRank: idx + 1 };
    });
    byPatients.forEach((f, idx) => {
      if (rankMap[f._id]) rankMap[f._id].patientsRank = idx + 1;
    });
    byRev.forEach((f, idx) => {
      if (rankMap[f._id]) rankMap[f._id].revenueRank = idx + 1;
    });

    const colors = [
      '#2563EB', '#10B981', '#6366F1', '#D97706',
      '#06B6D4', '#8B5CF6', '#EC4899', '#64748B'
    ];

    return facilities.map((f, idx) => {
      const rm = rankMap[f._id] || { appointmentsRank: idx + 1, patientsRank: idx + 1, revenueRank: idx + 1 };
      return {
        id: f._id,
        name: f.name || 'Healthcare Facility',
        district: f.district || f.city || 'Tamil Nadu',
        color: colors[idx % colors.length],
        appointmentCount: f.appointmentCount || 0,
        patientCount: f.patientCount || 0,
        revenue: f.revenue || 0,
        ranks: [rm.appointmentsRank, rm.patientsRank, rm.revenueRank]
      };
    }).sort((a, b) => {
      if (activeMetric === 'patients') return a.ranks[1] - b.ranks[1];
      if (activeMetric === 'revenue') return a.ranks[2] - b.ranks[2];
      return a.ranks[0] - b.ranks[0];
    });
  }, [facilities, activeMetric]);

  const totalOrgs = rankedFacilities.length || 8;
  const svgHeight = Math.max(320, totalOrgs * 44 + 40);
  const colX = [80, 280, 480]; // SVG column coordinates

  const getY = (rank) => 40 + (rank - 1) * 42;

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col ${className}`}>
      {/* Header with Metric Switcher */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Trophy className="w-4 h-4 text-amber-500" />
            Facility Multi-Dimensional Rank Evolution
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Relative platform ranking transition across operational volume, patient cohort, and revenue
          </p>
        </div>

        {/* Primary Sort Metric Selector */}
        <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg text-xs font-semibold text-slate-600">
          <button
            type="button"
            onClick={() => setActiveMetric('appointments')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeMetric === 'appointments' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            By Encounters
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('patients')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeMetric === 'patients' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            By Cohort
          </button>
          <button
            type="button"
            onClick={() => setActiveMetric('revenue')}
            className={`px-2.5 py-1 rounded-md transition-all ${
              activeMetric === 'revenue' ? 'bg-white text-slate-900 shadow-xs' : 'hover:text-slate-900'
            }`}
          >
            By Revenue
          </button>
        </div>
      </div>

      {/* Bump Chart SVG Canvas */}
      <div className="overflow-x-auto">
        <div className="min-w-[560px]">
          {/* Column Header Labels */}
          <div className="flex justify-between px-10 mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">
            <span className="w-44 text-left">Consultation Volume</span>
            <span className="w-44 text-center">Patient Cohort</span>
            <span className="w-44 text-right">Realized Revenue</span>
          </div>

          <svg
            viewBox={`0 0 560 ${svgHeight}`}
            className="w-full"
            style={{ height: `${svgHeight}px` }}
          >
            <defs>
              <filter id="bumpShadow" x="-10%" y="-10%" width="120%" height="120%">
                <feDropShadow dx="0" dy="1" stdDeviation="1.5" floodOpacity="0.15" />
              </filter>
            </defs>

            {/* Horizontal Rank Reference Guides */}
            {Array.from({ length: totalOrgs }).map((_, rIdx) => {
              const y = getY(rIdx + 1);
              return (
                <g key={rIdx}>
                  <line
                    x1="40"
                    y1={y}
                    x2="520"
                    y2={y}
                    stroke="#F1F5F9"
                    strokeWidth="1"
                    strokeDasharray="3 3"
                  />
                  <text
                    x="24"
                    y={y + 4}
                    fill="#94A3B8"
                    fontSize="10"
                    fontWeight="600"
                    textAnchor="middle"
                    fontFamily="Poppins, sans-serif"
                  >
                    #{rIdx + 1}
                  </text>
                </g>
              );
            })}

            {/* Connecting Bezier Splines */}
            {rankedFacilities.map((fac) => {
              const isHovered = hoveredFacility === fac.id;
              const isSelected = selectedFacility && (selectedFacility === fac.name || selectedFacility === fac.id);
              const isDimmed = (hoveredFacility && !isHovered) || (selectedFacility && !isSelected);

              const y0 = getY(fac.ranks[0]);
              const y1 = getY(fac.ranks[1]);
              const y2 = getY(fac.ranks[2]);

              // Cubic bezier control points
              const cpX1 = colX[0] + (colX[1] - colX[0]) / 2;
              const cpX2 = colX[1] + (colX[2] - colX[1]) / 2;

              const pathData = `
                M ${colX[0]} ${y0}
                C ${cpX1} ${y0}, ${cpX1} ${y1}, ${colX[1]} ${y1}
                C ${cpX2} ${y1}, ${cpX2} ${y2}, ${colX[2]} ${y2}
              `;

              return (
                <g
                  key={fac.id}
                  className="cursor-pointer"
                  onMouseEnter={() => setHoveredFacility(fac.id)}
                  onMouseLeave={() => setHoveredFacility(null)}
                  onClick={() => onFacilityClick && onFacilityClick(fac)}
                >
                  {/* Outer glow stroke when highlighted */}
                  {(isHovered || isSelected) && (
                    <path
                      d={pathData}
                      fill="none"
                      stroke={fac.color}
                      strokeWidth="8"
                      strokeOpacity="0.2"
                      strokeLinecap="round"
                    />
                  )}

                  {/* Main Line */}
                  <path
                    d={pathData}
                    fill="none"
                    stroke={fac.color}
                    strokeWidth={isHovered || isSelected ? 3.5 : 2}
                    strokeOpacity={isDimmed ? 0.2 : 0.85}
                    strokeLinecap="round"
                    className="transition-all duration-200"
                  />

                  {/* Node 0: Appointments */}
                  <circle
                    cx={colX[0]}
                    cy={y0}
                    r={isHovered || isSelected ? 6 : 4.5}
                    fill={fac.color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    filter="url(#bumpShadow)"
                    opacity={isDimmed ? 0.25 : 1}
                  />

                  {/* Node 1: Patients */}
                  <circle
                    cx={colX[1]}
                    cy={y1}
                    r={isHovered || isSelected ? 6 : 4.5}
                    fill={fac.color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    filter="url(#bumpShadow)"
                    opacity={isDimmed ? 0.25 : 1}
                  />

                  {/* Node 2: Revenue */}
                  <circle
                    cx={colX[2]}
                    cy={y2}
                    r={isHovered || isSelected ? 6 : 4.5}
                    fill={fac.color}
                    stroke="#FFFFFF"
                    strokeWidth="2"
                    filter="url(#bumpShadow)"
                    opacity={isDimmed ? 0.25 : 1}
                  />

                  {/* Facility Label at the end */}
                  <text
                    x={colX[2] + 12}
                    y={y2 + 4}
                    fill={isHovered || isSelected ? '#0F172A' : '#64748B'}
                    fontSize={isHovered || isSelected ? '11' : '10'}
                    fontWeight={isHovered || isSelected ? '700' : '500'}
                    fontFamily="Poppins, sans-serif"
                    opacity={isDimmed ? 0.3 : 1}
                  >
                    {fac.name.split(' ')[0]} (#{fac.ranks[2]})
                  </text>
                </g>
              );
            })}
          </svg>
        </div>
      </div>

      {/* Hovered / Selected Facility Details Strip */}
      {hoveredFacility && (
        <div className="mt-3 p-3 bg-slate-50 rounded-xl border border-slate-200 flex items-center justify-between text-xs animate-in fade-in">
          {(() => {
            const fac = rankedFacilities.find((f) => f.id === hoveredFacility);
            if (!fac) return null;
            return (
              <>
                <div className="flex items-center gap-2">
                  <span className="w-3 h-3 rounded-full" style={{ backgroundColor: fac.color }} />
                  <span className="font-bold text-slate-900">{fac.name}</span>
                  <span className="text-slate-400">({fac.district})</span>
                </div>
                <div className="flex items-center gap-4 text-slate-600 font-medium">
                  <span>Encounters: <strong className="text-slate-900">{fac.appointmentCount}</strong> (Rank #{fac.ranks[0]})</span>
                  <span>Cohort: <strong className="text-slate-900">{fac.patientCount}</strong> (Rank #{fac.ranks[1]})</span>
                  <span>Revenue: <strong className="text-slate-900">₹{fac.revenue.toLocaleString('en-IN')}</strong> (Rank #{fac.ranks[2]})</span>
                </div>
              </>
            );
          })()}
        </div>
      )}
    </div>
  );
};

export default CareFlowBumpChart;
