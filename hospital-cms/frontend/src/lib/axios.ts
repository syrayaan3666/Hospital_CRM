import axios, { AxiosHeaders, type AxiosError, type AxiosInstance, type AxiosRequestConfig, type InternalAxiosRequestConfig } from 'axios';

interface RefreshResponse {
  success: boolean;
  data: {
    accessToken: string;
  };
}

interface RetriableConfig extends AxiosRequestConfig {
  _retry?: boolean;
}

const apiBaseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

const apiClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const refreshClient: AxiosInstance = axios.create({
  baseURL: apiBaseUrl,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

const isBrowser = typeof window !== 'undefined';

apiClient.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  if (!isBrowser) {
    return config;
  }

  const token = window.localStorage.getItem('hms_access_token');

  if (token) {
    config.headers = config.headers ?? new AxiosHeaders();
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as RetriableConfig | undefined;

    if (!isBrowser || error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    originalRequest._retry = true;

    try {
      const refreshResponse = await refreshClient.post<RefreshResponse>('/auth/refresh', {}, { withCredentials: true });
      const nextToken = refreshResponse.data.data.accessToken;

      window.localStorage.setItem('hms_access_token', nextToken);

      originalRequest.headers = originalRequest.headers ?? new AxiosHeaders();
      originalRequest.headers.Authorization = `Bearer ${nextToken}`;

      return apiClient(originalRequest);
    } catch (refreshError) {
      window.localStorage.removeItem('hms_access_token');
      window.location.href = '/login';
      return Promise.reject(refreshError);
    }
  },
);

export default apiClient;
