import React from 'react';
import {
  LayoutDashboard,
  Building2,
  Stethoscope,
  UsersRound,
  CalendarDays,
  WalletCards,
  MessageSquare,
  ShieldCheck
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';

export const SuperAdminTemplate = () => {
  const navItems = [
    { path: '/super-admin/dashboard', label: 'Command Center', icon: LayoutDashboard },
    { path: '/super-admin/organizations', label: 'Organizations', icon: Building2 },
    { path: '/super-admin/doctors', label: 'Doctors Ledger', icon: Stethoscope },
    { path: '/super-admin/patients', label: 'Patients Directory', icon: UsersRound },
    { path: '/super-admin/appointments', label: 'Platform Appointments', icon: CalendarDays },
    { path: '/super-admin/payments', label: 'Platform Revenue', icon: WalletCards },
    { path: '/super-admin/chat', label: 'Platform Comms', icon: MessageSquare },
    { path: '/super-admin/profile', label: 'System Settings', icon: ShieldCheck }
  ];

  return (
    <AppShell
      navItems={navItems}
      role="super_admin"
      portalTitle="CareFlow"
      portalSubtitle="Platform Command"
      profileRoute="/super-admin/profile"
    />
  );
};

export default SuperAdminTemplate;
