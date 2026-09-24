import React, { useState, useEffect } from 'react';
import { User, Mail, Phone, Shield, Camera, Upload, Trash2, CheckCircle2, Edit3, Save, X, Building2 } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { updateProfileApi, updateProfileImageApi } from '../../api/auth';
import Button from '../common/Button';
import Input from '../common/Input';
import StatusBadge from '../common/StatusBadge';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const UserProfile = ({ secondaryTitle, secondaryContent }) => {
  const { user, updateUser } = useAuth();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [phone, setPhone] = useState(user?.phone || '');
  const [email, setEmail] = useState(user?.email || '');
  const [saving, setSaving] = useState(false);

  // Profile Image Upload State
  const [previewUrl, setPreviewUrl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    if (user) {
      setName(user.name || '');
      setPhone(user.phone || '');
      setEmail(user.email || '');
    }
  }, [user]);

  const getInitials = () => {
    const rawName = name || user?.name || '';
    if (!rawName) return 'U';
    const parts = rawName.trim().split(' ').filter(Boolean);
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return rawName.slice(0, 2).toUpperCase();
  };

  const currentImageUrl = previewUrl || (!imgError && (user?.profileImage?.url || user?.profileImage));

  const handleFileSelect = (e) => {
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

    setSelectedFile(file);
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);
  };

  const handleRemovePreview = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setSelectedFile(null);
    setPreviewUrl(null);
  };

  const handleImageSave = async () => {
    if (!selectedFile) return;

    try {
      setUploadingImage(true);
      const formData = new FormData();
      formData.append('profileImage', selectedFile);

      const res = await updateProfileImageApi(formData);
      const updatedUser = res.data;

      updateUser({
        profileImage: updatedUser.profileImage || updatedUser.user?.profileImage
      });

      handleRemovePreview();
      setImgError(false);
      showSuccessToast('Profile image updated successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to update profile image');
    } finally {
      setUploadingImage(false);
    }
  };

  const handleSaveProfile = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await updateProfileApi({ name, phone });
      const updatedUser = res.data;

      updateUser({
        name: updatedUser.name || name,
        phone: updatedUser.phone || phone
      });

      setIsEditing(false);
      showSuccessToast('Profile details updated successfully!');
    } catch (err) {
      showErrorToast(err.message || 'Failed to update profile details');
    } finally {
      setSaving(false);
    }
  };

  const formatRoleLabel = (role) => {
    if (!role) return 'User';
    switch (role.toLowerCase()) {
      case 'superadmin':
        return 'Super Administrator';
      case 'admin':
        return 'Clinic Administrator';
      case 'doctor':
        return 'Medical Doctor';
      case 'patient':
        return 'Registered Patient';
      default:
        return role.toUpperCase();
    }
  };

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-200/80 pb-5">
        <div>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">Account Profile</h1>
          <p className="text-xs text-slate-500">Manage your account information and preferences</p>
        </div>
        <Button
          variant={isEditing ? 'outline' : 'primary'}
          icon={isEditing ? X : Edit3}
          onClick={() => setIsEditing(!isEditing)}
        >
          {isEditing ? 'Cancel Editing' : 'Edit Profile'}
        </Button>
      </div>

      {/* Main 2 Column Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Main Profile Card (7 Cols) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-6">
          <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6 border-b border-slate-100 pb-6">
            {/* Avatar & File Upload Controls */}
            <div className="relative shrink-0 flex flex-col items-center gap-2">
              <div className="relative w-28 h-28 rounded-full bg-teal-900 text-teal-100 font-bold text-3xl flex items-center justify-center border-4 border-teal-50 shadow-md overflow-hidden">
                {currentImageUrl ? (
                  <img
                    src={currentImageUrl}
                    alt={name}
                    onError={() => setImgError(true)}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span>{getInitials()}</span>
                )}
              </div>

              {/* Upload Action */}
              <label
                htmlFor="profile-upload"
                className="cursor-pointer text-[11px] font-semibold text-teal-700 bg-teal-50 hover:bg-teal-100 px-2.5 py-1 rounded-md border border-teal-200 flex items-center gap-1.5 transition-colors"
              >
                <Camera className="w-3.5 h-3.5" />
                Change Photo
              </label>
              <input
                id="profile-upload"
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />

              {/* Preview Actions */}
              {selectedFile && (
                <div className="flex items-center gap-1 mt-1">
                  <Button
                    variant="primary"
                    size="sm"
                    loading={uploadingImage}
                    onClick={handleImageSave}
                    icon={Upload}
                    className="text-[10px] px-2 py-0.5"
                  >
                    Save Photo
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={handleRemovePreview}
                    className="text-rose-600 p-1"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              )}
            </div>

            {/* Profile Overview */}
            <div className="flex-1 text-center sm:text-left space-y-2">
              <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
                <h2 className="text-xl font-bold text-slate-900">{name || 'User Profile'}</h2>
                <StatusBadge status={user?.role || 'active'} className="text-[11px]" />
              </div>
              <p className="text-xs text-slate-500 font-medium">{formatRoleLabel(user?.role)}</p>

              {user?.organizationId?.name && (
                <div className="flex items-center justify-center sm:justify-start gap-1.5 text-xs text-slate-600 pt-1">
                  <Building2 className="w-3.5 h-3.5 text-teal-600" />
                  <span>{user.organizationId.name}</span>
                </div>
              )}
            </div>
          </div>

          {/* Form or Info Display */}
          {isEditing ? (
            <form onSubmit={handleSaveProfile} className="space-y-4 text-xs">
              <Input
                label="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />

              <Input
                label="Email Address (Read-only)"
                value={email}
                disabled
                className="bg-slate-50 cursor-not-allowed text-slate-500"
              />

              <Input
                label="Phone Number"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="Enter 10-digit phone number"
              />

              <div className="flex justify-end gap-2 pt-4 border-t border-slate-100">
                <Button variant="outline" onClick={() => setIsEditing(false)} disabled={saving}>
                  Cancel
                </Button>
                <Button type="submit" variant="primary" loading={saving} icon={Save}>
                  Save Profile Changes
                </Button>
              </div>
            </form>
          ) : (
            <div className="space-y-4 text-xs">
              <h3 className="font-bold text-slate-800 uppercase tracking-wider text-[11px] border-b border-slate-100 pb-2">
                Personal Information
              </h3>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="flex items-start gap-3">
                  <User className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700 block">Full Name</span>
                    <span className="text-slate-900 font-medium">{name || 'Not set'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Mail className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700 block">Email Address</span>
                    <span className="text-slate-900 font-medium">{email || 'Not set'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Phone className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700 block">Phone Number</span>
                    <span className="text-slate-900 font-medium">{phone || 'Not set'}</span>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Shield className="w-4 h-4 text-slate-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-semibold text-slate-700 block">Assigned Role</span>
                    <span className="text-teal-700 font-bold">{formatRoleLabel(user?.role)}</span>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Right Secondary Section (5 Cols) */}
        <div className="lg:col-span-5 space-y-6">
          <div className="bg-white rounded-xl border border-slate-200 shadow-2xs p-6 space-y-4">
            <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider border-b border-slate-100 pb-3 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-teal-600" />
              {secondaryTitle || 'Account Information'}
            </h3>

            {secondaryContent || (
              <div className="space-y-3 text-xs text-slate-600">
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-800 block">Account Status</span>
                  <span className="text-emerald-700 font-bold">Active & Authenticated</span>
                </div>
                <div className="p-3 bg-slate-50 rounded-lg border border-slate-100">
                  <span className="font-semibold text-slate-800 block">Organization Access</span>
                  <span className="text-slate-700">{user?.organizationId?.name || 'CareFlow Platform'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserProfile;
