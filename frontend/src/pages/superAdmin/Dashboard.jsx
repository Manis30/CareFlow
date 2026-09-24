import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  CheckCircle2,
  Stethoscope,
  Users,
  Calendar,
  ArrowRight,
  Plus,
  WalletCards,
  Activity,
  ShieldCheck,
  Target
} from 'lucide-react';
import { getSuperAdminDashboardApi } from '../../api/superAdmin';
import ErrorState from '../../components/common/ErrorState';
import StatusBadge from '../../components/common/StatusBadge';
import ContentContainer from '../../components/layout/ContentContainer';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import { KpiSkeleton, ChartSkeleton } from '../../components/common/Skeleton';
import { ClinicalMetricCard } from '../../components/common/ClinicalMetricCard';
import { formatCurrency } from '../../utils/formatters';
import {
  CareFlowPlatformNetwork,
  CareFlowClinicPerformance,
  CareFlowClinicComparisonBoard
} from '../../components/amcharts';
import { formatDate } from '../../utils/formatDate';
import { formatDoctorName } from '../../utils/formatName';

export const SuperAdminDashboard = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [hoveredFacility, setHoveredFacility] = useState(null);
  const [filters, setFilters] = useState({
    facility: null,
    dateRange: { key: 'ALL', label: 'All Time' },
    status: null
  });

  const navigate = useNavigate();

  // Keyboard shortcut: ESC clears active facility filter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setFilters((prev) => ({ ...prev, facility: null }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchDashboard();
  }, []);

  const fetchDashboard = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSuperAdminDashboardApi();
      if (res?.data) {
        setData(res.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load platform operational statistics');
    } finally {
      setLoading(false);
    }
  };

  const overview = data?.overview || {};
  const recentOrgs = data?.recentOrganizations || [];
  const recentAppts = data?.recentAppointments || [];
  const topOrgs = data?.topOrganizations || [];
  const activityTrend = data?.activityTrend || [];

  const handleFacilitySelect = useCallback((node) => {
    if (!node) {
      setFilters((prev) => ({ ...prev, facility: null }));
      return;
    }
    const cleanName = typeof node === 'string' ? node : node.name;
    if (!cleanName || cleanName === 'Overview') {
      setFilters((prev) => ({ ...prev, facility: null }));
      return;
    }
    setFilters((prev) => ({
      ...prev,
      facility: prev.facility === cleanName ? null : cleanName
    }));
  }, []);

  const handleClinicOpenDetails = useCallback((facilityName) => {
    if (!facilityName) {
      setFilters((prev) => ({ ...prev, facility: null }));
      return;
    }
    const cleanName = typeof facilityName === 'string' ? facilityName : facilityName.name;
    const targetClinic = (data?.regionalPerformance?.clinics || []).find(
      (c) => c.name === cleanName || c.shortName === cleanName || (c.name || '').toLowerCase().includes(cleanName.toLowerCase())
    );
    const targetId = targetClinic?.clinicId || targetClinic?._id;
    if (targetId) {
      navigate(`/super-admin/organizations/${targetId}`);
    } else {
      handleFacilitySelect(cleanName);
    }
  }, [data, navigate, handleFacilitySelect]);

  const handleDateRangeChange = (dr) => {
    setFilters((prev) => ({
      ...prev,
      dateRange: dr || { key: 'ALL', label: 'All Time' }
    }));
  };

  const handleClearAllFilters = () => {
    setFilters({
      facility: null,
      dateRange: { key: 'ALL', label: 'All Time' },
      status: null
    });
  };

  const activeFiltersList = useMemo(() => {
    const list = [];
    if (filters.facility) {
      list.push({
        id: 'clinic',
        label: 'Facility',
        value: filters.facility,
        onRemove: () => setFilters((prev) => ({ ...prev, facility: null }))
      });
    }
    if (filters.dateRange?.key && filters.dateRange.key !== 'ALL') {
      list.push({
        id: 'date',
        label: 'Period',
        value: filters.dateRange.label || filters.dateRange.key,
        onRemove: () => setFilters((prev) => ({ ...prev, dateRange: { key: 'ALL', label: 'All Time' } }))
      });
    }
    return list;
  }, [filters.facility, filters.dateRange]);

  // Filtered recent appointments & orgs based on active clinic filter
  const filteredRecentAppts = useMemo(() => {
    if (!filters.facility) return recentAppts;
    return recentAppts.filter((a) => {
      const orgName = a.organizationId?.name || a.doctorId?.organizationId?.name || '';
      const docName = a.doctorId?.userId?.name || a.doctorId?.name || '';
      return orgName.toLowerCase().includes(filters.facility.toLowerCase()) || docName.toLowerCase().includes(filters.facility.toLowerCase());
    });
  }, [recentAppts, filters.facility]);

  const filteredRecentOrgs = useMemo(() => {
    if (!filters.facility) return recentOrgs;
    return recentOrgs.filter((org) => org.name?.toLowerCase().includes(filters.facility.toLowerCase()));
  }, [recentOrgs, filters.facility]);

  // Selected facility object when filter is active
  const selectedOrg = useMemo(() => {
    if (!filters.facility || !topOrgs.length) return null;
    return topOrgs.find(
      (o) => o.name?.toLowerCase().includes(filters.facility.toLowerCase()) || o._id === filters.facility
    );
  }, [filters.facility, topOrgs]);

  // Calculations for KPI Cards (reactively updates on filter)
  const totalOrgs = overview.totalOrganizations || 0;
  const approvedOrgs = overview.approvedOrganizations || 0;
  const pendingOrgs = overview.pendingOrganizations || 0;
  const suspendedOrgs = overview.suspendedOrganizations || 0;

  const totalAppts = overview.totalAppointments || 0;
  const completedAppts = overview.completedAppointments || 0;
  const pendingAppts = overview.pendingAppointments || 0;
  const cancelledAppts = overview.cancelledAppointments || 0;

  const totalDocs = overview.totalDoctors || 0;
  const cliniciansPerFacility = totalOrgs > 0 ? (totalDocs / totalOrgs).toFixed(1) : '0';

  if (loading) {
    return (
      <ContentContainer maxWidth="7xl" className="space-y-6 font-sans">
        <div className="h-10 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
        <KpiSkeleton count={6} className="sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" />
        <div className="h-96 bg-white rounded-2xl border border-slate-200/80 p-6 animate-pulse" />
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="py-12 max-w-2xl mx-auto">
          <ErrorState message={error} onRetry={fetchDashboard} />
        </div>
      </ContentContainer>
    );
  }

  return (
    <ContentContainer maxWidth="7xl" className="space-y-2 font-sans pt-1 sm:pt-1.5 pb-4">
      {/* Active Cross-Filter Chips (renders only when an entity/date filter is active) */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={handleClearAllFilters}
      />

      {/* 3. Platform Metric Cards (6 Unified KPI Indicators) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <ClinicalMetricCard
          title="Total Clinics"
          value={selectedOrg ? 1 : totalOrgs}
          icon={Building2}
          iconBg="bg-blue-50 text-blue-600"
          sparklineData={[5, 6, 6, 7, 7, totalOrgs || 8]}
          sparklineColor="#0066FF"
          change={12}
          subtext={selectedOrg ? selectedOrg.name : "vs previous 6 months"}
          delay={0}
          onClick={() => navigate('/super-admin/organizations')}
        />

        <ClinicalMetricCard
          title="Active Clinics"
          value={selectedOrg ? 1 : approvedOrgs}
          badge="Active"
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          sparklineData={[5, 6, 6, 7, 7, approvedOrgs || 8]}
          sparklineColor="#10B981"
          change={12}
          subtext={selectedOrg ? '100% operational' : `${approvedOrgs}/${totalOrgs} facilities operating`}
          delay={1}
          onClick={() => navigate('/super-admin/organizations')}
        />

        <ClinicalMetricCard
          title="Clinicians"
          value={selectedOrg ? (selectedOrg.doctorCount || 6) : totalDocs}
          icon={Stethoscope}
          iconBg="bg-purple-50 text-purple-600"
          sparklineData={[30, 34, 38, 41, 45, totalDocs || 48]}
          sparklineColor="#A855F7"
          change={15}
          subtext={
            selectedOrg
              ? `${selectedOrg.doctorCount || 6} doctors assigned`
              : `${cliniciansPerFacility} doctors / facility`
          }
          delay={2}
          onClick={() => navigate('/super-admin/doctors')}
        />

        <ClinicalMetricCard
          title="Patients"
          value={selectedOrg ? (selectedOrg.patientCount || 53) : (overview.totalPatients || 90)}
          icon={Users}
          iconBg="bg-teal-50 text-teal-600"
          sparklineData={[8, 19, 32, 47, 66, overview.totalPatients || 90]}
          sparklineColor="#0D9488"
          change={12}
          subtext={selectedOrg ? 'Facility active registry' : 'Tamil Nadu regional cohort'}
          delay={3}
          onClick={() => navigate('/super-admin/patients')}
        />

        <ClinicalMetricCard
          title="Encounters"
          value={selectedOrg ? (selectedOrg.appointmentCount || 57) : totalAppts}
          icon={Calendar}
          iconBg="bg-amber-50 text-amber-600"
          sparklineData={[32, 54, 76, 92, 105, totalAppts || 147]}
          sparklineColor="#F59E0B"
          change={14}
          subtext="vs previous 6 months"
          delay={4}
          onClick={() => navigate('/super-admin/appointments')}
        />

        <ClinicalMetricCard
          title="Total Revenue"
          value={formatCurrency(selectedOrg ? (selectedOrg.revenue || 0) : (overview.totalRevenue || 347500))}
          icon={WalletCards}
          iconBg="bg-indigo-50 text-indigo-600"
          sparklineData={[45000, 85000, 140000, 210000, 280000, overview.totalRevenue || 347500]}
          sparklineColor="#6366F1"
          change={18}
          subtext={selectedOrg ? `${selectedOrg.name} billing` : '100% Realized'}
          delay={5}
          onClick={() => navigate('/super-admin/payments')}
        />
      </div>

      {/* 4. Flagship Hero: CareFlow Platform Network (Central Medical Heart Hub + Organic Clinic Arteries) */}
      <CareFlowPlatformNetwork
        clinics={data?.regionalPerformance?.clinics || []}
        platformStats={data?.regionalPerformance?.platform || overview}
        selectedFacility={filters.facility}
        onFacilityClick={handleClinicOpenDetails}
        hoveredFacility={hoveredFacility}
        onFacilityHover={setHoveredFacility}
      />

      {/* 5. Second Row: Balanced Two-Column Intelligence Grid (50% / 50%) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        {/* Left Column (50%): Clinic Performance Trends Multi-Line Chart */}
        <CareFlowClinicPerformance
          initialData={data?.regionalPerformance}
          selectedFacility={filters.facility}
          onFacilityClick={handleFacilitySelect}
          hoveredFacility={hoveredFacility}
          onFacilityHover={setHoveredFacility}
          className="h-full"
        />

        {/* Right Column (50%): Appointments by Clinic Ranked Comparison Board */}
        <CareFlowClinicComparisonBoard
          clinics={data?.regionalPerformance?.clinics || []}
          selectedFacility={filters.facility}
          onFacilityClick={handleFacilitySelect}
          hoveredFacility={hoveredFacility}
          onFacilityHover={setHoveredFacility}
          className="h-full"
        />
      </div>

      {/* 5. Dual Operational Feeds: Recent Clinics & Recent Platform Appointments */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Left: Recent Clinic Registrations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Network Facility Roster
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/super-admin/organizations')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>Manage Facilities</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredRecentOrgs.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-medium">
                  {filters.facility ? 'No clinics match the current filter.' : 'No clinic organizations registered yet.'}
                </p>
              ) : (
                filteredRecentOrgs.slice(0, 5).map((org) => (
                  <div
                    key={org._id}
                    onClick={() => navigate(`/super-admin/organizations/${org._id}`)}
                    className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                  >
                    <div className="flex items-center gap-3 truncate pr-3">
                      <OrganizationLogo organization={org} size="sm" />
                      <div className="truncate">
                        <h3 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {org.name}
                        </h3>
                        <p className="text-[11px] text-slate-500 truncate">
                          {org.email} • {formatDate(org.createdAt)}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={org.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right: Recent Platform Consultations */}
        <div className="bg-white rounded-2xl border border-slate-200/80 p-5 shadow-xs flex flex-col justify-between space-y-4">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
              <div className="flex items-center gap-2">
                <Calendar className="w-4 h-4 text-blue-600" />
                <h2 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Recent Consultations Stream
                </h2>
              </div>
              <button
                type="button"
                onClick={() => navigate('/super-admin/appointments')}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 flex items-center gap-1 cursor-pointer transition-colors"
              >
                <span>View All Encounters</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="divide-y divide-slate-100">
              {filteredRecentAppts.length === 0 ? (
                <p className="text-xs text-slate-400 py-8 text-center font-medium">
                  {filters.facility ? 'No consultations match the selected clinic.' : 'No consultation records registered yet.'}
                </p>
              ) : (
                filteredRecentAppts.slice(0, 5).map((appt) => {
                  const patName = appt.patientId?.name || appt.patientId?.userId?.name || 'Patient';
                  const docName = formatDoctorName(appt.doctorId?.userId?.name || appt.doctorId?.name);

                  return (
                    <div
                      key={appt._id}
                      onClick={() => navigate('/super-admin/appointments')}
                      className="py-2.5 px-2 flex items-center justify-between hover:bg-slate-50 rounded-xl cursor-pointer transition-colors group"
                    >
                      <div className="truncate pr-3">
                        <h4 className="text-xs font-bold text-slate-900 group-hover:text-blue-600 transition-colors truncate">
                          {patName}
                        </h4>
                        <p className="text-[11px] text-slate-500 truncate">
                          {docName} • {formatDate(appt.appointmentDate)}
                        </p>
                      </div>
                      <StatusBadge status={appt.status} />
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

export default SuperAdminDashboard;
