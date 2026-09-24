import React, { useEffect, useState } from 'react';
import {
  LayoutDashboard,
  CalendarClock,
  Clock,
  FileHeart,
  ClipboardList,
  MessageSquare,
  UserRound
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { getOrganizationByIdApi } from '../api/organization';
import AppShell from '../components/layout/AppShell';

export const DoctorTemplate = () => {
  const { user } = useAuth();
  const [orgDetails, setOrgDetails] = useState(null);

  useEffect(() => {
    fetchClinicDetails();
  }, [user]);

  const fetchClinicDetails = async () => {
    if (typeof user?.organizationId === 'object' && user?.organizationId?.name) {
      setOrgDetails(user.organizationId);
      return;
    }

    const orgId = typeof user?.organizationId === 'string' ? user.organizationId : user?.doctorId?.organizationId;
    if (typeof orgId === 'string' && /^[0-9a-fA-F]{24}$/.test(orgId)) {
      try {
        const res = await getOrganizationByIdApi(orgId);
        const data = res.data?.organization || res.data;
        if (data) setOrgDetails(data);
      } catch {
        // Fallback gracefully
      }
    }
  };

  const navItems = [
    { path: '/doctor/dashboard', label: 'Clinical Workspace', icon: LayoutDashboard },
    { path: '/doctor/appointments', label: 'Appointments', icon: CalendarClock },
    { path: '/doctor/availability', label: 'Operating Schedule', icon: Clock },
    { path: '/doctor/medical-records', label: 'Shared Records', icon: FileHeart },
    { path: '/doctor/prescriptions', label: 'Prescriptions', icon: ClipboardList },
    { path: '/doctor/chat', label: 'Clinical Chat', icon: MessageSquare },
    { path: '/doctor/profile', label: 'Doctor Profile', icon: UserRound }
  ];

  const displayedClinicName = orgDetails?.name || user?.organizationId?.name || user?.organizationName || 'CareFlow';

  return (
    <AppShell
      navItems={navItems}
      role="doctor"
      portalTitle={displayedClinicName}
      portalSubtitle="Clinical Workspace"
      organization={orgDetails || user?.organizationId}
      profileRoute="/doctor/profile"
    />
  );
};

export default DoctorTemplate;
