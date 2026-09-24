import React from 'react';
import {
  Home,
  Search,
  CalendarDays,
  FileHeart,
  Pill,
  WalletCards,
  UserRound
} from 'lucide-react';
import AppShell from '../components/layout/AppShell';

export const PatientTemplate = () => {
  const navItems = [
    { path: '/patient/dashboard', label: 'Home', icon: Home },
    { path: '/patient/doctors', label: 'Find Care', icon: Search },
    { path: '/patient/appointments', label: 'Appointments', icon: CalendarDays },
    { path: '/patient/medical-records', label: 'Health Vault', icon: FileHeart },
    { path: '/patient/prescriptions', label: 'Prescriptions', icon: Pill },
    { path: '/patient/payments', label: 'Payments', icon: WalletCards },
    { path: '/patient/profile', label: 'My Account', icon: UserRound }
  ];

  return (
    <AppShell
      navItems={navItems}
      role="patient"
      portalTitle="CareFlow"
      portalSubtitle="Patient Portal"
      profileRoute="/patient/profile"
    />
  );
};

export default PatientTemplate;
