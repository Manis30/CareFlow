import React from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import ProtectedRoute from './ProtectedRoute';
import AppLoader from '../components/common/AppLoader';
import { useAuth } from '../context/AuthContext';
import { getDashboardRoute } from '../utils/normalizeRole';

// Templates
import PublicTemplate from '../templates/PublicTemplate';
import AuthTemplate from '../templates/AuthTemplate';
import SuperAdminTemplate from '../templates/SuperAdminTemplate';
import AdminTemplate from '../templates/AdminTemplate';
import DoctorTemplate from '../templates/DoctorTemplate';
import PatientTemplate from '../templates/PatientTemplate';
// Meeting Room Page
import MeetingRoom from '../pages/common/MeetingRoom';

import { ROLES } from '../utils/constants';
import Home from '../pages/public/Home';
import Login from '../pages/auth/Login';
import Register from '../pages/auth/Register';
import ForgotPassword from '../pages/auth/ForgotPassword';
import ResetPassword from '../pages/auth/ResetPassword';
import ForceResetPassword from '../pages/auth/ForceResetPassword';
import Unauthorized from '../pages/auth/Unauthorized';
import NotFound from '../pages/auth/NotFound';

// Super Admin Pages
import SuperAdminDashboard from '../pages/superAdmin/Dashboard';
import SuperAdminOrganizations from '../pages/superAdmin/Organizations';
import SuperAdminOrganizationDetails from '../pages/superAdmin/OrganizationDetails';
import SuperAdminDoctors from '../pages/superAdmin/Doctors';
import SuperAdminDoctorDetails from '../pages/superAdmin/DoctorDetails';
import SuperAdminPatients from '../pages/superAdmin/Patients';
import SuperAdminAppointments from '../pages/superAdmin/Appointments';
import SuperAdminPayments from '../pages/superAdmin/Payments';
import SuperAdminProfile from '../pages/superAdmin/Profile';
import SuperAdminChat from '../pages/superAdmin/Chat';

// Org Admin Pages
import AdminDashboard from '../pages/admin/Dashboard';
import AdminDoctors from '../pages/admin/Doctors';
import AdminAddDoctor from '../pages/admin/AddDoctor';
import AdminEditDoctor from '../pages/admin/EditDoctor';
import AdminDoctorDetails from '../pages/admin/DoctorDetails';
import AdminDepartments from '../pages/admin/Departments';
import AdminAppointments from '../pages/admin/Appointments';
import AdminPatients from '../pages/admin/Patients';
import AdminPayments from '../pages/admin/Payments';
import AdminProfile from '../pages/admin/Profile';
import AdminChat from '../pages/admin/Chat';

// Doctor Pages
import DoctorDashboard from '../pages/doctor/Dashboard';
import DoctorAppointments from '../pages/doctor/Appointments';
import DoctorAppointmentDetails from '../pages/doctor/AppointmentDetails';
import DoctorAvailability from '../pages/doctor/Availability';
import DoctorMedicalRecords from '../pages/doctor/MedicalRecords';
import DoctorPrescriptions from '../pages/doctor/Prescriptions';
import DoctorChat from '../pages/doctor/Chat';
import DoctorProfile from '../pages/doctor/Profile';

// Patient Pages
import PatientDashboard from '../pages/patient/Dashboard';
import PatientDoctors from '../pages/patient/Doctors';
import PatientDoctorDetails from '../pages/patient/DoctorDetails';
import PatientBookAppointment from '../pages/patient/BookAppointment';
import PatientAppointments from '../pages/patient/Appointments';
import PatientAppointmentDetails from '../pages/patient/AppointmentDetails';
import PatientMedicalRecords from '../pages/patient/MedicalRecords';
import PatientPrescriptions from '../pages/patient/Prescriptions';
import PatientPayments from '../pages/patient/Payments';
import PatientProfile from '../pages/patient/Profile';


