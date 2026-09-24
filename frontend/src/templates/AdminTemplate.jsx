import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  Stethoscope,
  Building2,
  CalendarDays,
  UsersRound,
  WalletCards,
  MessageSquare,
  Building
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrganizationByIdApi } from '../api/organization';
import AppShell from '../components/layout/AppShell';

export const AdminTemplate = () => {
  const { user } = useAuth();
  const [orgDetails, setOrgDetails] = useState(null);

  useEffect(() => {
    fetchClinicDetails();
  }, [user?.organizationId]);

  const fetchClinicDetails = async () => {
    if (!user?.organizationId) return;

    if (typeof user.organizationId === 'object' && user.organizationId?.name) {
      setOrgDetails(user.organizationId);
      return;
    }

    if (typeof user.organizationId === 'string' && /^[0-9a-fA-F]{24}$/.test(user.organizationId)) {
      try {
        const res = await getOrganizationByIdApi(user.organizationId);
        if (res.data) setOrgDetails(res.data);
      } catch {
        // Non-blocking fallback
      }
    }
  };

  const navItems = [
    { path: '/admin/dashboard', label: 'Operations Center', icon: LayoutDashboard },
    { path: '/admin/doctors', label: 'Doctors Registry', icon: Stethoscope },
    { path: '/admin/departments', label: 'Departments', icon: Building2 },
    { path: '/admin/appointments', label: 'Appointments Ledger', icon: CalendarDays },
    { path: '/admin/patients', label: 'Patient Registry', icon: UsersRound },
    { path: '/admin/payments', label: 'Payments & Revenue', icon: WalletCards },
    { path: '/admin/chat', label: 'Operations Chat', icon: MessageSquare },
    { path: '/admin/profile', label: 'Clinic Profile', icon: Building }
  ];

  const clinicName = orgDetails?.name || user?.organizationId?.name || user?.organizationName || 'CareFlow Clinic';

  return (
    <AppShell
      navItems={navItems}
      role="organization_admin"
      portalTitle={clinicName}
      portalSubtitle="Clinic Operations"
      organization={orgDetails || user?.organizationId}
      profileRoute="/admin/profile"
    />
  );
};

export default AdminTemplate;
