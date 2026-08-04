import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { getAuthToken, clearAuthTokens } from "@/lib/auth/token";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: "member" | "creator" | "vendor" | "admin";
  permissions?: string[];
  kyc_status?: string;
  avatar?: string;
  avatar_url?: string;
  email_verified: boolean;
  phone_verified?: boolean;
  mobile_number?: string;
}

export type OtpIntent = "login" | "register";

export interface OtpRequestResult {
  masked_phone: string;
  pending?: boolean;
  requires_challenge?: boolean;
  expires_in_seconds?: number;
  resend_after_seconds?: number;
  channel?: string;
}

export interface OtpVerifyResult {
  verified: boolean;
  account_exists?: boolean;
  registration_session_id?: string;
  phone_e164?: string;
  country_iso2?: string;
  is_new_device?: boolean;
  token?: string;
  user?: UserProfile;
  expires_in_seconds?: number;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  login: (email: string, password: string) => Promise<UserProfile | null>;
  requestOtp: (payload: { intent: OtpIntent; phoneE164: string }) => Promise<OtpRequestResult | null>;
  verifyOtp: (payload: { intent: OtpIntent; phoneE164: string; code: string }) => Promise<OtpVerifyResult | null>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isVendor: boolean;
  isCreatorOrAdmin: boolean;
  hasPermission: (permission: string) => boolean;
}

export interface RegisterData {
  name: string;
  email: string;
  username: string;
  role: string;
  password: string;
  passwordConfirmation: string;
  country?: string;
  mobileNumber?: string;
  county?: string;
  state?: string;
  kycDocument?: string;
  registrationSessionId?: string;
  phoneE164?: string;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const token = getAuthToken();
    if (!token) {
      setLoading(false);
      return;
    }
    apiClient
      .get("/user")
      .then((res) => {
        const responseData = res.data;
        if (responseData && responseData.success) {
          setUser(responseData.data);
        } else {
          setUser(responseData);
        }
      })
      .catch(() => {
        clearAuthTokens();
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<UserProfile | null> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const envelope = response.data;
      const responseData = envelope.success ? envelope.data : envelope;
      const token = responseData.token;
      const userProfile = responseData.user as UserProfile;
      if (!token || !userProfile) {
        setError("Invalid response: missing credentials.");
        return null;
      }
      localStorage.setItem("murihspace-token", token);
      setUser(userProfile);
      toast.success(`Welcome back, ${userProfile.name}!`);
      return userProfile;
    } catch (err: unknown) {
      const apiErr = err && typeof err === "object" ? (err as ApiError) : { message: "An unexpected error occurred.", errors: {} };
      setError(apiErr.message || "Login failed.");
      setFieldErrors(apiErr.errors || {});
      toast.error(apiErr.message || "Login failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const requestOtp = useCallback(async (payload: { intent: OtpIntent; phoneE164: string }): Promise<OtpRequestResult | null> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiClient.post("/auth/otp/request", {
        intent: payload.intent,
        phone_e164: payload.phoneE164,
      });
      // Unwrap the response envelope
      const envelope = response.data;
      const data = (envelope?.success ? envelope.data : envelope) as Partial<OtpRequestResult> & { message?: string };
      return {
        masked_phone: data.masked_phone ?? "",
        pending: data.pending ?? true,
        requires_challenge: data.requires_challenge ?? false,
        expires_in_seconds: data.expires_in_seconds,
        resend_after_seconds: data.resend_after_seconds,
        channel: data.channel,
      };
    } catch (err: unknown) {
      const apiErr = err && typeof err === "object" ? (err as ApiError) : { message: "Could not send the verification code.", errors: {} };
      setError(apiErr.message || "Could not send the verification code.");
      setFieldErrors(apiErr.errors || {});
      toast.error(apiErr.message || "Could not send the verification code.");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const verifyOtp = useCallback(async (payload: { intent: OtpIntent; phoneE164: string; code: string }): Promise<OtpVerifyResult | null> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiClient.post("/auth/otp/verify", {
        intent: payload.intent,
        phone_e164: payload.phoneE164,
        code: payload.code,
      });
      // Unwrap the response envelope
      const envelope = response.data;
      const data = (envelope?.success ? envelope.data : envelope) as Partial<OtpVerifyResult> & { message?: string };
      if (payload.intent === "login" && data.account_exists && data.token && data.user) {
        localStorage.setItem("murihspace-token", data.token);
        setUser(data.user);
        toast.success(`Welcome back, ${data.user.name}!`);
      }
      return {
        verified: data.verified ?? false,
        account_exists: data.account_exists,
        registration_session_id: data.registration_session_id,
        phone_e164: data.phone_e164 ?? payload.phoneE164,
        country_iso2: data.country_iso2,
        is_new_device: data.is_new_device,
        token: data.token,
        user: data.user,
        expires_in_seconds: data.expires_in_seconds,
      };
    } catch (err: unknown) {
      const apiErr = err && typeof err === "object" ? (err as ApiError) : { message: "That code did not work. Please try again.", errors: {} };
      setError(apiErr.message || "That code did not work. Please try again.");
      setFieldErrors(apiErr.errors || {});
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  const register = useCallback(async (signUpData: RegisterData): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const body: Record<string, unknown> = {
        name: signUpData.name,
        username: signUpData.username,
        role: signUpData.role,
        password: signUpData.password,
        password_confirmation: signUpData.passwordConfirmation,
        county: signUpData.county,
        state: signUpData.state,
        kyc_document: signUpData.kycDocument,
      };
      if (signUpData.email) {
        body.email = signUpData.email;
      }
      if (signUpData.registrationSessionId) {
        body.registration_session_id = signUpData.registrationSessionId;
      } else {
        body.country = signUpData.country;
        body.mobile_number = signUpData.mobileNumber;
      }
      const response = await apiClient.post("/auth/register", body);
      const envelope = response.data;
      const responseData = envelope.success ? envelope.data : envelope;
      const token = responseData.token;
      const userProfile = responseData.user;
      localStorage.setItem("murihspace-token", token);
      setUser(userProfile);
      return true;
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Registration failed.");
      setFieldErrors(apiErr.errors || {});
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(async () => {
    setLoading(true);
    try {
      await apiClient.post("/auth/logout");
      toast.info("You have been signed out. See you soon!");
    } catch (err) {
      console.error("Logout request failed:", err);
    } finally {
      localStorage.removeItem("murihspace-token");
      setUser(null);
      setLoading(false);
    }
  }, []);

  const value: AuthContextValue = {
    user,
    loading,
    error,
    fieldErrors,
    login,
    requestOtp,
    verifyOtp,
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isCreator: user?.role === "creator",
    isVendor: user?.role === "vendor",
    isCreatorOrAdmin: user?.role === "admin" || user?.role === "creator",
    hasPermission: (permission: string) => {
      if (!user) return false;
      if (user.role === "admin") return true;
      return user.permissions?.includes(permission) ?? false;
    },
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return context;
}
