import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  User,
  Mail,
  Phone,
  IndianRupee,
  Award,
  Upload,
  AlertCircle,
  Camera,
  Trash2,
  Building2,
  ChevronDown,
  Search,
  X,
  Check,
  Save,
  Stethoscope
} from 'lucide-react';
import { getDoctorByIdApi, updateDoctorApi } from '../../api/doctor';
import { getDepartmentsApi } from '../../api/department';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import Loader from '../../components/common/Loader';
import ErrorState from '../../components/common/ErrorState';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import { showSuccessToast, showErrorToast } from '../../utils/toast';
import { cleanDoctorNameInput, formatDoctorName } from '../../utils/formatName';

const EditDoctor = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  const [departments, setDepartments] = useState([]);
  const [selectedDeptIds, setSelectedDeptIds] = useState([]);
  const [deptSearch, setDeptSearch] = useState('');
  const [isDeptDropdownOpen, setIsDeptDropdownOpen] = useState(false);
  const deptDropdownRef = useRef(null);

  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    gender: 'Male',
    specialization: '',
    qualification: '',
    consultationFee: 500
  });

  const [profileImage, setProfileImage] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [existingImageUrl, setExistingImageUrl] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  // Validation States
  const [errors, setErrors] = useState({});
  const [touched, setTouched] = useState({});

  useEffect(() => {
    fetchDoctorAndDepartments();
  }, [id]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (deptDropdownRef.current && !deptDropdownRef.current.contains(e.target)) {
        setIsDeptDropdownOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const fetchDoctorAndDepartments = async () => {
    try {
      setLoading(true);
      setError('');

      const [deptRes, docRes] = await Promise.all([
        getDepartmentsApi(),
        getDoctorByIdApi(id)
      ]);

      const list = deptRes?.data || (Array.isArray(deptRes) ? deptRes : []);
      const depts = Array.isArray(list) ? list : [];
      setDepartments(depts);

      const doctorData =
        docRes?.data?.doctor ||
        docRes?.data?.data?.doctor ||
        docRes?.data?.data ||
        docRes?.data ||
        docRes;

      if (!doctorData) {
        setError('Clinician profile details not found.');
        return;
      }

      const docUser = doctorData.userId || doctorData;
      setFormData({
        name: docUser.name || doctorData.name || '',
        email: docUser.email || doctorData.email || '',
        phone: docUser.phone || doctorData.phone || '',
        gender: doctorData.gender || docUser.gender || 'Male',
        specialization: doctorData.specialization || '',
        qualification: doctorData.qualification || '',
        consultationFee: doctorData.consultationFee || 500
      });

      const img =
        docUser.profileImage?.url ||
        docUser.profileImage ||
        doctorData.profileImage?.url ||
        doctorData.profileImage;
      if (typeof img === 'string' && img.trim()) {
        setExistingImageUrl(img);
        setPreviewUrl(img);
      }

      const initialDeptIds = [];
      if (Array.isArray(doctorData.departmentIds) && doctorData.departmentIds.length > 0) {
        doctorData.departmentIds.forEach((d) => {
          const dId = typeof d === 'object' ? d._id : d;
          if (dId) initialDeptIds.push(String(dId));
        });
      } else if (doctorData.departmentId) {
        const dId = typeof doctorData.departmentId === 'object' ? doctorData.departmentId._id : doctorData.departmentId;
        if (dId) initialDeptIds.push(String(dId));
      }
      setSelectedDeptIds(initialDeptIds);
    } catch (err) {
      setError(err.message || 'Failed to load clinician profile for editing.');
    } finally {
      setLoading(false);
    }
  };

  const getDoctorInitials = (nameStr) => {
    if (!nameStr || !nameStr.trim()) return 'DR';
    const clean = nameStr.replace(/^Dr\.\s*/i, '').trim();
    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    if (clean.length > 0) return clean.slice(0, 2).toUpperCase();
    return 'DR';
  };

  const validateField = (name, value) => {
    let err = '';
    const valStr = String(value || '').trim();

    switch (name) {
      case 'name':
        if (!valStr) {
          err = 'Clinician full name is required.';
        } else if (valStr.length < 2) {
          err = 'Clinician name must be at least 2 characters.';
        }
        break;

      case 'email':
        if (!valStr) {
          err = 'Email address is required.';
        } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(valStr)) {
          err = 'Please enter a valid email address.';
        }
        break;

      case 'phone':
        if (!valStr) {
          err = 'Phone number is required.';
        } else if (!/^\+?[0-9\s-]{7,15}$/.test(valStr)) {
          err = 'Please enter a valid phone number (7-15 digits).';
        }
        break;

      case 'gender':
        if (!valStr) {
          err = 'Please select a gender.';
        }
        break;

      case 'specialization':
        if (!valStr) {
          err = 'Specialization is required.';
        }
        break;

      case 'qualification':
        if (!valStr) {
          err = 'Qualifications are required.';
        }
        break;

      case 'consultationFee':
        if (value === '' || value === null || value === undefined) {
          err = 'Consultation fee is required.';
        } else if (isNaN(value) || Number(value) <= 0) {
          err = 'Consultation fee must be a positive number greater than 0.';
        }
        break;

      default:
        break;
    }

    return err;
  };

  const validateAll = () => {
    const newErrors = {};
    Object.keys(formData).forEach((key) => {
      const err = validateField(key, formData[key]);
      if (err) newErrors[key] = err;
    });

    if (departments.length > 0 && selectedDeptIds.length === 0) {
      newErrors.departmentIds = 'Please select at least one department.';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    const nextFormData = { ...formData, [name]: value };
    setFormData(nextFormData);

    if (touched[name]) {
      const err = validateField(name, value);
      setErrors((prev) => ({ ...prev, [name]: err }));
    }
  };

  const handleBlur = (name) => {
    setTouched((prev) => ({ ...prev, [name]: true }));
    const err = validateField(name, formData[name]);
    setErrors((prev) => ({ ...prev, [name]: err }));
  };

  const toggleDepartment = (deptId) => {
    const updated = selectedDeptIds.includes(deptId)
      ? selectedDeptIds.filter((id) => id !== deptId)
      : [...selectedDeptIds, deptId];

    setSelectedDeptIds(updated);
    setTouched((prev) => ({ ...prev, departmentIds: true }));

    if (departments.length > 0 && updated.length === 0) {
      setErrors((prev) => ({ ...prev, departmentIds: 'Please select at least one department.' }));
    } else {
      setErrors((prev) => ({ ...prev, departmentIds: '' }));
    }
  };

  const removeDepartment = (deptId, e) => {
    e.stopPropagation();
    toggleDepartment(deptId);
  };

  const handleImageChange = (e) => {
    const file = e.target.files?.[0] || null;
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrors((prev) => ({ ...prev, profileImage: 'Profile photo must be under 5MB.' }));
      return;
    }
    if (!file.type.startsWith('image/')) {
      setErrors((prev) => ({ ...prev, profileImage: 'Only image files are allowed.' }));
      return;
    }

    setErrors((prev) => ({ ...prev, profileImage: '' }));
    setProfileImage(file);
    if (previewUrl && previewUrl !== existingImageUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const handleRemoveImage = () => {
    setProfileImage(null);
    if (previewUrl && previewUrl !== existingImageUrl) {
      URL.revokeObjectURL(previewUrl);
    }
    setPreviewUrl(null);
    setExistingImageUrl(null);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    const allTouched = {};
    Object.keys(formData).forEach((k) => (allTouched[k] = true));
    allTouched.departmentIds = true;
    setTouched(allTouched);

    if (!validateAll()) {
      showErrorToast('Please correct validation errors before saving.');
      return;
    }

    try {
      setSaving(true);
      setError('');

      const bodyData = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key] !== undefined && formData[key] !== null && formData[key] !== '') {
          if (key === 'name') {
            bodyData.append(key, cleanDoctorNameInput(formData.name));
          } else {
            bodyData.append(key, formData[key]);
          }
        }
      });

      if (departments.length > 0) {
        bodyData.append('departmentIds', JSON.stringify(selectedDeptIds));
        if (selectedDeptIds.length > 0) {
          bodyData.append('departmentId', selectedDeptIds[0]);
        }
      }

      if (profileImage) {
        bodyData.append('profileImage', profileImage);
      }

      await updateDoctorApi(id, bodyData);
      showSuccessToast('Clinician profile updated successfully!');
      navigate(`/admin/doctors/${id}`);
    } catch (err) {
      const errMsg = err.response?.data?.message || err.message || 'Failed to update clinician';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setSaving(false);
    }
  };

  const filteredDepartments = departments.filter((d) =>
    d.name.toLowerCase().includes(deptSearch.toLowerCase())
  );

  if (loading) {
    return (
      <ContentContainer maxWidth="5xl">
        <div className="py-24 flex flex-col items-center justify-center space-y-3">
          <Loader size="lg" />
          <p className="text-xs font-semibold text-slate-500">Loading clinician credentials for modification...</p>
        </div>
      </ContentContainer>
    );
  }

  if (error && !formData.name) {
    return (
      <ContentContainer maxWidth="5xl">
        <ErrorState message={error} onRetry={fetchDoctorAndDepartments} />
      </ContentContainer>
    );
  }

  return (
    <ContentContainer maxWidth="5xl">
      <PageHeader
        title="Edit Clinician Profile"
        subtitle="Modify practitioner credentials, department affiliations, and consultation fees."
        backButton={{
          label: 'Back to Dossier',
          onClick: () => navigate(`/admin/doctors/${id}`)
        }}
      />

      {/* Live Preview Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 shadow-xs mb-6">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-5">
          <div className="flex items-center gap-4 w-full sm:w-auto">
            <div className="relative group shrink-0">
              <div className="w-20 h-20 rounded-full bg-blue-50 text-blue-700 font-bold text-2xl flex items-center justify-center border-4 border-white shadow-md overflow-hidden ring-1 ring-slate-200/80">
                {previewUrl ? (
                  <img src={previewUrl} alt="Doctor Preview" className="w-full h-full object-cover" />
                ) : (
                  <span>{getDoctorInitials(formData.name)}</span>
                )}
              </div>
              <label
                className="absolute bottom-0 right-0 p-2 bg-blue-600 hover:bg-blue-700 text-white rounded-full shadow-md cursor-pointer transition-all border-2 border-white"
                title="Change Portrait"
              >
                <Camera className="w-3.5 h-3.5" />
                <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
              </label>
            </div>

            <div className="min-w-0 flex-1 space-y-1">
              <h3 className="text-lg font-bold text-slate-900 truncate tracking-tight">
                {formData.name.trim() ? formatDoctorName(cleanDoctorNameInput(formData.name)) : 'Clinician'}
              </h3>
              <p className="text-xs font-semibold text-blue-600 truncate">
                {formData.specialization.trim() ? formData.specialization : 'Specialization'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end shrink-0">
            <label className="px-3.5 py-2 bg-white hover:bg-slate-50 text-slate-700 rounded-xl text-xs font-semibold cursor-pointer transition-all border border-slate-200 inline-flex items-center gap-1.5 shadow-2xs">
              <Upload className="w-3.5 h-3.5 text-blue-600" />
              <span>{previewUrl ? 'Change Portrait' : 'Upload Portrait'}</span>
              <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />
            </label>
            {previewUrl && (
              <button
                type="button"
                onClick={handleRemoveImage}
                className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-600 rounded-xl text-xs font-semibold transition-all border border-rose-200 inline-flex items-center gap-1 cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Remove</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Form Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-xs">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 text-xs sm:text-sm rounded-xl flex items-center gap-2.5">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span className="font-semibold">{error}</span>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-5">
            {/* Left Column */}
            <div className="space-y-5">
              <Input
                label="Clinician Full Name"
                name="name"
                placeholder="Dr. Full Name"
                value={formData.name}
                onChange={handleChange}
                onBlur={() => handleBlur('name')}
                error={touched.name ? errors.name : ''}
                icon={User}
                required
              />

              <Input
                label="Direct Phone Number"
                name="phone"
                placeholder="+91 98765 43210"
                value={formData.phone}
                onChange={handleChange}
                onBlur={() => handleBlur('phone')}
                error={touched.phone ? errors.phone : ''}
                icon={Phone}
                required
              />

              <Input
                label="Medical Specialization"
                name="specialization"
                placeholder="e.g. Cardiology, Neurology"
                value={formData.specialization}
                onChange={handleChange}
                onBlur={() => handleBlur('specialization')}
                error={touched.specialization ? errors.specialization : ''}
                icon={Stethoscope}
                required
              />

              {/* Department(s) Multi-Select */}
              {departments.length > 0 ? (
                <div className="space-y-1.5 relative" ref={deptDropdownRef}>
                  <label className="block text-xs font-semibold text-slate-700">
                    Assigned Department(s) <span className="text-rose-500">*</span>
                  </label>

                  <div
                    onClick={() => setIsDeptDropdownOpen(true)}
                    className={`min-h-[44px] p-2 bg-white border ${
                      touched.departmentIds && errors.departmentIds
                        ? 'border-rose-400'
                        : 'border-slate-200 focus-within:border-blue-600 focus-within:ring-2 focus-within:ring-blue-500/20'
                    } rounded-xl transition-all cursor-pointer flex flex-wrap items-center gap-1.5`}
                  >
                    <Building2 className="w-4 h-4 text-slate-400 ml-1.5 shrink-0" />

                    {selectedDeptIds.map((id) => {
                      const dept = departments.find((d) => d._id === id);
                      if (!dept) return null;
                      return (
                        <span
                          key={id}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200/80 shadow-2xs"
                        >
                          <span>{dept.name}</span>
                          <button
                            type="button"
                            onClick={(e) => removeDepartment(id, e)}
                            className="p-0.5 hover:bg-blue-200/60 rounded-full text-blue-700 transition-colors"
                          >
                            <X className="w-3 h-3" />
                          </button>
                        </span>
                      );
                    })}

                    {selectedDeptIds.length === 0 && (
                      <span className="text-xs text-slate-400 font-normal pl-1">
                        Select department(s)...
                      </span>
                    )}
                  </div>

                  {isDeptDropdownOpen && (
                    <div className="absolute z-30 top-full left-0 right-0 mt-1 bg-white rounded-xl border border-slate-200 shadow-lg p-2 space-y-2">
                      <div className="relative">
                        <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Search departments..."
                          value={deptSearch}
                          onChange={(e) => setDeptSearch(e.target.value)}
                          className="w-full h-9 pl-9 pr-3 text-xs bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-blue-600"
                          autoFocus
                        />
                      </div>

                      <div className="max-h-48 overflow-y-auto space-y-0.5">
                        {filteredDepartments.length === 0 ? (
                          <p className="text-xs text-slate-400 p-2 text-center">No matching departments</p>
                        ) : (
                          filteredDepartments.map((dept) => {
                            const isSelected = selectedDeptIds.includes(dept._id);
                            return (
                              <div
                                key={dept._id}
                                onClick={() => toggleDepartment(dept._id)}
                                className={`px-3 py-2 rounded-lg text-xs font-medium cursor-pointer flex items-center justify-between transition-colors ${
                                  isSelected
                                    ? 'bg-blue-50 text-blue-700 font-bold'
                                    : 'hover:bg-slate-50 text-slate-700'
                                }`}
                              >
                                <span>{dept.name}</span>
                                {isSelected && <Check className="w-4 h-4 text-blue-600" />}
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}

                  {touched.departmentIds && errors.departmentIds && (
                    <p className="text-xs text-rose-600 font-medium">{errors.departmentIds}</p>
                  )}
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold text-slate-700">
                    Department
                  </label>
                  <div className="p-3 bg-blue-50/70 border border-blue-200/60 rounded-xl text-xs text-blue-800 font-medium">
                    Assigned to General Practice
                  </div>
                </div>
              )}
            </div>

            {/* Right Column */}
            <div className="space-y-5">
              <Input
                label="Login Email Address"
                type="email"
                name="email"
                placeholder="doctor@clinic.com"
                value={formData.email}
                onChange={handleChange}
                onBlur={() => handleBlur('email')}
                error={touched.email ? errors.email : ''}
                icon={Mail}
                required
              />

              <div className="space-y-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  Gender <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleChange}
                    onBlur={() => handleBlur('gender')}
                    className={`w-full h-11 pl-10 pr-9 bg-white border ${
                      touched.gender && errors.gender
                        ? 'border-rose-400'
                        : 'border-slate-200 focus:border-blue-600 focus:ring-2 focus:ring-blue-500/20'
                    } rounded-xl text-xs sm:text-sm text-slate-900 font-medium transition-all outline-none appearance-none cursor-pointer`}
                  >
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Prefer not to say">Prefer not to say</option>
                  </select>
                  <ChevronDown className="w-4 h-4 text-slate-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
                {touched.gender && errors.gender && (
                  <p className="text-xs text-rose-600 font-medium">{errors.gender}</p>
                )}
              </div>

              <Input
                label="Medical Qualifications & Degrees"
                name="qualification"
                placeholder="e.g. MBBS, MD, FRCS"
                value={formData.qualification}
                onChange={handleChange}
                onBlur={() => handleBlur('qualification')}
                error={touched.qualification ? errors.qualification : ''}
                icon={Award}
                required
              />

              <Input
                label="Consultation Fee (₹)"
                type="number"
                name="consultationFee"
                placeholder="500"
                value={formData.consultationFee}
                onChange={handleChange}
                onBlur={() => handleBlur('consultationFee')}
                error={touched.consultationFee ? errors.consultationFee : ''}
                icon={IndianRupee}
                required
              />
            </div>
          </div>

          {/* Form Actions */}
          <div className="border-t border-slate-100 pt-6 flex flex-col sm:flex-row items-center justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              size="md"
              onClick={() => navigate(`/admin/doctors/${id}`)}
              className="w-full sm:w-auto"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="md"
              icon={Save}
              loading={saving}
              className="w-full sm:w-auto"
            >
              Save Changes
            </Button>
          </div>
        </form>
      </div>
    </ContentContainer>
  );
};

export default EditDoctor;
