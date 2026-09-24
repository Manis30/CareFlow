import React, { useEffect, useState } from 'react';
import {
  Building2,
  Stethoscope,
  CheckCircle2,
  Edit3,
  Save,
  X,
  MapPin,
  Phone,
  Mail,
  User,
  Clock3,
  Camera,
  Trash2,
  Calendar
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfileApi, updateProfileImageApi } from '../../api/auth';
import { getDoctorsApi } from '../../api/doctor';
import { getDepartmentsApi } from '../../api/department';
import {
  getMyOrganizationApi,
  updateMyOrganizationApi,
  updateMyOrganizationLogoApi,
  removeMyOrganizationLogoApi
} from '../../api/organization';
import Loader from '../../components/common/Loader';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Modal from '../../components/common/Modal';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import ClinicLocationMap from '../../components/common/ClinicLocationMap';
import ClinicLocationPicker from '../../components/common/ClinicLocationPicker';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { formatAddress } from '../../utils/formatAddress';
import { formatTime } from '../../utils/formatTime';
import { formatOrganizationName } from '../../utils/formatters';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const match = timeStr.match(/(\d+):(\d+)\s*(AM|PM)?/i);
  if (!match) return 0;
  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const period = match[3]?.toUpperCase();
  if (period === 'PM' && hours < 12) hours += 12;
  if (period === 'AM' && hours === 12) hours = 0;
  return hours * 60 + minutes;
};

