import React, { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ShieldDone as ShieldCheck, Profile as User } from "@/components/icons";
import { Spinner } from "@/components/icons/rounded";;
import { toast } from "sonner";
import { useNavigate } from "react-router";

interface CreateEscrowModalProps {
  isOpen: boolean;
  onClose: () => void;
  availableBalanceMinor?: number;
  onSuccess: () => void;
}

export function CreateEscrowModal({
  isOpen,
  onClose,
  onSuccess,
}: CreateEscrowModalProps) {
  const navigate = useNavigate();
  const [title, setTitle] = useState("");
  const [sellerUsername, setSellerUsername] = useState("");
  const [amount, setAmount] = useState("100");
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !sellerUsername.trim()) {
      toast.error("Please enter a deal title and counterparty username.");
      return;
    }

    const minor = Math.round((parseFloat(amount) || 0) * 100);
    if (minor <= 0) {
      toast.error("Please enter a valid escrow amount.");
      return;
    }

    setLoading(true);
    try {
      toast.success("Navigating to Escrow Agreement Hub to complete contract terms!");
      onSuccess();
      onClose();
      navigate("/app/wallet/escrow");
    } catch {
      toast.error("Failed to initialize escrow deal.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(val) => !val && onClose()}>
      <DialogContent className="sm:max-w-md p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="flex items-center gap-2 text-lg font-bold">
            <ShieldCheck weight="fill" className="h-5 w-5 text-amber-500" />
            Lock Funds in Escrow
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            Funds remain safely locked and protected until product delivery or milestone confirmation.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 pt-1">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Deal Title
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Sponsored Video Campaign or Web Development"
              className="w-full px-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2164b6]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Counterparty (Seller / Creator Username)
            </label>
            <div className="relative">
              <User weight="bold" className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={sellerUsername}
                onChange={(e) => setSellerUsername(e.target.value)}
                placeholder="Username (e.g. apex_audio)"
                className="w-full pl-9 pr-3 py-2 text-sm bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2164b6]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Escrow Amount ($ USD)
            </label>
            <input
              type="number"
              step="0.01"
              min="5"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100.00"
              className="w-full px-3 py-2 text-base font-bold bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2164b6]"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-muted-foreground mb-1">
              Terms & Milestone Notes (Optional)
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Delivery within 7 business days..."
              className="w-full px-3 py-2 text-xs bg-muted/30 border border-border rounded-xl text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-[#2164b6] resize-none"
            />
          </div>

          <div className="pt-2">
            <Button
              type="submit"
              disabled={loading || !title || !sellerUsername}
              className="w-full h-11 bg-amber-600 hover:bg-amber-700 text-white font-bold text-sm rounded-xl shadow-xs"
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <Spinner weight="bold" className="h-4 w-4 animate-spin" /> Initializing Escrow...
                </span>
              ) : (
                <span>Initialize Escrow Deal</span>
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}

