import axios from 'axios';
import { ACCESS_TOKEN } from './token';


const apiUrl = "/choreo-apis/awbo/backend/rest-api-be2/v1.0";

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL ? import.meta.env.VITE_API_URL : apiUrl,
})


api.interceptors.request.use(
  (config) => {
    const accessToken = localStorage.getItem(ACCESS_TOKEN);
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => {
    Promise.reject(error);
  }
  
);

// Feedback API helpers
export const submitFeedback = async (payload) => {
  const res = await api.post('/feedback/', payload);
  return res.data;
}

export const listFeedbacks = async () => {
  const res = await api.get('/feedback/');
  return res.data;
}

export const getFeedback = async (id) => {
  const res = await api.get(`/feedback/${id}/`);
  return res.data;
}

export const updateFeedback = async (id, payload) => {
  // Use PATCH for partial updates (admin may only send admin_response/status)
  const res = await api.patch(`/feedback/${id}/`, payload);
  return res.data;
  
}

export const getCurrentUser = async () => {
  const res = await api.get('/auth/me/');
  return res.data;
}

export default api;