import React, { useState, useEffect } from 'react';
import {
  User,
  Phone,
  Mail,
  Edit3,
  Save,
  Camera,
  Trash2,
  Lock,
  ShieldCheck,
  ArrowRight,
  Shield
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfileApi, updateProfileImageApi, forceResetPasswordApi } from '../../api/auth';
import Button from '../../components/common/Button';
import Input from '../../components/common/Input';
import Modal from '../../components/common/Modal';
import PageHeader from '../../components/layout/PageHeader';
import ContentContainer from '../../components/layout/ContentContainer';
import PulseIndicator from '../../components/clinical/PulseIndicator';
import { resolveProfileImage, getInitials } from '../../utils/resolveProfileImage';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const SuperAdminProfile = () => {
  const { user, updateUser } = useAuth();

  // Modals state
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);

  // Profile Edit Form State
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    name: user?.name || '',
    phone: user?.phone || ''
  });

  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isRemoved, setIsRemoved] = useState(false);

  // Password Change Form State
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordForm, setPasswordForm] = useState({
    newPassword: '',
    confirmPassword: ''
  });

  useEffect(() => {
    if (user) {
      setForm({
        name: user.name || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const profileUrl = resolveProfileImage(user);
  const displayPhotoUrl = isRemoved ? null : (previewUrl || profileUrl);

  const handleInputChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const handlePasswordInputChange = (e) => {
    setPasswordForm({ ...passwordForm, [e.target.name]: e.target.value });
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      showErrorToast('Please select a valid image file (JPG, JPEG, PNG, WEBP)');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      showErrorToast('Image file size must be under 5MB');
      return;
    }

    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }

    const objectUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setPreviewUrl(objectUrl);
    setIsRemoved(false);
  };

  const handleRemovePhoto = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsRemoved(true);
  };

  const handleCancelEdit = () => {
    if (previewUrl && previewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(previewUrl);
    }
    setSelectedFile(null);
    setPreviewUrl(null);
    setIsRemoved(false);
    setForm({
      name: user?.name || '',
      phone: user?.phone || ''
    });
    setIsEditModalOpen(false);
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setLoading(true);
      let updatedUser = user;

      if (selectedFile) {
        const formData = new FormData();
        formData.append('profileImage', selectedFile);
        const res = await updateProfileImageApi(formData);
        updatedUser = res.data?.user || res.data;
      } else if (isRemoved) {
        const res = await updateProfileApi({ profileImage: { url: null, publicId: null } });
        updatedUser = res.data?.user || res.data;
      }

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim()
      };

      const profileRes = await updateProfileApi(payload);
      const finalUserData = profileRes.data?.user || profileRes.data;

      updateUser({
        ...updatedUser,
        ...finalUserData,
        name: payload.name,
        phone: payload.phone
      });

      if (previewUrl && previewUrl.startsWith('blob:')) {
        URL.revokeObjectURL(previewUrl);
      }
      setSelectedFile(null);
      setPreviewUrl(null);
      setIsRemoved(false);

      setIsEditModalOpen(false);
      showSuccessToast('Profile updated successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!passwordForm.newPassword || passwordForm.newPassword.length < 6) {
      showErrorToast('New password must be at least 6 characters long');
      return;
    }

    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      showErrorToast('New passwords do not match');
      return;
    }

    try {
      setPasswordLoading(true);
      await forceResetPasswordApi({ newPassword: passwordForm.newPassword });
      showSuccessToast('Password updated successfully!');
      setPasswordForm({ newPassword: '', confirmPassword: '' });
      setIsPasswordModalOpen(false);
    } catch (err) {
      showErrorToast(err.message || 'Failed to update password');
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <ContentContainer maxWidth="7xl">
      {/* Page Header */}
      <PageHeader
        subtitle="Master platform root credentials, contact telephone, and system security controls."
        badgeText="Root Administrator"
        badgeVariant="blue"
      />

      {/* Main Profile Dossier Card */}
      <div className="bg-white rounded-xl border border-slate-200/80 p-6 sm:p-8 shadow-xs space-y-8">
        {/* Profile Hero Area */}
        <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6 border-b border-slate-100 pb-7">
          <div className="flex flex-col sm:flex-row items-center sm:items-center gap-6 text-center sm:text-left">
            {/* Avatar */}
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-xl bg-blue-600 text-white font-bold text-3xl flex items-center justify-center border-2 border-blue-200 shadow-md overflow-hidden">
                {displayPhotoUrl ? (
                  <img
                    src={displayPhotoUrl}
                    alt={user?.name}
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                    className="w-full h-full object-cover"
                  />
                ) : null}
                <span className={displayPhotoUrl ? 'hidden' : 'block'}>
                  {getInitials(user?.name, 'SA')}
                </span>
              </div>

              {/* Status Dot */}
              <div className="absolute -bottom-1 -right-1 bg-white p-0.5 rounded-full shadow-xs">
                <PulseIndicator status="online" pulseColor="#2563EB" />
              </div>
            </div>

            {/* Hero Details */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-2xl sm:text-3xl font-bold text-slate-900">
                  {user?.name || 'Platform Administrator'}
                </h2>
                <span className="px-3 py-1 rounded-full text-[11px] font-bold bg-blue-50 text-blue-700 border border-blue-200 uppercase tracking-wider">
                  Super Admin
                </span>
              </div>

              <p className="text-xs text-slate-500 font-medium flex items-center justify-center sm:justify-start gap-1.5">
                <Mail className="w-3.5 h-3.5 text-blue-600 shrink-0" />
                <span>{user?.email}</span>
              </p>

              <div className="flex items-center justify-center sm:justify-start gap-2 text-xs font-semibold text-blue-600 pt-0.5">
                <span className="w-2 h-2 rounded-full bg-blue-600" />
                <span>System Root Active</span>
              </div>
            </div>
          </div>

          <div className="shrink-0 pt-2 sm:pt-0">
            <Button
              variant="primary"
              size="sm"
              icon={Edit3}
              onClick={() => setIsEditModalOpen(true)}
              className="shadow-xs font-semibold"
            >
              Edit Profile
            </Button>
          </div>
        </div>

        {/* Details & Security Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
          {/* Personal Info Cards */}
          <div className="lg:col-span-2 space-y-4">
            <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wider">
              Personal Credentials & Telephony
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-blue-600" /> Administrator Name
                </span>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.name || 'Platform Administrator'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Mail className="w-3.5 h-3.5 text-blue-600" /> Master Email Address
                </span>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.email || 'N/A'}
                </p>
              </div>

              <div className="p-4 rounded-xl bg-slate-50/80 border border-slate-200/80 space-y-1 sm:col-span-2">
                <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider flex items-center gap-1.5">
                  <Phone className="w-3.5 h-3.5 text-blue-600" /> Primary Contact Phone
                </span>
                <p className="text-sm font-semibold text-slate-900 truncate">
                  {user?.phone || 'Not Provided'}
                </p>
              </div>
            </div>
          </div>

          {/* Account Security Card */}
          <div className="p-6 rounded-xl bg-gradient-to-br from-blue-50/60 to-slate-50 border border-blue-100/80 space-y-4">
            <div className="p-2.5 rounded-xl bg-blue-100 text-blue-600 border border-blue-200 w-fit">
              <ShieldCheck className="w-5 h-5" />
            </div>

            <div className="space-y-1">
              <h3 className="text-sm font-bold text-slate-900">
                Credentials & Security
              </h3>
              <p className="text-xs text-slate-500 leading-relaxed">
                Protect master super-admin access with updated credentials.
              </p>
            </div>

            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                icon={Lock}
                onClick={() => setIsPasswordModalOpen(true)}
                className="w-full justify-between hover:bg-blue-600 hover:text-white hover:border-blue-600 text-xs font-semibold py-2.5 transition-colors"
              >
                <span>Update Password</span>
                <ArrowRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* EDIT PROFILE MODAL */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={handleCancelEdit}
        title="Edit Profile"
      >
        <form onSubmit={handleSaveProfile} className="space-y-5 text-xs">
          {/* Photo Box */}
          <div className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex flex-col sm:flex-row items-center gap-4">
            <div className="relative shrink-0">
              <div className="w-16 h-16 rounded-xl bg-blue-600 text-white font-bold text-lg flex items-center justify-center border border-blue-200 overflow-hidden">
                {displayPhotoUrl ? (
                  <img src={displayPhotoUrl} alt="Preview" className="w-full h-full object-cover" />
                ) : (
                  <span>{getInitials(form.name || user?.name, 'SA')}</span>
                )}
              </div>
            </div>

            <div className="space-y-1.5 text-center sm:text-left flex-1">
              <p className="font-bold text-slate-900 text-xs">Profile Portrait</p>
              <p className="text-[11px] text-slate-500">
                Select an image up to 5MB to set as your master avatar.
              </p>

              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 pt-1">
                <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 text-white hover:bg-blue-700 cursor-pointer transition-colors shadow-xs">
                  <Camera className="w-3.5 h-3.5" />
                  Upload Image
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={handleFileSelect}
                    className="hidden"
                  />
                </label>

                {(displayPhotoUrl || selectedFile) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    icon={Trash2}
                    onClick={handleRemovePhoto}
                    className="text-rose-600 border-rose-200 hover:bg-rose-50"
                  >
                    Remove
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <Input
              label="Full Name *"
              name="name"
              value={form.name}
              onChange={handleInputChange}
              required
            />

            <Input
              label="Contact Telephone"
              name="phone"
              value={form.phone}
              onChange={handleInputChange}
            />
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={handleCancelEdit}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              size="sm"
              loading={loading}
              icon={Save}
            >
              {loading ? 'Saving...' : 'Save Profile'}
            </Button>
          </div>
        </form>
      </Modal>

      {/* CHANGE PASSWORD MODAL */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={() => setIsPasswordModalOpen(false)}
        title="Update Master Password"
      >
        <form onSubmit={handleChangePassword} className="space-y-4 text-xs">
          <Input
            label="New Password *"
            type="password"
            name="newPassword"
            placeholder="Min. 6 characters"
            value={passwordForm.newPassword}
            onChange={handlePasswordInputChange}
            required
          />

          <Input
            label="Confirm New Password *"
            type="password"
            name="confirmPassword"
            placeholder="Re-enter new password"
            value={passwordForm.confirmPassword}
            onChange={handlePasswordInputChange}
            required
          />

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-100">
            <Button
              variant="outline"
              type="button"
              size="sm"
              onClick={() => setIsPasswordModalOpen(false)}
              disabled={passwordLoading}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              type="submit"
              size="sm"
              loading={passwordLoading}
              icon={Lock}
            >
              {passwordLoading ? 'Updating...' : 'Update Password'}
            </Button>
          </div>
        </form>
      </Modal>
    </ContentContainer>
  );
};

export default SuperAdminProfile;
