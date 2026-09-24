import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, Mail, Phone, Lock, Calendar, Heart, UserPlus, Stethoscope, ArrowRight } from 'lucide-react';
import { registerUserApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { normalizeRole } from '../../utils/normalizeRole';
import Input from '../../components/common/Input';
import Select from '../../components/common/Select';
import Textarea from '../../components/common/Textarea';
import Button from '../../components/common/Button';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const Register = () => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    dateOfBirth: '',
    gender: 'other',
    bloodGroup: 'A+',
    address: '',
    allergies: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();
  const { updateUser, getDashboardPath } = useAuth();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.name || !formData.email || !formData.phone || !formData.password) {
      showErrorToast('Please fill in all required fields.');
      return;
    }

    if (formData.password.length < 6) {
      showErrorToast('Password must be at least 6 characters long.');
      return;
    }

    try {
      setLoading(true);
      setError('');
      const data = new FormData();
      Object.keys(formData).forEach((key) => {
        if (formData[key]) data.append(key, formData[key]);
      });

      const res = await registerUserApi(data);
      const rawUser = res.user || res.data?.user || res.data?.data || res.data;

      if (rawUser && (rawUser._id || rawUser.id || rawUser.role)) {
        showSuccessToast(`Welcome to CareFlow, ${rawUser.name || 'Patient'}!`);
        const authenticatedUser = {
          ...rawUser,
          role: normalizeRole(rawUser.role || 'patient')
        };
        updateUser(authenticatedUser);
        const targetPath = getDashboardPath(authenticatedUser.role);
        navigate(targetPath, { replace: true });
      } else {
        showSuccessToast('Account created successfully! Please sign in.');
        navigate('/login', { replace: true });
      }
    } catch (err) {
      const errMsg = err.message || 'Registration failed. Please check your inputs.';
      setError(errMsg);
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 w-full font-sans antialiased">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Create Patient Account
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Set up your private medical profile to book appointments and store health records.
        </p>
      </div>

      {error && (
        <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-xl font-medium">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: Personal Information */}
        <div className="space-y-3.5">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <User className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Personal Information</span>
          </div>

          <Input
            label="Full Legal Name"
            name="name"
            placeholder="Jane Doe"
            value={formData.name}
            onChange={handleChange}
            icon={User}
            required
            disabled={loading}
          />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <Input
              label="Email Address"
              type="email"
              name="email"
              placeholder="jane@example.com"
              value={formData.email}
              onChange={handleChange}
              icon={Mail}
              required
              disabled={loading}
            />

            <Input
              label="Contact Telephone"
              name="phone"
              placeholder="+91 9876543210"
              value={formData.phone}
              onChange={handleChange}
              icon={Phone}
              required
              disabled={loading}
            />
          </div>
        </div>

        {/* Section 2: Account Security */}
        <div className="space-y-3.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Lock className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Account Security</span>
          </div>

          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="Minimum 6 characters"
            value={formData.password}
            onChange={handleChange}
            icon={Lock}
            required
            disabled={loading}
          />
        </div>

        {/* Section 3: Health Profile */}
        <div className="space-y-3.5 pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900 uppercase tracking-wider">
            <Stethoscope className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            <span>Health & Clinical Details</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3.5">
            <Input
              label="Date of Birth"
              type="date"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              icon={Calendar}
              disabled={loading}
            />

            <Select
              label="Gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              options={[
                { value: 'male', label: 'Male' },
                { value: 'female', label: 'Female' },
                { value: 'other', label: 'Other' }
              ]}
              disabled={loading}
            />

            <Select
              label="Blood Group"
              name="bloodGroup"
              value={formData.bloodGroup}
              onChange={handleChange}
              options={['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-']}
              disabled={loading}
            />
          </div>

          <Textarea
            label="Home / Residential Address"
            name="address"
            placeholder="Street address, City, Pincode..."
            value={formData.address}
            onChange={handleChange}
            rows={2}
            disabled={loading}
          />

          <Input
            label="Known Allergies (Optional)"
            name="allergies"
            placeholder="e.g. Penicillin, Dust, Peanuts"
            value={formData.allergies}
            onChange={handleChange}
            icon={Heart}
            disabled={loading}
          />
        </div>

        {/* Submit Primary CTA */}
        <Button
          type="submit"
          variant="primary"
          className="w-full text-xs font-semibold py-3 shadow-xs mt-2"
          loading={loading}
          disabled={loading}
          icon={UserPlus}
        >
          Create Patient Account
        </Button>
      </form>

      {/* Footer */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">Already registered?</span>
        <Link
          to="/login"
          className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
        >
          <span>Sign In</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default Register;
