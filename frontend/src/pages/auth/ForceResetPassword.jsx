import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Lock, KeyRound, ShieldAlert, CheckCircle2 } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { forceResetPasswordApi } from '../../api/auth';
import { useAuth } from '../../context/AuthContext';
import { showSuccessToast, showErrorToast } from '../../utils/toast';

const ForceResetPassword = () => {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (password.length < 6) {
      showErrorToast('Password must be at least 6 characters long.');
      return;
    }

    if (password !== confirmPassword) {
      showErrorToast('New password and confirm password do not match.');
      return;
    }

    try {
      setLoading(true);
      await forceResetPasswordApi({ newPassword: password });
      
      await logout().catch(() => null);

      showSuccessToast('Password updated successfully. Please sign in again with your new password.');
      navigate('/login', { replace: true });
    } catch (err) {
      showErrorToast(err.message || 'Failed to update password. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-sm mx-auto w-full font-sans">
      <div className="space-y-3">
        <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center border border-amber-200">
          <ShieldAlert className="w-5 h-5" />
        </div>
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">
            Security Password Update
          </h1>
          <p className="text-xs text-slate-500 mt-1 leading-relaxed">
            Welcome, <span className="font-semibold text-slate-900">{user?.name || 'User'}</span>. For your clinical account security, please replace your temporary credentials before continuing.
          </p>
        </div>
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
        />

        <Button
          type="submit"
          variant="primary"
          className="w-full text-xs font-semibold py-3 shadow-xs"
          loading={loading}
          disabled={loading}
          icon={CheckCircle2}
        >
          Update Credentials & Sign In
        </Button>
      </form>
    </div>
  );
};

export default ForceResetPassword;
