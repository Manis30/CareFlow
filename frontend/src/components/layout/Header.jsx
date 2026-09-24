import React from 'react';
import { Menu, Search, Sparkles } from 'lucide-react';
import { NavLink, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { resolveProfileImage } from '../../utils/resolveProfileImage';

export const Header = ({
  onMobileMenuToggle,
  onAiTrigger,
  organization = null,
  breadcrumbs = [],
  profileRoute = '/patient/profile',
  pageTitle = null
}) => {
  const { user } = useAuth();
  const location = useLocation();
  const profileUrl = resolveProfileImage(user);

  const getContextTitle = () => {
    if (pageTitle) return pageTitle;
    if (breadcrumbs && breadcrumbs.length > 0) {
      return breadcrumbs[breadcrumbs.length - 1].label;
    }
    const path = location.pathname;

    // Super Admin Routes
    if (path.includes('/super-admin/dashboard')) return 'Platform Operations Overview';
    if (path.includes('/super-admin/organizations/') && path !== '/super-admin/organizations') return 'Organization Dossier';
    if (path.includes('/super-admin/organizations')) return 'Clinic Organizations';
    if (path.includes('/super-admin/doctors/') && path !== '/super-admin/doctors') return 'Clinician Profile';
    if (path.includes('/super-admin/doctors')) return 'Platform Clinicians';
    if (path.includes('/super-admin/patients')) return 'Platform Patients Directory';
    if (path.includes('/super-admin/appointments')) return 'Platform Consultations';
    if (path.includes('/super-admin/payments')) return 'Platform Revenue Ledger';
    if (path.includes('/super-admin/chat')) return 'Platform Communications';
    if (path.includes('/super-admin/profile')) return 'Platform Governance Profile';

    // Admin Routes
    if (path.includes('/admin/dashboard')) return 'Clinic Operations Center';
    if (path.includes('/admin/doctors/add')) return 'Register Clinician';
    if (path.includes('/admin/doctors/') && path.includes('/edit')) return 'Edit Clinician';
    if (path.includes('/admin/doctors/') && path !== '/admin/doctors') return 'Clinician Profile';
    if (path.includes('/admin/doctors')) return 'Clinicians Directory';
    if (path.includes('/admin/departments')) return 'Clinical Departments';
    if (path.includes('/admin/appointments')) return 'Appointments Ledger';
    if (path.includes('/admin/patients')) return 'Patient Registry';
    if (path.includes('/admin/payments')) return 'Financial Ledger';
    if (path.includes('/admin/chat')) return 'Operations Chat';
    if (path.includes('/admin/profile')) return 'Clinic Profile';

    // Doctor Routes
    if (path.includes('/doctor/dashboard')) return 'Doctor Clinical Workspace';
    if (path.includes('/doctor/appointments/') && path !== '/doctor/appointments') return 'Consultation Chart';
    if (path.includes('/doctor/appointments')) return 'Clinical Schedule';
    if (path.includes('/doctor/availability')) return 'Operating Hours & Availability';
    if (path.includes('/doctor/medical-records')) return 'Shared Medical Records';
    if (path.includes('/doctor/prescriptions')) return 'Prescriptions & Orders';
    if (path.includes('/doctor/chat')) return 'Clinical Chat';
    if (path.includes('/doctor/profile')) return 'Clinician Profile';

    // Patient Routes
    if (path.includes('/patient/dashboard')) return 'Healthcare Portal';
    if (path.includes('/patient/doctors/') && path !== '/patient/doctors') return 'Doctor Profile';
    if (path.includes('/patient/doctors')) return 'Find Care & Specialists';
    if (path.includes('/patient/book-appointment')) return 'Schedule Clinical Consultation';
    if (path.includes('/patient/appointments/') && path !== '/patient/appointments') return 'Consultation Details';
    if (path.includes('/patient/appointments')) return 'My Appointments';
    if (path.includes('/patient/medical-records')) return 'Medical Records';
    if (path.includes('/patient/prescriptions')) return 'Medications & Prescriptions';
    if (path.includes('/patient/payments')) return 'Billing & Payment History';
    if (path.includes('/patient/profile')) return 'Personal Health Profile';

    // Common / Meeting
    if (path.includes('/meeting/')) return 'Live Teleconsultation Room';

    return 'CareFlow';
  };

  const getRoleDisplayName = () => {
    if (!user?.role) return 'User';
    if (user.role === 'super_admin') return 'Super Admin';
    if (user.role === 'admin' || user.role === 'organization_admin') return 'Organization Admin';
    if (user.role === 'doctor') return 'Doctor';
    if (user.role === 'patient') return 'Patient';
    return user.role;
  };

  return (
    <header className="sticky top-0 z-30 h-15 bg-white border-b border-slate-200 px-4 sm:px-5 md:px-6 flex items-center justify-between shadow-2xs">
      {/* Left: Mobile Toggle & Page Context Title */}
      <div className="flex items-center gap-3 min-w-0">
        <button
          type="button"
          onClick={onMobileMenuToggle}
          aria-label="Toggle navigation menu"
          className="md:hidden p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer border border-slate-200"
        >
          <Menu className="w-5 h-5" />
        </button>

        {/* Page Context Heading & Breadcrumbs */}
        <div className="flex items-center gap-2 min-w-0">
          {breadcrumbs && breadcrumbs.length > 1 ? (
            <nav aria-label="Breadcrumbs" className="flex items-center gap-1.5 text-xs text-slate-500 truncate">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={idx}>
                  {idx > 0 && <span className="text-slate-300">/</span>}
                  {crumb.path ? (
                    <NavLink
                      to={crumb.path}
                      className="hover:text-blue-600 font-medium transition-colors truncate"
                    >
                      {crumb.label}
                    </NavLink>
                  ) : (
                    <span className="font-bold text-slate-900 truncate">{crumb.label}</span>
                  )}
                </React.Fragment>
              ))}
            </nav>
          ) : (
            <div className="flex items-center gap-2">
              <h1 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight truncate">
                {getContextTitle()}
              </h1>
            </div>
          )}
        </div>
      </div>

      {/* Right: Global Command Search, AI Trigger & User Avatar */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Clean Clinical Search Input */}
        <div className="relative hidden md:flex items-center">
          <Search className="absolute left-3 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="Search records, appointments..."
            className="w-48 lg:w-64 h-9 pl-9 pr-8 rounded-xl border border-slate-200 bg-slate-50 text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 focus:bg-white transition-all font-medium"
          />
          <kbd className="absolute right-2.5 text-[9px] font-semibold text-slate-400 border border-slate-200 rounded px-1.5 py-0.5 bg-white">
            ⌘K
          </kbd>
        </div>

        {/* CareFlow Intelligence Trigger Button: Calm, clinical, restrained */}
        {onAiTrigger && (
          <button
            type="button"
            onClick={onAiTrigger}
            aria-label="Open CareFlow Intelligence"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-blue-200 bg-blue-50/70 text-blue-700 hover:bg-blue-100 text-xs font-semibold transition-all cursor-pointer shadow-2xs"
          >
            <Sparkles className="w-3.5 h-3.5 text-blue-600" />
            <span className="hidden sm:inline">✦ Intelligence</span>
          </button>
        )}

        {/* User Profile Avatar Link */}
        <NavLink
          to={profileRoute}
          aria-label="User Profile"
          className="flex items-center gap-2 p-1 rounded-xl hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center overflow-hidden border border-blue-200">
            {profileUrl ? (
              <img src={profileUrl} alt={user?.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
            )}
          </div>
          <div className="hidden lg:block text-left">
            <span className="text-xs font-bold text-slate-900 block leading-tight truncate max-w-[130px]">
              {user?.name || 'My Account'}
            </span>
            <span className="text-[10px] text-slate-500 block leading-none font-medium">
              {getRoleDisplayName()}
            </span>
          </div>
        </NavLink>
      </div>
    </header>
  );
};

export default Header;
