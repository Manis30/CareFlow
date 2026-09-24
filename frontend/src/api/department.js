import api from './axios';

export const createDepartmentApi = async (data) => {
  const response = await api.post('/department/', data);
  return response.data;
};

export const getDepartmentsApi = async (params) => {
  const response = await api.get('/department/', { params });
  return response.data;
};

export const getDepartmentByIdApi = async (id) => {
  const response = await api.get(`/department/${id}`);
  return response.data;
};

export const updateDepartmentApi = async (id, data) => {
  const response = await api.patch(`/department/${id}`, data);
  return response.data;
};

export const deleteDepartmentApi = async (id) => {
  const response = await api.delete(`/department/${id}`);
  return response.data;
};