const AdminProfile = () => {
  const { user, updateUser } = useAuth();
  const [docCount, setDocCount] = useState(0);
  const [deptCount, setDeptCount] = useState(0);

  // Admin User Profile Edit State
  const [isAdminEditing, setIsAdminEditing] = useState(false);
  const [adminName, setAdminName] = useState(user?.name || '');
  const [adminPhone, setAdminPhone] = useState(user?.phone || '');
  const [savingAdmin, setSavingAdmin] = useState(false);

  // Admin Profile Image Upload State
  const [adminImgPreview, setAdminImgPreview] = useState(null);
  const [selectedAdminImg, setSelectedAdminImg] = useState(null);
  const [uploadingAdminImg, setUploadingAdminImg] = useState(false);

  // Clinic Organization State
  const [org, setOrg] = useState(null);
  const [loadingOrg, setLoadingOrg] = useState(true);
  const [savingOrg, setSavingOrg] = useState(false);
  const [orgError, setOrgError] = useState('');
  const [isEditingOrg, setIsEditingOrg] = useState(false);
  const [isManageScheduleOpen, setIsManageScheduleOpen] = useState(false);

  // Clinic Logo upload preview state
  const [logoPreview, setLogoPreview] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [removingLogo, setRemovingLogo] = useState(false);
  const [hoveredRowKey, setHoveredRowKey] = useState(null);

  const handleLogoUploadDirect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setUploadingLogo(true);
      const res = await updateMyOrganizationLogoApi(file);
      const updatedOrg = res.data?.organization || res.data || res;
      setOrg(updatedOrg);
      const newLogoUrl = updatedOrg?.logo?.url || updatedOrg?.logo || updatedOrg?.organizationLogo || '';
      setLogoPreview(newLogoUrl);
      if (user && updatedOrg) {
        updateUser({ ...user, organizationId: updatedOrg });
      }
      showSuccessToast('Organization logo updated successfully.');
    } catch (err) {
      showErrorToast(err.message || 'Unable to upload organization logo.');
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleRemoveLogoDirect = async () => {
    try {
      setRemovingLogo(true);
      const res = await removeMyOrganizationLogoApi();
      const updatedOrg = res.data?.organization || res.data || res;
      setOrg(updatedOrg);
      setLogoPreview('');
      if (user && updatedOrg) {
        updateUser({ ...user, organizationId: updatedOrg });
      }
      showSuccessToast('Organization logo removed successfully.');
    } catch (err) {
      showErrorToast(err.message || 'Failed to remove organization logo.');
    } finally {
      setRemovingLogo(false);
    }
  };

  // Form State for Organization Profile
  const [orgForm, setOrgForm] = useState({
    name: '',
    email: '',
    phone: '',
    street: '',
    city: '',
    state: '',
    country: '',
    pincode: '',
    latitude: 11.9401,
    longitude: 79.4861
  });

  const [scheduleForm, setScheduleForm] = useState([]);

  useEffect(() => {
    fetchMetrics();
    fetchOrganizationData();
  }, []);

  useEffect(() => {
    if (user) {
      setAdminName(user.name || '');
      setAdminPhone(user.phone || '');
    }
  }, [user]);

  const fetchMetrics = async () => {
    try {
      const [docsRes, deptsRes] = await Promise.all([
        getDoctorsApi().catch(() => ({ data: [] })),
        getDepartmentsApi().catch(() => ({ data: [] }))
      ]);
      const docsList = docsRes?.data?.doctors || docsRes?.data || (Array.isArray(docsRes) ? docsRes : []);
      setDocCount(Array.isArray(docsList) ? docsList.length : 0);

      const deptsList = deptsRes?.data || (Array.isArray(deptsRes) ? deptsRes : []);
      setDeptCount(Array.isArray(deptsList) ? deptsList.length : 0);
    } catch (e) {}
  };

  const fetchOrganizationData = async () => {
    try {
      setLoadingOrg(true);
      setOrgError('');

      const res = await getMyOrganizationApi();
      const data = res.data?.organization || res.data;

      if (data) {
        setOrg(data);
        populateOrgForm(data);
        populateScheduleForm(data.workingHours);
      }
    } catch (err) {
      setOrgError(err.message || 'Failed to load clinic organization profile');
    } finally {
      setLoadingOrg(false);
    }
  };

  const populateOrgForm = (data) => {
    const addr = typeof data.address === 'object' && data.address !== null ? data.address : {};

    setOrgForm({
      name: data.name || '',
      email: data.email || '',
      phone: data.phone || '',
      street: addr.street || '',
      city: addr.city || '',
      state: addr.state || '',
      country: addr.country || 'India',
      pincode: addr.pincode || '',
      latitude: addr.latitude !== undefined && addr.latitude !== null ? Number(addr.latitude) : 11.9401,
      longitude: addr.longitude !== undefined && addr.longitude !== null ? Number(addr.longitude) : 79.4861
    });

    if (data.logo?.url || data.logo) {
      setLogoPreview(data.logo?.url || data.logo);
    }
  };

  const populateScheduleForm = (workingHours = []) => {
    const hoursMap = {};
    if (Array.isArray(workingHours)) {
      workingHours.forEach((wh) => {
        if (wh && wh.day) hoursMap[wh.day.toLowerCase()] = wh;
      });
    }

    const defaultList = DAYS_OF_WEEK.map(({ key }) => {
      const existing = hoursMap[key];
      return {
        day: key,
        status: existing?.status || (key === 'sunday' ? 'CLOSED' : key === 'saturday' ? 'HALF_DAY' : 'OPEN'),
        open: existing?.open || '09:00 AM',
        close: existing?.close || existing?.clode || (key === 'saturday' ? '02:00 PM' : '09:00 PM')
      };
    });
    setScheduleForm(defaultList);
  };

  const handleAdminImgSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showErrorToast('Please select a valid image file');
      return;
    }

    setSelectedAdminImg(file);
    setAdminImgPreview(URL.createObjectURL(file));
  };

  const handleSaveAdminImg = async () => {
    if (!selectedAdminImg) return;
    try {
      setUploadingAdminImg(true);
      const formData = new FormData();
      formData.append('profileImage', selectedAdminImg);

      const res = await updateProfileImageApi(formData);
      if (res.data?.user) {
        updateUser(res.data.user);
        setSelectedAdminImg(null);
        showSuccessToast('Administrator profile photo updated!');
      }
    } catch (err) {
      showErrorToast(err.message || 'Failed to upload admin photo');
    } finally {
      setUploadingAdminImg(false);
    }
  };

  const handleSaveAdminProfile = async (e) => {
    e.preventDefault();
    try {
      setSavingAdmin(true);
      const res = await updateProfileApi({ name: adminName, phone: adminPhone });
      if (res.data?.user) {
        updateUser(res.data.user);
        setIsAdminEditing(false);
        showSuccessToast('Administrator profile details updated!');
      }
    } catch (err) {
      showErrorToast(err.message || 'Failed to update administrator profile');
    } finally {
      setSavingAdmin(false);
    }
  };

  const handleSaveOrg = async (e) => {
    e.preventDefault();
    try {
      setSavingOrg(true);
      const payload = {
        name: orgForm.name,
        email: orgForm.email,
        phone: orgForm.phone,
        address: {
          street: orgForm.street,
          city: orgForm.city,
          state: orgForm.state,
          country: orgForm.country,
          pincode: orgForm.pincode,
          latitude: orgForm.latitude,
          longitude: orgForm.longitude
        }
      };

      const res = await updateMyOrganizationApi(payload);
      const updatedOrg = res.data?.organization || res.data;
      if (updatedOrg) {
        setOrg(updatedOrg);
        if (user) updateUser({ ...user, organizationId: updatedOrg });
      }

      setIsEditingOrg(false);
      showSuccessToast('Clinic facility information saved successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to save clinic facility details');
    } finally {
      setSavingOrg(false);
    }
  };

  const handleSaveSchedule = async (e) => {
    e.preventDefault();
    try {
      setSavingOrg(true);
      const payload = {
        workingHours: scheduleForm.map((s) => ({
          day: s.day,
          status: s.status,
          isOpen: s.status === 'OPEN' || s.status === 'HALF_DAY',
          open: (s.status === 'OPEN' || s.status === 'HALF_DAY') ? s.open : '',
          close: (s.status === 'OPEN' || s.status === 'HALF_DAY') ? s.close : '',
          clode: (s.status === 'OPEN' || s.status === 'HALF_DAY') ? s.close : ''
        }))
      };

      const res = await updateMyOrganizationApi(payload);
      const updatedOrg = res.data?.organization || res.data;
      if (updatedOrg) setOrg(updatedOrg);

      showSuccessToast('Clinic working hours schedule updated!');
      setIsManageScheduleOpen(false);
    } catch (err) {
      showErrorToast(err.message || 'Failed to update schedule');
    } finally {
      setSavingOrg(false);
    }
  };

  const getAdminInitials = () => {
    const rawName = user?.name || adminName || '';
    if (!rawName) return 'CA';
    const parts = rawName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    return rawName.slice(0, 2).toUpperCase();
  };

  const hoursMap = {};
  if (org && Array.isArray(org.workingHours)) {
    org.workingHours.forEach((wh) => {
      if (wh && wh.day) hoursMap[wh.day.toLowerCase()] = wh;
    });
  }

  const formattedOrgName = formatOrganizationName(org?.name);
  const currentAdminImg = adminImgPreview || user?.profileImage?.url || user?.profileImage;

  if (loadingOrg) {
    return (
      <ContentContainer maxWidth="7xl">
        <div className="space-y-6">
          <div className="h-8 w-64 bg-slate-200 rounded-lg animate-pulse mb-6" />
          <CardSkeleton count={1} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <CardSkeleton count={1} />
            <CardSkeleton count={1} />
          </div>
          <CardSkeleton count={1} />
        </div>
      </ContentContainer>
    );
  }

  if (orgError) {
    return (
      <ContentContainer maxWidth="7xl">
        <ErrorState message={orgError} onRetry={fetchOrganizationData} />
      </ContentContainer>
    );
  }

  const todayDayName = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const scheduleCalculations = DAYS_OF_WEEK.map(({ key, label }) => {
    const dayData = hoursMap[key];
    const rawStatus = (dayData?.status || (key === 'sunday' ? 'CLOSED' : key === 'saturday' ? 'HALF_DAY' : 'OPEN')).toUpperCase();
    const openTime = dayData?.open || (rawStatus === 'HALF_DAY' ? '09:00 AM' : rawStatus === 'OPEN' ? '09:00 AM' : '');
    const closeTime = dayData?.close || dayData?.clode || (rawStatus === 'HALF_DAY' ? '02:00 PM' : rawStatus === 'OPEN' ? '09:00 PM' : '');

    let workingMins = 0;
    if (rawStatus === 'OPEN' || rawStatus === 'HALF_DAY') {
      const startMins = parseTimeToMinutes(openTime);
      const endMins = parseTimeToMinutes(closeTime);
      if (endMins > startMins) {
        workingMins = endMins - startMins;
      }
    }

    return {
      key,
      label,
      rawStatus,
      openTime,
      closeTime,
      workingMins,
      isToday: key === todayDayName
    };
  });

  const maxWorkingMins = Math.max(...scheduleCalculations.map((s) => s.workingMins), 1);
  const activeDaysCount = scheduleCalculations.filter((s) => s.workingMins > 0).length;

  return (
    <ContentContainer maxWidth="7xl">
      <PageHeader
        subtitle="Manage facility credentials, operations administrator dossier, geolocation, and operating schedule."
      />

      {/* 1. Clinic Hero Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-6 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6 border-b border-slate-100 pb-6">
          <div className="flex items-center gap-5 min-w-0">
            <div className="relative shrink-0">
              <OrganizationLogo
                organization={org || user?.organizationId}
                logo={logoPreview || org?.logo}
                size="xl"
                className="rounded-xl border-2 border-slate-200/80 shadow-2xs"
              />
            </div>
            <div className="space-y-2 min-w-0">
              <h2 className="text-2xl sm:text-3xl font-bold text-slate-900 truncate tracking-tight">
                {formattedOrgName}
              </h2>

              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-100">
                  <Stethoscope className="w-3.5 h-3.5 text-blue-600" /> {docCount} Clinicians
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-700 border border-slate-200">
                  <Building2 className="w-3.5 h-3.5 text-slate-500" /> {deptCount} Departments
                </span>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-100">
                  <Clock3 className="w-3.5 h-3.5 text-emerald-600" /> {activeDaysCount} Days Active
                </span>
              </div>
            </div>
          </div>

          {/* Action Controls */}
          <div className="flex items-center gap-2.5 shrink-0 flex-wrap">
            <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white text-slate-700 border border-slate-200 hover:bg-slate-50 shadow-2xs transition-colors">
              <Camera className="w-3.5 h-3.5 text-blue-600" />
              <span>{uploadingLogo ? 'Uploading...' : 'Change Logo'}</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/jpg,image/webp"
                onChange={handleLogoUploadDirect}
                disabled={uploadingLogo}
                className="hidden"
              />
            </label>

            {(logoPreview || org?.logo) && (
              <button
                type="button"
                onClick={handleRemoveLogoDirect}
                disabled={removingLogo}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 border border-rose-200 transition-colors cursor-pointer"
                title="Remove Logo"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}

            <Button
              variant={isEditingOrg ? 'outline' : 'primary'}
              size="sm"
              icon={isEditingOrg ? X : Edit3}
              onClick={() => {
                if (isEditingOrg) populateOrgForm(org);
                setIsEditingOrg(!isEditingOrg);
              }}
            >
              {isEditingOrg ? 'Cancel' : 'Edit Facility'}
            </Button>
          </div>
        </div>

        {/* Contact Info or Inline Edit */}
        {isEditingOrg ? (
          <form onSubmit={handleSaveOrg} className="space-y-4 pt-1">
            <Input
              label="Clinic / Organization Name"
              name="name"
              value={orgForm.name}
              onChange={(e) => setOrgForm({ ...orgForm, name: e.target.value })}
              required
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input
                label="Contact Email"
                type="email"
                name="email"
                value={orgForm.email}
                onChange={(e) => setOrgForm({ ...orgForm, email: e.target.value })}
                required
              />
              <Input
                label="Contact Phone"
                name="phone"
                value={orgForm.phone}
                onChange={(e) => setOrgForm({ ...orgForm, phone: e.target.value })}
                required
              />
            </div>

            <div className="pt-2 border-t border-slate-100 space-y-3">
              <ClinicLocationPicker
                initialAddress={{
                  street: orgForm.street,
                  city: orgForm.city,
                  state: orgForm.state,
                  country: orgForm.country,
                  pincode: orgForm.pincode
                }}
                initialLatitude={orgForm.latitude}
                initialLongitude={orgForm.longitude}
                onChange={(loc) => {
                  setOrgForm((prev) => ({
                    ...prev,
                    street: loc.street || prev.street,
                    city: loc.city || prev.city,
                    state: loc.state || prev.state,
                    country: loc.country || prev.country,
                    pincode: loc.pincode || prev.pincode,
                    latitude: loc.latitude,
                    longitude: loc.longitude
                  }));
                }}
              />

              <Input
                label="Street Address"
                name="street"
                value={orgForm.street}
                onChange={(e) => setOrgForm({ ...orgForm, street: e.target.value })}
              />

              <div className="grid grid-cols-3 gap-3">
                <Input
                  label="City"
                  name="city"
                  value={orgForm.city}
                  onChange={(e) => setOrgForm({ ...orgForm, city: e.target.value })}
                />
                <Input
                  label="State"
                  name="state"
                  value={orgForm.state}
                  onChange={(e) => setOrgForm({ ...orgForm, state: e.target.value })}
                />
                <Input
                  label="Pincode"
                  name="pincode"
                  value={orgForm.pincode}
                  onChange={(e) => setOrgForm({ ...orgForm, pincode: e.target.value })}
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
              <Button variant="outline" type="button" size="sm" onClick={() => setIsEditingOrg(false)} disabled={savingOrg}>
                Cancel
              </Button>
              <Button variant="primary" type="submit" size="sm" loading={savingOrg} icon={Save}>
                Save Facility Changes
              </Button>
            </div>
          </form>
        ) : (
          <div className="w-full bg-slate-50/70 border border-slate-200/80 rounded-xl p-4 flex flex-col md:flex-row items-stretch md:items-center divide-y md:divide-y-0 md:divide-x divide-slate-200 gap-3 md:gap-0">
            <div className="flex items-center gap-3 md:pr-6 md:w-[28%] shrink-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Mail className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">OFFICIAL EMAIL</p>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{org?.email || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:px-6 md:w-[24%] shrink-0 pt-3 md:pt-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <Phone className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">TELEPHONE</p>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">{org?.phone || 'N/A'}</p>
              </div>
            </div>

            <div className="flex items-center gap-3 md:pl-6 flex-1 min-w-0 pt-3 md:pt-0">
              <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 border border-blue-100">
                <MapPin className="w-4 h-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">FACILITY ADDRESS</p>
                <p className="text-xs font-bold text-slate-900 truncate mt-0.5">
                  {formatAddress(org?.address) || 'No address specified'}
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 2. Balanced 2-Column: Admin Profile + Geolocation Map */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch mb-6">
        {/* Left: Organization Admin Dossier */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col justify-between h-full space-y-5">
          <div className="space-y-4">
            <div className="border-b border-slate-100 pb-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600" />
                <h3 className="text-sm font-bold text-slate-900">
                  Operations Administrator
                </h3>
              </div>
              <Button
                variant="ghost"
                size="sm"
                icon={isAdminEditing ? X : Edit3}
                onClick={() => setIsAdminEditing(!isAdminEditing)}
                className="text-xs"
              >
                {isAdminEditing ? 'Cancel' : 'Edit Admin'}
              </Button>
            </div>

            {/* Profile Avatar & Info */}
            <div className="flex items-center gap-4 pt-1">
              <div className="relative group shrink-0">
                <div className="w-16 h-16 rounded-full bg-blue-50 text-blue-700 font-bold text-xl flex items-center justify-center border-2 border-white shadow-md overflow-hidden ring-1 ring-slate-200/80">
                  {currentAdminImg ? (
                    <img src={currentAdminImg} alt={user?.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{getAdminInitials()}</span>
                  )}
                </div>
                <label className="absolute bottom-0 right-0 bg-blue-600 hover:bg-blue-700 text-white p-1.5 rounded-full cursor-pointer shadow-md transition-colors border-2 border-white">
                  <Camera className="w-3 h-3" />
                  <input type="file" accept="image/*" onChange={handleAdminImgSelect} className="hidden" />
                </label>
              </div>

              <div className="min-w-0 flex-1 space-y-0.5">
                <div className="flex items-center gap-2">
                  <h4 className="text-base font-bold text-slate-900 truncate">{user?.name || 'Admin User'}</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 shrink-0">
                    Clinic Admin
                  </span>
                </div>
                <p className="text-xs text-slate-500 font-medium">Operations & Clinical Load Manager</p>
              </div>
            </div>

            {selectedAdminImg && (
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-100 flex items-center justify-between gap-2">
                <span className="text-xs text-blue-800 font-bold truncate">New portrait selected</span>
                <Button size="sm" onClick={handleSaveAdminImg} disabled={uploadingAdminImg} className="text-xs px-3 py-1">
                  {uploadingAdminImg ? 'Saving...' : 'Save Photo'}
                </Button>
              </div>
            )}
          </div>

          <div>
            {isAdminEditing ? (
              <form onSubmit={handleSaveAdminProfile} className="space-y-3">
                <Input label="Administrator Name" value={adminName} onChange={(e) => setAdminName(e.target.value)} required />
                <Input label="Direct Phone Number" value={adminPhone} onChange={(e) => setAdminPhone(e.target.value)} />
                <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                  <Button type="button" variant="outline" size="sm" onClick={() => setIsAdminEditing(false)}>Cancel</Button>
                  <Button type="submit" size="sm" disabled={savingAdmin}>{savingAdmin ? 'Saving...' : 'Save Details'}</Button>
                </div>
              </form>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-slate-100">
                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">LOGIN EMAIL</p>
                    <p className="text-xs font-bold text-slate-900 truncate pt-0.5">{user?.email || 'N/A'}</p>
                  </div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-50/70 border border-slate-200/70 flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-50 text-blue-600 shrink-0">
                    <Phone className="w-4 h-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">DIRECT PHONE</p>
                    <p className="text-xs font-bold text-slate-900 truncate pt-0.5">{user?.phone || 'N/A'}</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Geolocation Map */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs flex flex-col h-full">
          <ClinicLocationMap
            clinicName={formattedOrgName}
            address={org?.address}
            latitude={org?.address?.latitude}
            longitude={org?.address?.longitude}
            mapUrl={org?.address?.mapUrl}
            className="w-full flex-1 h-full min-h-[220px]"
          />
        </div>
      </div>

      {/* 3. Weekly Operating Schedule */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 shrink-0 border border-blue-100">
              <Clock3 className="w-4.5 h-4.5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-slate-900">
                Weekly Operating Schedule
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Facility consultation operating windows & outpatient hours
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 shrink-0 self-start sm:self-auto">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-blue-50 text-blue-700 border border-blue-100">
              {activeDaysCount} Days Active
            </span>

            <Button
              variant="outline"
              size="sm"
              icon={Clock3}
              onClick={() => setIsManageScheduleOpen(true)}
            >
              Manage Schedule
            </Button>
          </div>
        </div>

        {/* Schedule Timeline Rows */}
        <div className="border border-slate-200/80 rounded-xl overflow-hidden bg-white shadow-2xs">
          <div className="grid grid-cols-12 gap-3 px-5 py-2.5 bg-slate-50/80 border-b border-slate-200/80 text-[10px] font-bold text-slate-400 uppercase tracking-wider items-center text-center">
            <div className="col-span-2 text-left">DAY</div>
            <div className="col-span-5 text-center">AVAILABILITY TRACK</div>
            <div className="col-span-3 text-center">TIME WINDOW</div>
            <div className="col-span-2 text-center">STATUS</div>
          </div>

          <div className="divide-y divide-slate-100">
            {scheduleCalculations.map((item) => {
              const percentage = item.workingMins > 0 ? Math.round((item.workingMins / maxWorkingMins) * 100) : 0;
              const hoursDecimal = item.workingMins > 0 ? (item.workingMins / 60).toFixed(1).replace('.0', '') : 0;

              return (
                <div
                  key={item.key}
                  onMouseEnter={() => setHoveredRowKey(item.key)}
                  className={`grid grid-cols-12 gap-3 px-5 py-3.5 items-center relative text-xs transition-colors group ${
                    item.isToday
                      ? 'bg-blue-50/50 border-l-4 border-l-blue-600'
                      : 'hover:bg-slate-50/60'
                  }`}
                >
                  {/* Day */}
                  <div className="col-span-2 flex items-center gap-2">
                    <span className={`font-semibold capitalize ${item.isToday ? 'text-blue-700 font-bold' : 'text-slate-800'}`}>
                      {item.label}
                    </span>
                    {item.isToday && (
                      <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                        TODAY
                      </span>
                    )}
                  </div>

                  {/* Track */}
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
                      {item.workingMins > 0 ? `${hoursDecimal}h` : '0h'}
                    </span>
                  </div>

                  {/* Time Range */}
                  <div className="col-span-3 text-center">
                    {item.rawStatus === 'OPEN' || item.rawStatus === 'HALF_DAY' ? (
                      <span className="font-semibold text-slate-900">
                        {formatTime(item.openTime)} – {formatTime(item.closeTime)}
                      </span>
                    ) : (
                      <span className="text-slate-400 font-normal">Closed</span>
                    )}
                  </div>

                  {/* Status */}
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

      {/* Manage Schedule Modal */}
      <Modal
        isOpen={isManageScheduleOpen}
        onClose={() => setIsManageScheduleOpen(false)}
        title="Manage Clinic Working Hours Schedule"
        subtitle="Configure operating days and facility open/close windows."
      >
        <form onSubmit={handleSaveSchedule} className="space-y-4 text-xs font-sans">
          <div className="divide-y divide-slate-100">
            {scheduleForm.map((item, idx) => (
              <div key={item.day} className="py-2.5 flex items-center justify-between gap-3">
                <span className="font-bold text-slate-900 capitalize w-24">{item.day}</span>
                <select
                  value={item.status}
                  onChange={(e) => {
                    const newList = [...scheduleForm];
                    newList[idx].status = e.target.value;
                    setScheduleForm(newList);
                  }}
                  className="p-2 rounded-xl border border-slate-200 text-xs font-semibold bg-white outline-none focus:border-blue-600"
                >
                  <option value="OPEN">OPEN</option>
                  <option value="HALF_DAY">HALF DAY</option>
                  <option value="CLOSED">CLOSED</option>
                  <option value="NOT_CONFIGURED">NOT CONFIG</option>
                </select>

                {item.status === 'OPEN' || item.status === 'HALF_DAY' ? (
                  <div className="flex items-center gap-1">
                    <input
                      type="text"
                      placeholder="09:00 AM"
                      value={item.open}
                      onChange={(e) => {
                        const newList = [...scheduleForm];
                        newList[idx].open = e.target.value;
                        setScheduleForm(newList);
                      }}
                      className="w-22 p-2 border border-slate-200 rounded-xl text-center text-xs font-semibold outline-none focus:border-blue-600"
                    />
                    <span className="text-slate-400">–</span>
                    <input
                      type="text"
                      placeholder="09:00 PM"
                      value={item.close}
                      onChange={(e) => {
                        const newList = [...scheduleForm];
                        newList[idx].close = e.target.value;
                        setScheduleForm(newList);
                      }}
                      className="w-22 p-2 border border-slate-200 rounded-xl text-center text-xs font-semibold outline-none focus:border-blue-600"
                    />
                  </div>
                ) : (
                  <span className="text-slate-400 italic">Facility Closed</span>
                )}
              </div>
            ))}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button variant="outline" type="button" onClick={() => setIsManageScheduleOpen(false)} disabled={savingOrg}>
              Cancel
            </Button>
            <Button variant="primary" type="submit" loading={savingOrg} icon={Save}>
              Save Schedule
            </Button>
          </div>
        </form>
      </Modal>
    </ContentContainer>
  );
};

export default AdminProfile;
