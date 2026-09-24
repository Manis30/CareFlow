import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const Login = () => {
  const [formData, setFormData] = useState({ email: '', password: '' });
  const [loading, setLoading] = useState(false);
  const { login, getDashboardPath } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.email || !formData.password) {
      showErrorToast('Please enter both email and password.');
      return;
    }

    try {
      setLoading(true);
      const userData = await login(formData);

      if (userData) {
        if (userData.mustResetPassword === true) {
          showSuccessToast('First login detected. Please update your password.');
          navigate('/force-reset-password', { replace: true });
        } else {
          showSuccessToast(`Welcome back, ${userData.name || 'User'}!`);
          const targetPath = getDashboardPath(userData.role);
          navigate(targetPath, { replace: true });
        }
      }
    } catch (err) {
      const errMsg = err.message || 'Invalid email or password credentials.';
      showErrorToast(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-sm mx-auto w-full font-sans">
      {/* Page Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Sign in to CareFlow
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Access your authorized healthcare consultation portal securely.
        </p>
      </div>

      {/* Login Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="Email Address"
          type="email"
          name="email"
          placeholder="name@clinic.com"
          value={formData.email}
          onChange={handleChange}
          icon={Mail}
          required
        />

        <div className="space-y-1">
          <Input
            label="Password"
            type="password"
            name="password"
            placeholder="••••••••••••"
            value={formData.password}
            onChange={handleChange}
            icon={Lock}
            required
          />
          <div className="flex justify-end pt-1">
            <Link
              to="/forgot-password"
              className="text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              Forgot password?
            </Link>
          </div>
        </div>

        <Button
          type="submit"
          variant="primary"
          className="w-full text-xs font-semibold py-3 shadow-xs"
          loading={loading}
          disabled={loading}
          icon={LogIn}
        >
          Sign In to CareFlow
        </Button>
      </form>

      {/* Footer Registration Redirect (Patient only) */}
      <div className="pt-4 border-t border-slate-100 flex items-center justify-between text-xs">
        <span className="text-slate-500 font-medium">New patient?</span>
        <Link
          to="/register"
          className="font-semibold text-blue-600 hover:text-blue-700 flex items-center gap-1 transition-colors"
        >
          <span>Register Account</span>
          <ArrowRight className="w-3.5 h-3.5" />
        </Link>
      </div>
    </div>
  );
};

export default Login;
