import React, { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { ShieldAlert, AlertTriangle, CheckCircle2 } from 'lucide-react';
import type { ReportReason, ReportedType } from '@/types/moderation';
import { getAuthToken } from "@/lib/auth/token";

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

interface ReportModalProps {
  isOpen: boolean;
  onClose: () => void;
  reportedType: ReportedType;
  reportedId: number;
  targetName?: string;
}

const REASONS: { value: ReportReason; label: string; desc: string }[] = [
  { value: 'spam', label: 'Spam', desc: 'Unwanted promotional content or repetitive posts' },
  { value: 'harassment', label: 'Harassment & Bullying', desc: 'Targeted hate, threats, or intimidation' },
  { value: 'inappropriate', label: 'Inappropriate Content', desc: 'Nudity, violence, or explicit material' },
  { value: 'misinformation', label: 'Misinformation', desc: 'False or misleading claims' },
  { value: 'other', label: 'Other Issue', desc: 'Any other violation of community guidelines' },
];

export function ReportModal({
  isOpen,
  onClose,
  reportedType,
  reportedId,
  targetName,
}: ReportModalProps) {
  const [selectedReason, setSelectedReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const token = getAuthToken();
    try {
      const res = await fetch(`${API_BASE}/reports`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          reported_type: reportedType,
          reported_id: reportedId,
          reason: selectedReason,
          details: details.trim() || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to submit report');
      }

      setIsSuccess(true);
      setTimeout(() => {
        setIsSuccess(false);
        onClose();
        setDetails('');
        setSelectedReason('spam');
      }, 1800);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'An error occurred while submitting the report.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-lg md:max-w-xl bg-card border-border shadow-2xl rounded-2xl p-6 sm:p-8">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle className="text-lg font-bold text-foreground">
              Report {reportedType === 'user' ? 'User' : reportedType === 'post' ? 'Post' : 'Comment'}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            {targetName ? `Help us keep the platform safe. Why are you reporting "${targetName}"?` : 'Help us keep the platform safe by reporting policy violations.'}
          </DialogDescription>
        </DialogHeader>

        {isSuccess ? (
          <div className="py-8 flex flex-col items-center justify-center text-center space-y-3">
            <CheckCircle2 className="h-12 w-12 text-emerald-500 animate-bounce" />
            <h4 className="text-base font-bold text-foreground">Report Submitted</h4>
            <p className="text-xs text-muted-foreground max-w-xs">
              Thank you for keeping our community safe. Our moderation team will review this shortly.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {error && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <div className="space-y-2">
              <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                Select Reason
              </span>
              <div className="space-y-1.5">
                {REASONS.map((r) => (
                  <div
                    key={r.value}
                    onClick={() => setSelectedReason(r.value)}
                    onKeyDown={(e) => e.key === 'Enter' && setSelectedReason(r.value)}
                    role="radio"
                    aria-checked={selectedReason === r.value}
                    tabIndex={0}
                    className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col gap-0.5 ${
                      selectedReason === r.value
                        ? 'border-secondary bg-secondary/10 shadow-sm'
                        : 'border-border hover:border-muted-foreground/30 hover:bg-muted/30'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground">{r.label}</span>
                      <input
                        type="radio"
                        name="reason"
                        checked={selectedReason === r.value}
                        onChange={() => setSelectedReason(r.value)}
                        className="accent-secondary h-3.5 w-3.5"
                      />
                    </div>
                    <span className="text-[11px] text-muted-foreground">{r.desc}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="report-details" className="text-xs font-bold text-foreground uppercase tracking-wider">
                Additional Details (Optional)
              </label>
              <Textarea
                id="report-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                placeholder="Provide any additional context to help our moderators…"
                rows={3}
                className="text-xs bg-muted/30 border-border focus-visible:ring-secondary resize-none"
              />
            </div>

            <DialogFooter className="pt-2 gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                disabled={isSubmitting}
                className="text-xs font-semibold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                variant="destructive"
                disabled={isSubmitting}
                className="text-xs font-semibold gap-1.5"
              >
                {isSubmitting ? 'Submitting…' : 'Submit Report'}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
