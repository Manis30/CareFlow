import React, { useState, useMemo, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity,
  Building2,
  CheckCircle2,
  ArrowUpRight,
  RefreshCw,
  AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { getRegionalPerformanceApi } from '../../api/superAdmin';

// Palette matching reference design:
// Left Side: 1. Electric Blue (#0066FF), 2. Emerald (#10B981), 3. Amber (#F59E0B), 4. Purple (#8B5CF6)
// Right Side: 5. Pink (#EC4899), 6. Cyan (#06B6D4), 7. Gold (#EAB308), 8. Crimson (#EF4444)
const CLINIC_PALETTE = [
  '#0066FF',
  '#10B981',
  '#F59E0B',
  '#8B5CF6',
  '#EC4899',
  '#06B6D4',
  '#EAB308',
  '#EF4444'
];

// Exact geometry on a 1000 x 500 virtual canvas.
// Center Node is at (500, 250) with outer perimeter landing radius = 40-42 units.
// Left nodes: connection starts at clinic icon (startX, startY), text is on left.
// Right nodes: connection starts at clinic icon (startX, startY), text is on right.
const CLINIC_LAYOUT_SPECS = [
  // LEFT SIDE (4 nodes)
  {
    startX: 335,
    startY: 115,
    endX: 462,
    endY: 222,
    cp1X: 395,
    cp1Y: 115,
    cp2X: 435,
    cp2Y: 215,
    isLeft: true
  },
  {
    startX: 310,
    startY: 205,
    endX: 458,
    endY: 242,
    cp1X: 375,
    cp1Y: 205,
    cp2X: 425,
    cp2Y: 236,
    isLeft: true
  },
  {
    startX: 310,
    startY: 295,
    endX: 458,
    endY: 258,
    cp1X: 375,
    cp1Y: 295,
    cp2X: 425,
    cp2Y: 264,
    isLeft: true
  },
  {
    startX: 335,
    startY: 385,
    endX: 462,
    endY: 278,
    cp1X: 395,
    cp1Y: 385,
    cp2X: 435,
    cp2Y: 285,
    isLeft: true
  },
  // RIGHT SIDE (4 nodes)
  {
    startX: 665,
    startY: 115,
    endX: 538,
    endY: 222,
    cp1X: 605,
    cp1Y: 115,
    cp2X: 565,
    cp2Y: 215,
    isLeft: false
  },
  {
    startX: 690,
    startY: 205,
    endX: 542,
    endY: 242,
    cp1X: 625,
    cp1Y: 205,
    cp2X: 575,
    cp2Y: 236,
    isLeft: false
  },
  {
    startX: 690,
    startY: 295,
    endX: 542,
    endY: 258,
    cp1X: 625,
    cp1Y: 295,
    cp2X: 575,
    cp2Y: 264,
    isLeft: false
  },
  {
    startX: 665,
    startY: 385,
    endX: 538,
    endY: 278,
    cp1X: 605,
    cp1Y: 385,
    cp2X: 565,
    cp2Y: 285,
    isLeft: false
  }
];

export const CareFlowPlatformNetwork = ({
  clinics = [],
  platformStats = null,
  selectedFacility = null,
  onFacilityClick = null,
  hoveredFacility = null,
  onFacilityHover = null,
  className = ''
}) => {
  const containerRef = useRef(null);
  const clinicRefs = useRef({});

  const [hoveredClinic, setHoveredClinic] = useState(null);
  const [selectedClinicId, setSelectedClinicId] = useState(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [fetchedData, setFetchedData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [tooltipState, setTooltipState] = useState({
    visible: false,
    clinic: null,
    x: 0,
    y: 0,
    placement: 'bottom'
  });

  const navigate = useNavigate();

  // Initial staged reveal sequence
  useEffect(() => {
    const timer = setTimeout(() => setIsLoaded(true), 60);
    return () => clearTimeout(timer);
  }, []);

  // Fetch real data from backend if initial clinics prop is missing/empty
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await getRegionalPerformanceApi({ timeframe: 'ALL' });
      if (res?.data) {
        setFetchedData(res.data);
      }
    } catch (err) {
      console.error('Failed to load platform network performance:', err);
      setError(err?.message || 'Failed to load network telemetry data');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if ((!clinics || clinics.length === 0) && !fetchedData && !loading) {
      loadData();
    }
  }, [clinics, fetchedData, loading, loadData]);

  // Keyboard shortcut: ESC clears selection
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedClinicId(null);
        if (onFacilityClick) onFacilityClick(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onFacilityClick]);

  // Determine active dataset: fetched dynamic data takes precedence, then incoming props
  const activeClinicsList = useMemo(() => {
    if (fetchedData?.clinics && fetchedData.clinics.length > 0) {
      return fetchedData.clinics;
    }
    if (clinics && clinics.length > 0) {
      return clinics;
    }
    return [];
  }, [fetchedData, clinics]);

  const activePlatformInfo = useMemo(() => {
    if (fetchedData?.platform) {
      return fetchedData.platform;
    }
    return platformStats;
  }, [fetchedData, platformStats]);

  const matchesFacility = (targetFacility, clinic) => {
    if (!targetFacility || !clinic) return false;
    const t = (typeof targetFacility === 'string' ? targetFacility : targetFacility.name || '').toLowerCase().trim();
    const cName = (clinic.name || '').toLowerCase().trim();
    const sName = (clinic.shortName || '').toLowerCase().trim();
    const cId = String(clinic.clinicId || clinic._id || '');
    return t === cName || t === sName || t === cId || cName.includes(t) || t.includes(cName);
  };

  // Map real database clinics into the 8 symmetrical layout slots
  const mappedClinics = useMemo(() => {
    if (!activeClinicsList || activeClinicsList.length === 0) {
      return [];
    }

    return CLINIC_LAYOUT_SPECS.map((spec, i) => {
      const c = activeClinicsList[i];
      if (!c) return null;

      const clinicId = c.clinicId || c._id || `clinic-slot-${i}`;
      const color = c.color || CLINIC_PALETTE[i % CLINIC_PALETTE.length];
      const pulseDur = (2.4 + (i % 4) * 0.25).toFixed(2);
      const pathD = `M ${spec.startX} ${spec.startY} C ${spec.cp1X} ${spec.cp1Y}, ${spec.cp2X} ${spec.cp2Y}, ${spec.endX} ${spec.endY}`;

      const totalAppointments = c.totalAppointments ?? c.appointmentCount ?? 0;
      const completedAppointments = c.completedAppointments ?? c.completedCount ?? 0;
      const cancelledAppointments = c.cancelledAppointments ?? c.cancelledCount ?? 0;
      const doctorCount = c.doctorCount ?? 0;
      const patientCount = c.patientCount ?? 0;

      const totalResolved = completedAppointments + cancelledAppointments;
      const calculatedRate = totalResolved > 0
        ? Number(((completedAppointments / totalResolved) * 100).toFixed(1))
        : (totalAppointments > 0 ? Number(((completedAppointments / totalAppointments) * 100).toFixed(1)) : 0);

      const overallSuccessRate = c.overallSuccessRate ?? c.completionRate ?? calculatedRate;

      return {
        ...c,
        clinicIndex: i,
        clinicId,
        isLeft: spec.isLeft,
        name: c.name || `Clinic ${i + 1}`,
        shortName: c.shortName || c.name || `Clinic ${i + 1}`,
        color,
        spec,
        pathD,
        pulseDur: `${pulseDur}s`,
        totalAppointments,
        completedAppointments,
        cancelledAppointments,
        overallSuccessRate: Number(overallSuccessRate).toFixed(1),
        doctorCount,
        patientCount
      };
    }).filter(Boolean);
  }, [activeClinicsList]);

  // Network-level KPIs derived directly from real database metrics
  const totalApptsCount = useMemo(() => {
    if (activePlatformInfo?.totalAppointments !== undefined && activePlatformInfo?.totalAppointments !== null) {
      return activePlatformInfo.totalAppointments;
    }
    return mappedClinics.reduce((acc, c) => acc + (c.totalAppointments || 0), 0);
  }, [activePlatformInfo, mappedClinics]);

  const avgSuccessRate = useMemo(() => {
    if (activePlatformInfo?.overallSuccessRate !== undefined && activePlatformInfo?.overallSuccessRate !== null) {
      return Number(activePlatformInfo.overallSuccessRate).toFixed(1);
    }
    if (activePlatformInfo?.completionRate !== undefined && activePlatformInfo?.completionRate !== null) {
      return Number(activePlatformInfo.completionRate).toFixed(1);
    }
    const totalComp = mappedClinics.reduce((acc, c) => acc + (c.completedAppointments || 0), 0);
    const totalResolved = mappedClinics.reduce((acc, c) => acc + (c.completedAppointments || 0) + (c.cancelledAppointments || 0), 0);
    if (totalResolved > 0) {
      return Number(((totalComp / totalResolved) * 100).toFixed(1));
    }
    if (totalApptsCount > 0) {
      return Number(((totalComp / totalApptsCount) * 100).toFixed(1));
    }
    return '0.0';
  }, [activePlatformInfo, mappedClinics, totalApptsCount]);

  // Real growth metrics: ONLY displayed when a valid comparison exists from backend data
  const growthData = useMemo(() => {
    const apptGrowth = activePlatformInfo?.appointmentGrowth;
    const rateDelta = activePlatformInfo?.rateDelta;

    return {
      hasApptGrowth: apptGrowth !== null && apptGrowth !== undefined && !isNaN(apptGrowth),
      apptGrowthText: apptGrowth !== null && apptGrowth !== undefined && !isNaN(apptGrowth)
        ? `${apptGrowth >= 0 ? '↑' : '↓'} ${Math.abs(apptGrowth)}%`
        : null,
      isApptGrowthPositive: apptGrowth >= 0,

      hasRateDelta: rateDelta !== null && rateDelta !== undefined && !isNaN(rateDelta),
      rateDeltaText: rateDelta !== null && rateDelta !== undefined && !isNaN(rateDelta)
        ? `${rateDelta >= 0 ? '↑' : '↓'} ${Math.abs(rateDelta)}pp`
        : null,
      isRateDeltaPositive: rateDelta >= 0
    };
  }, [activePlatformInfo]);

  // Dynamic collision-free tooltip placement based on getBoundingClientRect()
  const updateTooltipPosition = useCallback((clinic) => {
    if (!clinic || !containerRef.current) {
      setTooltipState((prev) => ({ ...prev, visible: false, clinic: null }));
      return;
    }

    const cId = String(clinic.clinicId || clinic._id || '');
    let nodeEl = clinicRefs.current[cId] || clinicRefs.current[clinic.clinicId];
    if (!nodeEl && containerRef.current) {
      nodeEl = containerRef.current.querySelector(`[data-clinic-id="${cId}"]`);
    }
    if (!nodeEl || !containerRef.current) return;

    const containerRect = containerRef.current.getBoundingClientRect();
    const nodeRect = nodeEl.getBoundingClientRect();
    const tooltipWidth = 232;
    const tooltipHeight = 208;

    const nodeLeft = nodeRect.left - containerRect.left;
    const nodeRight = nodeRect.right - containerRect.left;
    const nodeTop = nodeRect.top - containerRect.top;
    const nodeBottom = nodeRect.bottom - containerRect.top;
    const nodeCenterY = (nodeTop + nodeBottom) / 2;
    const containerCenterY = containerRect.height / 2;

    let y = 0;
    let placement = 'bottom';

    // Dynamic space detection:
    // If the node center is below container center, more vertical space exists ABOVE the clinic.
    // Place tooltip above the node to avoid cutting off at the bottom or overlapping lower nodes.
    // If the node center is above container center, more vertical space exists BELOW the clinic.
    if (nodeCenterY > containerCenterY) {
      y = nodeTop - tooltipHeight - 8;
      placement = 'top';
    } else {
      y = nodeBottom + 8;
      placement = 'bottom';
    }

    // Strictly clamp within container vertical viewport bounds
    y = Math.max(10, Math.min(y, containerRect.height - tooltipHeight - 10));

    // Horizontal placement:
    // Left-side clinics: align near left edge of node
    // Right-side clinics: align near right edge of node
    let x = 0;
    if (clinic.isLeft) {
      x = Math.max(12, Math.min(nodeLeft, containerRect.width - tooltipWidth - 12));
    } else {
      x = Math.min(containerRect.width - tooltipWidth - 12, Math.max(12, nodeRight - tooltipWidth));
    }

    setTooltipState({
      visible: true,
      clinic,
      x,
      y,
      placement
    });
  }, []);

  // Recalculate tooltip position on window resize
  useEffect(() => {
    const handleResize = () => {
      if (tooltipState.clinic) {
        updateTooltipPosition(tooltipState.clinic);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [tooltipState.clinic, updateTooltipPosition]);

  const handleClinicHoverStart = (clinic) => {
    setHoveredClinic(clinic);
    updateTooltipPosition(clinic);
    if (onFacilityHover) {
      onFacilityHover(clinic.name);
    }
  };

  const handleClinicHoverEnd = () => {
    setHoveredClinic(null);
    setTooltipState((prev) => ({ ...prev, visible: false, clinic: null }));
    if (onFacilityHover) {
      onFacilityHover(null);
    }
  };

  const handleClinicClick = (clinic) => {
    const targetId = clinic.clinicId || clinic._id;
    if (selectedClinicId === targetId) {
      setSelectedClinicId(null);
      if (onFacilityClick) onFacilityClick(null);
      return;
    }

    setSelectedClinicId(targetId);

    if (targetId) {
      navigate(`/super-admin/organizations/${targetId}`);
    } else if (onFacilityClick) {
      onFacilityClick(clinic.name);
    }
  };

  const handleHubClick = () => {
    setSelectedClinicId(null);
    if (onFacilityClick) {
      onFacilityClick(null);
    }
  };

  return (
    <div className={`p-2.5 sm:p-3 rounded-2xl bg-white border border-slate-200/80 shadow-xs flex flex-col font-sans relative isolate overflow-hidden ${className}`}>
      {/* 1. Card Header: Title & Clean Live Indicator */}
      <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-slate-100">
        {/* Left: Icon & Title */}
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100/60 shadow-xs">
            <Activity className="w-3.5 h-3.5 text-blue-600 stroke-[2.4]" />
          </div>
          <div>
            <h2 className="text-sm sm:text-base font-semibold text-slate-900 tracking-tight">
              CareFlow Platform Network
            </h2>
          </div>
        </div>

        {/* Right: Clean Live Status Pill */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200/70 text-xs font-semibold select-none">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>Live</span>
          </div>
        </div>
      </div>

      {/* 2. Hero Visual Surface */}
      <div
        ref={containerRef}
        className="relative w-full h-[360px] sm:h-[385px] rounded-2xl mt-1.5 flex items-center justify-center border border-slate-100/80 select-none overflow-hidden"
      >
        {/* Soft atmospheric gradient background */}
        <div className="absolute inset-0 rounded-2xl overflow-hidden bg-radial from-[#FAFCFF] via-[#F3F7FD]/80 to-[#EDF4FD]/60 pointer-events-none" />

        {/* Loading state indicator */}
        {loading && mappedClinics.length === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/70 backdrop-blur-xs rounded-2xl">
            <div className="flex flex-col items-center gap-2">
              <RefreshCw className="w-6 h-6 text-blue-600 animate-spin" />
              <span className="text-xs font-semibold text-slate-600">Connecting to platform network...</span>
            </div>
          </div>
        )}

        {/* Error state */}
        {error && mappedClinics.length === 0 && (
          <div className="absolute inset-0 z-30 flex items-center justify-center bg-white/90 backdrop-blur-xs rounded-2xl p-4">
            <div className="flex flex-col items-center gap-2 max-w-xs text-center">
              <AlertCircle className="w-6 h-6 text-rose-500" />
              <p className="text-xs font-semibold text-slate-700">{error}</p>
              <button
                type="button"
                onClick={loadData}
                className="mt-1 px-3 py-1 text-xs font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-lg shadow-xs cursor-pointer"
              >
                Retry Connection
              </button>
            </div>
          </div>
        )}

        {/* Top-Left Badge: Connected Clinics Count */}
        <div className="absolute top-3.5 left-4 z-20 flex items-center gap-2">
          <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 relative flex items-center justify-center">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping absolute" style={{ animationDuration: '2.5s' }} />
          </div>
          <div>
            <div className="text-xs font-bold text-slate-900">
              {mappedClinics.length > 0 ? `${mappedClinics.length} Clinics Connected` : 'Network Connected'}
            </div>
            <div className="text-[10px] text-slate-500 font-medium">
              Real-time clinical data flow
            </div>
          </div>
        </div>

        {/* Top-Right Floating KPI Cards (Calculated directly from real database metrics) */}
        <div className="absolute top-3 right-4 z-20 flex items-center gap-2">
          {/* Total Appointments Card */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs border border-slate-200/80 shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
              <Activity className="w-4 h-4 text-blue-600 stroke-[2.4]" />
            </div>
            <div>
              <div className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                {totalApptsCount.toLocaleString()}
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                <span>Total Appointments</span>
                {growthData.hasApptGrowth && (
                  <span className={`font-bold inline-flex items-center ${growthData.isApptGrowthPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {growthData.apptGrowthText}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Average Success Rate Card */}
          <div className="flex items-center gap-2.5 px-3 py-1.5 rounded-xl bg-white/95 backdrop-blur-xs border border-slate-200/80 shadow-xs">
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 stroke-[2.4]" />
            </div>
            <div>
              <div className="text-xs sm:text-[13px] font-bold text-slate-900 leading-tight">
                {avgSuccessRate}%
              </div>
              <div className="flex items-center gap-1.5 text-[10px] text-slate-500 font-medium whitespace-nowrap mt-0.5">
                <span>Average Success Rate</span>
                {growthData.hasRateDelta && (
                  <span className={`font-bold inline-flex items-center ${growthData.isRateDeltaPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {growthData.rateDeltaText}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* 3. SVG Network Arteries Layer (Directly terminating at the Center Node boundary) */}
        <svg
          viewBox="0 0 1000 500"
          className="w-full h-full absolute inset-0 z-10 pointer-events-none"
          preserveAspectRatio="none"
        >
          <defs>
            <filter id="particleGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur in="SourceGraphic" stdDeviation="2.2" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>

          {/* 8 Curved Arteries with Moving Data Flow Particles */}
          {mappedClinics.map((clinic, idx) => {
            const isHovered = hoveredClinic?.clinicId === clinic.clinicId || matchesFacility(hoveredFacility, clinic);
            const isSelected = selectedClinicId === clinic.clinicId || matchesFacility(selectedFacility, clinic);
            const isDimmed = (hoveredClinic && !isHovered) || (hoveredFacility && !isHovered && !isSelected);

            return (
              <g
                key={clinic.clinicId}
                className="transition-opacity duration-300"
                style={{ opacity: isDimmed ? 0.25 : 1 }}
              >
                {/* Wider invisible hit-area path for line hovering/clicking */}
                <path
                  d={clinic.pathD}
                  fill="none"
                  stroke="transparent"
                  strokeWidth="22"
                  className="pointer-events-stroke cursor-pointer"
                  onMouseEnter={() => handleClinicHoverStart(clinic)}
                  onMouseLeave={handleClinicHoverEnd}
                  onClick={() => handleClinicClick(clinic)}
                />

                {/* 1. Background Soft Halo Path */}
                <path
                  d={clinic.pathD}
                  fill="none"
                  stroke={clinic.color}
                  strokeWidth={isHovered || isSelected ? 4.5 : 2.5}
                  strokeOpacity={isHovered || isSelected ? 0.4 : 0.16}
                  strokeLinecap="round"
                />

                {/* 2. Primary Flow Artery */}
                <motion.path
                  initial={{ pathLength: 0, opacity: 0 }}
                  animate={{
                    pathLength: isLoaded ? 1 : 0,
                    opacity: isLoaded ? (isHovered || isSelected ? 0.95 : 0.75) : 0
                  }}
                  transition={{ delay: 0.2 + idx * 0.04, duration: 0.55 }}
                  id={`artery-${clinic.clinicIndex}`}
                  d={clinic.pathD}
                  fill="none"
                  stroke={clinic.color}
                  strokeWidth={isHovered || isSelected ? 2.8 : 1.8}
                  strokeLinecap="round"
                />

                {/* 3. Starting Anchor Glow Dot at Clinic Icon */}
                <circle
                  cx={clinic.spec.startX}
                  cy={clinic.spec.startY}
                  r={isHovered || isSelected ? 4.2 : 3}
                  fill={clinic.color}
                  filter="url(#particleGlow)"
                />

                {/* 4. Terminating Anchor Glow Dot on Center Circle Rim */}
                <circle
                  cx={clinic.spec.endX}
                  cy={clinic.spec.endY}
                  r={isHovered || isSelected ? 4.2 : 3}
                  fill={clinic.color}
                  filter="url(#particleGlow)"
                />

                {/* 5. Primary Data Particle flowing strictly CLINIC ──✦──→ CAREFLOW HUB */}
                <circle
                  r={isHovered || isSelected ? 4.5 : 3.4}
                  fill={clinic.color}
                  filter="url(#particleGlow)"
                >
                  <animateMotion
                    path={clinic.pathD}
                    dur={clinic.pulseDur}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                  />
                </circle>

                {/* 6. Secondary Pulse Core along the same artery */}
                <circle r="1.8" fill="#FFFFFF">
                  <animateMotion
                    path={clinic.pathD}
                    dur={clinic.pulseDur}
                    begin={`-${parseFloat(clinic.pulseDur) * 0.5}s`}
                    repeatCount="indefinite"
                    keyPoints="0;1"
                    keyTimes="0;1"
                  />
                </circle>
              </g>
            );
          })}
        </svg>

        {/* 4. Single Elegant Center CareFlow Node (~78-80px circular hub, no heart icon, no large text) */}
        <div
          className="absolute z-20 -translate-x-1/2 -translate-y-1/2 pointer-events-auto"
          style={{ left: '50%', top: '50%' }}
        >
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{
              scale: isLoaded ? [1, 1.02, 1] : 0.8,
              opacity: isLoaded ? 1 : 0
            }}
            transition={{
              scale: { duration: 3.2, repeat: Infinity, ease: 'easeInOut' },
              opacity: { duration: 0.45 }
            }}
            onClick={handleHubClick}
            className="relative flex items-center justify-center cursor-pointer select-none group"
            title="CareFlow Platform Hub"
          >
            {/* Subtle blue glow halo */}
            <div className="absolute -inset-2.5 rounded-full bg-blue-500/15 blur-md pointer-events-none transition-all duration-300 group-hover:bg-blue-500/25 group-hover:scale-105" />

            {/* Clean 80px circular disc with CareFlow Activity logo */}
            <div className="relative w-20 h-20 rounded-full bg-white border-2 border-blue-200/90 shadow-[0_4px_24px_rgba(37,99,235,0.18)] flex items-center justify-center transition-transform duration-300 group-hover:scale-105">
              <Activity className="w-10 h-10 text-blue-600 stroke-[2.8]" />
            </div>
          </motion.div>
        </div>

        {/* 5. Connected Clinic Nodes: Logo is always visually closer to the connection endpoint */}
        {mappedClinics.map((clinic, idx) => {
          const isHovered = hoveredClinic?.clinicId === clinic.clinicId || matchesFacility(hoveredFacility, clinic);
          const isSelected = selectedClinicId === clinic.clinicId || matchesFacility(selectedFacility, clinic);
          const isDimmed = (hoveredClinic && !isHovered) || (hoveredFacility && !isHovered && !isSelected);

          const appts = clinic.totalAppointments;
          const rate = clinic.overallSuccessRate;

          return (
            <div
              key={clinic.clinicId}
              ref={(el) => {
                if (el) clinicRefs.current[clinic.clinicId] = el;
              }}
              data-clinic-id={clinic.clinicId}
              className={`absolute z-20 pointer-events-auto -translate-y-1/2 ${
                clinic.isLeft ? '-translate-x-full pr-1' : 'pl-1'
              }`}
              style={{
                left: `${(clinic.spec.startX / 1000) * 100}%`,
                top: `${(clinic.spec.startY / 500) * 100}%`
              }}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.85 }}
                animate={{ opacity: isLoaded ? 1 : 0, scale: isLoaded ? 1 : 0.85 }}
                transition={{ delay: 0.12 + idx * 0.05, duration: 0.35 }}
                onClick={() => handleClinicClick(clinic)}
                onMouseEnter={() => handleClinicHoverStart(clinic)}
                onMouseLeave={handleClinicHoverEnd}
                className="relative flex items-center cursor-pointer transition-all duration-200 select-none group"
                style={{ opacity: isDimmed ? 0.28 : 1 }}
              >
                {clinic.isLeft ? (
                  /* LEFT CLINIC: [Text: Name, Appts • Rate] [Clinic Logo (closer to connection)] */
                  <div className="flex items-center gap-2.5">
                    <div className="text-right select-none pr-1">
                      <div
                        className="text-xs sm:text-[13px] font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors truncate max-w-[155px]"
                        title={clinic.name}
                      >
                        {clinic.shortName || clinic.name}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 whitespace-nowrap mt-0.5">
                        {appts > 0 ? (
                          <>
                            <span>{appts.toLocaleString()} appts</span>
                            <span className="mx-1 text-slate-300">•</span>
                            <span className="font-semibold text-slate-700">{rate}% success</span>
                          </>
                        ) : (
                          <span className="text-slate-400">No appointment data</span>
                        )}
                      </div>
                    </div>

                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white transition-all duration-200 ${
                        isHovered || isSelected ? 'scale-110 shadow-lg ring-2 ring-blue-400/50' : 'shadow-xs'
                      }`}
                      style={{
                        backgroundColor: clinic.color,
                        boxShadow: `0 3px 12px ${clinic.color}45`
                      }}
                    >
                      <Building2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white stroke-[2.2]" />
                    </div>
                  </div>
                ) : (
                  /* RIGHT CLINIC: [Clinic Logo (closer to connection)] [Text: Name, Appts • Rate] */
                  <div className="flex items-center gap-2.5">
                    <div
                      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white transition-all duration-200 ${
                        isHovered || isSelected ? 'scale-110 shadow-lg ring-2 ring-blue-400/50' : 'shadow-xs'
                      }`}
                      style={{
                        backgroundColor: clinic.color,
                        boxShadow: `0 3px 12px ${clinic.color}45`
                      }}
                    >
                      <Building2 className="w-4 h-4 sm:w-4.5 sm:h-4.5 text-white stroke-[2.2]" />
                    </div>

                    <div className="text-left select-none pl-1">
                      <div
                        className="text-xs sm:text-[13px] font-bold text-slate-800 tracking-tight group-hover:text-blue-600 transition-colors truncate max-w-[155px]"
                        title={clinic.name}
                      >
                        {clinic.shortName || clinic.name}
                      </div>
                      <div className="text-[10px] sm:text-[11px] font-medium text-slate-500 whitespace-nowrap mt-0.5">
                        {appts > 0 ? (
                          <>
                            <span>{appts.toLocaleString()} appts</span>
                            <span className="mx-1 text-slate-300">•</span>
                            <span className="font-semibold text-slate-700">{rate}% success</span>
                          </>
                        ) : (
                          <span className="text-slate-400">No appointment data</span>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </motion.div>
            </div>
          );
        })}

        {/* 6. Dynamic Viewport-Clamped Tooltip Overlay (Never clips, never extends beyond container) */}
        <AnimatePresence>
          {tooltipState.visible && tooltipState.clinic && (
            <motion.div
              initial={{
                opacity: 0,
                scale: 0.96,
                y: tooltipState.placement === 'top' ? 4 : -4
              }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.96 }}
              transition={{ duration: 0.12 }}
              style={{
                position: 'absolute',
                left: tooltipState.x,
                top: tooltipState.y,
                width: 232,
                zIndex: 50,
                pointerEvents: 'none'
              }}
              className="bg-slate-900 text-white rounded-xl shadow-2xl p-3 border border-slate-800 text-left"
            >
              <div className="text-xs font-bold text-white border-b border-slate-800 pb-1.5 mb-2 flex items-center gap-1.5">
                <span
                  className="w-2.5 h-2.5 rounded-full shrink-0"
                  style={{ backgroundColor: tooltipState.clinic.color }}
                />
                <span className="truncate">{tooltipState.clinic.name}</span>
              </div>

              <div className="space-y-1 text-[11px]">
                <div className="flex justify-between">
                  <span className="text-slate-400">Total Appointments:</span>
                  <span className="font-bold text-white">
                    {tooltipState.clinic.totalAppointments > 0
                      ? tooltipState.clinic.totalAppointments.toLocaleString()
                      : '0'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Completed:</span>
                  <span className="font-bold text-emerald-400">
                    {tooltipState.clinic.completedAppointments.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Cancelled:</span>
                  <span className="font-bold text-rose-400">
                    {tooltipState.clinic.cancelledAppointments.toLocaleString()}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Success Rate:</span>
                  <span className="font-bold text-blue-400">
                    {tooltipState.clinic.overallSuccessRate}%
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Active Clinicians:</span>
                  <span className="font-bold text-white">
                    {tooltipState.clinic.doctorCount}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400">Patient Reach:</span>
                  <span className="font-bold text-white">
                    {tooltipState.clinic.patientCount}
                  </span>
                </div>
              </div>

              <div className="text-[10px] text-blue-300 mt-2.5 pt-1.5 border-t border-slate-800 font-medium flex items-center justify-between">
                <span>Click to view clinic details</span>
                <ArrowUpRight className="w-3 h-3 text-blue-300" />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Bottom Tagline Watermark */}
        <div className="absolute bottom-2.5 inset-x-0 text-center z-10 select-none pointer-events-none">
          <div className="text-[10px] sm:text-[11px] font-medium text-slate-400 tracking-wide">
            Patients &nbsp;•&nbsp; Providers &nbsp;•&nbsp; Better Healthcare
          </div>
        </div>
      </div>
    </div>
  );
};

export default CareFlowPlatformNetwork;
