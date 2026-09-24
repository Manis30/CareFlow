import React, { useState, useEffect, useRef, useCallback } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  ChevronRight,
  LogOut,
  Activity,
  Sparkles
} from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { resolveProfileImage } from '../../utils/resolveProfileImage';
import OrganizationLogo from '../common/OrganizationLogo';

const MIN_SIDEBAR_WIDTH = 230;
const MAX_SIDEBAR_WIDTH = 360;
const DEFAULT_SIDEBAR_WIDTH = 264;
const COLLAPSED_WIDTH = 72;
const STORAGE_KEY = 'careflow_sidebar_width';
const COLLAPSED_STORAGE_KEY = 'careflow_sidebar_collapsed';

export const ResizableSidebar = ({
  navItems = [],
  role = 'patient',
  portalTitle = 'CareFlow',
  portalSubtitle = 'Portal',
  organization = null,
  onAiTrigger = null
}) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  // Load persisted width and collapsed state
  const [width, setWidth] = useState(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    const parsed = parseInt(saved, 10);
    return !isNaN(parsed) && parsed >= MIN_SIDEBAR_WIDTH && parsed <= MAX_SIDEBAR_WIDTH
      ? parsed
      : DEFAULT_SIDEBAR_WIDTH;
  });

  const [isCollapsed, setIsCollapsed] = useState(() => {
    return localStorage.getItem(COLLAPSED_STORAGE_KEY) === 'true';
  });

  const [isDragging, setIsDragging] = useState(false);
  const dragStartX = useRef(0);
  const startWidthRef = useRef(width);

  // Sync collapsed state to localStorage
  const toggleCollapse = useCallback(() => {
    setIsCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSED_STORAGE_KEY, String(next));
      window.dispatchEvent(new CustomEvent('careflow:sidebar-toggle', { detail: { isCollapsed: next } }));
      setTimeout(() => {
        window.dispatchEvent(new Event('resize'));
      }, 120);
      return next;
    });
  }, []);

  // Mouse drag handler
  const handleMouseDown = (e) => {
    if (isCollapsed) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartX.current = e.clientX;
    startWidthRef.current = width;

    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    const handleMouseMove = (e) => {
      if (!isDragging) return;
      const deltaX = e.clientX - dragStartX.current;
      const newWidth = Math.min(MAX_SIDEBAR_WIDTH, Math.max(MIN_SIDEBAR_WIDTH, startWidthRef.current + deltaX));
      setWidth(newWidth);
    };

    const handleMouseUp = () => {
      if (!isDragging) return;
      setIsDragging(false);
      localStorage.setItem(STORAGE_KEY, String(width));
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, width]);

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const getRoleDisplayName = () => {
    const r = user?.role || role;
    if (r === 'super_admin') return 'Super Admin';
    if (r === 'admin' || r === 'organization_admin') return 'Organization Admin';
    if (r === 'doctor') return 'Doctor';
    if (r === 'patient') return 'Patient';
    return r;
  };

  const profileUrl = resolveProfileImage(user);
  const currentWidth = isCollapsed ? COLLAPSED_WIDTH : width;

  return (
    <aside
      style={{ width: `${currentWidth}px` }}
      aria-label="Main Navigation"
      className={`relative hidden md:flex flex-col justify-between shrink-0 h-screen sticky top-0 z-30
        bg-white text-slate-700 border-r border-slate-200/90 transition-[width] ${
          isDragging ? 'duration-0' : 'duration-150'
        } ease-out select-none shadow-2xs`}
    >
      {/* 1. Header & Navigation Links */}
      <div className="flex flex-col flex-1 min-h-0">
        <div
          className={`h-16 border-b border-slate-200/90 transition-all flex items-center shrink-0 ${
            isCollapsed ? 'justify-center px-0' : 'justify-between px-4'
          }`}
        >
          <div className="flex items-center gap-3 min-w-0">
            {organization ? (
              <div className="w-9 h-9 shrink-0 flex items-center justify-center">
                <OrganizationLogo organization={organization} size="sm" />
              </div>
            ) : (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-blue-600 text-white shadow-xs">
                <Activity className="h-5 w-5 text-white" />
              </div>
            )}

            {!isCollapsed && (
              <div className="truncate">
                <span className="font-bold text-[14.5px] tracking-tight text-slate-900 block truncate leading-tight">
                  {portalTitle}
                </span>
                <span className="text-[10px] font-bold text-blue-600 tracking-[0.08em] block truncate uppercase leading-tight mt-0.5">
                  {portalSubtitle}
                </span>
              </div>
            )}
          </div>

          {/* Clean Floating Collapse Button */}
          <button
            type="button"
            onClick={toggleCollapse}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            className="hidden lg:flex absolute -right-3 top-8 -translate-y-1/2 z-50 h-6 w-6 items-center justify-center rounded-full bg-white text-slate-500 border border-slate-200 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 shadow-xs transition-all duration-150 cursor-pointer"
          >
            {isCollapsed ? (
              <ChevronRight className="h-3 w-3" />
            ) : (
              <ChevronLeft className="h-3 w-3" />
            )}
          </button>
        </div>

        {/* 2. Navigation Links */}
        <nav className="flex-1 px-3 py-4 space-y-1.5 overflow-y-auto overflow-x-hidden scrollbar-thin">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink
                key={item.path}
                to={item.path}
                title={isCollapsed ? item.label : undefined}
                className={({ isActive }) =>
                  `group relative flex items-center rounded-xl text-[13px] transition-all duration-150 ${
                    isCollapsed ? 'justify-center h-10 px-0' : 'gap-3 px-3.5 py-2.5'
                  } ${
                    isActive
                      ? 'bg-blue-50/90 text-blue-700 font-semibold shadow-2xs border border-blue-100/70'
                      : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 font-medium border border-transparent'
                  }`
                }
              >
                {({ isActive }) => (
                  <>
                    {/* Active Left Indicator Bar */}
                    {isActive && (
                      <span
                        className="absolute left-0 top-1/2 -translate-y-1/2 h-5 w-1 rounded-r-full bg-blue-600"
                        aria-hidden="true"
                      />
                    )}

                    <div className="w-5 h-5 flex items-center justify-center shrink-0">
                      <Icon
                        className={`h-[18px] w-[18px] shrink-0 transition-colors ${
                          isActive ? 'text-blue-600' : 'text-slate-400 group-hover:text-slate-700'
                        }`}
                      />
                    </div>

                    {!isCollapsed && (
                      <span className="truncate tracking-[-0.01em]">{item.label}</span>
                    )}
                  </>
                )}
              </NavLink>
            );
          })}
        </nav>
      </div>

      {/* 3. Bottom User Profile & Intelligence Quick Trigger */}
      <div className="p-3.5 border-t border-slate-200/90 space-y-2.5 shrink-0 bg-white">
        {/* CareFlow Intelligence Trigger Button: Subtle, calm clinical copilot */}
        {onAiTrigger && (
          <button
            type="button"
            onClick={onAiTrigger}
            title="CareFlow Intelligence"
            className={`w-full flex items-center rounded-xl text-[12.5px] font-semibold transition-all duration-150 border border-blue-200/70 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 text-blue-700 hover:from-blue-100/80 hover:to-indigo-100/80 cursor-pointer shadow-2xs ${
              isCollapsed ? 'justify-center h-10 p-0' : 'px-3.5 py-2.5 gap-2.5'
            }`}
          >
            <div className="w-5 h-5 flex items-center justify-center shrink-0">
              <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
            </div>
            {!isCollapsed && (
              <span className="truncate text-blue-900 font-semibold tracking-tight">✦ Intelligence</span>
            )}
          </button>
        )}

        {/* User Card */}
        <div
          className={`flex items-center rounded-xl transition-colors ${
            isCollapsed
              ? 'justify-center h-10 p-0'
              : 'gap-2.5 bg-slate-50/80 hover:bg-slate-100/60 p-2.5 border border-slate-200/80'
          }`}
        >
          <div className="w-8.5 h-8.5 rounded-full bg-blue-100 text-blue-700 font-bold text-xs flex items-center justify-center shrink-0 overflow-hidden border border-blue-200/80">
            {profileUrl ? (
              <img src={profileUrl} alt={user?.name || 'User'} className="w-full h-full object-cover" />
            ) : (
              <span>{user?.name ? user.name.charAt(0).toUpperCase() : 'U'}</span>
            )}
          </div>

          {!isCollapsed && (
            <div className="flex-1 truncate">
              <span className="text-[12.5px] font-semibold text-slate-900 block truncate leading-tight">
                {user?.name || 'Authorized User'}
              </span>
              <span className="text-[11px] text-slate-500 block truncate font-medium leading-tight mt-0.5">
                {getRoleDisplayName()}
              </span>
            </div>
          )}

          {!isCollapsed && (
            <button
              type="button"
              onClick={handleLogout}
              title="Sign Out"
              aria-label="Sign Out"
              className="text-slate-400 hover:text-rose-600 hover:bg-rose-50 p-1.5 rounded-lg transition-colors cursor-pointer"
            >
              <LogOut className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* 4. Draggable Resize Handle */}
      {!isCollapsed && (
        <div
          onMouseDown={handleMouseDown}
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize sidebar"
          tabIndex={0}
          onKeyDown={(e) => {
            if (e.key === 'ArrowLeft') {
              setWidth((prev) => Math.max(MIN_SIDEBAR_WIDTH, prev - 10));
            } else if (e.key === 'ArrowRight') {
              setWidth((prev) => Math.min(MAX_SIDEBAR_WIDTH, prev + 10));
            }
          }}
          className={`absolute -right-1 top-0 bottom-0 w-2 cursor-col-resize z-40 group hover:bg-blue-500/20 transition-colors ${
            isDragging ? 'bg-blue-500' : ''
          }`}
        >
          <div className="w-0.5 h-8 bg-slate-300 group-hover:bg-blue-500 rounded-full mx-auto mt-[45vh] transition-colors" />
        </div>
      )}
    </aside>
  );
};

export default ResizableSidebar;
