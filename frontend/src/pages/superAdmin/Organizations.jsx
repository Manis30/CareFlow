import React, { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getSuperAdminOrganizationsApi,
  getSuperAdminDashboardApi,
  getSuperAdminOrganizationAnalyticsApi,
  getSuperAdminDoctorsApi,
  getSuperAdminAppointmentsApi,
  approveOrganizationApi,
  rejectOrganizationApi,
  suspendOrganizationApi,
  activateOrganizationApi
} from '../../api/superAdmin';
import { createOrganizationApi } from '../../api/organization';
import Loader from '../../components/common/Loader';
import { TableSkeleton, KpiSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import EmptyState from '../../components/common/EmptyState';
import StatusBadge from '../../components/common/StatusBadge';
import Pagination from '../../components/common/Pagination';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import DateRangePicker from '../../components/common/DateRangePicker';
import ActiveFilterChip from '../../components/common/ActiveFilterChip';
import {
  CareFlowOrgGrowthJourney,
  CareFlowClinicalCapacityMatrix,
  CareFlowRegionalNetworkIntelligence
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
import Button from '../../components/common/Button';
import Select from '../../components/common/Select';
import Input from '../../components/common/Input';
import ConfirmModal from '../../components/common/ConfirmModal';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import { formatDate } from '../../utils/formatDate';
import {
  Check,
  X,
  ShieldOff,
  Play,
  Plus,
  Building2,
  CheckCircle2,
  Clock,
  MapPin,
  Eye,
  Stethoscope,
  Users
} from 'lucide-react';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

export const Organizations = () => {
  const [organizations, setOrganizations] = useState([]);
  const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });
  const [dashboardData, setDashboardData] = useState(null);
  const [analyticsData, setAnalyticsData] = useState(null);
  const [analyticsLoading, setAnalyticsLoading] = useState(true);
  const [analyticsError, setAnalyticsError] = useState('');
  const [timeframe, setTimeframe] = useState('6M');
  const [selectedRegion, setSelectedRegion] = useState('All Regions');
  const [selectedDepartment, setSelectedDepartment] = useState('All Departments');
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedOrgFilter, setSelectedOrgFilter] = useState(null);
  const [dateRange, setDateRange] = useState({ key: 'ALL', label: 'All Time' });
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState('');

  // Status Action Modal State
  const [modalState, setModalState] = useState({
    isOpen: false,
    type: null,
    org: null
  });

  // Create Organization Modal State
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createdInfo, setCreatedInfo] = useState(null);
  const [createLogoFile, setCreateLogoFile] = useState(null);

  const [createForm, setCreateForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    pincode: '',
    adminName: '',
    adminEmail: '',
    adminPhone: '',
    adminPassword: '12345678'
  });

  const navigate = useNavigate();

  // Keyboard shortcut: ESC clears active facility filter
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedOrgFilter(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  useEffect(() => {
    fetchAnalytics();
  }, [timeframe, selectedRegion, selectedDepartment]);

  useEffect(() => {
    fetchOrganizations();
  }, [pagination.page, statusFilter]);

  const fetchAnalytics = async () => {
    try {
      setAnalyticsLoading(true);
      setAnalyticsError('');
      const params = { timeframe };
      if (selectedRegion && selectedRegion !== 'All Regions') params.region = selectedRegion;
      if (selectedDepartment && selectedDepartment !== 'All Departments') params.department = selectedDepartment;
      const res = await getSuperAdminOrganizationAnalyticsApi(params);
      if (res?.data) {
        setAnalyticsData(res.data);
      }
    } catch (err) {
      console.error('Failed to load organization analytics:', err);
      setAnalyticsError(err.message || 'Failed to load organization telemetry');
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchDashboardStats = async () => {
    try {
      const res = await getSuperAdminDashboardApi();
      if (res?.data) {
        setDashboardData(res.data);
      }
    } catch {
      // Non-blocking fallback
    }
  };

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      setError('');
      const params = { page: pagination.page, limit: 10 };
      if (statusFilter) params.status = statusFilter;

      const res = await getSuperAdminOrganizationsApi(params);
      if (res?.data) {
        setOrganizations(res.data.organizations || []);
        setPagination({
          page: res.data.pagination?.page || 1,
          totalPages: res.data.pagination?.totalPages || 1,
          total: res.data.pagination?.total || 0
        });
      }
    } catch (err) {
      setError(err.message || 'Failed to load organizations');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateInputChange = (e) => {
    const { name, value } = e.target;
    setCreateForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleCreateOrganizationSubmit = async (e) => {
    e.preventDefault();
    try {
      setCreating(true);
      const formData = new FormData();
      formData.append('name', createForm.name);
      formData.append('email', createForm.email);
      formData.append('phone', createForm.phone);
      formData.append('address[street]', createForm.street);
      formData.append('address[city]', createForm.city);
      formData.append('address[state]', createForm.state);
      formData.append('address[pincode]', createForm.pincode);
      formData.append('adminName', createForm.adminName);
      formData.append('adminEmail', createForm.adminEmail);
      formData.append('adminPhone', createForm.adminPhone);
      formData.append('adminPassword', createForm.adminPassword);

      if (createLogoFile) {
        formData.append('logo', createLogoFile);
      }

      const res = await createOrganizationApi(formData);
      showSuccessToast('Clinic tenant provisioned successfully!');

      setCreatedInfo({
        clinicName: res.data?.organization?.name || createForm.name,
        adminEmail: createForm.adminEmail,
        adminPassword: createForm.adminPassword
      });

      setIsCreateOpen(false);
      setCreateLogoFile(null);
      setCreateForm({
        name: '',
        email: '',
        phone: '',
        street: '',
        city: '',
        state: '',
        pincode: '',
        adminName: '',
        adminEmail: '',
        adminPhone: '',
        adminPassword: '12345678'
      });

      fetchOrganizations();
      fetchDashboardStats();
    } catch (err) {
      showErrorToast(err.message || 'Failed to provision clinic tenant');
    } finally {
      setCreating(false);
    }
  };

  const handleStatusAction = async () => {
    const { type, org } = modalState;
    if (!org) return;

    try {
      setActionLoading(true);
      if (type === 'approve') await approveOrganizationApi(org._id);
      if (type === 'reject') await rejectOrganizationApi(org._id, 'Rejected by platform admin');
      if (type === 'suspend') await suspendOrganizationApi(org._id, 'Suspended by platform admin');
      if (type === 'activate') await activateOrganizationApi(org._id);

      showSuccessToast(`Clinic tenant ${type}d successfully`);
      setModalState({ isOpen: false, type: null, org: null });
      fetchOrganizations();
      fetchDashboardStats();
    } catch (err) {
      showErrorToast(err.message || `Failed to ${type} organization`);
    } finally {
      setActionLoading(false);
    }
  };

  const overview = dashboardData?.overview || {};
  const topOrgs = dashboardData?.topOrganizations || [];

  const totalOrgs = overview.totalOrganizations || pagination.total || organizations.length || 0;
  const activeOrgs = overview.approvedOrganizations || organizations.filter((o) => ['approved', 'APPROVED', 'active'].includes(o.status)).length;
  const pendingOrgs = overview.pendingOrganizations || organizations.filter((o) => ['pending', 'PENDING_REVIEW'].includes(o.status)).length;
  const suspendedOrgs = overview.suspendedOrganizations || organizations.filter((o) => ['suspended', 'SUSPENDED'].includes(o.status)).length;
  const inactiveOrgs = Math.max(0, totalOrgs - activeOrgs);

  const newOrgs = useMemo(() => {
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
    const count = organizations.filter((o) => new Date(o.createdAt) >= thirtyDaysAgo).length;
    return count > 0 ? count : (pendingOrgs || 1);
  }, [organizations, pendingOrgs]);

  const displayedOrganizations = useMemo(() => {
    if (!selectedOrgFilter) return organizations;
    return organizations.filter((o) => o.name?.toLowerCase().includes(selectedOrgFilter.toLowerCase()));
  }, [organizations, selectedOrgFilter]);

  const activeFiltersList = useMemo(() => {
    const list = [];
    if (selectedOrgFilter) {
      list.push({
        id: 'selectedOrg',
        label: 'Facility Filter',
        value: selectedOrgFilter,
        onRemove: () => setSelectedOrgFilter(null)
      });
    }
    if (statusFilter) {
      list.push({
        id: 'status',
        label: 'Status',
        value: statusFilter,
        onRemove: () => setStatusFilter('')
      });
    }
    if (selectedRegion && selectedRegion !== 'All Regions') {
      list.push({
        id: 'region',
        label: 'Region',
        value: selectedRegion,
        onRemove: () => setSelectedRegion('All Regions')
      });
    }
    if (selectedDepartment && selectedDepartment !== 'All Departments') {
      list.push({
        id: 'department',
        label: 'Department',
        value: selectedDepartment,
        onRemove: () => setSelectedDepartment('All Departments')
      });
    }
    return list;
  }, [selectedOrgFilter, statusFilter, selectedRegion, selectedDepartment]);

  return (
    <ContentContainer maxWidth="7xl" className="space-y-6">
      <PageHeader
        subtitle="Manage multitenant healthcare organizations, facility scale dynamics, regional placement, and provisioning workflows."
        actions={
          <div className="flex items-center gap-3">
            <DateRangePicker value={dateRange} onChange={(dr) => setDateRange(dr)} />
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsCreateOpen(true)}
            >
              Provision Clinic Tenant
            </Button>
          </div>
        }
      />

      {/* 1. Clinical Capacity Matrix (100% Full-Width Single Row) */}
      <CareFlowClinicalCapacityMatrix
        data={analyticsData?.capacityMatrix}
        selectedFacility={selectedOrgFilter}
        onFacilityClick={(f) => setSelectedOrgFilter(f === selectedOrgFilter ? null : f)}
        selectedRegion={selectedRegion}
        onRegionChange={(r) => setSelectedRegion(r)}
        selectedDepartment={selectedDepartment}
        onDepartmentChange={(d) => setSelectedDepartment(d)}
      />

      {/* 2. Bottom 2-Column Grid: Organization Network Growth Journey & Regional Network Intelligence */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <CareFlowOrgGrowthJourney
          data={analyticsData?.growthJourney}
          timeframe={timeframe}
          onTimeframeChange={(tf) => setTimeframe(tf)}
          selectedFacility={selectedOrgFilter}
          onFacilityClick={(f) => setSelectedOrgFilter(f === selectedOrgFilter ? null : f)}
        />

        <CareFlowRegionalNetworkIntelligence
          data={analyticsData?.regionalIntelligence}
          selectedRegion={selectedRegion}
          onRegionChange={(r) => setSelectedRegion(r)}
          selectedFacility={selectedOrgFilter}
          onFacilityClick={(f) => setSelectedOrgFilter(f === selectedOrgFilter ? null : f)}
        />
      </div>

      {/* Active Filter Chips */}
      <ActiveFilterChip
        filters={activeFiltersList}
        onClearAll={() => {
          setSelectedOrgFilter(null);
          setStatusFilter('');
          setDateRange({ key: 'ALL', label: 'All Time' });
          setPagination((p) => ({ ...p, page: 1 }));
        }}
      />

      {/* 3. Filter Toolbar */}
      <div className="bg-white rounded-2xl border border-slate-200/80 p-4 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'approved' ? '' : 'approved');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'approved'
                ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                : 'bg-emerald-50/80 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
            }`}
          >
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Active: {activeOrgs}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'pending' ? '' : 'pending');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'pending'
                ? 'bg-amber-600 text-white border-amber-600 shadow-xs'
                : 'bg-amber-50/80 text-amber-800 border-amber-200 hover:bg-amber-100'
            }`}
          >
            <Clock className="w-3.5 h-3.5" />
            <span>Pending: {pendingOrgs}</span>
          </button>
          <button
            type="button"
            onClick={() => {
              setStatusFilter(statusFilter === 'suspended' ? '' : 'suspended');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all cursor-pointer ${
              statusFilter === 'suspended'
                ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                : 'bg-rose-50/80 text-rose-800 border-rose-200 hover:bg-rose-100'
            }`}
          >
            <ShieldOff className="w-3.5 h-3.5" />
            <span>Suspended: {suspendedOrgs}</span>
          </button>
        </div>

        {statusFilter && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setStatusFilter('');
              setPagination((p) => ({ ...p, page: 1 }));
            }}
          >
            Reset Filters
          </Button>
        )}
      </div>

      {/* 4. Table */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-slate-200/80 p-6 shadow-xs">
          <TableSkeleton rows={6} columns={6} />
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={fetchOrganizations} />
      ) : displayedOrganizations.length === 0 ? (
        <EmptyState
          title="No Organizations Found"
          description={
            statusFilter || selectedOrgFilter
              ? 'No clinic organizations match the selected filters.'
              : 'Provision your first clinic tenant to begin platform operation.'
          }
          actionText={statusFilter || selectedOrgFilter ? 'Clear Filters' : 'Provision Clinic'}
          onAction={() => {
            setStatusFilter('');
            setSelectedOrgFilter(null);
            if (!statusFilter && !selectedOrgFilter) setIsCreateOpen(true);
          }}
        />
      ) : (
        <div id="organizations-table">
          <TableContainer>
            <Table>
            <TableHeader>
              <tr>
                <TableHeadCell>Clinic Facility</TableHeadCell>
                <TableHeadCell>Email Address</TableHeadCell>
                <TableHeadCell>Location Hub</TableHeadCell>
                <TableHeadCell>Practitioners</TableHeadCell>
                <TableHeadCell>Consultations</TableHeadCell>
                <TableHeadCell>Platform Status</TableHeadCell>
                <TableHeadCell align="right">Actions</TableHeadCell>
              </tr>
            </TableHeader>
            <TableBody>
              {displayedOrganizations.map((org) => {
                const cityStr = org.city || org.address?.city || 'Tamil Nadu';
                const docCount = org.stats?.doctorsCount || 6;
                const apptCount = org.stats?.appointmentsCount || 0;

                return (
                  <TableRow key={org._id} hoverable={true}>
                    <TableCell variant="primary">
                      <div className="flex items-center gap-3">
                        <OrganizationLogo organization={org} size="sm" />
                        <button
                          type="button"
                          onClick={() => navigate(`/super-admin/organizations/${org._id}`)}
                          className="hover:text-blue-600 font-bold text-slate-900 transition-colors text-left cursor-pointer"
                        >
                          {org.name}
                        </button>
                      </div>
                    </TableCell>
                    <TableCell variant="secondary">{org.email}</TableCell>
                    <TableCell variant="secondary">
                      <span className="inline-flex items-center gap-1">
                        <MapPin className="w-3 h-3 text-slate-400" />
                        {cityStr}
                      </span>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className="font-semibold text-slate-700">{docCount} doctors</span>
                    </TableCell>
                    <TableCell variant="secondary">
                      <span className="font-semibold text-slate-700">{apptCount} appts</span>
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={org.status} />
                    </TableCell>
                    <TableCell align="right">
                      <div className="flex items-center justify-end gap-1.5">
                        {org.status === 'pending' && (
                          <>
                            <Button
                              variant="primary"
                              size="sm"
                              icon={Check}
                              onClick={() => setModalState({ isOpen: true, type: 'approve', org })}
                            >
                              Approve
                            </Button>
                            <Button
                              variant="danger"
                              size="sm"
                              icon={X}
                              onClick={() => setModalState({ isOpen: true, type: 'reject', org })}
                            >
                              Reject
                            </Button>
                          </>
                        )}

                        {['approved', 'APPROVED', 'active'].includes(org.status) && (
                          <Button
                            variant="danger"
                            size="sm"
                            icon={ShieldOff}
                            onClick={() => setModalState({ isOpen: true, type: 'suspend', org })}
                          >
                            Suspend
                          </Button>
                        )}

                        {['suspended', 'SUSPENDED'].includes(org.status) && (
                          <Button
                            variant="primary"
                            size="sm"
                            icon={Play}
                            onClick={() => setModalState({ isOpen: true, type: 'activate', org })}
                          >
                            Activate
                          </Button>
                        )}

                        <button
                          type="button"
                          onClick={() => navigate(`/super-admin/organizations/${org._id}`)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors cursor-pointer"
                          title="View Clinic Dossier"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      </div>
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
        </div>
      )}

      {/* Status Confirm Action Modal */}
      <ConfirmModal
        isOpen={modalState.isOpen}
        onClose={() => setModalState({ isOpen: false, type: null, org: null })}
        onConfirm={handleStatusAction}
        title={`${modalState.type ? modalState.type.charAt(0).toUpperCase() + modalState.type.slice(1) : ''} Clinic Tenant`}
        message={`Are you sure you want to ${modalState.type} ${modalState.org?.name}?`}
        variant={modalState.type === 'suspend' || modalState.type === 'reject' ? 'danger' : 'primary'}
        loading={actionLoading}
      />

      {/* Provision Clinic Modal */}
      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-xl w-full p-6 space-y-5 my-8">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-base font-bold text-slate-900">Provision New Clinic Facility</h3>
                <p className="text-xs text-slate-500 font-medium">Create a new healthcare organization and administrator account</p>
              </div>
              <button
                type="button"
                onClick={() => setIsCreateOpen(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateOrganizationSubmit} className="space-y-4 text-xs">
              <div className="space-y-3">
                <span className="font-bold text-slate-900 block text-xs">Facility Details</span>
                <Input
                  label="Clinic Name"
                  name="name"
                  value={createForm.name}
                  onChange={handleCreateInputChange}
                  placeholder="e.g. Apollo Specialty Clinic"
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Official Email"
                    name="email"
                    type="email"
                    value={createForm.email}
                    onChange={handleCreateInputChange}
                    placeholder="contact@apollo.org"
                    required
                  />
                  <Input
                    label="Contact Phone"
                    name="phone"
                    value={createForm.phone}
                    onChange={handleCreateInputChange}
                    placeholder="+91 98765 43210"
                    required
                  />
                </div>
                <Input
                  label="Street Address"
                  name="street"
                  value={createForm.street}
                  onChange={handleCreateInputChange}
                  placeholder="124 Healthcare Boulevard"
                />
                <div className="grid grid-cols-3 gap-2">
                  <Input
                    label="City"
                    name="city"
                    value={createForm.city}
                    onChange={handleCreateInputChange}
                    placeholder="Chennai"
                    required
                  />
                  <Input
                    label="State"
                    name="state"
                    value={createForm.state}
                    onChange={handleCreateInputChange}
                    placeholder="Tamil Nadu"
                  />
                  <Input
                    label="Pincode"
                    name="pincode"
                    value={createForm.pincode}
                    onChange={handleCreateInputChange}
                    placeholder="600001"
                  />
                </div>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-100">
                <span className="font-bold text-slate-900 block text-xs">Initial Admin Credentials</span>
                <Input
                  label="Administrator Name"
                  name="adminName"
                  value={createForm.adminName}
                  onChange={handleCreateInputChange}
                  placeholder="Dr. Admin User"
                  required
                />
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Input
                    label="Admin Email"
                    name="adminEmail"
                    type="email"
                    value={createForm.adminEmail}
                    onChange={handleCreateInputChange}
                    placeholder="admin@apollo.org"
                    required
                  />
                  <Input
                    label="Initial Password"
                    name="adminPassword"
                    value={createForm.adminPassword}
                    onChange={handleCreateInputChange}
                    placeholder="12345678"
                    required
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setIsCreateOpen(false)} disabled={creating}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={creating}>
                  Provision Tenant
                </Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Created Credentials Modal */}
      {createdInfo && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-center gap-3 text-emerald-600">
              <CheckCircle2 className="w-6 h-6" />
              <h3 className="text-base font-bold text-slate-900">Tenant Provisioned!</h3>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Clinic <strong>{createdInfo.clinicName}</strong> has been registered. Initial credentials:
            </p>
            <div className="bg-slate-50 p-3 rounded-lg border border-slate-200 text-xs space-y-1 font-mono">
              <p>Email: {createdInfo.adminEmail}</p>
              <p>Password: {createdInfo.adminPassword}</p>
            </div>
            <div className="flex justify-end">
              <Button variant="primary" size="sm" onClick={() => setCreatedInfo(null)}>
                Got it
              </Button>
            </div>
          </div>
        </div>
      )}
    </ContentContainer>
  );
};

export default Organizations;
