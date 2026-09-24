import api from './axios';

export const getSuperAdminDashboardApi = async () => {
  const response = await api.get('/super-admin/dashboard');
  return response.data;
};

export const getSuperAdminOrganizationsApi = async (params = {}) => {
  const response = await api.get('/super-admin/organizations', { params });
  return response.data;
};

export const getSuperAdminOrganizationByIdApi = async (id) => {
  const response = await api.get(`/super-admin/organizations/${id}`);
  return response.data;
};

export const approveOrganizationApi = async (id) => {
  const response = await api.patch(`/super-admin/organizations/${id}/approve`);
  return response.data;
};

export const rejectOrganizationApi = async (id, rejectionReason) => {
  const response = await api.patch(`/super-admin/organizations/${id}/reject`, { rejectionReason });
  return response.data;
};

export const suspendOrganizationApi = async (id, suspensionReason) => {
  const response = await api.patch(`/super-admin/organizations/${id}/suspend`, { suspensionReason });
  return response.data;
};

export const activateOrganizationApi = async (id) => {
  const response = await api.patch(`/super-admin/organizations/${id}/activate`);
  return response.data;
};

export const getSuperAdminDoctorsApi = async (params = {}) => {
  const response = await api.get('/super-admin/doctors', { params });
  return response.data;
};

export const getSuperAdminDoctorByIdApi = async (id) => {
  const response = await api.get(`/super-admin/doctors/${id}`);
  return response.data;
};

export const getSuperAdminPatientsApi = async (params = {}) => {
  const response = await api.get('/super-admin/patients', { params });
  return response.data;
};

export const getSuperAdminAppointmentsApi = async (params = {}) => {
  const response = await api.get('/super-admin/appointments', { params });
  return response.data;
};

export const getSuperAdminPaymentsApi = async (params = {}) => {
  const response = await api.get('/super-admin/payments', { params });
  return response.data;
};

export const getRegionalPerformanceApi = async (params = {}) => {
  const response = await api.get('/super-admin/regional-performance', { params });
  return response.data;
};

export const getSuperAdminOrganizationAnalyticsApi = async (params = {}) => {
  const response = await api.get('/super-admin/organizations/analytics', { params });
  return response.data;
};

export const getSuperAdminPatientAnalyticsApi = async (params = {}) => {
  const response = await api.get('/super-admin/patients/analytics', { params });
  return response.data;
};

export const getSuperAdminAppointmentAnalyticsApi = async (params = {}) => {
  const response = await api.get('/super-admin/appointments/analytics', { params });
  return response.data;
};