const AppRoutes = () => {
  const { user, authInitialized } = useAuth();
  const location = useLocation();

  if (!authInitialized) {
    return <AppLoader />;
  }

  if (user && (location.pathname === '/' || location.pathname === '/login')) {
    if (user.mustResetPassword === true) {
      return <Navigate to="/force-reset-password" replace />;
    }
    return <Navigate to={getDashboardRoute(user.role)} replace />;
  }

  return (
    <Routes>
      {/* Root redirect to login */}
      <Route path="/" element={<Navigate to="/login" replace />} />

      {/* Public Pages */}
      <Route element={<PublicTemplate />}>
        <Route path="/home" element={<Home />} />
      </Route>

      {/* Auth Pages */}
      <Route element={<AuthTemplate />}>
        <Route path="/login" element={<Login />} />
        <Route path="/register" element={<Register />} />
        <Route path="/forgot-password" element={<ForgotPassword />} />
        <Route path="/reset-password" element={<ResetPassword />} />
        <Route path="/unauthorized" element={<Unauthorized />} />
      </Route>

      {/* First-Login Force Password Change Route */}
      <Route element={<ProtectedRoute isForceResetRoute={true} />}>
        <Route element={<AuthTemplate />}>
          <Route path="/force-reset-password" element={<ForceResetPassword />} />
        </Route>
      </Route>

      {/* Super Admin Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.SUPER_ADMIN]} />}>
        <Route element={<SuperAdminTemplate />}>
          <Route path="/super-admin/dashboard" element={<SuperAdminDashboard />} />
          <Route path="/super-admin/organizations" element={<SuperAdminOrganizations />} />
          <Route path="/super-admin/organizations/:id" element={<SuperAdminOrganizationDetails />} />
          <Route path="/super-admin/doctors" element={<SuperAdminDoctors />} />
          <Route path="/super-admin/doctors/:id" element={<SuperAdminDoctorDetails />} />
          <Route path="/super-admin/patients" element={<SuperAdminPatients />} />
          <Route path="/super-admin/appointments" element={<SuperAdminAppointments />} />
          <Route path="/super-admin/payments" element={<SuperAdminPayments />} />
          <Route path="/super-admin/chat" element={<SuperAdminChat />} />
          <Route path="/super-admin/profile" element={<SuperAdminProfile />} />
        </Route>
      </Route>

      {/* Organization Admin Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.ADMIN]} />}>
        <Route element={<AdminTemplate />}>
          <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/doctors" element={<AdminDoctors />} />
          <Route path="/admin/doctors/add" element={<AdminAddDoctor />} />
          <Route path="/admin/doctors/:id" element={<AdminDoctorDetails />} />
          <Route path="/admin/doctors/:id/edit" element={<AdminEditDoctor />} />
          <Route path="/admin/departments" element={<AdminDepartments />} />
          <Route path="/admin/appointments" element={<AdminAppointments />} />
          <Route path="/admin/patients" element={<AdminPatients />} />
          <Route path="/admin/payments" element={<AdminPayments />} />
          <Route path="/admin/chat" element={<AdminChat />} />
          <Route path="/admin/profile" element={<AdminProfile />} />
        </Route>
      </Route>

      {/* Doctor Protected Routes */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.DOCTOR]} />}>
        <Route element={<DoctorTemplate />}>
          <Route path="/doctor/dashboard" element={<DoctorDashboard />} />
          <Route path="/doctor/appointments" element={<DoctorAppointments />} />
          <Route path="/doctor/appointments/:id" element={<DoctorAppointmentDetails />} />
          <Route path="/doctor/availability" element={<DoctorAvailability />} />
          <Route path="/doctor/medical-records" element={<DoctorMedicalRecords />} />
          <Route path="/doctor/prescriptions" element={<DoctorPrescriptions />} />
          <Route path="/doctor/chat" element={<DoctorChat />} />
          <Route path="/doctor/profile" element={<DoctorProfile />} />
        </Route>
      </Route>

      {/* Patient Protected Routes (Mobile-First) */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.PATIENT]} />}>
        <Route element={<PatientTemplate />}>
          <Route path="/patient/dashboard" element={<PatientDashboard />} />
          <Route path="/patient/doctors" element={<PatientDoctors />} />
          <Route path="/patient/doctors/:id" element={<PatientDoctorDetails />} />
          <Route path="/patient/book-appointment" element={<PatientBookAppointment />} />
          <Route path="/patient/appointments" element={<PatientAppointments />} />
          <Route path="/patient/appointments/:id" element={<PatientAppointmentDetails />} />
          <Route path="/patient/medical-records" element={<PatientMedicalRecords />} />
          <Route path="/patient/prescriptions" element={<PatientPrescriptions />} />
          <Route path="/patient/payments" element={<PatientPayments />} />
          <Route path="/patient/profile" element={<PatientProfile />} />
        </Route>
      </Route>

      {/* Protected Standalone Video Consultation Room Route */}
      <Route element={<ProtectedRoute allowedRoles={[ROLES.PATIENT, ROLES.DOCTOR, ROLES.ADMIN, ROLES.SUPER_ADMIN]} />}>
        <Route path="/meeting/:appointmentId" element={<MeetingRoom />} />
      </Route>

      {/* Fallback 404 Route */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

export default AppRoutes;
