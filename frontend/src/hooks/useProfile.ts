import { useState, useEffect } from "react";
import { apiClient, type ApiError } from "@/lib/api/client";

export interface UserProfileData {
  id: number;
  name: string;
  email: string;
  username: string;
  role: "member" | "creator" | "vendor" | "admin";
  bio?: string | null;
  avatar?: string | null;
  country?: string | null;
  county?: string | null;
  state?: string | null;
  mobile_number?: string | null;
  kyc_status: "pending" | "verified" | "rejected";
  kyc_document?: string | null;
  kyc_rejection_reason?: string | null;
  email_verified: boolean;
  created_at?: string;
}

export function useProfile() {
  const [profile, setProfile] = useState<UserProfileData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [updating, setUpdating] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [pendingKycs, setPendingKycs] = useState<UserProfileData[]>([]);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/profile");
      const envelope = response.data;
      const data = envelope.success ? envelope.data : envelope;
      setProfile(data);
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfileData>): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    setFieldErrors({});
    try {
      const response = await apiClient.put("/profile", data);
      const envelope = response.data;
      const updated = envelope.success ? envelope.data : envelope;
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
      return true;
    } catch (err: any) {
      const apiErr = err.response?.data as ApiError;
      if (apiErr?.errors) {
        setFieldErrors(apiErr.errors);
      }
      setError(apiErr?.message || "Failed to update profile.");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const submitKyc = async (kycDocument: string): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    try {
      const response = await apiClient.post("/profile/kyc", { kyc_document: kycDocument });
      const envelope = response.data;
      const resData = envelope.success ? envelope.data : envelope;
      setProfile((prev) => (prev ? { ...prev, kyc_status: resData.kyc_status, kyc_document: resData.kyc_document, kyc_rejection_reason: null } : null));
      return true;
    } catch (err: any) {
      setError(err.response?.data?.message || "Failed to submit KYC document.");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const fetchPendingKycs = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await apiClient.get("/admin/kyc");
      const envelope = response.data;
      const list = envelope.success ? envelope.data : envelope;
      setPendingKycs(Array.isArray(list) ? list : []);
    } catch (err: any) {
      setError("Failed to fetch pending KYC submissions.");
    } finally {
      setLoading(false);
    }
  };

  const approveKyc = async (userId: number): Promise<boolean> => {
    try {
      await apiClient.post(`/admin/kyc/${userId}/approve`);
      setPendingKycs((prev) => prev.filter((item) => item.id !== userId));
      return true;
    } catch (err) {
      return false;
    }
  };

  const rejectKyc = async (userId: number, reason: string): Promise<boolean> => {
    try {
      await apiClient.post(`/admin/kyc/${userId}/reject`, { reason });
      setPendingKycs((prev) => prev.filter((item) => item.id !== userId));
      return true;
    } catch (err) {
      return false;
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  return {
    profile,
    loading,
    updating,
    error,
    fieldErrors,
    pendingKycs,
    fetchProfile,
    updateProfile,
    submitKyc,
    fetchPendingKycs,
    approveKyc,
    rejectKyc,
  };
}
