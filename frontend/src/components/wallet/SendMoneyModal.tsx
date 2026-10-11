import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PaperPlaneRight, MagnifyingGlass, Lock, Spinner } from "@phosphor-icons/react";
import { apiClient, type ApiError } from "@/lib/api/client";
import { toast } from "sonner";

interface SendMoneyModalProps {
  isOpen: boolean;
  onClose: () => void;
  walletCurrency: string;
  hasPin: boolean;
  onSuccess: () => void;
}

export function SendMoneyModal({
  isOpen,
  onClose,
  walletCurrency = "USD",
  hasPin = false,
  onSuccess,
}: SendMoneyModalProps) {
  const [recipient, setRecipient] = useState("");
  const [amount, setAmount] = useState("50");
  const [note, setNote] = useState("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);

  const quickAmounts = ["10", "20", "50", "100"];

  const recentContacts = [
    { name: "Alex", username: "alex", avatar: "A" },
    { name: "Sarah", username: "sarah", avatar: "S" },
    { name: "Daniel", username: "daniel", avatar: "D" },
    { name: "Amina", username: "amina", avatar: "M" },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const minorAmount = Math.round((parseFloat(amount) || 0) * 100);

    if (minorAmount <= 0) {
      toast.error("Please enter a valid transfer amount.");
      return;
    }
    if (!recipient.trim()) {
      toast.error("Please enter the recipient username or email.");
      return;
    }
    if (hasPin && (!pin || pin.length !== 4)) {
      toast.error("Please enter your 4-digit transaction PIN.");
      return;
    }

    setLoading(true);
    try {
      await apiClient.post("/wallet/transfers/send", {
        recipient_username: recipient.trim().replace(/^@/, ""),
        amount: minorAmount,
        currency: walletCurrency,
        note: note.trim() || undefined,
        ...(hasPin ? { pin } : {}),
      });

      toast.success(`Successfully sent ${walletCurrency === "USD" ? "$" : walletCurrency} ${parseFloat(amount).toFixed(2)} to @${recipient}!`);
      onSuccess();
      handleClose();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Transfer failed. Please check recipient details.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setRecipient("");
    setAmount("50");
    setNote("");
    setPin("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && handleClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <PaperPlaneRight weight="fill" className="h-5 w-5 text-[#1A68D4]" />
            Send Money
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Instant peer-to-peer transfers with zero fees between MurihSpace members.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          {/* Recipient Search Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Recipient
            </label>
            <div className="relative">
              <MagnifyingGlass weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={recipient}
                onChange={(e) => setRecipient(e.target.value)}
                placeholder="Search people, username or phone..."
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
              />
            </div>
          </div>

          {/* Quick Contacts Avatar Strip */}
          <div className="flex items-center gap-3 overflow-x-auto pb-1">
            {recentContacts.map((c) => (
              <button
                key={c.username}
                type="button"
                onClick={() => setRecipient(c.username)}
                className={`flex flex-col items-center gap-1 p-1 rounded-xl group transition-all ${
                  recipient === c.username ? "scale-105" : ""
                }`}
              >
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-xs shadow-xs transition-colors ${
                    recipient === c.username
                      ? "bg-[#1A68D4] text-white ring-2 ring-[#1A68D4]/30"
                      : "bg-muted text-foreground group-hover:bg-muted/80"
                  }`}
                >
                  {c.avatar}
                </div>
                <span className="text-[11px] font-medium text-foreground truncate max-w-[50px]">
                  {c.name}
                </span>
              </button>
            ))}
          </div>

          {/* Amount Input */}
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Amount
            </label>
            <div className="relative">
              <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-lg font-bold text-muted-foreground">
                {walletCurrency === "USD" ? "$" : walletCurrency}
              </span>
              <input
                type="number"
                step="0.01"
                min="0.5"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                className="w-full pl-9 pr-16 py-2.5 text-xl font-bold bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground bg-muted px-2 py-1 rounded-md">
                {walletCurrency}
              </span>
            </div>
          </div>

          {/* Quick Amount Chips */}
          <div className="flex items-center gap-2">
            {quickAmounts.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setAmount(q)}
                className={`flex-1 py-1.5 rounded-lg text-xs font-bold transition-all border ${
                  amount === q
                    ? "border-[#1A68D4] bg-[#1A68D4]/10 text-[#1A68D4]"
                    : "border-border bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40"
                }`}
              >
                ${q}
              </button>
            ))}
          </div>

          {/* Note Input */}
          <div>
            <div className="flex justify-between items-center mb-1">
              <label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                Add a note (optional)
              </label>
              <span className="text-[10px] text-muted-foreground">{note.length}/100</span>
            </div>
            <textarea
              rows={2}
              maxLength={100}
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g. Thanks for your help!"
              className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#1A68D4] resize-none"
            />
          </div>

          {/* Security PIN Input if enabled */}
          {hasPin && (
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
                4-Digit Security PIN
              </label>
              <div className="relative">
                <Lock weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <input
                  type="password"
                  maxLength={4}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ""))}
                  placeholder="••••"
                  className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground tracking-widest font-mono text-center focus:outline-none focus:ring-1 focus:ring-[#1A68D4]"
                />
              </div>
            </div>
          )}

          {/* Submit Button */}
          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !recipient}
              className="w-full h-11 bg-[#1A68D4] hover:bg-[#1555AD] text-white font-bold text-sm rounded-xl shadow-xs"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner weight="bold" className="h-4 w-4 animate-spin" /> Sending...
                </span>
              ) : (
                <span>Continue & Send</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

