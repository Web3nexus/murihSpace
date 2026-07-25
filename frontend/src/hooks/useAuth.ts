import { useState, useEffect } from "react";
import { apiClient, type ApiError } from "@/lib/api/client";

export interface UserProfile {
  id: number;
  name: string;
  email: string;
  email_verified: boolean;
}

export function useAuth() {
  const [user, setUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  useEffect(() => {
    // Check if token exists in storage
    const token = localStorage.getItem("murihspace-token");
    if (!token) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLoading(false);
      return;
    }

    // Fetch user profile
    apiClient
      .get("/user")
      .then((res) => {
        // Enveloped response has data: { id, name, email, email_verified }
        // Our middleware wrapped it. Let's inspect the response body.
        const responseData = res.data;
        if (responseData && responseData.success) {
          setUser(responseData.data);
        } else {
          setUser(responseData);
        }
      })
      .catch(() => {
        // Clear expired or invalid token
        localStorage.removeItem("murihspace-token");
        setUser(null);
      })
      .finally(() => {
        setLoading(false);
      });
  }, []);

  const login = async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiClient.post("/auth/login", { email, password });
      const envelope = response.data;
      
      const responseData = envelope.success ? envelope.data : envelope;
      const token = responseData.token;
      const userProfile = responseData.user;

      localStorage.setItem("murihspace-token", token);
      setUser(userProfile);
      return true;
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      setError(apiErr.message || "Login failed.");
      setFieldErrors(apiErr.errors || {});
      return false;
    } finally {
      setLoading(false);
    }
  };

  const register = async (signUpData: {
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
  }): Promise<boolean> => {
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
  };

  const logout = async () => {
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
  };

  return {
    user,
    loading,
    error,
    fieldErrors,
    login,
    register,
    logout,
    isAuthenticated: !!user,
  };
}
