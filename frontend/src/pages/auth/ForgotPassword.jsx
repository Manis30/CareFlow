import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, ArrowLeft, Send, CheckCircle2 } from 'lucide-react';
import Input from '../../components/common/Input';
import Button from '../../components/common/Button';
import { forgotPasswordApi } from '../../api/auth';
import { showErrorToast, showSuccessToast } from '../../utils/toast';

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const validateEmail = (val) => {
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(val.trim());
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const cleanEmail = email.trim();

    if (!cleanEmail) {
      showErrorToast('Please enter your registered email address.');
      return;
    }

    if (!validateEmail(cleanEmail)) {
      showErrorToast('Please enter a valid email address format.');
      return;
    }

    try {
      setLoading(true);
      const res = await forgotPasswordApi({ email: cleanEmail });
      setSubmitted(true);
      showSuccessToast(res?.message || 'If an account exists for this email, a password reset link has been sent.');
    } catch (err) {
      showErrorToast(err.message || 'Failed to process request. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-sm mx-auto w-full font-sans antialiased">
      {/* Header */}
      <div className="space-y-2">
        <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
          Forgot Password
        </h1>
        <p className="text-xs text-slate-500 leading-relaxed">
          Enter your registered email address to receive a secure recovery link.
        </p>
      </div>

      {submitted ? (
        <div className="bg-blue-50/70 border border-blue-200/80 rounded-xl p-6 text-center space-y-4 shadow-xs">
          <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center mx-auto border border-blue-200">
            <CheckCircle2 className="w-6 h-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-sm font-bold text-slate-900">Request Transmitted</h3>
            <p className="text-xs text-slate-600 leading-relaxed">
              If an account exists for <strong className="text-slate-900 font-semibold">{email}</strong>, a recovery link has been dispatched to your inbox.
            </p>
          </div>
          <div className="pt-2 flex flex-col gap-2">
            <Link
              to="/login"
              className="inline-flex items-center justify-center gap-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
            </Link>
          </div>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Registered Email Address"
            type="email"
            name="email"
            placeholder="name@clinic.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            icon={Mail}
            required
            disabled={loading}
          />

          <Button
            type="submit"
            variant="primary"
            className="w-full text-xs font-semibold py-3 shadow-xs"
            loading={loading}
            disabled={loading}
            icon={Send}
          >
            Send Recovery Link
          </Button>

          <div className="text-center pt-2">
            <Link
              to="/login"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-blue-600 transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> Return to Sign In
            </Link>
          </div>
        </form>
      )}
    </div>
  );
};

export default ForgotPassword;
