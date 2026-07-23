import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";

export interface ApiError {
  message: string;
  code: string;
  errors: Record<string, string[]>;
  request_id?: string;
  status: number;
}

// Create custom Axios instance
export const apiClient = axios.create({
  baseURL: env.VITE_API_BASE_URL,
  timeout: 15000,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
    Accept: "application/json",
  },
});

// Request interceptor
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const token = localStorage.getItem("murihspace-token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response interceptor to normalize errors
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error: AxiosError) => {
    const apiError: ApiError = {
      message: "An unexpected error occurred",
      code: "UNKNOWN_ERROR",
      errors: {},
      status: error.response?.status || 500,
    };

    if (error.response) {
      const data = error.response.data as Record<string, unknown>;
      const status = error.response.status;

      // Extract request ID if returned in headers or body
      apiError.request_id = 
        (error.response.headers["x-request-id"] as string) || 
        (typeof data?.request_id === "string" ? data.request_id : undefined);

      if (data && typeof data === "object") {
        apiError.message = (data.message as string) || apiError.message;
        apiError.code = (data.code as string) || apiError.code;
        apiError.errors = (data.errors as Record<string, string[]>) || {};
      }

      // Handle specific status codes
      switch (status) {
        case 401:
          apiError.code = apiError.code === "UNKNOWN_ERROR" ? "UNAUTHORIZED" : apiError.code;
          console.warn("[API Client] 401 Unauthorized detected. Session reset hook prepared.");
          break;
        case 419:
          apiError.code = "CSRF_TOKEN_MISMATCH";
          apiError.message = "Session expired or CSRF token invalid. Please refresh the page.";
          console.warn("[API Client] 419 CSRF Token mismatch detected.");
          break;
        case 422:
          apiError.code = "VALIDATION_ERROR";
          break;
        case 429:
          apiError.code = "TOO_MANY_REQUESTS";
          apiError.message = apiError.message || "Too many requests. Please try again later.";
          break;
        case 500:
          apiError.code = "INTERNAL_SERVER_ERROR";
          apiError.message = apiError.message || "Internal server error occurred.";
          break;
        default:
          break;
      }
    } else if (error.request) {
      // Network error or timeout
      apiError.message = "Network error. Please check your internet connection.";
      apiError.code = "NETWORK_ERROR";
      apiError.status = 0;
    } else {
      apiError.message = error.message;
    }

    return Promise.reject(apiError);
  }
);
export default apiClient;
