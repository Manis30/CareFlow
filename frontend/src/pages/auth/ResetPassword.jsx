import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { Lock, KeyRound, ArrowLeft, CheckCircle2, AlertCircle } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { resetPasswordApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const rawToken = searchParams.get('token') || searchParams.get('resetToken') || '';

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [countdown, setCountdown] = useState(3);

  const { logout } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    let timer;
    if (success && countdown > 0) {
      timer = setTimeout(() => {
        setCountdown((prev) => prev - 1);
      }, 1000);
    } else if (success && countdown === 0) {
      navigate('/login', { replace: true });
    }
    return () => clearTimeout(timer);
  }, [success, countdown, navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!rawToken) {
      showErrorToast('Invalid or missing password reset token.');
      return;
    }

    if (!password) {
      showErrorToast('Please enter your new password.');
      return;
    }

    if (password.length < 6) {
      showErrorToast('Password must be at least 6 characters long.');
      return;
    }

    if (!confirmPassword) {
      showErrorToast('Please confirm your new password.');
      return;
    }

    if (password !== confirmPassword) {
      showErrorToast('New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      const res = await resetPasswordApi({ token: rawToken, resetToken: rawToken, password, newPassword: password });

      await logout().catch(() => null);

      setSuccess(true);
      showSuccessToast(res?.message || 'Password reset successfully. Please sign in with your new password.');
    } catch (err) {
      showErrorToast(err.message || 'Invalid or expired password reset link.');
    } finally {
      setLoading(false);
    }
  };

  // Missing or Invalid Token State
  if (!rawToken) {
    return (
      <div className="space-y-6 max-w-sm mx-auto w-full font-sans text-center antialiased">
        <div className="w-12 h-12 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto border border-rose-200">
          <AlertCircle className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">Invalid Security Token</h2>
          <p className="text-xs text-slate-500 leading-relaxed">
            This password recovery link is expired or contains an invalid security token.
          </p>
        </div>
        <div className="pt-2">
          <Link
            to="/forgot-password"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
          >
            Request New Reset Link →
          </Link>
        </div>
      </div>
    );
  }

  // Success Confirmation Screen
  if (success) {
    return (
      <div className="space-y-6 max-w-sm mx-auto w-full font-sans text-center antialiased">
        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-200">
          <CheckCircle2 className="w-6 h-6" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-lg font-bold text-slate-900">Password Updated</h2>
          <p className="text-xs text-slate-600 leading-relaxed">
            Your account credentials have been updated securely.
          </p>
          <p className="text-[11px] text-blue-600 font-semibold pt-1">
            Redirecting to Sign In in {countdown}s...
          </p>
        </div>
        <Button
          variant="primary"
          className="w-full text-xs font-semibold py-2.5 shadow-xs"
          onClick={() => navigate('/login', { replace: true })}
        >
          Sign In Now
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-sm mx-auto w-full font-sans antialiased">
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Create New Password
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Configure a secure new password for your CareFlow account.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <Input
          label="New Password"
          type="password"
          name="password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          icon={Lock}
          required
          disabled={loading}
        />

        <Input
          label="Confirm New Password"
          type="password"
          name="confirmPassword"
          placeholder="••••••••••••"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          icon={KeyRound}
          required
          disabled={loading}
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full text-xs font-semibold py-3 shadow-xs"
          loading={loading}
          disabled={loading}
        >
          Save New Password
        </Button>

        <div className="text-center pt-2">
          <Link
            to="/login"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 hover:underline transition-colors"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
          </Link>
        </div>
      </form>
    </div>
  );
};

export default ResetPassword;
