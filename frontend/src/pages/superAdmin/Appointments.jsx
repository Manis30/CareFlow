import React, { useEffect, useState, useMemo } from 'react';
import {
  getSuperAdminAppointmentsApi,
  getSuperAdminOrganizationsApi,
  getSuperAdminDoctorsApi,
  getSuperAdminAppointmentAnalyticsApi
} from '../../api/superAdmin';
import { TableSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import { AppointmentKpiStrip } from '../../components/clinical/AppointmentKpiStrip';
import { AppointmentDensityHeatmap, FacilityEncountersRankChart } from '../../components/amcharts';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableIdentityCell
} from '../../components/common/Table';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatDoctorName } from '../../utils/formatters';
import { RotateCcw } from 'lucide-react';
import Button from '../../components/common/Button';

export const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [organizations, setOrganizations] = useState([]);
  const [allDoctors, setAllDoctors] = useState([]);

  // Telemetry analytics state from real backend
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);

  // Filters
  const [orgFilter, setOrgFilter] = useState('ALL');
  const [docFilter, setDocFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState('ALL');
  const [selectedDate, setSelectedDate] = useState(null);
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });

  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keyboard shortcut: ESC clears all active filters
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOrgFilter('ALL');
        setDocFilter('ALL');
        setStatusFilter('ALL');
        setSelectedDate(null);
        setSelectedTimeSlot(null);
        setPagination((p) => ({ ...p, page: 1 }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Fetch filter metadata (organizations & doctors)
  useEffect(() => {
    const fetchFilterMetadata = async () => {
      try {
        const [orgsRes, docsRes] = await Promise.allSettled([
          getSuperAdminOrganizationsApi({ limit: 100 }),
          getSuperAdminDoctorsApi({ limit: 100 })
        ]);
        if (orgsRes.status === 'fulfilled' && orgsRes.value?.data) {
          setOrganizations(orgsRes.value.data.organizations || []);
        }
        if (docsRes.status === 'fulfilled' && docsRes.value?.data) {
          setAllDoctors(docsRes.value.data.doctors || []);
        }
      } catch (err) {
        console.error('Failed to load filter metadata:', err);
      }
    };
    fetchFilterMetadata();
  }, []);

  // Fetch real analytics telemetry
  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      const params = {};
      if (dateRange?.startDate && dateRange?.endDate) {
        params.startDate = dateRange.startDate;
        params.endDate = dateRange.endDate;
      }
      const res = await getSuperAdminAppointmentAnalyticsApi(params);
      if (res?.data) {
        setAnalyticsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load appointment analytics telemetry:', err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  useEffect(() => {
    fetchAnalytics();
  }, [dateRange]);

  // Fetch paginated appointments
  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: pagination.page, limit: 10 };
      if (orgFilter !== 'ALL') params.organizationId = orgFilter;
      if (docFilter !== 'ALL') params.doctorId = docFilter;
      if (statusFilter !== 'ALL') params.status = statusFilter;
      if (selectedDate) {
        params.startDate = selectedDate;
        params.endDate = selectedDate;
      } else if (dateRange?.startDate) {
        params.startDate = dateRange.startDate;
        params.endDate = dateRange.endDate;
      }

      const res = await getSuperAdminAppointmentsApi(params);
      if (res?.data) {
        setAppointments(res.data.appointments || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.totalPages || 1,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch platform appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAppointments();
  }, [pagination.page, orgFilter, docFilter, statusFilter, selectedDate, dateRange]);

  // Cross-filter appointments table when a density cell (day + hour) is clicked
  const displayedAppointments = useMemo(() => {
    if (!selectedTimeSlot) return appointments;
    return appointments.filter((appt) => {
      if (!appt.appointmentDate) return false;
      const d = new Date(appt.appointmentDate);
      const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
      const apptDay = days[d.getDay()];
      const slotDay = (selectedTimeSlot.day || '').slice(0, 3);
      if (apptDay !== slotDay) return false;

      const slotHour = parseInt(selectedTimeSlot.hour.split(':')[0], 10);
      let apptHour = -1;
      if (appt.startTime) {
        apptHour = parseInt(appt.startTime.split(':')[0], 10);
      } else {
        apptHour = d.getHours();
      }
      return apptHour === slotHour;
    });
  }, [appointments, selectedTimeSlot]);

  // Active filters list for chip display
  const activeFiltersList = useMemo(() => {
    const list = [];
    if (orgFilter !== 'ALL') {
      const org = organizations.find((o) => o._id === orgFilter);
      list.push({
        id: 'org',
        label: 'Facility',
        value: org?.name || 'Selected Clinic',
        onRemove: () => {
          setOrgFilter('ALL');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (selectedTimeSlot) {
      list.push({
        id: 'timeSlot',
        label: 'Density Slot',
        value: `${selectedTimeSlot.day} ${selectedTimeSlot.hour}`,
        onRemove: () => setSelectedTimeSlot(null)
      });
    }
    if (docFilter !== 'ALL') {
      const doc = allDoctors.find((d) => d._id === docFilter);
      list.push({
        id: 'doc',
        label: 'Doctor',
        value: formatDoctorName(doc?.userId?.name || doc?.name),
        onRemove: () => {
          setDocFilter('ALL');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (statusFilter !== 'ALL') {
      list.push({
        id: 'status',
        label: 'Status',
        value: statusFilter.toUpperCase(),
        onRemove: () => {
          setStatusFilter('ALL');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (selectedDate) {
      list.push({
        id: 'date',
        label: 'Date',
        value: selectedDate,
        onRemove: () => {
          setSelectedDate(null);
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    return list;
  }, [orgFilter, selectedTimeSlot, docFilter, statusFilter, selectedDate, organizations, allDoctors]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-5 font-sans">
      <PageHeader
        subtitle="Platform-wide encounter realization, calendar consultation density, and appointment lifecycle fulfillment."
        actions={
          <div className="flex items-center gap-2.5">
            <DateRangePicker value={dateRange} onChange={(dr) => setDateRange(dr)} />
          </div>
        }
      />

      {/* 1. Compact 5-card KPI Strip */}
      <AppointmentKpiStrip
        kpi={analyticsData?.kpis}
        loading={analyticsLoading && !analyticsData}
      />

      {/* 2. Visual Analytics Row: Consultation Scheduling Density (Left ~58-60%) + Encounters by Facility (Right ~40-42%) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
          <AppointmentDensityHeatmap
            data={analyticsData?.heatmap || []}
            totalAppointments={analyticsData?.meta?.totalAppointments || 0}
            selectedSlot={selectedTimeSlot}
            onSlotClick={(slot) => {
              setSelectedTimeSlot((prev) =>
                prev?.day === slot.day && prev?.hour === slot.hour ? null : slot
              );
            }}
            loading={analyticsLoading && !analyticsData}
            className="h-full"
          />
        </div>

        <div className="lg:col-span-5 flex flex-col">
          <FacilityEncountersRankChart
            data={analyticsData?.facilities || []}
            selectedFacility={orgFilter}
            onFacilityClick={(facility) => {
              setOrgFilter((prev) => (prev === facility.organizationId ? 'ALL' : facility.organizationId));
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            loading={analyticsLoading && !analyticsData}
            className="h-full"
          />
        </div>
      </div>

      {/* 3. Active Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={() => {
          setOrgFilter('ALL');
          setDocFilter('ALL');
          setStatusFilter('ALL');
          setSelectedDate(null);
          setSelectedTimeSlot(null);
          setPagination((p) => ({ ...p, page: 1 }));
        }}
      />

      {/* 4. Controls Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-wrap flex-1">
          <select
            value={orgFilter}
            onChange={(e) => {
              setOrgFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
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

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value);
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Statuses</option>
            <option value="completed">Completed</option>
            <option value="booked">Scheduled / Booked</option>
            <option value="cancelled">Cancelled</option>
          </select>

          {(orgFilter !== 'ALL' || statusFilter !== 'ALL' || selectedDate || selectedTimeSlot || docFilter !== 'ALL') && (
            <Button
              variant="outline"
              size="sm"
              icon={RotateCcw}
              onClick={() => {
                setOrgFilter('ALL');
                setDocFilter('ALL');
                setStatusFilter('ALL');
                setSelectedDate(null);
                setSelectedTimeSlot(null);
                setPagination((p) => ({ ...p, page: 1 }));
              }}
            >
              Reset Filters
            </Button>
          )}
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {displayedAppointments.length} of {pagination.total} Consultations
        </span>
      </div>

      {/* 5. Appointments Ledger Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAppointments} />
      ) : displayedAppointments.length === 0 ? (
        <EmptyState
          title="No Encounters Found"
          description="No clinical appointments match the selected filter criteria."
          actionText="Clear Filters"
          onAction={() => {
            setOrgFilter('ALL');
            setDocFilter('ALL');
            setStatusFilter('ALL');
            setSelectedDate(null);
            setSelectedTimeSlot(null);
            setPagination((p) => ({ ...p, page: 1 }));
          }}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell>Patient Record</TableHeadCell>
                <TableHeadCell>Attending Physician</TableHeadCell>
                <TableHeadCell>Facility Organization</TableHeadCell>
                <TableHeadCell>Session Date & Time</TableHeadCell>
                <TableHeadCell>Modality</TableHeadCell>
                <TableHeadCell>Encounter Status</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {displayedAppointments.map((appt) => {
                const patName = appt.patientId?.name || appt.patientId?.userId?.name || 'Patient';
                const patEmail = appt.patientId?.userId?.email || '—';
                const docName = formatDoctorName(appt.doctorId?.userId?.name || appt.doctorId?.name);
                const orgName = appt.organizationId?.name || 'CareFlow Facility';
                const dateStr = formatDate(appt.appointmentDate);
                const timeStr = formatTime(appt.startTime);
                const mode = appt.consultationType || 'offline';

                return (
                  <TableRow key={appt._id} hoverable={true}>
                    <TableIdentityCell
                      name={patName}
                      subtitle={patEmail}
                      avatarUrl={appt.patientId?.userId?.profileImage?.url}
                    />
                    <TableCell variant="secondary">
                      <span className="font-semibold text-slate-900">{docName}</span>
                    </TableCell>
                    <TableCell variant="secondary">{orgName}</TableCell>
                    <TableCell variant="secondary">
                      <div className="flex flex-col">
                        <span className="font-medium text-slate-800">{dateStr}</span>
                        <span className="text-[11px] text-slate-400 font-mono">{timeStr}</span>
                      </div>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wider ${
                        mode === 'online' ? 'bg-purple-50 text-purple-700' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {mode}
                      </span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={appt.status} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>

          <div className="px-4 py-3 border-t border-slate-100">
            <Pagination
              currentPage={pagination.page}
              totalPages={pagination.totalPages}
              totalItems={pagination.total}
              limit={10}
              onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
            />
          </div>
        </TableContainer>
      )}
    </ContentContainer>
  );
};

export default Appointments;
