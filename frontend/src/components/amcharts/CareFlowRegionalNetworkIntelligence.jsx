import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  MapPin,
  ChevronRight,
  Plus,
  Minus,
  Compass,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  X,
  Layers
} from 'lucide-react';

export const CareFlowRegionalNetworkIntelligence = ({
  data = null,
  selectedRegion = 'All Regions',
  onRegionChange = null,
  selectedFacility = null,
  onFacilityClick = null,
  className = ''
}) => {
  const [zoomLevel, setZoomLevel] = useState(1);
  const [activeDrawerRegion, setActiveDrawerRegion] = useState(null);
  const [hoveredNode, setHoveredNode] = useState(null);

  const regions = useMemo(() => data?.regions || [], [data]);

  // Sync activeDrawerRegion when selectedRegion changes from parent
  const activeRegionData = useMemo(() => {
    if (activeDrawerRegion) {
      return regions.find(r => r.district.toLowerCase() === activeDrawerRegion.toLowerCase());
    }
    if (selectedRegion && selectedRegion !== 'All Regions') {
      return regions.find(r => r.district.toLowerCase() === selectedRegion.toLowerCase());
    }
    return null;
  }, [activeDrawerRegion, selectedRegion, regions]);

  // SVG Projection Parameters for Tamil Nadu
  // Lat: ~8.5 to ~13.5 N, Lng: ~76.2 to ~80.5 E
  const MIN_LAT = 8.5;
  const MAX_LAT = 13.6;
  const MIN_LNG = 76.2;
  const MAX_LNG = 80.5;

  const mapWidth = 560;
  const mapHeight = 360;

  const project = (lat, lng) => {
    const x = ((lng - MIN_LNG) / (MAX_LNG - MIN_LNG)) * (mapWidth - 140) + 70;
    const y = ((MAX_LAT - lat) / (MAX_LAT - MIN_LAT)) * (mapHeight - 80) + 40;
    return { x, y };
  };

  // Node color helper
  const getNodeColor = (status) => {
    switch (status) {
      case 'High Load': return '#EF4444'; // Red
      case 'Suspended': return '#EF4444'; // Red
      case 'Watch': return '#F59E0B';     // Amber
      case 'Pending': return '#F97316';   // Orange
      case 'Healthy':
      case 'Operational':
      default:
        return '#10B981'; // Green
    }
  };

  const handleNodeClick = (region) => {
    if (activeDrawerRegion === region.district) {
      setActiveDrawerRegion(null);
      if (onRegionChange) onRegionChange('All Regions');
    } else {
      setActiveDrawerRegion(region.district);
      if (onRegionChange) onRegionChange(region.district);
    }
  };

  return (
    <div className={`p-5 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col justify-between font-sans relative isolate overflow-hidden ${className}`}>
      {/* 1. Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-100">
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
            <MapPin className="w-4 h-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-slate-900 tracking-tight">
              Regional Network Intelligence
            </h3>
            <p className="text-[11px] text-slate-500 font-medium">
              Geographic distribution and activity of CareFlow facilities
            </p>
          </div>
        </div>

        {/* Right: Active Region Filter Pill */}
        <div className="flex items-center gap-2 shrink-0">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-50 text-blue-700 border border-blue-200/70 text-xs font-semibold select-none">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500 animate-pulse" />
            <span>{selectedRegion || 'All Regions'}</span>
          </div>
        </div>
      </div>

      {/* 2. Map Canvas Surface */}
      <div className="relative w-full h-[320px] rounded-xl overflow-hidden bg-[#F0F7FF]/50 border border-blue-100/60 mt-3 flex items-center justify-center">
        {/* Map Controls Top-Left */}
        <div className="absolute top-3 left-3 z-10 flex flex-col gap-1 bg-white/90 backdrop-blur-xs border border-slate-200/80 rounded-lg p-0.5 shadow-xs">
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.min(prev + 0.2, 1.8))}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
            title="Zoom In"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoomLevel(prev => Math.max(prev - 0.2, 0.8))}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
            title="Zoom Out"
          >
            <Minus className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoomLevel(1);
              setActiveDrawerRegion(null);
              if (onRegionChange) onRegionChange('All Regions');
            }}
            className="w-7 h-7 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded cursor-pointer"
            title="Reset Map"
          >
            <Compass className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* State/Geographic Context Labels */}
        <div className="absolute top-4 left-16 text-[10px] font-bold text-slate-400 tracking-wider select-none pointer-events-none">
          KARNATAKA
        </div>
        <div className="absolute top-4 right-16 text-[10px] font-bold text-slate-400 tracking-wider select-none pointer-events-none">
          ANDHRA PRADESH
        </div>
        <div className="absolute bottom-8 left-6 text-[10px] font-bold text-slate-400 tracking-wider select-none pointer-events-none">
          KERALA
        </div>
        <div className="absolute bottom-12 right-8 text-[10px] font-bold text-sky-400/80 tracking-wider select-none pointer-events-none">
          Bay of Bengal
        </div>
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-xs font-bold text-slate-300 tracking-widest uppercase select-none pointer-events-none">
          TAMIL NADU
        </div>

        {/* Vector SVG Map */}
        <motion.div
          animate={{ scale: zoomLevel }}
          transition={{ duration: 0.25 }}
          className="w-full h-full flex items-center justify-center"
        >
          <svg
            viewBox={`0 0 ${mapWidth} ${mapHeight}`}
            className="w-full h-full max-w-[560px]"
          >
            {/* Tamil Nadu Coastal Contour */}
            <path
              d="
                M 410 38
                L 442 55
                L 450 82
                L 440 125
                L 430 165
                L 415 210
                L 385 245
                L 345 280
                L 305 305
                L 275 315
                L 245 295
                L 205 270
                L 145 235
                L 115 195
                L 95 155
                L 125 118
                L 175 88
                L 235 68
                L 335 42
                Z
              "
              fill="#E0F2FE"
              fillOpacity="0.45"
              stroke="#BAE6FD"
              strokeWidth="1.5"
              strokeDasharray="4 3"
            />

            {/* Regional Nodes */}
            {regions.map((region) => {
              const { x, y } = project(region.lat, region.lng);
              const nodeColor = getNodeColor(region.status);
              const isSelected = activeRegionData?.district === region.district;

              // Node radius scaled by encounter volume
              const nodeRadius = Math.max(12, Math.min(22, (region.totalEncounters || 250) / 25));

              return (
                <g
                  key={region.district}
                  className="cursor-pointer transition-transform"
                  onClick={() => handleNodeClick(region)}
                  onMouseEnter={() => setHoveredNode(region)}
                  onMouseLeave={() => setHoveredNode(null)}
                >
                  {/* Outer Concentric Focus / Pulse Ring for Selected / Active node */}
                  {isSelected && (
                    <circle
                      cx={x}
                      cy={y}
                      r={nodeRadius + 10}
                      fill={nodeColor}
                      fillOpacity="0.18"
                      className="animate-pulse"
                    />
                  )}

                  {/* Main Node Circle */}
                  <circle
                    cx={x}
                    cy={y}
                    r={nodeRadius}
                    fill={nodeColor}
                    stroke="#FFFFFF"
                    strokeWidth="2.5"
                    filter="drop-shadow(0 2px 4px rgba(0,0,0,0.15))"
                  />

                  {/* Inner Ring */}
                  <circle
                    cx={x}
                    cy={y}
                    r={Math.max(4, nodeRadius - 6)}
                    fill="#FFFFFF"
                    fillOpacity="0.8"
                  />

                  {/* Center Dot */}
                  <circle
                    cx={x}
                    cy={y}
                    r={3}
                    fill={nodeColor}
                  />

                  {/* Node Label Text */}
                  <text
                    x={x}
                    y={y - nodeRadius - 5}
                    textAnchor="middle"
                    className="text-[11px] font-bold fill-slate-900 select-none"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {region.district}
                  </text>
                  <text
                    x={x}
                    y={y + nodeRadius + 14}
                    textAnchor="middle"
                    className="text-[9px] font-semibold fill-slate-500 select-none"
                    style={{ fontFamily: 'Poppins, sans-serif' }}
                  >
                    {region.facilityCount} {region.facilityCount === 1 ? 'Facility' : 'Facilities'}
                  </text>
                </g>
              );
            })}
          </svg>
        </motion.div>

        {/* Hover Tooltip on Node */}
        <AnimatePresence>
          {hoveredNode && !activeRegionData && (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 4 }}
              className="absolute top-3 right-3 bg-slate-900/95 text-white p-2.5 rounded-xl text-xs z-20 shadow-lg pointer-events-none"
            >
              <div className="font-bold text-white">{hoveredNode.district}</div>
              <div className="text-[11px] text-slate-300 mt-0.5">
                {hoveredNode.facilityCount} Facilities • {hoveredNode.totalEncounters} Encounters
              </div>
              <div className="text-[10px] text-emerald-400 font-semibold mt-1">
                {hoveredNode.completionRate}% Completion Rate
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* 3. Slide-out Regional Intelligence Drawer */}
        <AnimatePresence>
          {activeRegionData && (
            <motion.div
              initial={{ x: '100%', opacity: 0 }}
              animate={{ x: 0, opacity: 1 }}
              exit={{ x: '100%', opacity: 0 }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="absolute top-0 right-0 bottom-0 w-[240px] sm:w-[260px] bg-white/95 backdrop-blur-md border-l border-slate-200 shadow-2xl p-4 flex flex-col justify-between z-30"
            >
              <div>
                {/* Drawer Header */}
                <div className="flex items-center justify-between pb-2 mb-3 border-b border-slate-100">
                  <div className="flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-blue-600" />
                    <h4 className="text-xs font-bold text-slate-900 tracking-tight">
                      {activeRegionData.district} Region
                    </h4>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveDrawerRegion(null);
                      if (onRegionChange) onRegionChange('All Regions');
                    }}
                    className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100 cursor-pointer"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>

                {/* 4 Stat Metrics */}
                <div className="space-y-2 mb-4">
                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Building2 className="w-3.5 h-3.5 text-blue-600" />
                      <span>Facilities</span>
                    </div>
                    <span className="font-bold text-slate-900">{activeRegionData.facilityCount}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Calendar className="w-3.5 h-3.5 text-sky-600" />
                      <span>Total Encounters</span>
                    </div>
                    <span className="font-bold text-slate-900">{activeRegionData.totalEncounters}</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                      <span>Completion Rate</span>
                    </div>
                    <span className="font-bold text-emerald-600">{activeRegionData.completionRate}%</span>
                  </div>

                  <div className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border border-slate-100 text-xs">
                    <div className="flex items-center gap-2 text-slate-600 font-medium">
                      <Clock className="w-3.5 h-3.5 text-amber-600" />
                      <span>Avg Queue Time</span>
                    </div>
                    <span className="font-bold text-slate-900">{activeRegionData.avgQueueTime} min</span>
                  </div>
                </div>

                {/* Facilities List in this Region */}
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
                    Facilities in this Region
                  </div>
                  <div className="space-y-1.5 max-h-[120px] overflow-y-auto pr-1">
                    {activeRegionData.facilities?.map((f) => {
                      const isSelected = selectedFacility?.toLowerCase() === f.name?.toLowerCase();
                      const statusColor = f.healthStatus === 'High Load' ? 'text-rose-600 bg-rose-50' : 'text-emerald-600 bg-emerald-50';

                      return (
                        <button
                          key={f.id || f.name}
                          type="button"
                          onClick={() => onFacilityClick && onFacilityClick(isSelected ? null : f.name)}
                          className={`w-full flex items-center justify-between p-2 rounded-lg border text-left transition-all cursor-pointer ${
                            isSelected
                              ? 'bg-blue-50/90 border-blue-300 shadow-xs'
                              : 'bg-white border-slate-100 hover:bg-slate-50'
                          }`}
                        >
                          <div className="flex items-center gap-1.5 truncate pr-1">
                            <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${f.healthStatus === 'High Load' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                            <span className="text-[11px] font-semibold text-slate-900 truncate">
                              {f.name}
                            </span>
                          </div>
                          <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded shrink-0 ${statusColor}`}>
                            {f.healthStatus}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="pt-2 border-t border-slate-100 text-[10px] text-slate-600 text-center font-medium">
                Click facility to cross-filter dashboard
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* 4. Bottom Legend Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mt-3 pt-2.5 border-t border-slate-100 text-[11px] text-slate-500">
        {/* Left: Activity Volume Scale */}
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-600">Activity Volume</span>
          <span className="text-[10px] text-slate-600">Low</span>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-400" />
            <span className="w-2.5 h-2.5 rounded-full bg-blue-500" />
            <span className="w-3.5 h-3.5 rounded-full bg-blue-600" />
          </div>
          <span className="text-[10px] text-slate-600">High</span>
        </div>

        {/* Right: Facility Status Indicators */}
        <div className="flex items-center gap-3 flex-wrap text-[10px] font-medium">
          <span className="font-semibold text-slate-600">Facility Status:</span>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500" />
            <span>Operational</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-amber-500" />
            <span>Watch</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500" />
            <span>Suspended</span>
          </div>
          <div className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-orange-500" />
            <span>Pending</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareFlowRegionalNetworkIntelligence;
