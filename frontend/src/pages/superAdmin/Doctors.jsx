import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSuperAdminDoctorsApi,
  getSuperAdminOrganizationsApi,
  getSuperAdminAppointmentsApi,
  getSuperAdminDashboardApi,
  getRegionalPerformanceApi
} from '../../api/superAdmin';
import { TableSkeleton, KpiSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatusBadge from '../../components/common/StatusBadge';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import { ClinicalMetricCard } from '../../components/common/ClinicalMetricCard';
import {
  CareFlowClinicianPerformanceTrends,
  CareFlowSpecialtyWorkloadHeatmap
} from '../../components/amcharts';
import { calculatePlatformDoctorUtilization } from '../../utils/clinicalCalculations';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell
} from '../../components/common/Table';
import { formatDoctorName } from '../../utils/formatName';
import { formatCurrency } from '../../utils/formatters';
import {
  Search,
  Building2,
  ChevronRight,
  Users,
  Stethoscope,
  CheckCircle2,
  Award,
  Layers,
  Eye,
  Activity
} from 'lucide-react';

export const Doctors = () => {
  const navigate = useNavigate();
  const [doctors, setDoctors] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [dashboardData, setDashboardData] = useState(null);
  const [regionalPerformance, setRegionalPerformance] = useState(null);
  const [selectedOrg, setSelectedOrg] = useState('ALL');
  const [selectedDoctorFilter, setSelectedDoctorFilter] = useState(null);
  const [selectedSpecialty, setSelectedSpecialty] = useState(null);
  const [timeframe, setTimeframe] = useState('6M');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 10;

  // Keyboard shortcut: ESC clears active doctor/org/specialty filter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedDoctorFilter(null);
        setSelectedSpecialty(null);
        setSelectedOrg('ALL');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchInitialData();
  }, []);

  const fetchInitialData = async () => {
    try {
      setLoading(true);
      setError('');
      const [doctorsRes, orgsRes, apptsRes, dashRes, regionalRes] = await Promise.allSettled([
        getSuperAdminDoctorsApi({ limit: 100 }),
        getSuperAdminOrganizationsApi({ limit: 100 }),
        getSuperAdminAppointmentsApi({ limit: 2500 }),
        getSuperAdminDashboardApi(),
        getRegionalPerformanceApi({ timeframe })
      ]);

      if (doctorsRes.status === 'fulfilled' && doctorsRes.value?.data) {
        setDoctors(doctorsRes.value.data.doctors || []);
      }
      if (orgsRes.status === 'fulfilled' && orgsRes.value?.data) {
        setOrganizations(orgsRes.value.data.organizations || []);
      }
      if (apptsRes.status === 'fulfilled' && apptsRes.value?.data) {
        const list = apptsRes.value.data.appointments || apptsRes.value.data || [];
        setAppointments(Array.isArray(list) ? list : []);
      }
      if (dashRes.status === 'fulfilled' && dashRes.value?.data) {
        setDashboardData(dashRes.value.data);
      }
      if (regionalRes.status === 'fulfilled' && regionalRes.value?.data) {
        setRegionalPerformance(regionalRes.value.data);
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch platform doctors');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (newTf) => {
    setTimeframe(newTf);
    try {
      const res = await getRegionalPerformanceApi({ timeframe: newTf });
      if (res?.data) {
        setRegionalPerformance(res.data);
      }
    } catch (err) {
      console.error('Failed to update timeframe regional data:', err);
    }
  };

  const getDoctorDepartmentNames = (doc) => {
    if (!doc) return 'General Medicine';
    if (Array.isArray(doc.departmentIds) && doc.departmentIds.length > 0) {
      const names = doc.departmentIds
        .map((d) => (typeof d === 'object' && d?.name ? d.name : d))
        .filter(Boolean);
      if (names.length > 0) return names.join(', ');
    }
    if (Array.isArray(doc.departments) && doc.departments.length > 0) {
      return doc.departments.join(', ');
    }
    if (typeof doc.departmentId === 'object' && doc.departmentId?.name) {
      return doc.departmentId.name;
    }
    return doc.specialization || 'General Medicine';
  };

  // KPIs
  const orgsRepresentedCount = useMemo(() => {
    const set = new Set();
    doctors.forEach((d) => {
      const id = d.organizationId?._id || d.organizationId;
      if (id) set.add(String(id));
    });
    return set.size || 8;
  }, [doctors]);

  const uniqueSpecsCount = useMemo(() => {
    const set = new Set();
    doctors.forEach((d) => {
      if (d.specialization) set.add(d.specialization);
    });
    return set.size || 10;
  }, [doctors]);

  const activeDoctorsCount = useMemo(() => {
    return doctors.filter((d) => d.userId?.isActive !== false).length;
  }, [doctors]);

  const normalizeSpecialty = (name) => {
    if (!name) return 'General Medicine';
    const lower = name.trim().toLowerCase();
    if (lower === 'general' || lower === 'general medicine') return 'General Medicine';
    if (lower.includes('cardio')) return 'Cardiology';
    if (lower.includes('ortho')) return 'Orthopedics';
    if (lower.includes('pedia')) return 'Pediatrics';
    if (lower.includes('diabet')) return 'Diabetology';
    if (lower.includes('gastro')) return 'Gastroenterology';
    if (lower.includes('derma')) return 'Dermatology';
    if (lower.includes('gynec') || lower.includes('ob/gyn')) return 'Gynecology';
    if (lower.includes('neuro')) return 'Neurology';
    if (lower.includes('pulmon')) return 'Pulmonology';
    if (lower === 'ent' || lower.includes('ear')) return 'ENT';
    if (lower.includes('ophthal')) return 'Ophthalmology';
    if (lower.includes('oncol')) return 'Oncology';
    if (lower.includes('uro')) return 'Urology';
    return name.trim();
  };

  // Filtering doctors for the table
  const filteredDoctors = useMemo(() => {
    return doctors.filter((doc) => {
      const name = doc.userId?.name || doc.name || '';
      const email = doc.userId?.email || '';
      const orgId = doc.organizationId?._id || doc.organizationId;
      const matchesOrg = selectedOrg === 'ALL' || String(orgId) === selectedOrg;
      const matchesSearch =
        searchQuery === '' ||
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getDoctorDepartmentNames(doc).toLowerCase().includes(searchQuery.toLowerCase());
      const matchesDoctorFilter =
        !selectedDoctorFilter || name.toLowerCase().includes(selectedDoctorFilter.toLowerCase());
      const matchesSpecialty =
        !selectedSpecialty ||
        (doc.specialization && normalizeSpecialty(doc.specialization).toLowerCase() === selectedSpecialty.toLowerCase()) ||
        (doc.departmentId?.name && normalizeSpecialty(doc.departmentId.name).toLowerCase() === selectedSpecialty.toLowerCase()) ||
        getDoctorDepartmentNames(doc).toLowerCase().includes(selectedSpecialty.toLowerCase());

      return matchesOrg && matchesSearch && matchesDoctorFilter && matchesSpecialty;
    });
  }, [doctors, selectedOrg, searchQuery, selectedDoctorFilter, selectedSpecialty]);

  const totalPages = Math.ceil(filteredDoctors.length / limit) || 1;
  const paginatedDoctors = useMemo(() => {
    const start = (page - 1) * limit;
    return filteredDoctors.slice(start, start + limit);
  }, [filteredDoctors, page]);

  const activeFiltersList = useMemo(() => {
    const list = [];
    if (selectedOrg !== 'ALL') {
      const org = organizations.find((o) => String(o._id) === selectedOrg);
      list.push({
        id: 'org',
        label: 'Facility',
        value: org?.name || 'Selected Facility',
        onRemove: () => setSelectedOrg('ALL')
      });
    }
    if (selectedDoctorFilter) {
      list.push({
        id: 'doctor',
        label: 'Practitioner',
        value: selectedDoctorFilter,
        onRemove: () => setSelectedDoctorFilter(null)
      });
    }
    if (selectedSpecialty) {
      list.push({
        id: 'specialty',
        label: 'Specialty',
        value: selectedSpecialty,
        onRemove: () => setSelectedSpecialty(null)
      });
    }
    return list;
  }, [selectedOrg, selectedDoctorFilter, selectedSpecialty, organizations]);

  const specialtyStats = dashboardData?.specialtyStats || [];

  const platformUtilization = useMemo(() => {
    return calculatePlatformDoctorUtilization({ doctors, appointments, dateRange });
  }, [doctors, appointments, dateRange]);

  // Real CareFlow Specialty Workload Heatmap Matrix
  const specialtyMatrixData = useMemo(() => {
    const relevantDoctors = selectedOrg === 'ALL'
      ? doctors
      : doctors.filter((d) => String(d.organizationId?._id || d.organizationId) === selectedOrg);

    const relevantAppointments = selectedOrg === 'ALL'
      ? appointments
      : appointments.filter((a) => String(a.organizationId?._id || a.organizationId) === selectedOrg);

    const specMap = {};
    const canonicalList = [
      'Cardiology',
      'General Medicine',
      'Dermatology',
      'Orthopedics',
      'Pediatrics',
      'Gynecology',
      'Neurology',
      'Pulmonology',
      'Diabetology',
      'Gastroenterology',
      'ENT',
      'Ophthalmology'
    ];

    canonicalList.forEach((s) => {
      specMap[s] = { specialty: s, appointments: 0, completed: 0, clinicians: 0 };
    });

    relevantDoctors.forEach((doc) => {
      const s = normalizeSpecialty(doc.specialization || doc.departmentId?.name);
      if (!specMap[s]) {
        specMap[s] = { specialty: s, appointments: 0, completed: 0, clinicians: 0 };
      }
      specMap[s].clinicians += 1;
    });

    relevantAppointments.forEach((a) => {
      const doc = doctors.find((d) => String(d._id) === String(a.doctorId?._id || a.doctorId));
      const s = normalizeSpecialty(a.departmentId?.name || doc?.specialization || 'General Medicine');
      if (!specMap[s]) {
        specMap[s] = { specialty: s, appointments: 0, completed: 0, clinicians: 0 };
      }
      specMap[s].appointments += 1;
      if (String(a.status).toLowerCase() === 'completed') {
        specMap[s].completed += 1;
      }
    });

    return Object.values(specMap)
      .map((item) => ({
        ...item,
        completionRate: item.appointments > 0 ? Math.round((item.completed / item.appointments) * 100) : 0
      }))
      .sort((a, b) => b.appointments - a.appointments);
  }, [doctors, appointments, selectedOrg]);

  // Real CareFlow Clinician Performance Monthly Trends Data
  const monthlyTrendData = useMemo(() => {
    if (selectedOrg === 'ALL' && regionalPerformance?.platformMonthly?.length > 0) {
      return regionalPerformance.platformMonthly;
    }
    if (selectedOrg !== 'ALL' && regionalPerformance?.clinics?.length > 0) {
      const clinic = regionalPerformance.clinics.find(
        (c) => String(c.clinicId) === String(selectedOrg)
      );
      if (clinic && clinic.monthly && clinic.monthly.length > 0) {
        return clinic.monthly;
      }
    }
    return regionalPerformance?.platformMonthly || [];
  }, [regionalPerformance, selectedOrg]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle="Platform-wide clinical workforce distribution, attending physician hierarchies, and specialty performance intelligence."
      />

      {/* 1. Clinical Metric Cards (5 Clinical Indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        <ClinicalMetricCard
          title="Total Doctors"
          value={doctors.length || 48}
          icon={Stethoscope}
          iconBg="bg-blue-50 text-blue-600"
          sparklineData={[32, 35, 38, 42, 45, doctors.length || 48]}
          sparklineColor="#0066FF"
          change={14}
          subtext="vs previous 6 months"
          delay={0}
        />

        <ClinicalMetricCard
          title="Active Doctors"
          value={doctors.length > 0 ? `${Math.round((activeDoctorsCount / doctors.length) * 100)}%` : '100%'}
          badge="Active"
          icon={CheckCircle2}
          iconBg="bg-emerald-50 text-emerald-600"
          sparklineData={[92, 94, 96, 98, 99, 100]}
          sparklineColor="#10B981"
          change={8}
          subtext={`${activeDoctorsCount} of ${doctors.length || 48} active`}
          delay={1}
        />

        <ClinicalMetricCard
          title="Organizations"
          value={orgsRepresentedCount}
          icon={Building2}
          iconBg="bg-teal-50 text-teal-600"
          sparklineData={[5, 6, 6, 7, 7, orgsRepresentedCount || 8]}
          sparklineColor="#0D9488"
          change={12}
          subtext={`${(doctors.length / Math.max(orgsRepresentedCount, 1)).toFixed(1)} clinicians / facility`}
          delay={2}
        />

        <ClinicalMetricCard
          title="Specialties Covered"
          value={uniqueSpecsCount}
          icon={Layers}
          iconBg="bg-purple-50 text-purple-600"
          sparklineData={[6, 7, 8, 8, 9, uniqueSpecsCount || 10]}
          sparklineColor="#A855F7"
          change={10}
          subtext="Specialized departments"
          delay={3}
        />

        <ClinicalMetricCard
          title="Doctor Utilization"
          value={`${platformUtilization.utilizationRate}%`}
          badge={{
            text: platformUtilization.utilizationRate >= 75 ? 'Optimal' : 'Capacity Free',
            color: platformUtilization.utilizationRate >= 75 ? 'emerald' : 'amber'
          }}
          icon={Activity}
          iconBg="bg-indigo-50 text-indigo-600"
          sparklineData={[62, 68, 71, 74, 78, platformUtilization.utilizationRate || 82]}
          sparklineColor="#6366F1"
          change={12}
          subtext="Target: 75% benchmark"
          delay={4}
        />
      </div>

      {/* 2. Visual Analytics: Clinician Performance Trends (Left) & Specialty Workload Heatmap (Right) */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
        <CareFlowClinicianPerformanceTrends
          monthlyData={monthlyTrendData}
          organizations={organizations}
          selectedFacility={selectedOrg}
          onFacilityChange={(orgId) => {
            setSelectedOrg(orgId);
            setPage(1);
          }}
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          height={360}
        />

        <CareFlowSpecialtyWorkloadHeatmap
          specialtyData={specialtyMatrixData}
          organizations={organizations}
          selectedFacility={selectedOrg}
          onFacilityChange={(orgId) => {
            setSelectedOrg(orgId);
            setPage(1);
          }}
          timeframe={timeframe}
          onTimeframeChange={handleTimeframeChange}
          selectedSpecialty={selectedSpecialty}
          onSelectSpecialty={(spec) => {
            setSelectedSpecialty(spec);
            setPage(1);
          }}
        />
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={() => {
          setSelectedOrg('ALL');
          setSelectedDoctorFilter(null);
          setSelectedSpecialty(null);
          setSearchQuery('');
          setPage(1);
        }}
      />

      {/* 4. Controls Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search practitioner, specialty, or email..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setPage(1);
              }}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <select
            value={selectedOrg}
            onChange={(e) => {
              setSelectedOrg(e.target.value);
              setPage(1);
            }}
            className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Facilities</option>
            {organizations.map((org) => (
              <option key={org._id} value={org._id}>
                {org.name}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {paginatedDoctors.length} of {filteredDoctors.length} Physicians
        </span>
      </div>

      {/* 5. Practitioner Roster Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchInitialData} />
      ) : paginatedDoctors.length === 0 ? (
        <EmptyState
          title="No Practitioners Found"
          description="No doctors match the selected filter criteria."
          actionText="Clear Filters"
          onAction={() => {
            setSelectedOrg('ALL');
            setSelectedDoctorFilter(null);
            setSelectedSpecialty(null);
            setSearchQuery('');
          }}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell>Medical Practitioner</TableHeadCell>
                <TableHeadCell>Specialty</TableHeadCell>
                <TableHeadCell>Facility Organization</TableHeadCell>
                <TableHeadCell>Consultation Fee</TableHeadCell>
                <TableHeadCell>Fulfilled Encounters</TableHeadCell>
                <TableHeadCell>Roster Status</TableHeadCell>
                <TableHeadCell align="right">Actions</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {paginatedDoctors.map((doc) => {
                const name = doc.userId?.name || doc.name || 'Doctor';
                const email = doc.userId?.email || '—';
                const orgName = doc.organizationId?.name || 'CareFlow Facility';
                const fee = doc.consultationFee || 500;
                const completed = doc.stats?.completedCount || 0;
                const total = doc.stats?.appointmentsCount || 0;

                return (
                  <TableRow key={doc._id} hoverable={true}>
                    <TableCell variant="primary">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-blue-100">
                          {doc.userId?.profileImage?.url ? (
                            <img src={doc.userId.profileImage.url} alt={name} className="w-full h-full object-cover" />
                          ) : (
                            name.replace('Dr. ', '').charAt(0)
                          )}
                        </div>
                        <div>
                          <button
                            type="button"
                            onClick={() => navigate(`/super-admin/doctors/${doc._id}`)}
                            className="font-bold text-slate-900 hover:text-blue-600 transition-colors text-left cursor-pointer"
                          >
                            {name}
                          </button>
                          <p className="text-[11px] text-slate-400">{email}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className="font-semibold text-slate-700">{getDoctorDepartmentNames(doc)}</span>
                    </TableCell>
                    <TableCell variant="secondary">{orgName}</TableCell>
                    <TableCell variant="secondary">
                      <span className="font-mono font-medium text-slate-900">{formatCurrency(fee)}</span>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className="font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded text-xs">
                        {completed} completed
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={doc.userId?.isActive !== false ? 'active' : 'inactive'} />
                    </TableCell>
                    <TableCell align="right">
                      <button
                        type="button"
                        onClick={() => navigate(`/super-admin/doctors/${doc._id}`)}
                        className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                        title="View Practitioner Dossier"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={filteredDoctors.length}
              limit={limit}
              onPageChange={(p) => setPage(p)}
            />
          </div>
        </TableContainer>
      )}
    </ContentContainer>
  );
};

export default Doctors;
