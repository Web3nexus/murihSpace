import { useState, useEffect, useCallback } from "react";
import {
  ShieldCheck,
  Upload,
  Check,
  X,
  AlertCircle,
  Loader2,
  FileText,
  IdCard,
  CreditCard,
  Building2,
} from "lucide-react";
import { apiClient } from "@/lib/api/client";

type KycStatus = "unverified" | "pending" | "verified" | "rejected";

interface KycSubmission {
  id: number;
  status: KycStatus;
  document_type: string;
  document_number?: string;
  notes?: string;
  created_at: string;
  updated_at: string;
}

const DOCUMENT_TYPES = [
  { value: "passport", label: "Passport", icon: IdCard },
  { value: "drivers_license", label: "Driver's License", icon: CreditCard },
  { value: "national_id", label: "National ID", icon: Building2 },
];

export default function KycSettingsPage() {
  const [submission, setSubmission] = useState<KycSubmission | null>(null);
  const [loading, setLoading] = useState(true);
  const [documentType, setDocumentType] = useState("passport");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient.get("/kyc/status");
      const data = res.data?.data ?? res.data;
      if (data?.submission) setSubmission(data.submission);
    } catch {
      // no submission yet
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file) {
      setUploadMsg({ ok: false, text: "Please select a document file to upload." });
      return;
    }
    setUploading(true);
    setUploadMsg(null);
    const formData = new FormData();
    formData.append("document_type", documentType);
    formData.append("document", file);
    try {
      const res = await apiClient.post("/kyc/submit", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const data = res.data?.data ?? res.data;
      setSubmission(data?.submission ?? data);
      setUploadMsg({ ok: true, text: "Verification submitted successfully! We'll review it shortly." });
      setFile(null);
    } catch {
      setUploadMsg({ ok: false, text: "Upload failed. Please try again or contact support." });
    } finally {
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const StatusBanner = ({ status }: { status: KycStatus }) => {
    const config = {
      verified:   { icon: Check,       bg: "bg-emerald-500/10", text: "text-emerald-600", border: "border-emerald-500/20",  label: "Verified",      msg: "Your identity has been verified." },
      pending:    { icon: Loader2,      bg: "bg-amber-500/10",  text: "text-amber-600",  border: "border-amber-500/20",   label: "In Review",     msg: "Your documents are being reviewed. This usually takes 1-2 business days." },
      rejected:   { icon: X,            bg: "bg-red-500/10",    text: "text-red-600",    border: "border-red-500/20",     label: "Rejected",      msg: submission?.notes || "Your submission was not approved. Please re-submit with valid documents." },
      unverified: { icon: AlertCircle,  bg: "bg-muted",         text: "text-muted-foreground", border: "border-border", label: "Not Verified", msg: "Complete verification below to unlock all features." },
    };
    const c = config[status];
    const Icon = c.icon;
    return (
      <div className={`flex items-start gap-3 p-4 rounded-xl border ${c.bg} ${c.border}`}>
        <Icon className={`h-5 w-5 shrink-0 mt-0.5 ${status === "pending" ? "animate-spin" : ""} ${c.text}`} />
        <div>
          <p className={`text-xs font-bold ${c.text}`}>{c.label}</p>
          <p className="text-[11px] text-muted-foreground mt-0.5">{c.msg}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6 w-full max-w-3xl">
      <div>
        <h2 className="text-lg font-bold text-foreground flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-secondary" />
          KYC Verification
        </h2>
        <p className="text-xs text-muted-foreground mt-0.5">
          Verify your identity to unlock payouts, escrow, and full platform access.
        </p>
      </div>

      <StatusBanner status={submission?.status ?? "unverified"} />

      {(submission?.status === "unverified" || submission?.status === "rejected") && (
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Document Type */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
              <FileText className="h-3.5 w-3.5 text-secondary" /> Document Type
            </h3>
            <div className="grid grid-cols-3 gap-3">
              {DOCUMENT_TYPES.map((dt) => {
                const active = documentType === dt.value;
                const Icon = dt.icon;
                return (
                  <button
                    key={dt.value}
                    type="button"
                    onClick={() => setDocumentType(dt.value)}
                    className={`flex flex-col items-center gap-2 p-4 rounded-xl border transition-all ${
                      active ? "border-secondary bg-secondary/5" : "border-border bg-muted/30 hover:border-muted-foreground/30"
                    }`}
                  >
                    <Icon className={`h-6 w-6 ${active ? "text-secondary" : "text-muted-foreground"}`} />
                    <span className="text-[11px] font-bold text-foreground text-center leading-tight">{dt.label}</span>
                  </button>
                );
              })}
            </div>
          </section>

          {/* File Upload */}
          <section className="rounded-2xl border border-border bg-card p-5 shadow-2xs space-y-4">
            <h3 className="font-bold text-foreground text-xs flex items-center gap-2">
              <Upload className="h-3.5 w-3.5 text-secondary" /> Upload Document
            </h3>
            <label className="flex flex-col items-center justify-center gap-2 p-8 rounded-xl border-2 border-dashed border-border bg-muted/20 cursor-pointer hover:border-secondary/50 transition-all">
              <Upload className="h-8 w-8 text-muted-foreground" />
              <div className="text-center">
                <p className="text-xs font-bold text-foreground">
                  {file ? file.name : "Click to upload a document"}
                </p>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {file
                    ? `${(file.size / 1024 / 1024).toFixed(1)} MB`
                    : "PNG, JPG, or PDF (max 10MB)"}
                </p>
              </div>
              <input
                type="file"
                accept=".png,.jpg,.jpeg,.pdf"
                onChange={(e) => setFile(e.target.files?.[0] ?? null)}
                className="hidden"
              />
            </label>
            {file && (
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4 text-secondary" />
                  <span className="text-xs font-medium text-foreground">{file.name}</span>
                </div>
                <button type="button" onClick={() => setFile(null)} className="text-[11px] text-muted-foreground hover:text-red-500">
                  Remove
                </button>
              </div>
            )}
          </section>

          {uploadMsg && (
            <div className={`flex items-start gap-2 p-3 rounded-xl text-xs ${
              uploadMsg.ok ? "bg-emerald-500/10 text-emerald-600" : "bg-red-500/10 text-red-600"
            }`}>
              {uploadMsg.ok ? <Check className="h-4 w-4 shrink-0 mt-0.5" /> : <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />}
              {uploadMsg.text}
            </div>
          )}

          <div className="flex justify-end">
            <button
              type="submit"
              disabled={uploading || !file}
              className="px-6 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 disabled:opacity-50 disabled:cursor-not-allowed transition-all shadow-xs flex items-center gap-2"
            >
              {uploading ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Uploading...</>
              ) : (
                <><Upload className="h-4 w-4" /> Submit Verification</>
              )}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
