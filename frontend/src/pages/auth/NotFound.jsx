import React from 'react';
import { useNavigate } from 'react-router-dom';
import { FileQuestion, Home } from 'lucide-react';
import Button from '../../components/common/Button';

const NotFound = () => {
  const navigate = useNavigate();

  return (
    <div className="flex flex-col items-center justify-center p-8 text-center space-y-4 font-sans">
      <div className="w-14 h-14 bg-slate-100 text-slate-500 rounded-xl flex items-center justify-center border border-slate-200">
        <FileQuestion className="w-7 h-7 text-slate-400" />
      </div>
      <div className="space-y-1">
        <h2 className="text-xl font-bold text-slate-900">404 — Endpoint Not Found</h2>
        <p className="text-xs text-slate-500 max-w-sm leading-relaxed">
          The consultation page, document record, or navigation path you requested does not exist or has been relocated.
        </p>
      </div>
      <div className="pt-3">
        <Button
          variant="primary"
          onClick={() => navigate('/')}
          icon={Home}
          className="shadow-xs font-semibold"
        >
          Return to Platform Home
        </Button>
      </div>
    </div>
  );
};

export default NotFound;
