import api from './axios';

export const createOrganizationApi = async (orgData) => {
  let payload = orgData;
  let headers = {};
  if (orgData instanceof FormData) {
    payload = orgData;
    headers = { 'Content-Type': 'multipart/form-data' };
  }
  const response = await api.post('/organization/', payload, { headers });
  return response.data;
};

export const getOrganizationsApi = async (params = {}) => {
  const response = await api.get('/organization/', { params });
  return response.data;
};

export const getOrganizationByIdApi = async (id) => {
  const response = await api.get(`/organization/${id}`);
  return response.data;
};

export const getMyOrganizationApi = async () => {
  const response = await api.get('/organization/my');
  return response.data;
};

export const updateMyOrganizationApi = async (data) => {
  const response = await api.patch('/organization/my', data);
  return response.data;
};

export const updateMyOrganizationLogoApi = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.patch('/organization/my/logo', formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  });
  return response.data;
};

export const removeMyOrganizationLogoApi = async () => {
  const response = await api.delete('/organization/my/logo');
  return response.data;
};

export const updateOrganizationApi = async (id, data) => {
  const response = await api.patch(`/organization/${id}`, data);
  return response.data;
};

export const deleteOrganizationApi = async (id) => {
  const response = await api.delete(`/organization/${id}`);
  return response.data;
};

export const getOrganizationCitiesApi = async () => {
  const response = await api.get('/organization/cities');
  return response.data;
};

export const getActiveOrganizationsApi = async (params = {}) => {
  const response = await api.get('/organization/active', { params });
  return response.data;
};
