import { logger } from "@/lib/logger";
import axios, { type AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from "axios";
import { env } from "@/config/env";
import { getLiveSessionId, isLiveRequest } from "@/lib/live/liveSession";
import { ensureCsrfCookie, isUnsafeMethod, readXsrfToken, refreshCsrfCookie, XSRF_HEADER } from "@/lib/api/csrf";

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

// Marks a request that already had one CSRF retry, so a persistent 419 cannot loop.
// A flag on the config survives mergeConfig, unlike the config object's identity.
type CsrfRetryConfig = InternalAxiosRequestConfig & { _csrfRetried?: boolean };

// Request interceptor
apiClient.interceptors.request.use(
  async (config: InternalAxiosRequestConfig) => {
    if (isUnsafeMethod(config.method)) {
      const xsrf = await ensureCsrfCookie();
      if (xsrf) {
        config.headers[XSRF_HEADER] = xsrf;
      }
    }
    if (!config.headers["X-Client-Platform"]) {
      config.headers["X-Client-Platform"] = "web";
    }
    if (isLiveRequest(config.url ?? "") && !config.headers["X-Live-Session-ID"]) {
      const liveSessionId = getLiveSessionId();
      if (liveSessionId) {
        config.headers["X-Live-Session-ID"] = liveSessionId;
      }
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
  async (error: AxiosError) => {
    // A 419 means the CSRF cookie expired. Refresh it and resend the request once.
    const config = error.config as CsrfRetryConfig | undefined;
    if (error.response?.status === 419 && config && isUnsafeMethod(config.method) && !config._csrfRetried) {
      config._csrfRetried = true;
      await refreshCsrfCookie();
      const xsrf = readXsrfToken();
      if (xsrf) {
        config.headers[XSRF_HEADER] = xsrf;
      }
      return apiClient.request(config);
    }

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
          break;
        case 403:
          apiError.code = "FORBIDDEN";
          apiError.message = apiError.message || "You do not have permission to perform this action.";
          logger.warn("[API Client] 403 Forbidden detected.");
          break;
        case 419:
          apiError.code = "CSRF_TOKEN_MISMATCH";
          apiError.message = "Session expired or CSRF token invalid. Please refresh the page.";
          logger.warn("[API Client] 419 CSRF Token mismatch detected.");
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
