import React, { useEffect, useState, useMemo } from 'react';
import {
  User,
  MapPin,
  Edit3,
  Save,
  X,
  Plus,
  ShieldCheck,
  Camera,
  AlertCircle,
  Clock,
  KeyRound,
  IdCard,
  HeartPulse,
  Droplet
} from 'lucide-react';
import { getMyPatientProfileApi, updateMyPatientProfileApi } from '../../api/patient';
import { updateProfileImageApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import ErrorState from '../../components/common/ErrorState';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import ContentContainer from '../../components/layout/ContentContainer';
import { CardSkeleton } from '../../components/common/Skeleton';
import { normalizeAddress } from '../../utils/formatAddress';
import { formatDate } from '../../utils/formatDate';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

export const PatientProfile = () => {
  const { user, updateUser } = useAuth();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [isEditing, setIsEditing] = useState(false);

  // Form state
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    gender: 'male',
    dateOfBirth: '',
    bloodGroup: 'A+',
    street: '',
    city: '',
    state: '',
    pincode: ''
  });

  const [allergiesList, setAllergiesList] = useState([]);
  const [newAllergyInput, setNewAllergyInput] = useState('');
  const [uploadingImage, setUploadingImage] = useState(false);

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await getMyPatientProfileApi();
      const data = res.data?.patient || res.data;

      if (data) {
        setProfile(data);
        populateForm(data);
      }
    } catch (err) {
      setError(err.message || 'Failed to load patient medical profile');
    } finally {
      setLoading(false);
    }
  };

  const populateForm = (data) => {
    const normalizedAddr = normalizeAddress(data.address);

    setFormData({
      name: data.userId?.name || data.name || user?.name || '',
      phone: data.userId?.phone || data.phone || user?.phone || '',
      gender: data.gender || 'male',
      dateOfBirth: data.dateOfBirth ? String(data.dateOfBirth).split('T')[0] : '',
      bloodGroup: data.bloodGroup || 'A+',
      street: normalizedAddr.street,
      city: normalizedAddr.city,
      state: normalizedAddr.state,
      pincode: normalizedAddr.pincode
    });

    const existingAllergies = Array.isArray(data.allergies) ? data.allergies : [];
    setAllergiesList(existingAllergies);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddAllergy = () => {
    const trimmed = newAllergyInput.trim();
    if (!trimmed) return;
    if (allergiesList.includes(trimmed)) {
      showErrorToast('Allergy item already recorded.');
      return;
    }
    setAllergiesList((prev) => [...prev, trimmed]);
    setNewAllergyInput('');
  };

  const handleRemoveAllergy = (idx) => {
    setAllergiesList((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleImageChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const data = new FormData();
    data.append('profileImage', file);

    try {
      setUploadingImage(true);
      const res = await updateProfileImageApi(data);
      if (res.data?.user) {
        updateUser(res.data.user);
        showSuccessToast('Profile portrait updated successfully.');
        fetchProfile();
      }
    } catch (err) {
      showErrorToast(err.message || 'Failed to update portrait.');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e?.preventDefault();
    try {
      setSaving(true);
      const payload = {
        name: formData.name,
        phone: formData.phone,
        gender: formData.gender,
        dateOfBirth: formData.dateOfBirth || null,
        bloodGroup: formData.bloodGroup,
        allergies: allergiesList,
        address: {
          street: formData.street,
          city: formData.city,
          state: formData.state,
          pincode: formData.pincode
        }
      };

      const res = await updateMyPatientProfileApi(payload);
      const updated = res.data?.patient || res.data;
      if (updated) {
        setProfile(updated);
        populateForm(updated);
      }
      setIsEditing(false);
      showSuccessToast('Clinical dossier updated successfully.');
    } catch (err) {
      showErrorToast(err.message || 'Failed to save medical dossier.');
    } finally {
      setSaving(false);
    }
  };

  const patientName = formData.name || user?.name || 'Patient';
  const profileUrl = user?.profileImage?.url || profile?.profileImage?.url;
  const patientIdRaw = profile?._id || user?._id || 'PATIENT';
  const healthId = `CF-PAT-${String(patientIdRaw).slice(-6).toUpperCase()}`;

  // Calculate age if DOB exists
  let calculatedAge = null;
  if (formData.dateOfBirth) {
    const birthYear = new Date(formData.dateOfBirth).getFullYear();
    const currentYear = new Date().getFullYear();
    if (!isNaN(birthYear)) {
      calculatedAge = currentYear - birthYear;
    }
  }

  // Calculate profile completion percentage
  const completionPct = useMemo(() => {
    const fields = [
      formData.name,
      formData.phone,
      formData.gender,
      formData.dateOfBirth,
      formData.bloodGroup,
      formData.street,
      formData.city,
      formData.state,
      formData.pincode
    ];
    const filled = fields.filter((f) => f && String(f).trim().length > 0).length;
    return Math.round((filled / fields.length) * 100);
  }, [formData]);

  if (loading) {
    return (
      <ContentContainer maxWidth="6xl" className="space-y-4">
        <div className="h-20 bg-white rounded-xl border border-slate-200/80 p-4 animate-pulse" />
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <CardSkeleton />
          <CardSkeleton />
        </div>
      </ContentContainer>
    );
  }

  if (error) {
    return (
      <ContentContainer maxWidth="6xl">
        <ErrorState message={error} onRetry={fetchProfile} />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer maxWidth="6xl" className="space-y-4 font-sans">
      {/* 1. Header Action Strip */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-1 border-b border-slate-200/80">
        <div>
          <p className="text-xs text-slate-500 font-medium">
            Clinical Health Dossier • Verified Patient Identity & Medical Specifications
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {isEditing ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (profile) populateForm(profile);
                  setIsEditing(false);
                }}
                icon={X}
              >
                Cancel
              </Button>
              <Button
                variant="primary"
                size="sm"
                onClick={handleSaveProfile}
                loading={saving}
                icon={Save}
              >
                Save Dossier
              </Button>
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsEditing(true)}
              icon={Edit3}
            >
              Edit Dossier
            </Button>
          )}
        </div>
      </div>

      {/* 2. Patient Identity Hero with Circular ("crcly") Vitals & Integrity Ring */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Identity & Avatar */}
          <div className="flex items-center gap-4 min-w-0">
            <div className="relative w-16 h-16 sm:w-18 sm:h-18 shrink-0">
              <div className="w-16 h-16 sm:w-18 sm:h-18 rounded-xl bg-blue-50 text-blue-700 font-bold text-lg sm:text-xl flex items-center justify-center border-2 border-slate-200 overflow-hidden shadow-2xs">
                {profileUrl ? (
                  <img src={profileUrl} alt={patientName} className="w-full h-full object-cover" />
                ) : (
                  <span>{patientName.slice(0, 2).toUpperCase()}</span>
                )}
              </div>
              <label
                htmlFor="patient-avatar-upload"
                className="absolute -bottom-1 -right-1 p-1.5 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-colors cursor-pointer shadow-xs border border-white"
                title="Update portrait photo"
              >
                <Camera className="w-3 h-3" />
                <input
                  id="patient-avatar-upload"
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  disabled={uploadingImage}
                  className="hidden"
                />
              </label>
            </div>

            <div className="space-y-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight truncate">
                  {patientName}
                </h2>
                <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-700 text-[11px] font-semibold border border-emerald-200 shrink-0">
                  <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                  Verified Patient Record
                </span>
              </div>

              <div className="flex items-center gap-3 text-xs text-slate-500 font-medium flex-wrap pt-0.5">
                <span className="inline-flex items-center gap-1 font-mono text-slate-700 font-bold bg-slate-100 px-2 py-0.5 rounded text-[11px]">
                  <IdCard className="w-3 h-3 text-slate-500" />
                  {healthId}
                </span>
                <span className="truncate">{user?.email || 'Email verified'}</span>
                {formData.phone && <span>• {formData.phone}</span>}
              </div>
            </div>
          </div>

          {/* Circular ("crcly") Clinical Indicators */}
          <div className="flex items-center gap-2.5 sm:gap-3 flex-wrap lg:flex-nowrap shrink-0 border-t lg:border-t-0 pt-3 lg:pt-0 border-slate-100">
            {/* 1. Circular Dossier Progress Ring */}
            <div className="flex items-center gap-2.5 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="relative w-9 h-9 flex items-center justify-center shrink-0">
                <svg className="w-9 h-9 transform -rotate-90" viewBox="0 0 36 36">
                  <circle cx="18" cy="18" r="14" stroke="#E2E8F0" strokeWidth="3" fill="transparent" />
                  <circle
                    cx="18"
                    cy="18"
                    r="14"
                    stroke="#2563EB"
                    strokeWidth="3"
                    fill="transparent"
                    strokeDasharray="87.96"
                    strokeDashoffset={87.96 * (1 - completionPct / 100)}
                    strokeLinecap="round"
                    className="transition-all duration-700 ease-out"
                  />
                </svg>
                <span className="absolute text-[10px] font-bold text-slate-800 font-mono">
                  {completionPct}%
                </span>
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Dossier
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {completionPct === 100 ? 'Complete' : 'In Progress'}
                </span>
              </div>
            </div>

            {/* 2. Circular Blood Group Marker */}
            <div className="flex items-center gap-2.5 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-rose-50 text-rose-700 border-2 border-rose-200 flex items-center justify-center font-extrabold text-xs shadow-2xs shrink-0">
                {formData.bloodGroup || 'O+'}
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Blood Group
                </span>
                <span className="text-xs font-bold text-slate-800">
                  Rh Factor Match
                </span>
              </div>
            </div>

            {/* 3. Circular Adverse Drug Safety Status */}
            <div className="flex items-center gap-2.5 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className={`w-9 h-9 rounded-full flex items-center justify-center font-bold text-xs border-2 shadow-2xs shrink-0 ${
                allergiesList.length > 0
                  ? 'bg-amber-50 text-amber-700 border-amber-300'
                  : 'bg-emerald-50 text-emerald-700 border-emerald-300'
              }`}>
                {allergiesList.length > 0 ? allergiesList.length : '✓'}
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Drug Safety
                </span>
                <span className="text-xs font-bold text-slate-800">
                  {allergiesList.length > 0 ? `${allergiesList.length} Noted` : '0 Drug Flags'}
                </span>
              </div>
            </div>

            {/* 4. Circular Security & Encryption Status */}
            <div className="hidden sm:flex items-center gap-2.5 bg-slate-50/80 px-3 py-1.5 rounded-xl border border-slate-200/80 shadow-2xs">
              <div className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-700 border-2 border-indigo-200 flex items-center justify-center shadow-2xs shrink-0">
                <ShieldCheck className="w-4 h-4 text-indigo-600" />
              </div>
              <div className="leading-tight">
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                  Vault Security
                </span>
                <span className="text-xs font-bold text-slate-800">
                  AES-256 Active
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* 3. Core Specification Matrix: 2 Responsive Columns Filling the Viewport */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 items-stretch">
        {/* Left Column: Demographics & Biological Attributes */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3.5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <HeartPulse className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Demographics & Biological Attributes
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Clinical Data
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Date of Birth</label>
                <Input
                  type="date"
                  name="dateOfBirth"
                  value={formData.dateOfBirth}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="text-xs py-1.5"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Calculated Age</label>
                <div className="h-9 px-3 rounded-lg bg-slate-50 border border-slate-200/80 flex items-center text-slate-800 font-semibold text-xs">
                  {calculatedAge !== null ? `${calculatedAge} Years` : 'Not determined'}
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Gender Identity</label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                  <option value="other">Other / Non-binary</option>
                </select>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">Blood Group & Rh Factor</label>
                <select
                  name="bloodGroup"
                  value={formData.bloodGroup}
                  onChange={handleChange}
                  disabled={!isEditing}
                  className="w-full text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 py-1.5 px-2.5 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-50 disabled:text-slate-500"
                >
                  {['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'].map((bg) => (
                    <option key={bg} value={bg}>
                      {bg}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Integrated Clinical Sensitivities & Allergies Section */}
          <div className="pt-3 border-t border-slate-100">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span className="font-semibold text-slate-800 text-xs">
                  Documented Sensitivities & Allergies
                </span>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-600 bg-rose-50 px-2 py-0.5 rounded">
                Safety Guard
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5 min-h-[32px]">
              {allergiesList.length > 0 ? (
                allergiesList.map((allergy, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-md bg-rose-50 text-rose-700 border border-rose-200/80 font-semibold text-xs flex items-center gap-1.5 shadow-2xs"
                  >
                    <span>{allergy}</span>
                    {isEditing && (
                      <button
                        type="button"
                        onClick={() => handleRemoveAllergy(idx)}
                        className="text-rose-500 hover:text-rose-800 transition-colors cursor-pointer"
                        title="Remove allergy"
                      >
                        ×
                      </button>
                    )}
                  </span>
                ))
              ) : (
                <span className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200/70 block w-full">
                  No documented allergies or drug sensitivities on record.
                </span>
              )}
            </div>

            {isEditing && (
              <div className="flex items-center gap-2 pt-2">
                <input
                  type="text"
                  value={newAllergyInput}
                  onChange={(e) => setNewAllergyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleAddAllergy();
                    }
                  }}
                  placeholder="Add sensitivity (e.g. Penicillin, Latex)..."
                  className="flex-1 text-xs font-medium text-slate-900 bg-white rounded-lg border border-slate-200 py-1.5 px-3 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600"
                />
                <Button
                  type="button"
                  variant="primary"
                  size="sm"
                  onClick={handleAddAllergy}
                  icon={Plus}
                  className="text-xs py-1.5 px-3"
                >
                  Add
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Contact & Residential Coordinates */}
        <div className="bg-white rounded-xl border border-slate-200/80 p-4 sm:p-5 shadow-2xs flex flex-col justify-between space-y-3.5">
          <div>
            <div className="flex items-center justify-between border-b border-slate-100 pb-2.5 mb-3.5">
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4 text-blue-600" />
                <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                  Contact & Residential Coordinates
                </h3>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Coordinates
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              <div className="sm:col-span-2">
                <Input
                  label="Street Address"
                  name="street"
                  value={formData.street}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="123 Health Ave, Suite 400"
                  className="text-xs py-1.5"
                />
              </div>

              <Input
                label="City"
                name="city"
                value={formData.city}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="City"
                className="text-xs py-1.5"
              />

              <Input
                label="State / Province"
                name="state"
                value={formData.state}
                onChange={handleChange}
                disabled={!isEditing}
                placeholder="State"
                className="text-xs py-1.5"
              />

              <div className="sm:col-span-2">
                <Input
                  label="Postal Code / PIN"
                  name="pincode"
                  value={formData.pincode}
                  onChange={handleChange}
                  disabled={!isEditing}
                  placeholder="Postal code"
                  className="text-xs py-1.5"
                />
              </div>
            </div>
          </div>

          {/* Residential Verification Micro-badge */}
          <div className="pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
            <span className="text-[11px] font-medium text-slate-500">
              Billing & Clinical Dispatch Address
            </span>
            <span className="font-semibold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full border border-blue-100 text-[11px]">
              Active Primary Residence
            </span>
          </div>
        </div>
      </div>

    </ContentContainer>
  );
};

export default PatientProfile;
