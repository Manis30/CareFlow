import React, { useEffect, useState, useMemo } from 'react';
import {
  getAdminAppointmentsApi,
  getAdminAppointmentStatsApi
} from '../../api/appointment';
import { getDepartmentsApi } from '../../api/department';
import { getDoctorsApi } from '../../api/doctor';
import { TableSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import Select from '../../components/common/Select';
import Button from '../../components/common/Button';
import PatientAvatar from '../../components/common/PatientAvatar';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import StatTile from '../../components/common/StatTile';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import {
  CareFlowRankChart,
  CareFlowHeatmap,
  CLINICAL_COLORS
} from '../../components/amcharts';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell
} from '../../components/common/Table';
import { formatDate } from '../../utils/formatDate';
import { formatTime } from '../../utils/formatTime';
import { formatDoctorName } from '../../utils/formatters';
import { RotateCcw, CalendarDays, Clock, CheckCircle2, XCircle } from 'lucide-react';

const Appointments = () => {
  const [appointments, setAppointments] = useState([]);
  const [recentAppointments, setRecentAppointments] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [departments, setDepartments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [stats, setStats] = useState(null);

  // Filter States
  const [departmentFilter, setDepartmentFilter] = useState('');
  const [doctorFilter, setDoctorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Keyboard shortcut: ESC clears active filters
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        handleClearFilters();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const fetchInitialData = async () => {
    try {
      const [deptRes, docRes, statsRes, recentRes] = await Promise.allSettled([
        getDepartmentsApi(),
        getDoctorsApi(),
        getAdminAppointmentStatsApi(),
        getAdminAppointmentsApi({ limit: 100 })
      ]);

      if (deptRes.status === 'fulfilled') {
        const dList = deptRes.value.data || (Array.isArray(deptRes.value) ? deptRes.value : []);
        setDepartments(Array.isArray(dList) ? dList : []);
      }

      if (docRes.status === 'fulfilled') {
        const docList = docRes.value.data || (Array.isArray(docRes.value) ? docRes.value : []);
        setDoctors(Array.isArray(docList) ? docList : []);
      }

      if (statsRes.status === 'fulfilled' && statsRes.value?.data) {
        setStats(statsRes.value.data);
      }

      if (recentRes.status === 'fulfilled' && recentRes.value?.data) {
        const rList = recentRes.value.data.appointments || recentRes.value.data || (Array.isArray(recentRes.value.data) ? recentRes.value.data : []);
        setRecentAppointments(Array.isArray(rList) ? rList : []);
      }
    } catch (err) {
      console.error('Failed to load filter options or stats:', err);
    }
  };

  const fetchAppointments = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: pagination.page, limit: 10 };

      if (departmentFilter) params.departmentId = departmentFilter;
      if (doctorFilter) params.doctorId = doctorFilter;
      if (statusFilter) params.status = statusFilter;
      if (dateRange?.startDate) {
        params.startDate = dateRange.startDate;
        params.endDate = dateRange.endDate;
      }

      const res = await getAdminAppointmentsApi(params);
      if (res.data) {
        setAppointments(res.data.appointments || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.totalPages || 1,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load clinic appointments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchAppointments();
  }, [pagination.page, departmentFilter, doctorFilter, statusFilter, dateRange]);

  // Dedicated analytics source (comprehensive cohort)
  const analyticsAppts = useMemo(
    () => (recentAppointments.length > 0 ? recentAppointments : appointments),
    [recentAppointments, appointments]
  );

  // 1. Day x Hour Consultation Density Heatmap
  const heatmapData = useMemo(() => {
    if (!analyticsAppts || analyticsAppts.length === 0) return [];
    const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
    const dayIndices = [6, 0, 1, 2, 3, 4, 5]; // Sunday = 6, Monday = 0, ...
    const hours = [
      '09:00', '10:00', '11:00', '12:00',
      '13:00', '14:00', '15:00', '16:00',
      '17:00', '18:00', '19:00', '20:00'
    ];

    const matrix = {};
    days.forEach((d) => {
      hours.forEach((h) => {
        matrix[`${d}_${h}`] = 0;
      });
    });

    analyticsAppts.forEach((appt) => {
      if (!appt.appointmentDate) return;
      const d = new Date(appt.appointmentDate);
      const dayName = days[dayIndices[d.getDay()]] || 'Mon';

      let hourStr = '09:00';
      if (appt.startTime) {
        const parts = appt.startTime.split(':');
        const h = parseInt(parts[0], 10);
        if (!isNaN(h)) {
          const clamped = Math.max(9, Math.min(20, h));
          hourStr = `${clamped < 10 ? '0' : ''}${clamped}:00`;
        }
      }

      const key = `${dayName}_${hourStr}`;
      if (matrix[key] !== undefined) {
        matrix[key] += 1;
      }
    });

    const result = [];
    days.forEach((day) => {
      hours.forEach((hour) => {
        result.push({
          day,
          hour,
          count: matrix[`${day}_${hour}`] || 0
        });
      });
    });

    return result;
  }, [analyticsAppts]);

  // 2. Multi-Day Volume Trend
  const appointmentActivityData = useMemo(() => {
    if (!analyticsAppts || analyticsAppts.length === 0) return [];
    const counts = {};
    analyticsAppts.forEach((a) => {
      if (!a.appointmentDate) return;
      const dKey = new Date(a.appointmentDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric'
      });
      counts[dKey] = (counts[dKey] || 0) + 1;
    });
    return Object.entries(counts)
      .slice(-10)
      .map(([date, count]) => ({ date, count }));
  }, [analyticsAppts]);

  // 3. Department Volume Breakdown for Rank Chart
  const departmentRankData = useMemo(() => {
    if (!analyticsAppts || analyticsAppts.length === 0) return [];
    const counts = {};
    analyticsAppts.forEach((a) => {
      const name = a.departmentId?.name || 'General Medicine';
      counts[name] = (counts[name] || 0) + 1;
    });
    return Object.entries(counts)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [analyticsAppts]);

  const appointmentStatusData = useMemo(() => {
    if (stats?.overview) {
      return [
        { name: 'Booked', value: stats.overview.booked || 0, color: CLINICAL_COLORS.primary },
        { name: 'Completed', value: stats.overview.completed || 0, color: CLINICAL_COLORS.emerald },
        { name: 'Cancelled', value: stats.overview.cancelled || 0, color: CLINICAL_COLORS.rose }
      ];
    }
    const booked = appointments.filter((a) => a.status === 'booked' || a.status === 'scheduled').length;
    const completed = appointments.filter((a) => a.status === 'completed').length;
    const cancelled = appointments.filter((a) => a.status === 'cancelled').length;
    return [
      { name: 'Booked', value: booked, color: CLINICAL_COLORS.primary },
      { name: 'Completed', value: completed, color: CLINICAL_COLORS.emerald },
      { name: 'Cancelled', value: cancelled, color: CLINICAL_COLORS.rose }
    ];
  }, [stats, appointments]);

  const consultationModeData = useMemo(() => {
    if (!appointments || appointments.length === 0) return [];
    const deptMap = {};
    appointments.forEach((a) => {
      const dept = a.departmentId?.name || 'General';
      if (!deptMap[dept]) {
        deptMap[dept] = { category: dept, online: 0, inPerson: 0 };
      }
      if (a.consultationType === 'online') {
        deptMap[dept].online += 1;
      } else {
        deptMap[dept].inPerson += 1;
      }
    });
    return Object.values(deptMap).slice(0, 4);
  }, [appointments]);

  const availableDoctors = departmentFilter
    ? doctors.filter((doc) => {
        const deptId = doc.departmentId?._id || doc.departmentId;
        const deptIds = Array.isArray(doc.departmentIds)
          ? doc.departmentIds.map((d) => d._id || d)
          : [];
        return deptId === departmentFilter || deptIds.includes(departmentFilter);
      })
    : doctors;

  const handleDepartmentChange = (e) => {
    const selectedDept = e.target.value;
    setDepartmentFilter(selectedDept);
    setPagination((p) => ({ ...p, page: 1 }));

    if (selectedDept && doctorFilter) {
      const isStillAvailable = doctors.some((doc) => {
        if (doc._id !== doctorFilter) return false;
        const deptId = doc.departmentId?._id || doc.departmentId;
        const deptIds = Array.isArray(doc.departmentIds)
          ? doc.departmentIds.map((d) => d._id || d)
          : [];
        return deptId === selectedDept || deptIds.includes(selectedDept);
      });
      if (!isStillAvailable) {
        setDoctorFilter('');
      }
    }
  };

  const handleDoctorChange = (e) => {
    setDoctorFilter(e.target.value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const handleStatusChange = (e) => {
    setStatusFilter(e.target.value);
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const activeFilterCount = [departmentFilter, doctorFilter, statusFilter].filter(Boolean).length;

  const handleClearFilters = () => {
    setDepartmentFilter('');
    setDoctorFilter('');
    setStatusFilter('');
    setSelectedTimeSlot(null);
    setDateRange({ key: 'ALL', label: 'All Time' });
    setPagination((p) => ({ ...p, page: 1 }));
  };

  const activeFiltersList = useMemo(() => {
    const list = [];
    if (departmentFilter) {
      const dept = departments.find((d) => d._id === departmentFilter);
      list.push({
        id: 'dept',
        label: 'Dept',
        value: dept?.name || departmentFilter,
        onRemove: () => {
          setDepartmentFilter('');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (doctorFilter) {
      const doc = doctors.find((d) => d._id === doctorFilter);
      list.push({
        id: 'doctor',
        label: 'Doctor',
        value: formatDoctorName(doc?.userId?.name || doc?.name || doctorFilter),
        onRemove: () => {
          setDoctorFilter('');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (statusFilter) {
      list.push({
        id: 'status',
        label: 'Status',
        value: statusFilter.toUpperCase(),
        onRemove: () => {
          setStatusFilter('');
          setPagination((p) => ({ ...p, page: 1 }));
        }
      });
    }
    if (selectedTimeSlot) {
      list.push({
        id: 'slot',
        label: 'Time Window',
        value: `${selectedTimeSlot.day} ${selectedTimeSlot.hour}`,
        onRemove: () => setSelectedTimeSlot(null)
      });
    }
    if (dateRange?.key && dateRange.key !== 'ALL') {
      list.push({
        id: 'date',
        label: 'Period',
        value: dateRange.label || dateRange.key,
        onRemove: () => setDateRange({ key: 'ALL', label: 'All Time' })
      });
    }
    return list;
  }, [departmentFilter, doctorFilter, statusFilter, selectedTimeSlot, dateRange, departments, doctors]);

  const displayedAppointments = useMemo(() => {
    if (!selectedTimeSlot) return appointments;
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return appointments.filter((appt) => {
      if (!appt.appointmentDate) return false;
      const d = new Date(appt.appointmentDate);
      const dayName = days[d.getDay()];
      if (dayName !== selectedTimeSlot.day) return false;
      if (selectedTimeSlot.hour && appt.startTime) {
        const h = parseInt(appt.startTime.split(':')[0], 10);
        const slotH = parseInt(selectedTimeSlot.hour.split(':')[0], 10);
        return h === slotH;
      }
      return true;
    });
  }, [appointments, selectedTimeSlot]);

  const totalBookedCount = analyticsAppts.filter((a) => a.status === 'booked' || a.status === 'scheduled').length;
  const totalCompletedCount = analyticsAppts.filter((a) => a.status === 'completed').length;
  const totalCancelledCount = analyticsAppts.filter((a) => a.status === 'cancelled').length;
  const totalNoShowCount = analyticsAppts.filter((a) => (a.status || '').toLowerCase() === 'no_show').length;
  const totalAppointmentsCount = pagination.total || analyticsAppts.length;

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle="Comprehensive clinical booking log across all departments and medical practitioners."
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={(dr) => setDateRange(dr)} />
            <span className="hidden sm:inline-flex px-2.5 py-1 rounded-lg bg-blue-50 text-blue-700 text-xs font-semibold border border-blue-100 shadow-2xs">
              {totalAppointmentsCount} Record{totalAppointmentsCount === 1 ? '' : 's'}
            </span>
          </div>
        }
      />

      {/* 1. KPIs Strip (4 indicators) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
        <StatTile
          index={0}
          label="Total Consultations"
          value={totalAppointmentsCount}
          subtext="Clinic ledger records"
          icon={CalendarDays}
          color="blue"
          sparklineData={appointmentActivityData.length >= 2 ? appointmentActivityData.map((d) => d.count) : undefined}
        />
        <StatTile
          index={1}
          label="Scheduled & Booked"
          value={totalBookedCount}
          subtext="Upcoming in pipeline"
          icon={Clock}
          color="indigo"
        />
        <StatTile
          index={2}
          label="Completed Visits"
          value={totalCompletedCount}
          subtext="Concluded encounters"
          icon={CheckCircle2}
          color="green"
        />
        <StatTile
          index={3}
          label="Cancelled Records"
          value={totalCancelledCount}
          subtext="Terminated bookings"
          icon={XCircle}
          color="rose"
        />
      </div>

      {/* 2. Visual Analytics Suite (amCharts 5): Consultation Density, Volume Trend, Status Breakdown, Department Rankings */}
      {/* 2. Visual Analytics Suite: Consultation Density & Department Rankings */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        <div className="lg:col-span-7 flex flex-col">
            <CareFlowHeatmap
              title="Consultation Density (Day × Hour)"
              subtitle="Aggregated clinic booking distribution across operating hours (click cell to filter)"
              data={heatmapData}
              height={230}
              className="h-full"
              onCellClick={(cell) => {
                setSelectedTimeSlot((prev) => (prev?.day === cell.day && prev?.hour === cell.hour ? null : cell));
              }}
            />
          </div>

          <div className="lg:col-span-5 flex flex-col">
            <CareFlowRankChart
              title="Encounters by Department"
              subtitle="Specialty workload (click bar to filter)"
              data={departmentRankData}
              categoryField="name"
              valueField="value"
              color={CLINICAL_COLORS.indigo}
              height={230}
              className="h-full"
              onBarClick={(item) => {
                const matchedDept = departments.find((d) => d.name?.toLowerCase() === item.name?.toLowerCase());
                if (matchedDept) {
                  setDepartmentFilter((prev) => (prev === matchedDept._id ? '' : matchedDept._id));
                  setPagination((p) => ({ ...p, page: 1 }));
                }
              }}
            />
          </div>
        </div>

      {/* Active Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={handleClearFilters}
      />

      {/* 3. Filter Bar */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 shadow-2xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 flex-1">
            <Select
              placeholder="All Departments"
              options={departments.map((d) => ({ value: d._id, label: d.name }))}
              value={departmentFilter}
              onChange={handleDepartmentChange}
              className="text-xs"
            />

            <Select
              placeholder="All Clinicians"
              options={availableDoctors.map((doc) => ({
                value: doc._id,
                label: formatDoctorName(doc.userId?.name || doc.name)
              }))}
              value={doctorFilter}
              onChange={handleDoctorChange}
              className="text-xs"
            />

            <Select
              placeholder="All Statuses"
              options={[
                { value: 'booked', label: 'Booked' },
                { value: 'completed', label: 'Completed' },
                { value: 'cancelled', label: 'Cancelled' }
              ]}
              value={statusFilter}
              onChange={handleStatusChange}
              className="text-xs"
            />
          </div>

          <div className="flex items-center gap-2 justify-end shrink-0">
            <Button
              variant="outline"
              size="sm"
              disabled={activeFiltersList.length === 0}
              onClick={handleClearFilters}
              icon={RotateCcw}
              className={activeFiltersList.length === 0 ? 'opacity-50 cursor-not-allowed' : ''}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </div>

      {/* 4. Main Table */}
      {loading ? (
        <TableSkeleton rows={8} columns={6} />
      ) : error ? (
        <ErrorState message={error} onRetry={fetchAppointments} />
      ) : displayedAppointments.length === 0 ? (
        <EmptyState
          title="No Consultations Found"
          description={
            activeFiltersList.length > 0
              ? 'Try modifying your filter parameters to locate matching consultation bookings.'
              : 'Appointments booked by patients will appear in this ledger.'
          }
          actionText={activeFiltersList.length > 0 ? 'Reset Filters' : undefined}
          onAction={activeFiltersList.length > 0 ? handleClearFilters : undefined}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell align="left">Patient</TableHeadCell>
                <TableHeadCell align="left">Clinician</TableHeadCell>
                <TableHeadCell align="left">Department</TableHeadCell>
                <TableHeadCell align="left">Date & Time</TableHeadCell>
                <TableHeadCell align="center">Modality</TableHeadCell>
                <TableHeadCell align="center">Consultation Status</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {displayedAppointments.map((appt) => {
                const patientName = appt.patientId?.userId?.name || appt.patientId?.name || 'Patient';

                return (
                  <TableRow key={appt._id} hoverable={true}>
                    <TableCell align="left" variant="primary">
                      <div className="flex items-center gap-3">
                        <PatientAvatar patient={appt.patientId} name={patientName} size="sm" />
                        <span className="font-bold text-slate-900 truncate">{patientName}</span>
                      </div>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="font-medium text-slate-800">
                        {formatDoctorName(appt.doctorId?.userId?.name || appt.doctorId?.name)}
                      </span>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="font-semibold text-blue-600">
                        {appt.departmentId?.name || 'General'}
                      </span>
                    </TableCell>
                    <TableCell align="left" variant="secondary">
                      <span className="text-slate-600">
                        {formatDate(appt.appointmentDate)} • {formatTime(appt.startTime)}
                      </span>
                    </TableCell>
                    <TableCell align="center">
                      <StatusBadge status={appt.consultationType} />
                    </TableCell>
                    <TableCell align="center">
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
