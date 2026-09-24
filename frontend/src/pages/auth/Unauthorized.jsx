import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ShieldAlert, ArrowLeft } from 'lucide-react';
import Button from '../../components/common/Button';
import { useAuth } from '../../context/AuthContext';

const Unauthorized = () => {
  const navigate = useNavigate();
  const { user, getDashboardPath } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans">
      <div className="w-14 h-14 bg-rose-50 text-rose-600 rounded-xl flex items-center justify-center border border-rose-200">
        <ShieldAlert className="w-7 h-7" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">403 — Access Restricted</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          You do not have the verified clinical privileges or authorized portal role to access this resource.
        </p>
      </div>
      <div className="pt-3">
        <Button
          variant="primary"
          onClick={() => navigate(user ? getDashboardPath(user.role) : '/login')}
          icon={ArrowLeft}
          className="shadow-xs font-semibold"
        >
          Return to Dashboard
        </Button>
      </div>
    </div>
  );
};

export default Unauthorized;
