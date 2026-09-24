import React, { useEffect, useState, useMemo } from 'react';
import {
  getSuperAdminPatientsApi,
  getSuperAdminDashboardApi,
  getSuperAdminAppointmentsApi,
  getSuperAdminPatientAnalyticsApi
} from '../../api/superAdmin';
import { TableSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import { PatientKpiStrip } from '../../components/clinical/PatientKpiStrip';
import { PatientGrowthChart } from '../../components/amcharts/PatientGrowthChart';
import { PatientBloodGroupMix } from '../../components/clinical/PatientBloodGroupMix';
import {
  TableContainer,
  Table,
  TableHeader,
  TableHeadCell,
  TableBody,
  TableRow,
  TableCell,
  TableIdentityCell,
  CompletedVisitsBadge
} from '../../components/common/Table';
import { formatDate } from '../../utils/formatDate';
import { Search } from 'lucide-react';

export const Patients = () => {
  const [patients, setPatients] = useState([]);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [selectedBloodGroup, setSelectedBloodGroup] = useState('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const limit = 10;

  useEffect(() => {
    fetchInitialData();
  }, []);

  useEffect(() => {
    fetchPatients();
  }, [pagination.page]);

  const fetchInitialData = async () => {
    try {
      setAnalyticsLoading(true);
      const [patientAnalyticsRes] = await Promise.allSettled([
        getSuperAdminPatientAnalyticsApi()
      ]);
      if (patientAnalyticsRes.status === 'fulfilled' && patientAnalyticsRes.value?.data) {
        setAnalyticsData(patientAnalyticsRes.value.data);
      }
    } catch {
      // Non-blocking
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchPatients = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getSuperAdminPatientsApi({ page: pagination.page, limit });
      if (res?.data) {
        setPatients(res.data.patients || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.totalPages || 1,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch platform patients');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard shortcut: ESC clears active blood group filter and search
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedBloodGroup('ALL');
        setSearchQuery('');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Table Filtering based on search query and selected blood group
  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const name = p.userId?.name || p.name || '';
      const email = p.userId?.email || '';
      const phone = p.userId?.phone || '';
      const bg = (p.bloodGroup || '').toUpperCase();
      const matchesSearch =
        searchQuery === '' ||
        name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        phone.includes(searchQuery);
      const matchesBlood = selectedBloodGroup === 'ALL' || bg === selectedBloodGroup;

      return matchesSearch && matchesBlood;
    });
  }, [patients, searchQuery, selectedBloodGroup]);

  const activeFiltersList = useMemo(() => {
    const list = [];
    if (selectedBloodGroup !== 'ALL') {
      list.push({
        id: 'bloodGroup',
        label: 'Blood Group',
        value: selectedBloodGroup,
        onRemove: () => setSelectedBloodGroup('ALL')
      });
    }
    return list;
  }, [selectedBloodGroup]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-5 font-sans">
      <PageHeader
        subtitle="Platform-wide patient demographic intelligence, clinical cohort growth dynamics, and consultation recurrence."
        actions={
          <div className="flex items-center gap-2.5">
            <DateRangePicker value={dateRange} onChange={(dr) => setDateRange(dr)} />
          </div>
        }
      />

      {/* 1. Compact 5-card KPI Strip */}
      <PatientKpiStrip
        kpi={analyticsData?.kpi}
        loading={analyticsLoading && !analyticsData}
      />

      {/* 2. Visual Analytics Row: Patient Growth & Registration (Combo) + Patient Mix by Blood Group (Ranked Bars) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-stretch">
        <PatientGrowthChart
          data={analyticsData?.patientGrowth || []}
          loading={analyticsLoading && !analyticsData}
          className="h-full"
        />

        <PatientBloodGroupMix
          data={analyticsData?.bloodGroupMix || []}
          selectedGroup={selectedBloodGroup}
          onGroupClick={(group) => setSelectedBloodGroup(group)}
          loading={analyticsLoading && !analyticsData}
          className="h-full"
        />
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={() => {
          setSelectedBloodGroup('ALL');
          setSearchQuery('');
        }}
      />

      {/* 4. Controls Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-1.5 rounded-lg border border-slate-200 text-xs focus:outline-none focus:border-blue-500 transition-colors"
            />
          </div>

          <select
            value={selectedBloodGroup}
            onChange={(e) => setSelectedBloodGroup(e.target.value)}
            className="text-xs py-1.5 px-3 rounded-lg border border-slate-200 bg-white text-slate-700 focus:outline-none focus:border-blue-500"
          >
            <option value="ALL">All Blood Groups</option>
            {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
              <option key={bg} value={bg}>
                {bg}
              </option>
            ))}
          </select>
        </div>

        <span className="text-xs font-semibold text-slate-500">
          Showing {filteredPatients.length} of {pagination.total} Patient Records
        </span>
      </div>

      {/* 5. Patient Roster Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchPatients} />
      ) : filteredPatients.length === 0 ? (
        <EmptyState
          title="No Patients Found"
          description="No patient records match the selected filter criteria."
          actionText="Clear Filters"
          onAction={() => {
            setSelectedBloodGroup('ALL');
            setSearchQuery('');
          }}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHeader>
              <tr>
                <TableHeadCell>Patient Name</TableHeadCell>
                <TableHeadCell>Contact Details</TableHeadCell>
                <TableHeadCell>Gender / Age</TableHeadCell>
                <TableHeadCell>Blood Group</TableHeadCell>
                <TableHeadCell>Completed Visits</TableHeadCell>
                <TableHeadCell>Registered</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {filteredPatients.map((patient) => {
                const name = patient.userId?.name || patient.name || 'Patient';
                const email = patient.userId?.email || '—';
                const phone = patient.userId?.phone || '—';
                const gender = patient.gender || patient.userId?.gender || '—';
                const bg = patient.bloodGroup || '—';
                const visits = patient.completedConsultationsCount || 0;

                return (
                  <TableRow key={patient._id} hoverable={true}>
                    <TableIdentityCell
                      name={name}
                      subtitle={email}
                      avatarUrl={patient.userId?.profileImage?.url}
                    />
                    <TableCell variant="secondary">{phone}</TableCell>
                    <TableCell variant="secondary">
                      <span className="capitalize">{gender}</span>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className="font-mono font-bold text-slate-700 bg-slate-100 px-2 py-0.5 rounded text-xs">
                        {bg}
                      </span>
                    </TableCell>
                    <TableCell variant="secondary">
                      <CompletedVisitsBadge count={visits} />
                    </TableCell>
                    <TableCell variant="muted">{formatDate(patient.createdAt)}</TableCell>
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
              limit={limit}
              onPageChange={(page) => setPagination((p) => ({ ...p, page }))}
            />
          </div>
        </TableContainer>
      )}
    </ContentContainer>
  );
};

export default Patients;
