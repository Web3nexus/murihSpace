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
  banner_url?: string | null;
  country?: string | null;
  county?: string | null;
  state?: string | null;
  mobile_number?: string | null;
  kyc_status: "pending" | "verified" | "rejected";
  kyc_document?: string | null;
  kyc_rejection_reason?: string | null;
  has_active_verification_badge?: boolean;
  email_verified: boolean;
  posts_count?: number;
  followers_count?: number;
  following_count?: number;
  communities_count?: number;
  coins?: number;
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
      let response;
      try {
        response = await apiClient.get("/user");
      } catch {
        response = await apiClient.get("/profile");
      }
      const envelope = response.data;
      const data = envelope?.data ?? envelope;
      setProfile(data);
    } catch (err: unknown) {
      // Fallback to local stored user data if backend endpoint fails
      try {
        const stored = JSON.parse(localStorage.getItem("user_data") ?? "{}");
        if (stored?.id) {
          setProfile({
            id: stored.id,
            name: stored.name ?? "User",
            email: stored.email ?? "",
            username: stored.username ?? "user",
            role: stored.role ?? "member",
            kyc_status: stored.kyc_status ?? "pending",
            email_verified: !!stored.email_verified,
            avatar: stored.avatar_url ?? stored.avatar ?? null,
            bio: stored.bio ?? null,
          });
          setError(null);
          return;
        }
      } catch { /* ignore */ }

      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to load profile.");
    } finally {
      setLoading(false);
    }
  };

  const updateProfile = async (data: Partial<UserProfileData>): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    setFieldErrors({});
    try {
      let response;
      try {
        response = await apiClient.put("/user", data);
      } catch {
        response = await apiClient.put("/profile", data);
      }
      const envelope = response.data;
      const updated = envelope?.data ?? envelope;
      setProfile((prev) => (prev ? { ...prev, ...updated } : updated));
      return true;
    } catch (err: unknown) {
      const apiErr = (err as { response?: { data?: ApiError } }).response?.data as ApiError;
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
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to submit KYC document.");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const switchRole = async (targetRole: "member" | "creator" | "vendor" | "admin"): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    try {
      const response = await apiClient.post("/profile/switch-role", { role: targetRole });
      const envelope = response.data;
      const updatedRole = envelope.role || targetRole;
      setProfile((prev) => (prev ? { ...prev, role: updatedRole } : null));
      return true;
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || "Failed to switch role.");
      return false;
    } finally {
      setUpdating(false);
    }
  };

  const fetchPendingKycs = async () => {
    try {
      const response = await apiClient.get("/admin/kyc/pending");
      const envelope = response.data;
      const list = envelope.success ? envelope.data : (Array.isArray(envelope) ? envelope : []);
      setPendingKycs(list);
    } catch {
      setPendingKycs([]);
    }
  };

  const reviewKyc = async (userId: number, action: "approve" | "reject", rejectionReason?: string): Promise<boolean> => {
    setUpdating(true);
    setError(null);
    try {
      await apiClient.post(`/admin/kyc/${userId}/${action}`, { rejection_reason: rejectionReason });
      setPendingKycs((prev) => prev.filter((u) => u.id !== userId));
      return true;
    } catch (err: unknown) {
      setError((err as { response?: { data?: { message?: string } } }).response?.data?.message || `Failed to ${action} KYC.`);
      return false;
    } finally {
      setUpdating(false);
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
    switchRole,
    fetchPendingKycs,
    reviewKyc,
  };
}
