import React from 'react';
import { Outlet, Link, useNavigate } from 'react-router-dom';
import { HeartPulse, LogIn, UserPlus } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import Button from '../components/common/Button';

export const PublicTemplate = () => {
  const { isAuthenticated, user, getDashboardPath, logout } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen flex flex-col bg-white text-slate-900 font-sans antialiased">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-600 flex items-center justify-center text-white shadow-xs">
              <HeartPulse className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-bold tracking-tight text-slate-900">
              CareFlow
            </span>
          </Link>

          <nav className="hidden md:flex items-center gap-8 text-xs font-semibold text-slate-600">
            <a href="#features" className="hover:text-blue-600 transition-colors">Features</a>
            <a href="#how-it-works" className="hover:text-blue-600 transition-colors">How It Works</a>
            <a href="#portals" className="hover:text-blue-600 transition-colors">Portals</a>
          </nav>

          <div className="flex items-center gap-2.5">
            {isAuthenticated ? (
              <>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => navigate(getDashboardPath(user?.role))}
                >
                  Enter Workspace
                </Button>
                <Button variant="ghost" size="sm" onClick={logout}>
                  Sign Out
                </Button>
              </>
            ) : (
              <>
                <Button variant="ghost" size="sm" onClick={() => navigate('/login')} icon={LogIn}>
                  Sign In
                </Button>
                <Button variant="primary" size="sm" onClick={() => navigate('/register')} icon={UserPlus}>
                  Register Patient
                </Button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-grow">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="bg-slate-900 text-slate-200 text-xs py-12 border-t border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 md:grid-cols-4 gap-8">
          <div className="space-y-3">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <HeartPulse className="w-4 h-4 text-white" />
              </div>
              <span className="text-lg font-bold text-white">CareFlow</span>
            </div>
            <p className="text-xs text-slate-400 leading-relaxed">
              Hospital network and private clinical operating platform delivering connected patient care and operational precision.
            </p>
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Platform</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><a href="#features" className="hover:text-white transition-colors">Clinical Network</a></li>
              <li><a href="#features" className="hover:text-white transition-colors">Medical Records Vault</a></li>
              <li><a href="#how-it-works" className="hover:text-white transition-colors">Governance & Security</a></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Access Portals</h4>
            <ul className="space-y-2 text-xs text-slate-400">
              <li><Link to="/login" className="hover:text-white transition-colors">Patient Concierge</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Doctor Clinical Workspace</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Clinic Operations Center</Link></li>
              <li><Link to="/login" className="hover:text-white transition-colors">Platform Command Center</Link></li>
            </ul>
          </div>
          <div>
            <h4 className="text-xs font-bold text-blue-400 uppercase tracking-wider mb-3">Clinical Security</h4>
            <p className="text-xs text-slate-400 leading-relaxed">
              Multi-tenant cryptographic data separation and granular audit logs protecting patient healthcare confidentiality.
            </p>
          </div>
        </div>
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-8 pt-8 border-t border-slate-800 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} CareFlow Healthcare Systems. All rights reserved.
        </div>
      </footer>
    </div>
  );
};

export default PublicTemplate;
