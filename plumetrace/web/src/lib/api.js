/**
 * OWNER    : Tanmay
 * DUE      : D1 13:00
 * TASK     :
 *   axios instance (baseURL VITE_API_URL, Bearer id token from authStore, 401 -> login). If VITE_USE_MOCKS=1 read contracts/mocks via import.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import axios from 'axios';
import { useAuthStore } from '../stores/authStore';

const USE_MOCKS = import.meta.env.VITE_USE_MOCKS === '1';

const realApi = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
});

realApi.interceptors.request.use((config) => {
  const { tokens } = useAuthStore.getState();
  if (tokens?.idToken) {
    config.headers.Authorization = `Bearer ${tokens.idToken}`;
  }
  return config;
});

realApi.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      useAuthStore.getState().logout();
    }
    return Promise.reject(error);
  }
);

const getMockData = async (url) => {
  if (url.includes('/runs/latest')) return (await import('../../../contracts/mocks/summary.json')).default;
  if (url.includes('/forecast')) return JSON.parse((await import('../../../contracts/mocks/forecast_h3.geojson?raw')).default);
  if (url.includes('/stations/')) return (await import('../../../contracts/mocks/station_forecast.json')).default;
  if (url.includes('/attribution')) return (await import('../../../contracts/mocks/attribution.json')).default;
  if (url.includes('/trajectories')) return JSON.parse((await import('../../../contracts/mocks/trajectories.geojson?raw')).default);
  if (url.includes('/skill')) return (await import('../../../contracts/mocks/skill.json')).default;
  if (url.includes('/fleet/')) return (await import('../../../contracts/mocks/fleet_exposure.json')).default;
  if (url.includes('/actions')) return (await import('../../../contracts/mocks/actions.json')).default;
  return {};
};

const api = USE_MOCKS
  ? {
      get: async (url) => ({ data: await getMockData(url) }),
      post: async () => ({ data: {} }),
      delete: async () => ({ data: {} }),
    }
  : realApi;

export default api;

export const fetchSummary = () => api.get('/runs/latest');
export const fetchForecastH3 = () => api.get('/forecast');
export const fetchStationForecast = (id) => api.get(`/stations/${id}`);
export const fetchAttribution = () => api.get('/attribution');
export const fetchTrajectories = () => api.get('/trajectories');
export const fetchSkill = () => api.get('/skill');
export const fetchFleetExposure = (id) => api.get(`/fleet/${id}`);
export const fetchActions = () => api.get('/actions');
