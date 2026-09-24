import React, { useEffect, useState } from 'react';
import {
  User,
  Mail,
  Phone,
  Clock,
  Camera,
  Edit3,
  ShieldCheck
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { getMyDoctorProfileApi } from '../../api/doctor';
import { updateProfileApi, updateProfileImageApi } from '../../api/auth';
import { CardSkeleton } from '../../components/common/Skeleton';
import ErrorState from '../../components/common/ErrorState';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import OrganizationLogo from '../../components/common/OrganizationLogo';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { formatTimeRange } from '../../utils/formatTime';

const DAYS_OF_WEEK = [
  { key: 'monday', label: 'Monday' },
  { key: 'tuesday', label: 'Tuesday' },
  { key: 'wednesday', label: 'Wednesday' },
  { key: 'thursday', label: 'Thursday' },
  { key: 'friday', label: 'Friday' },
  { key: 'saturday', label: 'Saturday' },
  { key: 'sunday', label: 'Sunday' }
];

const DoctorProfile = () => {
  const { user, updateUser } = useAuth();

  const [doctor, setDoctor] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Edit Modal State
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [saving, setSaving] = useState(false);

  // Profile Image Upload State
  const [previewUrl, setPreviewUrl] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await getMyDoctorProfileApi();
      if (res?.data) {
        const doctorData = res.data.doctor || res.data;
        setDoctor(doctorData);

        const docUser = doctorData.userId || user || {};
        setEditName(docUser.name || '');
        setEditPhone(docUser.phone || '');
      }
    } catch (err) {
      setError(err.message || 'Failed to fetch doctor profile');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <ContentContainer className="space-y-6 pb-12">
        <PageHeader
          subtitle="Loading clinician credentials & profile details..."
        />
        <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
          <CardSkeleton count={1} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <CardSkeleton count={2} />
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer>
        <div className="py-12">
          <ErrorState message={error} onRetry={fetchProfile} />
        </div>
      </ContentContainer>
    );
  }

  const userObj = doctor?.userId || user || {};
  const doctorName = userObj.name || doctor?.name || 'Dr. Practitioner';
  const email = userObj.email || 'N/A';
  const phone = userObj.phone || doctor?.phone || 'N/A';
  const gender = doctor?.gender || userObj.gender || 'Not Specified';
  const specialization = doctor?.specialization || 'General Practice';
  const consultationFee = doctor?.consultationFee || 0;

  const getAssignedDepartments = (doc) => {
    if (!doc) return [];
    if (Array.isArray(doc.departmentIds) && doc.departmentIds.length > 0) {
      const names = doc.departmentIds
        .map((d) => (typeof d === 'object' && d?.name ? d.name : d))
        .filter(Boolean);
      if (names.length > 0) return names;
    }
    if (Array.isArray(doc.departments) && doc.departments.length > 0) {
      return doc.departments.filter(Boolean);
    }
    if (typeof doc.departmentId === 'object' && doc.departmentId?.name) {
      return [doc.departmentId.name];
    }
    if (typeof doc.departmentId === 'string' && doc.departmentId.trim()) {
      return [doc.departmentId.trim()];
    }
    return [];
  };

  const departmentList = getAssignedDepartments(doctor);
  const organizationName =
    typeof doctor?.organizationId === 'object'
      ? doctor.organizationId?.name
      : doctor?.organizationId || 'CareFlow Medical Center';

  const availableSchedule = Array.isArray(doctor?.available) ? doctor.available : [];
  const todayKey = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase();

  const scheduleList = DAYS_OF_WEEK.map(({ key, label }) => {
    const dayData = availableSchedule.find((item) => item?.day?.toLowerCase() === key);
    const isLeave = Boolean(
      dayData?.status === 'leave' ||
        dayData?.isLeave ||
        dayData?.onLeave ||
        (doctor?.onLeave && todayKey === key)
    );

    const isAvailable = Boolean(
      (dayData
        ? dayData.isAvailable
        : ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'].includes(key)) &&
        dayData?.status !== 'closed' &&
        dayData?.status !== 'off' &&
        !isLeave
    );

    const openTime = dayData?.open || '09:00';
    const closeTime = dayData?.close || '17:00';
    const isToday = todayKey === key;

    return {
      key,
      label,
      isAvailable,
      isLeave,
      isToday,
      timeRange: isAvailable
        ? formatTimeRange(openTime, closeTime)
        : isLeave
        ? 'On Leave'
        : 'Unavailable'
    };
  });

  const currentImageUrl =
    previewUrl ||
    (!imgError &&
      (userObj.profileImage?.url || userObj.profileImage || userObj.profilePicture?.url));

  const getInitials = (name) => {
    if (!name) return 'DR';
    const clean = name.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
    }
    return clean.slice(0, 2).toUpperCase() || 'DR';
  };

  const handleFileSelect = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showErrorToast('Please select a valid image file (JPEG, PNG, WEBP)');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('Image size must be under 5MB');
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('profileImage', file);

      const res = await updateProfileImageApi(formData);
      const updatedUser = res.data;

      updateUser({
        profileImage: updatedUser.profileImage || updatedUser.user?.profileImage
      });

      setImgError(false);
      showSuccessToast('Profile picture updated successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to update profile picture');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateProfileApi({ name: editName, phone: editPhone });
      const updatedUser = res.data;

      updateUser({
        name: updatedUser.name || editName,
        phone: updatedUser.phone || editPhone
      });

      setIsEditModalOpen(false);
      fetchProfile();
      showSuccessToast('Profile information updated successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to update profile');
    } finally {
      setSaving(false);
    }
  };

  return (
    <ContentContainer className="space-y-6 pb-12">
      {/* 1. Page Header */}
      <PageHeader
        subtitle="Manage your professional practitioner identity, consultation fees, and practice contact details."
        actions={
          <Button
            variant="primary"
            icon={Edit3}
            onClick={() => setIsEditModalOpen(true)}
            className="rounded-xl shadow-xs font-semibold"
          >
            Edit Profile
          </Button>
        }
      />

      {/* 2. Hero Profile Card */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          {/* Avatar & Professional Overview */}
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 min-w-0 flex-1">
            <div className="relative shrink-0 group">
              <div className="w-24 h-24 sm:w-28 sm:h-28 rounded-xl bg-blue-50 text-blue-700 font-bold text-3xl flex items-center justify-center border border-slate-200 overflow-hidden shadow-xs">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={doctorName}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials(doctorName)}</span>
                )}
              </div>

              <label
                htmlFor="doctor-profile-upload"
                className="absolute -bottom-1 -right-1 p-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white shadow-md cursor-pointer transition-transform hover:scale-105 border-2 border-white"
                title="Change Photo"
              >
                <Camera className="w-4 h-4" />
              </label>
              <input
                id="doctor-profile-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
                disabled={uploadingImage}
              />
            </div>

            <div className="space-y-2 text-center sm:text-left min-w-0 flex-1">
              <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 border border-blue-100 uppercase tracking-wider">
                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                <span>Verified Clinician</span>
              </div>

              <h3 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                {doctorName}
              </h3>

              <p className="text-sm font-medium text-slate-500">
                Medical Specialist · <span className="text-blue-600 font-semibold">{specialization}</span>
              </p>

              {/* Department Badges */}
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                {departmentList.length > 0 ? (
                  departmentList.map((dept, idx) => (
                    <span
                      key={idx}
                      className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200"
                    >
                      {dept}
                    </span>
                  ))
                ) : (
                  <span className="px-3 py-1 rounded-lg text-xs font-semibold bg-slate-100 text-slate-800 border border-slate-200">
                    General Medicine
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Affiliation Callout */}
          <div className="flex flex-col items-center md:items-end text-center md:text-right gap-2 border-t md:border-t-0 md:border-l border-slate-100 pt-4 md:pt-0 md:pl-6 shrink-0">
            <OrganizationLogo
              organization={doctor?.organizationId || doctor?.organization}
              logo={doctor?.organizationLogo || doctor?.organizationLogoUrl}
              size="md"
              className="rounded-xl border border-slate-200 shadow-2xs"
            />
            <div>
              <h4 className="text-sm font-bold text-slate-900">{organizationName}</h4>
              <p className="text-[11px] font-medium text-slate-400">
                Healthcare Facility Affiliation
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Two Column Credentials & Working Schedule Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Left Column: Personal Information & Fees */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
          <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
            <User className="w-4 h-4 text-blue-600" />
            <h4 className="text-base font-bold text-slate-900">Personal Information</h4>
          </div>

          <div className="space-y-3">
            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                EMAIL ADDRESS
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Mail className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{email}</span>
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                DIRECT PHONE
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Phone className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{phone}</span>
              </p>
            </div>

            <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/70 space-y-1">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                GENDER
              </span>
              <p className="text-xs sm:text-sm font-semibold text-slate-900 capitalize flex items-center gap-2">
                <User className="w-4 h-4 text-blue-600 shrink-0" />
                <span>{gender}</span>
              </p>
            </div>

            <div className="p-4 bg-gradient-to-r from-blue-50/80 to-white rounded-xl border border-blue-200/80 space-y-1">
              <span className="text-[10px] font-bold text-blue-800 uppercase tracking-wider block">
                CONSULTATION FEE
              </span>
              <div className="flex items-center justify-between">
                <p className="text-xl sm:text-2xl font-bold text-slate-900 font-sans">
                  ₹{consultationFee}
                </p>
                <span className="text-xs font-semibold text-slate-500">per patient appointment</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Active Schedule Overview */}
        <div className="rounded-xl border border-slate-200 bg-white p-6 space-y-5 shadow-xs">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-blue-600" />
              <h4 className="text-base font-bold text-slate-900">Weekly Operating Hours</h4>
            </div>
            <span className="text-xs font-semibold text-blue-600">Consultation Schedule</span>
          </div>

          <div className="divide-y divide-slate-100">
            {scheduleList.map((day) => (
              <div
                key={day.key}
                className={`py-2.5 px-3 rounded-xl transition-all flex items-center justify-between ${
                  day.isToday ? 'bg-blue-50/70 border border-blue-200/80 font-bold' : ''
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`text-xs ${
                      day.isToday ? 'font-bold text-blue-950' : 'text-slate-700 font-medium'
                    }`}
                  >
                    {day.label}
                  </span>
                  {day.isToday && (
                    <span className="px-1.5 py-0.5 rounded text-[9px] font-bold bg-blue-600 text-white uppercase tracking-wider">
                      TODAY
                    </span>
                  )}
                </div>

                {day.isAvailable ? (
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                    <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                    <span>{day.timeRange}</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-xs font-medium text-slate-400">
                    <span className="w-2 h-2 rounded-full bg-slate-300 shrink-0" />
                    <span>{day.timeRange}</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Edit Clinician Profile"
        subtitle="Update your full name and direct telephone contact"
        headerIcon={Edit3}
        maxWidth="max-w-md"
      >
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Full Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            required
            className="rounded-xl"
          />

          <Input
            label="Phone Number"
            value={editPhone}
            onChange={(e) => setEditPhone(e.target.value)}
            required
            className="rounded-xl"
          />

          <div className="flex justify-end gap-3 pt-3 border-t border-slate-100">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setIsEditModalOpen(false)}
              className="rounded-xl"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              loading={saving}
              className="rounded-xl shadow-xs font-bold"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </Modal>
    </ContentContainer>
  );
};

export default DoctorProfile;
