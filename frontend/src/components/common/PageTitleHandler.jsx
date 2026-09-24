import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const ROUTE_TITLES = [
  // Public & Auth
  { path: '/home', title: 'Home' },
  { path: '/login', title: 'Login' },
  { path: '/register', title: 'Register' },
  { path: '/forgot-password', title: 'Forgot Password' },
  { path: '/reset-password', title: 'Reset Password' },
  { path: '/force-reset-password', title: 'Change Password' },
  { path: '/unauthorized', title: 'Unauthorized Access' },

  // Super Admin
  { path: '/super-admin/dashboard', title: 'Super Admin Dashboard' },
  { path: '/super-admin/organizations', title: 'Organizations' },
  { regex: /^\/super-admin\/organizations\/[^/]+$/, title: 'Organization Details' },
  { path: '/super-admin/doctors', title: 'All Doctors' },
  { regex: /^\/super-admin\/doctors\/[^/]+$/, title: 'Doctor Details' },
  { path: '/super-admin/patients', title: 'All Patients' },
  { path: '/super-admin/appointments', title: 'All Appointments' },
  { path: '/super-admin/payments', title: 'All Payments' },
  { path: '/super-admin/chat', title: 'Super Admin Chat' },
  { path: '/super-admin/profile', title: 'Super Admin Profile' },

  // Org Admin
  { path: '/admin/dashboard', title: 'Admin Dashboard' },
  { path: '/admin/doctors/add', title: 'Add New Doctor' },
  { regex: /^\/admin\/doctors\/[^/]+\/edit$/, title: 'Edit Doctor' },
  { regex: /^\/admin\/doctors\/[^/]+$/, title: 'Doctor Details' },
  { path: '/admin/doctors', title: 'Doctors Management' },
  { path: '/admin/departments', title: 'Departments Management' },
  { path: '/admin/appointments', title: 'Appointments Management' },
  { path: '/admin/patients', title: 'Patients Directory' },
  { path: '/admin/payments', title: 'Payments & Billing' },
  { path: '/admin/chat', title: 'Admin Chat' },
  { path: '/admin/profile', title: 'Admin Profile' },

  // Doctor
  { path: '/doctor/dashboard', title: 'Doctor Dashboard' },
  { regex: /^\/doctor\/appointments\/[^/]+$/, title: 'Appointment Details' },
  { path: '/doctor/appointments', title: 'Doctor Appointments' },
  { path: '/doctor/availability', title: 'Manage Schedules' },
  { path: '/doctor/medical-records', title: 'Medical Records' },
  { path: '/doctor/prescriptions', title: 'Prescriptions' },
  { path: '/doctor/chat', title: 'Doctor Chat' },
  { path: '/doctor/profile', title: 'Doctor Profile' },

  // Patient
  { path: '/patient/dashboard', title: 'Patient Dashboard' },
  { regex: /^\/patient\/doctors\/[^/]+$/, title: 'Doctor Profile' },
  { path: '/patient/doctors', title: 'Find Doctors' },
  { path: '/patient/book-appointment', title: 'Book Appointment' },
  { regex: /^\/patient\/appointments\/[^/]+$/, title: 'Appointment Details' },
  { path: '/patient/appointments', title: 'My Appointments' },
  { path: '/patient/medical-records', title: 'My Medical Records' },
  { path: '/patient/prescriptions', title: 'My Prescriptions' },
  { path: '/patient/payments', title: 'Billing & Payments' },
  { path: '/patient/profile', title: 'My Profile' },

  // Common / Meeting
  { regex: /^\/meeting\/[^/]+$/, title: 'Video Consultation' },
];

export const getTitleForPath = (pathname) => {
  for (const route of ROUTE_TITLES) {
    if (route.path && route.path === pathname) {
      return route.title;
    }
    if (route.regex && route.regex.test(pathname)) {
      return route.title;
    }
  }
  return null;
};

const PageTitleHandler = () => {
  const location = useLocation();

  useEffect(() => {
    const matchedTitle = getTitleForPath(location.pathname);
    if (matchedTitle) {
      document.title = `${matchedTitle} | CareFlow`;
    } else {
      document.title = 'CareFlow - Healthcare Management System';
    }
  }, [location.pathname]);

  return null;
};

export default PageTitleHandler;
