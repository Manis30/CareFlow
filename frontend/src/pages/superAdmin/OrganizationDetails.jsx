import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Building2,
  Mail,
  Phone,
  MapPin,
  Play,
  Stethoscope,
  Calendar,
  Users,
  Clock3,
  ShieldOff,
  ArrowLeft
} from 'lucide-react';
import {
  getSuperAdminOrganizationByIdApi,
  suspendOrganizationApi,
  activateOrganizationApi,
  getSuperAdminDoctorsApi,
  getSuperAdminAppointmentsApi,
  getSuperAdminPatientsApi
} from '../../api/superAdmin';
import { formatAddress } from '../../utils/formatAddress';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import ClinicLocationMap from '../../components/common/ClinicLocationMap';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import { ClinicalMetricCard } from '../../components/common/ClinicalMetricCard';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatOrganizationName } from '../../utils/formatters';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import Swal from 'sweetalert2';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const getHoursFromTimeString = (timeStr) => {
  if (timeStr === null || timeStr === undefined) return null;
  const cleaned = String(timeStr).trim();
  if (!cleaned) return null;

  const ampmMatch = cleaned.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (ampmMatch) {
    let hrs = parseInt(ampmMatch[1], 10);
    const mins = parseInt(ampmMatch[2], 10);
    const ampm = ampmMatch[3].toUpperCase();
    if (ampm === 'PM' && hrs < 12) hrs += 12;
    if (ampm === 'AM' && hrs === 12) hrs = 0;
    return hrs + mins / 60;
  }

  const h24Match = cleaned.match(/^(\d{1,2}):(\d{2})$/);
  if (h24Match) {
    const hrs = parseInt(h24Match[1], 10);
    const mins = parseInt(h24Match[2], 10);
    return hrs + mins / 60;
  }
  return null;
};

const OrganizationDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [org, setOrg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  // Stats Counters
  const [doctorsCount, setDoctorsCount] = useState(0);
  const [appointmentsCount, setAppointmentsCount] = useState(0);
  const [patientsCount, setPatientsCount] = useState(0);
  const [departmentsCount, setDepartmentsCount] = useState(0);

  useEffect(() => {
    fetchOrganization();
  }, [id]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSuperAdminOrganizationByIdApi(id);
      if (res?.data?.organization || res?.data) {
        const orgData = res.data.organization || res.data;
        setOrg(orgData);

        // Fetch associated clinic counts
        try {
          const [docRes, apptRes, patRes] = await Promise.all([
            getSuperAdminDoctorsApi({ organizationId: id, limit: 1 }).catch(() => null),
            getSuperAdminAppointmentsApi({ organizationId: id, limit: 1 }).catch(() => null),
            getSuperAdminPatientsApi({ organizationId: id, limit: 1 }).catch(() => null)
          ]);

          if (docRes?.data?.pagination?.total !== undefined) {
            setDoctorsCount(docRes.data.pagination.total);
          } else if (Array.isArray(docRes?.data?.doctors)) {
            setDoctorsCount(docRes.data.doctors.length);
          }

          if (apptRes?.data?.pagination?.total !== undefined) {
            setAppointmentsCount(apptRes.data.pagination.total);
          } else if (Array.isArray(apptRes?.data?.appointments)) {
            setAppointmentsCount(apptRes.data.appointments.length);
          }

          if (patRes?.data?.pagination?.total !== undefined) {
            setPatientsCount(patRes.data.pagination.total);
          } else if (Array.isArray(patRes?.data?.patients)) {
            setPatientsCount(patRes.data.patients.length);
          }

          if (Array.isArray(orgData.departments)) {
            setDepartmentsCount(orgData.departments.length);
          } else if (Array.isArray(orgData.departmentIds)) {
            setDepartmentsCount(orgData.departmentIds.length);
          }
        } catch (subErr) {
          console.error('Failed to fetch counts:', subErr);
        }
      }
    } catch (err) {
      setError(err.message || 'Failed to load clinic organization details');
    } finally {
      setLoading(false);
    }
  };

  const handleSuspend = async () => {
    const { value: reason, isConfirmed } = await Swal.fire({
      title: 'Suspend Clinic Organization',
      text: `Are you sure you want to suspend "${org?.name}"? All clinic staff and doctors will lose platform access.`,
      input: 'textarea',
      inputLabel: 'Reason for Suspension',
      inputPlaceholder: 'State reason for audit compliance...',
      inputValidator: (value) => {
        if (!value || !value.trim()) return 'A reason is required to suspend a healthcare facility.';
      },
      showCancelButton: true,
      confirmButtonText: 'Yes, Suspend Facility',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#EF4444'
    });

    if (!isConfirmed) return;

    try {
      setActionLoading(true);
      await suspendOrganizationApi(org._id, reason);
      showSuccessToast(`Organization "${org.name}" suspended.`);
      fetchOrganization();
    } catch (err) {
      showErrorToast(err.response?.data?.message || err.message || 'Suspension failed');
    } finally {
      setActionLoading(false);
    }
  };

  const handleActivate = async () => {
    const result = await Swal.fire({
      title: 'Reactivate Clinic Organization',
      text: `Reactivate "${org?.name}" and restore clinical booking capabilities?`,
      icon: 'question',
      showCancelButton: true,
      confirmButtonText: 'Yes, Reactivate',
      cancelButtonText: 'Cancel',
      confirmButtonColor: '#2563EB'
    });

    if (!result.isConfirmed) return;

    try {
      setActionLoading(true);
      await activateOrganizationApi(org._id);
      showSuccessToast(`Organization "${org.name}" reactivated!`);
      fetchOrganization();
    } catch (err) {
      showErrorToast(err.response?.data?.message || err.message || 'Reactivation failed');
    } finally {
      setActionLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <CardSkeleton count={1} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <CardSkeleton count={4} />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton count={1} />
            <CardSkeleton count={1} />
          </div>
          <CardSkeleton count={1} />
        </div>
      </ContentContainer>
    );
  }

  if (error || !org) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="py-12 max-w-xl mx-auto space-y-4">
          <ErrorState message={error || 'Organization profile not found'} onRetry={fetchOrganization} />
          <div className="flex justify-center">
            <Button variant="outline" size="sm" onClick={() => navigate('/super-admin/organizations')} icon={ArrowLeft}>
              Back to Organizations
            </Button>
          </div>
        </div>
      </ContentContainer>
    );
  }

  const formattedOrgName = formatOrganizationName(org.name);
  const cityState = [org.address?.city, org.address?.state].filter(Boolean).join(', ') || 'Location Not Specified';

  // Process schedule
  const workingHoursMap = {};
  if (Array.isArray(org.workingHours)) {
    org.workingHours.forEach((wh) => {
      if (wh && wh.day) workingHoursMap[wh.day.toLowerCase()] = wh;
    });
  }

  const scheduleList = DAYS_OF_WEEK.map(({ key, label }) => {
    const dayData = workingHoursMap[key];
    const rawStatus = (dayData?.status || (key === 'sunday' ? 'CLOSED' : key === 'saturday' ? 'HALF_DAY' : 'OPEN')).toUpperCase();
    const openTime = dayData?.open || (rawStatus === 'HALF_DAY' ? '09:00 AM' : rawStatus === 'OPEN' ? '09:00 AM' : '');
    const closeTime = dayData?.close || dayData?.clode || (rawStatus === 'HALF_DAY' ? '02:00 PM' : rawStatus === 'OPEN' ? '09:00 PM' : '');

    let durationHours = 0;
    if (rawStatus !== 'CLOSED') {
      const s = getHoursFromTimeString(openTime);
      const e = getHoursFromTimeString(closeTime);
      if (s !== null && e !== null && e > s) durationHours = e - s;
    }

    return { key, label, rawStatus, openTime, closeTime, durationHours };
  });

  const openDaysDurations = scheduleList
    .filter((s) => s.rawStatus !== 'CLOSED' && s.durationHours > 0)
    .map((s) => s.durationHours);
  const maxWorkingHoursInWeek = openDaysDurations.length > 0 ? Math.max(...openDaysDurations) : 1;
  const activeDaysCount = scheduleList.filter((s) => s.rawStatus === 'OPEN' || s.rawStatus === 'HALF_DAY').length;

  return (
    <ContentContainer maxWidth="7xl">
      <PageHeader
        title={formattedOrgName}
        subtitle={`Tenant Organization Dossier • ID: ${org._id}`}
        backButton={{
          label: 'Back to Directory',
          onClick: () => navigate('/super-admin/organizations')
        }}
        actions={
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200/80 bg-white text-xs font-bold text-slate-800 shadow-2xs">
              <PulseIndicator
                status={org.status === 'approved' ? 'online' : 'offline'}
                pulseColor={org.status === 'approved' ? '#2563EB' : '#EF4444'}
              />
              <span className="capitalize">{org.status === 'approved' ? 'Active' : 'Suspended'}</span>
            </div>

            {org.status === 'approved' ? (
              <Button
                variant="danger"
                size="sm"
                icon={ShieldOff}
                onClick={handleSuspend}
                loading={actionLoading}
              >
                Suspend Clinic
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                icon={Play}
                onClick={handleActivate}
                loading={actionLoading}
              >
                Reactivate Clinic
              </Button>
            )}
          </div>
        }
      />

      {/* 1. CLINICAL DOSSIER HERO BANNER */}
      <div className="bg-white border border-slate-200/80 rounded-xl p-6 sm:p-7 shadow-xs relative overflow-hidden mb-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          <div className="relative shrink-0">
            <OrganizationLogo
              organization={org}
              size="lg"
              className="shadow-sm border border-slate-200"
            />
          </div>

          <div className="space-y-1.5">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
              {formattedOrgName}
            </h1>

            <div className="flex flex-wrap items-center gap-2.5 text-xs text-slate-500 font-medium">
              <span className="flex items-center gap-1.5 bg-slate-50 px-2.5 py-0.5 rounded-md text-slate-800 border border-slate-200 font-semibold">
                <MapPin className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                {cityState}
              </span>
              <span>•</span>
              <span>
                Provisioned <strong className="text-slate-900 font-semibold">{formatDate(org.createdAt)}</strong>
              </span>
              <span>•</span>
              <span>
                Updated {formatDate(org.updatedAt || org.createdAt)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* 2. Bento Clinical Metric Cards Row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 mb-6">
        <ClinicalMetricCard
          title="Assigned Clinicians"
          value={doctorsCount}
          icon={Stethoscope}
          iconBg="bg-blue-50 text-blue-600"
          sparklineData={[2, 3, 4, 4, 5, doctorsCount || 6]}
          sparklineColor="#0066FF"
          change={10}
          subtext="vs previous 6 months"
          delay={0}
        />
        <ClinicalMetricCard
          title="Total Consultations"
          value={appointmentsCount}
          icon={Calendar}
          iconBg="bg-indigo-50 text-indigo-600"
          sparklineData={[12, 18, 26, 35, 44, appointmentsCount || 57]}
          sparklineColor="#6366F1"
          change={14}
          subtext="vs previous 6 months"
          delay={1}
        />
        <ClinicalMetricCard
          title="Unique Patients"
          value={patientsCount}
          icon={Users}
          iconBg="bg-purple-50 text-purple-600"
          sparklineData={[8, 15, 24, 32, 42, patientsCount || 53]}
          sparklineColor="#A855F7"
          change={12}
          subtext="vs previous 6 months"
          delay={2}
        />
        <ClinicalMetricCard
          title="Clinical Departments"
          value={departmentsCount}
          icon={Building2}
          iconBg="bg-amber-50 text-amber-600"
          sparklineData={[2, 2, 3, 3, 4, departmentsCount || 4]}
          sparklineColor="#F59E0B"
          badge="Operational"
          subtext="Specialty services configured"
          delay={3}
        />
      </div>

      {/* 3. 2-COLUMN SECTION: CLINIC CONTACT & LOCATION MAP */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-6">
        {/* Contact Information Panel */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between space-y-4">
          <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Building2 className="w-4 h-4 text-blue-600" />
              <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                Clinic Contact Details
              </h3>
            </div>
            <span className="text-[11px] font-mono text-slate-400">ID: {org._id?.substring(0, 10)}...</span>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
              <Mail className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-400 block">
                Primary Contact Email
              </span>
              <span className="text-sm font-bold text-slate-900 truncate block">
                {org.email || 'N/A'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
              <Phone className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-400 block">
                Direct Telephone
              </span>
              <span className="text-sm font-bold text-slate-900 truncate block">
                {org.phone || 'N/A'}
              </span>
            </div>
          </div>

          <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex items-start gap-4">
            <div className="p-2.5 rounded-lg bg-blue-50 text-blue-600 border border-blue-100 shrink-0 mt-0.5">
              <MapPin className="w-4 h-4" />
            </div>
            <div className="truncate min-w-0 flex-1">
              <span className="text-xs font-semibold text-slate-400 block">
                Full Physical Address
              </span>
              <span className="text-sm font-bold text-slate-900 truncate block">
                {formatAddress(org.address) || 'No address specified'}
              </span>
            </div>
          </div>
        </div>

        {/* Location Map */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col h-full">
          <ClinicLocationMap
            clinicName={formattedOrgName}
            address={org.address}
            latitude={org.address?.latitude}
            longitude={org.address?.longitude}
            mapUrl={org.address?.mapUrl}
            className="w-full flex-1 h-full min-h-[220px]"
          />
        </div>
      </div>

      {/* 4. WEEKLY OPERATING SCHEDULE */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-4">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 shrink-0">
              <Clock3 className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900">
                Weekly Operating Schedule
              </h3>
              <p className="text-xs text-slate-500 font-medium mt-0.5">
                Facility consultation operating windows & outpatient hours
              </p>
            </div>
          </div>

          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
            {activeDaysCount} Days Active
          </span>
        </div>

        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center text-center">
            <div className="col-span-2 text-left">DAY</div>
            <div className="col-span-5 text-center">AVAILABILITY TRACK</div>
            <div className="col-span-3 text-center">TIME WINDOW</div>
            <div className="col-span-2 text-center">STATUS</div>
          </div>

          <div className="divide-y divide-slate-100">
            {scheduleList.map((item) => {
              const percentage = item.durationHours > 0 ? Math.round((item.durationHours / maxWorkingHoursInWeek) * 100) : 0;
              const hoursDecimal = item.durationHours > 0 ? item.durationHours.toFixed(1).replace('.0', '') : 0;

              return (
                <div
                  key={item.key}
                  className="grid grid-cols-12 gap-3 px-5 py-3.5 items-center relative text-xs hover:bg-slate-50/60 transition-colors"
                >
                  <div className="col-span-2 flex items-center gap-2">
                    <span className="font-semibold text-slate-800 capitalize">
                      {item.label}
                    </span>
                  </div>

                  <div className="col-span-5 flex items-center gap-3">
                    <div className="flex-1 bg-slate-100 h-2 rounded-full overflow-hidden relative">
                      <div
                        className={`h-full rounded-full ${
                          item.rawStatus === 'HALF_DAY' ? 'bg-amber-500' : 'bg-blue-600'
                        } transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-bold text-slate-500 w-12 text-right">
                      {item.durationHours > 0 ? `${hoursDecimal}h` : '0h'}
                    </span>
                  </div>

                  <div className="col-span-3 text-center">
                    {item.rawStatus === 'OPEN' || item.rawStatus === 'HALF_DAY' ? (
                      <span className="font-semibold text-slate-900">
                        {formatTime(item.openTime)} – {formatTime(item.closeTime)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Closed</span>
                    )}
                  </div>

                  <div className="col-span-2 flex items-center justify-center">
                    {item.rawStatus === 'OPEN' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                        Open
                      </span>
                    )}
                    {item.rawStatus === 'HALF_DAY' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                        Half Day
                      </span>
                    )}
                    {item.rawStatus === 'CLOSED' && (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-medium bg-slate-100 text-slate-500 border border-slate-200">
                        Closed
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ContentContainer>
  );
};

export default OrganizationDetails;
