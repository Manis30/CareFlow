import React, { useState } from 'react';
import { Outlet } from 'react-router-dom';
import ResizableSidebar from './ResizableSidebar';
import Header from './Header';
import MobileNavigation from './MobileNavigation';
import AiDrawer from '../common/AiDrawer';

export const AppShell = ({
  navItems = [],
  role = 'patient',
  portalTitle = 'CareFlow',
  portalSubtitle = 'Healthcare System',
  organization = null,
  breadcrumbs = [],
  profileRoute = '/patient/profile',
  contextPanel = null,
  children
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);

  const handleToggleMobileMenu = () => setMobileMenuOpen((prev) => !prev);
  const handleCloseMobileMenu = () => setMobileMenuOpen(false);
  const handleToggleAi = () => setAiDrawerOpen((prev) => !prev);

  return (
    <div className="min-h-screen flex bg-[#F7F9FC] font-sans antialiased text-slate-900">
      {/* 1. Draggable & Resizable Desktop Sidebar */}
      <ResizableSidebar
        navItems={navItems}
        role={role}
        portalTitle={portalTitle}
        portalSubtitle={portalSubtitle}
        organization={organization}
        onAiTrigger={handleToggleAi}
      />

      {/* 2. Main Application Flow */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen bg-[#F7F9FC]">
        {/* Universal Clinical Header */}
        <Header
          onMobileMenuToggle={handleToggleMobileMenu}
          onAiTrigger={handleToggleAi}
          organization={organization}
          breadcrumbs={breadcrumbs}
          profileRoute={profileRoute}
        />

        {/* Dynamic Workspace Container with Optional Right Context Panel */}
        <div className="flex-1 flex min-w-0 bg-[#F7F9FC]">
          <main className="flex-1 min-w-0 overflow-y-auto overflow-x-hidden bg-[#F7F9FC] pb-20 md:pb-8">
            {children || <Outlet />}
          </main>

          {/* Contextual Right Panel (Desktop) */}
          {contextPanel}
        </div>
      </div>

      {/* 3. Purpose-Built Mobile Navigation */}
      <MobileNavigation
        isOpen={mobileMenuOpen}
        onClose={handleCloseMobileMenu}
        navItems={navItems}
        role={role}
        portalTitle={portalTitle}
        organization={organization}
      />

      {/* 4. Native CareFlow Intelligence Drawer */}
      <AiDrawer isOpen={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
    </div>
  );
};

export default AppShell;
