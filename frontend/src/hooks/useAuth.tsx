import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from "react";
import { apiClient, type ApiError } from "@/lib/api/client";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  username?: string;
  role: "member" | "creator" | "vendor" | "admin";
  kyc_status?: string;
  email_verified: boolean;
}

interface AuthContextValue {
  user: UserProfile | null;
  loading: boolean;
  error: string | null;
  fieldErrors: Record<string, string[]>;
  login: (email: string, password: string) => Promise<UserProfile | null>;
  register: (data: RegisterData) => Promise<boolean>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
  isAdmin: boolean;
  isCreator: boolean;
  isCreatorOrAdmin: boolean;
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
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    const token = localStorage.getItem("murihspace-token");
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
        localStorage.removeItem("murihspace-token");
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
      return userProfile;
    } catch (err: unknown) {
      const apiErr = err && typeof err === "object" ? (err as ApiError) : { message: "An unexpected error occurred.", errors: {} };
      setError(apiErr.message || "Login failed.");
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
      const response = await apiClient.post("/auth/register", {
        name: signUpData.name,
        email: signUpData.email,
        username: signUpData.username,
        role: signUpData.role,
        password: signUpData.password,
        password_confirmation: signUpData.passwordConfirmation,
        country: signUpData.country,
        mobile_number: signUpData.mobileNumber,
        county: signUpData.county,
        state: signUpData.state,
        kyc_document: signUpData.kycDocument,
      });
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
    register,
    logout,
    isAuthenticated: !!user,
    isAdmin: user?.role === "admin",
    isCreator: user?.role === "creator",
    isCreatorOrAdmin: user?.role === "admin" || user?.role === "creator",
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
