import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  X,
  LogOut,
  Home,
  Search,
  CalendarDays,
  FileHeart,
  Pill,
  UserRound,
  Activity
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveProfileImage } from '../../utils/resolveProfileImage';
import OrganizationLogo from '../common/OrganizationLogo';

export const MobileNavigation = ({
  isOpen = false,
  onClose,
  navItems = [],
  role = 'patient',
  portalTitle = 'CareFlow',
  organization = null
}) => {
  const { user, logout } = useAuth();
  const profileUrl = resolveProfileImage(user);

  const getRoleDisplayName = () => {
    const r = user?.role || role;
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'admin' || r === 'organization_admin') return 'Organization Admin';
    if (r === 'doctor') return 'Doctor';
    if (r === 'patient') return 'Patient';
    return r;
  };

  // Patient Bottom Bar Navigation items (high priority actions)
  const patientBottomNavItems = [
    { path: '/patient/dashboard', label: 'Home', icon: Home },
    { path: '/patient/doctors', label: 'Find Care', icon: Search },
    { path: '/patient/appointments', label: 'Appts', icon: CalendarDays },
    { path: '/patient/medical-records', label: 'Records', icon: FileHeart },
    { path: '/patient/prescriptions', label: 'Rx', icon: Pill },
    { path: '/patient/profile', label: 'Profile', icon: UserRound }
  ];

  return (
    <>
      {/* 1. Patient Purpose-Built Bottom Navigation Bar (Visible only on mobile/tablet for patient) */}
      {role === 'patient' && (
        <nav
          aria-label="Mobile Navigation Bar"
          className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 px-2 py-1 flex items-center justify-around shadow-sm safe-bottom"
        >
          {patientBottomNavItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) =>
                  `flex flex-col items-center justify-center py-2 px-2.5 min-h-[44px] rounded-lg text-[10px] font-medium transition-colors ${
                    isActive
                      ? 'text-blue-600 font-semibold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    <Icon
                      className={`w-5 h-5 mb-0.5 transition-colors ${
                        isActive ? 'text-blue-600' : 'text-slate-400'
                      }`}
                    />
                    <span className="truncate">{item.label}</span>
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      )}

      {/* 2. Slide-out Drawer for All Roles */}
      {isOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          {/* Backdrop */}
          <div
            onClick={onClose}
            aria-hidden="true"
            className="fixed inset-0 bg-slate-950/40 transition-opacity duration-150"
          />

          {/* Drawer Content */}
          <div className="relative w-4/5 max-w-xs bg-white text-slate-800 flex flex-col justify-between shadow-xl h-full p-4 border-r border-slate-200">
            <div>
              {/* Header */}
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div className="flex items-center gap-2.5 min-w-0">
                  {organization ? (
                    <OrganizationLogo organization={organization} size="sm" />
                  ) : (
                    <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shrink-0">
                      <Activity className="w-4 h-4 text-white" />
                    </div>
                  )}
                  <span className="font-bold text-sm text-slate-900 truncate">
                    {organization?.name || portalTitle}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close navigation menu"
                  className="p-2 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg text-slate-400 hover:text-slate-800 hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Navigation Items */}
              <nav className="py-4 space-y-1.5 overflow-y-auto max-h-[calc(100vh-180px)]">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <NavLink
                      key={item.path}
                      to={item.path}
                      onClick={onClose}
                      className={({ isActive }) =>
                        `flex items-center gap-3 px-3.5 py-3 min-h-[44px] rounded-xl text-[13px] transition-colors duration-150 ${
                          isActive
                            ? 'bg-blue-50/90 text-blue-700 font-semibold border border-blue-100/70 shadow-2xs'
                            : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          <Icon
                            className={`w-4.5 h-4.5 shrink-0 ${
                              isActive ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          />
                          <span className="truncate tracking-[-0.01em]">{item.label}</span>
                        </>
                      )}
                    </NavLink>
                  );
                })}
              </nav>
            </div>

            {/* Bottom User Area & Logout */}
            <div className="pt-3.5 border-t border-slate-200 flex items-center justify-between">
              <div className="flex items-center gap-2.5 min-w-0">
                <div className="w-8.5 h-8.5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 border border-blue-200 overflow-hidden">
                  {profileUrl ? (
                    <img src={profileUrl} alt={user?.name} className="w-full h-full object-cover" />
                  ) : (
                    <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
                  )}
                </div>
                <div className="truncate">
                  <span className="text-[12.5px] font-semibold text-slate-900 block truncate leading-tight">
                    {user?.name}
                  </span>
                  <span className="text-[11px] text-slate-500 block truncate font-medium leading-tight mt-0.5">
                    {getRoleDisplayName()}
                  </span>
                </div>
              </div>

              <button
                type="button"
                onClick={async () => {
                  onClose();
                  await logout();
                }}
                aria-label="Logout"
                className="p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors cursor-pointer"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default MobileNavigation;
