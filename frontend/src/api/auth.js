import api from './axios';

export const registerUserApi = async (userData) => {
  const response = await api.post('/auth/', userData);
  return response.data;
};

export const loginUserApi = async (credentials) => {
  const response = await api.post('/auth/login', credentials);
  return response.data;
};

export const refreshTokenApi = async () => {
  const response = await api.post('/auth/refresh');
  return response.data;
};

export const logoutUserApi = async () => {
  const response = await api.post('/auth/logout');
  return response.data;
};

export const getMeApi = async () => {
  const response = await api.get('/auth/me');
  return response.data;
};

export const updateProfileApi = async (profileData) => {
  const response = await api.patch('/auth/me', profileData);
  return response.data;
};

export const updateProfileImageApi = async (formData) => {
  const response = await api.patch('/auth/me/profile-image', formData, {
    headers: {
      'Content-Type': 'multipart/form-data'
    }
  });
  return response.data;
};

export const forgotPasswordApi = async (emailData) => {
  const response = await api.post('/auth/forgot-password', emailData);
  return response.data;
};

export const resetPasswordApi = async (resetData) => {
  const response = await api.post('/auth/reset-password', resetData);
  return response.data;
};

export const forceResetPasswordApi = async (resetData) => {
  const response = await api.post('/auth/force-reset-password', resetData);
  return response.data;
};
