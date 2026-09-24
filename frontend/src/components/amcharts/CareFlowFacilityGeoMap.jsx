import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Navigation, Building2 } from 'lucide-react';
import { CLINICAL_TOKENS } from './amchartsTheme';

/**
 * CareFlowFacilityGeoMap
 * 
 * Geographic Distribution Map of the Tamil Nadu Healthcare Facility Network:
 *  - Maps exact GPS coordinates onto an interactive regional canvas
 *  - Pins sized by consultation volume with concentric pulsing-ring animation
 *  - Click pins to cross-filter dashboard
 */
export const CareFlowFacilityGeoMap = ({
  facilities = [],
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  const [hoveredNode, setHoveredNode] = useState(null);

  const MIN_LAT = 8.8;
  const MAX_LAT = 13.6;
  const MIN_LNG = 76.4;
  const MAX_LNG = 80.5;

  const mapWidth = 560;
  const mapHeight = 320;

  const project = (lat, lng) => {
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (mapWidth - 100) + 50;
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (mapHeight - 80) + 30;
    return { x, y };
  };

  const tnBoundaryPath = `
    M 420 35
    L 450 50
    L 460 80
    L 445 120
    L 435 160
    L 420 200
    L 390 240
    L 350 270
    L 310 295
    L 280 305
    L 250 290
    L 210 265
    L 150 230
    L 120 190
    L 100 150
    L 130 115
    L 180 85
    L 240 65
    L 340 40
    Z
  `;

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans ${className}`}>
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-3 pb-2.5 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 tracking-tight flex items-center gap-1.5">
            <Navigation className="w-4 h-4 text-blue-600" />
            Regional Health Network Geospatial Topology
          </h3>
          <p className="text-[11px] text-slate-500 font-medium">
            Facility coordinate telemetry across Tamil Nadu clinical operating centers
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-600">
          <span className="w-2 h-2 rounded-full bg-blue-600 animate-pulse" />
          <span>{facilities.length} Active Nodes</span>
        </div>
      </div>

      {/* Map SVG Canvas */}
      <div className="relative flex justify-center items-center overflow-hidden bg-slate-50/50 rounded-xl border border-slate-100 p-2">
        <svg
          viewBox={`0 0 ${mapWidth} ${mapHeight}`}
          className="w-full max-w-[560px] h-auto"
        >
          <defs>
            <radialGradient id="tnGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor="#2563EB" stopOpacity="0.08" />
              <stop offset="100%" stopColor="#2563EB" stopOpacity="0.01" />
            </radialGradient>
          </defs>

          {/* Regional Territory Outline */}
          <path
            d={tnBoundaryPath}
            fill="url(#tnGlow)"
            stroke="#E2E8F0"
            strokeWidth="1.5"
            strokeDasharray="4 4"
          />

          {/* Regional Grid Watermark */}
          <text x="380" y="70" fill="#94A3B8" fontSize="10" fontFamily="Poppins, sans-serif" fontWeight="600" opacity="0.6">
            Chennai Cluster
          </text>
          <text x="140" y="160" fill="#94A3B8" fontSize="10" fontFamily="Poppins, sans-serif" fontWeight="600" opacity="0.6">
            Coimbatore Cluster
          </text>
          <text x="260" y="240" fill="#94A3B8" fontSize="10" fontFamily="Poppins, sans-serif" fontWeight="600" opacity="0.6">
            Madurai Cluster
          </text>

          {/* Facility Location Nodes with Pulsing-Ring Animation */}
          {facilities.map((fac) => {
            const lat = Number(fac.latitude || fac.address?.latitude) || 11.0;
            const lng = Number(fac.longitude || fac.address?.longitude) || 78.0;
            const { x, y } = project(lat, lng);

            const isSelected = selectedFacility && fac.name?.toLowerCase().includes(selectedFacility.toLowerCase());
            const count = fac.appointmentCount || fac.stats?.appointmentsCount || 40;
            const pinRadius = Math.min(10, Math.max(5, Math.sqrt(count) * 1.2));

            return (
              <g
                key={fac._id || fac.id || fac.name}
                className="cursor-pointer"
                onClick={() => onFacilityClick && onFacilityClick(fac)}
                onMouseEnter={() => setHoveredNode(fac)}
                onMouseLeave={() => setHoveredNode(null)}
              >
                {/* Expanding Concentric Pulsing Ring (Section 2.2 animation) */}
                <circle
                  cx={x}
                  cy={y}
                  r={pinRadius * 2}
                  fill="none"
                  stroke={CLINICAL_TOKENS.primary}
                  strokeWidth="1.5"
                  opacity="0.4"
                  className="animate-ping"
                  style={{ transformOrigin: `${x}px ${y}px`, animationDuration: '1.4s' }}
                />

                {/* Base Outer Glow */}
                <circle
                  cx={x}
                  cy={y}
                  r={pinRadius + 3}
                  fill={isSelected ? '#1D4ED8' : '#2563EB'}
                  fillOpacity="0.15"
                />

                {/* Core Pin */}
                <circle
                  cx={x}
                  cy={y}
                  r={pinRadius}
                  fill={isSelected ? CLINICAL_TOKENS.primaryHover : CLINICAL_TOKENS.primary}
                  stroke="#FFFFFF"
                  strokeWidth="2"
                />

                {/* Center Core Dot */}
                <circle
                  cx={x}
                  cy={y}
                  r={2.5}
                  fill="#FFFFFF"
                />

                {/* Node Label */}
                <text
                  x={x}
                  y={y - pinRadius - 5}
                  textAnchor="middle"
                  fill={isSelected ? '#0F172A' : '#475569'}
                  fontSize="9.5"
                  fontWeight={isSelected ? '700' : '600'}
                  fontFamily="Poppins, sans-serif"
                >
                  {fac.name?.replace(/Hospital|Clinic|Multispeciality/g, '').trim()}
                </text>
              </g>
            );
          })}
        </svg>

        {/* Hover / Selection Telemetry Card */}
        {hoveredNode && (
          <div className="absolute top-3 left-3 bg-white/95 backdrop-blur-xs p-2.5 rounded-xl border border-slate-200 shadow-md text-xs pointer-events-none font-sans z-20">
            <div className="font-semibold text-slate-900">{hoveredNode.name}</div>
            <div className="text-[11px] text-slate-500">{hoveredNode.address?.city || 'Tamil Nadu'}</div>
            <div className="mt-1 pt-1 border-t border-slate-100 flex items-center gap-3 text-[10px] text-slate-600 font-medium">
              <span>{hoveredNode.appointmentCount || hoveredNode.stats?.appointmentsCount || 0} visits</span>
              <span>{hoveredNode.doctorCount || hoveredNode.stats?.doctorsCount || 0} clinicians</span>
            </div>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between pt-2.5 text-[11px] text-slate-500">
        <span>Click node to isolate facility telemetry</span>
        <span className="text-blue-600 font-medium">Pins scaled by encounter volume</span>
      </div>
    </div>
  );
};

export default CareFlowFacilityGeoMap;
