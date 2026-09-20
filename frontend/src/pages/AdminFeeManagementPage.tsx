import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Plus,
  ArrowsClockwise as RefreshCw,
  Sliders,
  Pencil,
  Trash as Trash2,
  ToggleLeft,
  ToggleRight,
  Spinner,
} from "@phosphor-icons/react";
import { toast } from "sonner";
import { authFetch } from "@/lib/api/authFetch";

function currencySymbol(curr: string): string {
  const symbols: Record<string, string> = {
    NGN: "₦", USD: "$", EUR: "€", GBP: "£",
    KES: "KSh", GHS: "GH₵", UGX: "USh", ZAR: "R",
  };
  return symbols[curr.toUpperCase()] ?? curr + " ";
}
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

interface FeeRule {
  id: number;
  name: string;
  code: string;
  description?: string;
  fee_type: "fixed" | "percentage" | "fixed_plus_percentage" | "tiered";
  fixed_amount: number;
  percentage: number;
  minimum_fee: number;
  maximum_fee?: number | null;
  currency: string;
  country?: string;
  role?: string;
  wallet_type?: string;
  transaction_type?: string;
  payment_method?: string;
  enabled: boolean;
  priority: number;
}

export function AdminFeeManagementPage() {
  const [rules, setRules] = useState<FeeRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>("all");

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [editingRule, setEditingRule] = useState<FeeRule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form State
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [feeType, setFeeType] = useState<"fixed" | "percentage" | "fixed_plus_percentage">("percentage");
  const [fixedAmountInput, setFixedAmountInput] = useState("0");
  const [percentageInput, setPercentageInput] = useState("1.5");
  const [minimumFeeInput, setMinimumFeeInput] = useState("0");
  const [maximumFeeInput, setMaximumFeeInput] = useState("");
  const [transactionType, setTransactionType] = useState("deposit");
  const [priority, setPriority] = useState("10");
  const [currency, setCurrency] = useState("NGN");
  const [country, setCountry] = useState("");
  const [role, setRole] = useState("");
  const [walletType, setWalletType] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");

  const fetchRules = useCallback(async () => {
    setLoading(true);
    try {
      const res = await authFetch("/securegate/fees");
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        console.error("Fees error:", res.status, err);
        toast.error(err.message || `Failed to load platform fee rules (${res.status}).`);
        return;
      }
      const json = await res.json();
      const list = Array.isArray(json?.data) ? json.data : Array.isArray(json?.data?.data) ? json.data.data : Array.isArray(json) ? json : [];
      setRules(list);
    } catch (e) {
      console.error("Network error loading fee rules:", e);
      toast.error("Network error loading platform fee rules.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRules();
  }, [fetchRules]);

  const handleOpenAdd = () => {
    setEditingRule(null);
    setName("");
    setCode("");
    setDescription("");
    setFeeType("percentage");
    setFixedAmountInput("0");
    setPercentageInput("1.5");
    setMinimumFeeInput("0");
    setMaximumFeeInput("");
    setTransactionType("deposit");
    setPriority("10");
    setCurrency("NGN");
    setCountry("");
    setRole("");
    setWalletType("");
    setPaymentMethod("");
    setShowModal(true);
  };

  const handleOpenEdit = (rule: FeeRule) => {
    setEditingRule(rule);
    setName(rule.name);
    setCode(rule.code);
    setDescription(rule.description || "");
    setFeeType(rule.fee_type === "tiered" ? "percentage" : rule.fee_type);
    setFixedAmountInput((rule.fixed_amount / 100).toString());
    setPercentageInput(rule.percentage.toString());
    setMinimumFeeInput((rule.minimum_fee / 100).toString());
    setMaximumFeeInput(rule.maximum_fee ? (rule.maximum_fee / 100).toString() : "");
    setTransactionType(rule.transaction_type || "deposit");
    setPriority(rule.priority.toString());
    setCurrency(rule.currency || "NGN");
    setCountry(rule.country || "");
    setRole(rule.role || "");
    setWalletType(rule.wallet_type || "");
    setPaymentMethod(rule.payment_method || "");
    setShowModal(true);
  };

  const handleToggle = async (rule: FeeRule) => {
    try {
      const res = await authFetch(`/securegate/fees/${rule.id}/toggle`, { method: "POST" });
      if (res.ok) {
        toast.success(`Fee rule "${rule.name}" ${rule.enabled ? "disabled" : "enabled"}.`);
        fetchRules();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to toggle fee rule status.");
      }
    } catch {
      toast.error("Failed to toggle fee rule status.");
    }
  };

  const handleDelete = async (rule: FeeRule) => {
    if (!confirm(`Are you sure you want to delete fee rule "${rule.name}"?`)) return;
    try {
      const res = await authFetch(`/securegate/fees/${rule.id}`, { method: "DELETE" });
      if (res.ok) {
        toast.success("Fee rule deleted.");
        fetchRules();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to delete fee rule.");
      }
    } catch {
      toast.error("Failed to delete fee rule.");
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);

    const payload = {
      name,
      code: code.toUpperCase().replace(/\s+/g, "_"),
      description,
      fee_type: feeType,
      fixed_amount: Math.round((parseFloat(fixedAmountInput) || 0) * 100),
      percentage: parseFloat(percentageInput) || 0,
      minimum_fee: Math.round((parseFloat(minimumFeeInput) || 0) * 100),
      maximum_fee: maximumFeeInput ? Math.round(parseFloat(maximumFeeInput) * 100) : null,
      transaction_type: transactionType,
      priority: parseInt(priority) || 0,
      currency: currency || "NGN",
      country: country || null,
      role: role || null,
      wallet_type: walletType || null,
      payment_method: paymentMethod || null,
    };

    try {
      const url = editingRule ? `/securegate/fees/${editingRule.id}` : "/securegate/fees";
      const method = editingRule ? "PUT" : "POST";
      const res = await authFetch(url, {
        method,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editingRule ? "Fee rule updated successfully!" : "Fee rule created successfully!");
        setShowModal(false);
        fetchRules();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error(err.message || "Failed to save fee rule.");
      }
    } catch {
      toast.error("Network error saving fee rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (filterCategory === "all") return true;
    return (r.transaction_type || "").includes(filterCategory) || r.code.toLowerCase().includes(filterCategory);
  });

  const activeRulesCount = rules.filter((r) => r.enabled).length;
  const depositRulesCount = rules.filter((r) => (r.transaction_type || "").includes("deposit")).length;
  const withdrawalRulesCount = rules.filter((r) => (r.transaction_type || "").includes("withdrawal") || (r.transaction_type || "").includes("transfer")).length;

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-5 sm:p-6 rounded-2xl bg-gradient-to-br from-[#102840] via-[#173852] to-[#102840] text-white shadow-xl border border-white/10">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#2164b6]/30 text-[#7ab0ff] text-xs font-bold uppercase tracking-wider border border-[#2164b6]/40">
            <Receipt weight="fill" className="h-3.5 w-3.5" /> Platform Fees & Charges
          </div>
          <h1 className="text-2xl sm:text-3xl font-black tracking-tight">Platform Fee Rules Management</h1>
          <p className="text-sm text-white/80 max-w-xl">
            Configure platform commissions, gateway deposit fees, withdrawal processing charges, and transfer rules.
          </p>
        </div>

        <div className="flex items-center gap-2.5 flex-wrap">
          <Button
            onClick={fetchRules}
            disabled={loading}
            variant="outline"
            className="bg-white/10 hover:bg-white/20 text-white border-white/20 font-bold h-11 px-4 rounded-xl shadow-md transition-all gap-2"
          >
            <RefreshCw weight="bold" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button
            onClick={handleOpenAdd}
            className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold h-11 px-5 rounded-xl shadow-md transition-all gap-2"
          >
            <Plus weight="bold" className="h-4 w-4" /> Add Fee Rule
          </Button>
        </div>
      </div>

      {/* KPI Stats Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3.5">
        <div className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm hover:border-primary/40 transition-all">
          <p className="text-2xl sm:text-3xl font-black text-[#2164b6] dark:text-[#7ab0ff]">{rules.length}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Total Fee Rules</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm hover:border-primary/40 transition-all">
          <p className="text-2xl sm:text-3xl font-black text-emerald-500">{activeRulesCount}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Active in Engine</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm hover:border-primary/40 transition-all">
          <p className="text-2xl sm:text-3xl font-black text-blue-500">{depositRulesCount}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Deposit & Inflow</p>
        </div>

        <div className="rounded-2xl border border-border/40 bg-card p-4 text-center shadow-sm hover:border-primary/40 transition-all">
          <p className="text-2xl sm:text-3xl font-black text-purple-500">{withdrawalRulesCount}</p>
          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider mt-1">Payout & Transfer</p>
        </div>
      </div>

      {/* Modern Filter Pills */}
      <div className="flex items-center gap-1.5 p-1.5 bg-muted/20 border border-border/40 rounded-2xl overflow-x-auto">
        {["all", "deposit", "transfer", "withdrawal", "gift", "commerce"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all whitespace-nowrap ${
              filterCategory === cat
                ? "bg-[#2164b6] text-white shadow-md"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rules Table */}
      <div className="rounded-2xl border border-border/50 bg-card overflow-hidden shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-5 border-b border-border/40 bg-muted/20">
          <div>
            <h2 className="text-base font-bold text-foreground flex items-center gap-2">
              <Sliders weight="fill" className="h-4 w-4 text-primary" />
              Active Fee Calculation Matrix
            </h2>
            <p className="text-xs text-muted-foreground mt-0.5">
              Rules are evaluated hierarchically by priority score on transaction execution.
            </p>
          </div>
          <span className="px-2.5 py-1 rounded-lg bg-muted/40 border border-border/40 text-xs font-bold text-muted-foreground">
            {filteredRules.length} Rules Matching
          </span>
        </div>

        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-2">
            <Spinner weight="bold" className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs font-medium">Loading platform fee rules...</span>
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground gap-2">
            <Receipt weight="fill" className="h-10 w-10 text-muted-foreground/30" />
            <p className="text-sm font-bold text-foreground">No platform fee rules configured</p>
            <p className="text-xs text-muted-foreground">Click &quot;Add Fee Rule&quot; to define payment processing and transaction charges.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground bg-muted/30 border-b border-border/40">
                <tr>
                  <th className="px-5 py-3.5">Rule Code & Name</th>
                  <th className="px-4 py-3.5">Fee Structure</th>
                  <th className="px-4 py-3.5">Caps (Min / Max)</th>
                  <th className="px-4 py-3.5">Target Scope</th>
                  <th className="px-4 py-3.5">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/30">
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/15 transition-colors">
                    <td className="px-5 py-3.5">
                      <div className="font-bold text-foreground">{rule.name}</div>
                      <div className="text-xs font-mono text-muted-foreground/80 mt-0.5">{rule.code}</div>
                    </td>

                    <td className="px-4 py-3.5 text-xs font-bold">
                      {rule.fee_type === "fixed" && (
                        <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-500 border border-blue-500/20">
                          {currencySymbol(rule.currency)}{(rule.fixed_amount / 100).toFixed(2)} Fixed
                        </span>
                      )}
                      {rule.fee_type === "percentage" && (
                        <span className="px-2 py-0.5 rounded-md bg-purple-500/10 text-purple-500 border border-purple-500/20">
                          {rule.percentage}%
                        </span>
                      )}
                      {rule.fee_type === "fixed_plus_percentage" && (
                        <span className="px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-500 border border-amber-500/20">
                          {currencySymbol(rule.currency)}{(rule.fixed_amount / 100).toFixed(2)} + {rule.percentage}%
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5 text-xs font-mono text-muted-foreground">
                      <div>Min: {currencySymbol(rule.currency)}{(rule.minimum_fee / 100).toFixed(2)}</div>
                      <div>Max: {rule.maximum_fee ? `${currencySymbol(rule.currency)}${(rule.maximum_fee / 100).toFixed(2)}` : "None"}</div>
                    </td>

                    <td className="px-4 py-3.5 text-xs capitalize text-muted-foreground">
                      <span className="px-2 py-0.5 rounded-md bg-muted/60 border border-border/40 font-medium">
                        {rule.transaction_type || "All"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold border transition-all ${
                          rule.enabled
                            ? "bg-emerald-500/10 text-emerald-400 border-emerald-500/30"
                            : "bg-muted text-muted-foreground border-border/40"
                        }`}
                      >
                        {rule.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft weight="fill" className="h-4 w-4" />}
                        {rule.enabled ? "Active" : "Disabled"}
                      </button>
                    </td>

                    <td className="px-5 py-3.5 text-right space-x-1.5">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted/40 transition"
                        title="Edit Rule"
                      >
                        <Pencil weight="fill" className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-2 rounded-xl text-destructive hover:bg-destructive/10 transition"
                        title="Delete Rule"
                      >
                        <Trash2 weight="fill" className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Add / Edit Fee Rule Modal */}
      <Dialog open={showModal} onOpenChange={setShowModal}>
        <DialogContent className="sm:max-w-lg rounded-2xl border border-border/50 bg-card p-6 shadow-xl">
          <DialogHeader className="space-y-1.5">
            <DialogTitle className="flex items-center gap-2 text-lg font-black text-foreground">
              <Sliders weight="fill" className="h-5 w-5 text-primary" />
              {editingRule ? "Edit Fee Rule" : "Create Platform Fee Rule"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Configure platform commissions, percentage rates, and minimum/maximum fee caps.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Rule Name *</Label>
                <Input
                  placeholder="e.g. Card Deposit Fee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="rounded-xl"
                  required
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Rule Code *</Label>
                <Input
                  placeholder="DEPOSIT_FEE"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="rounded-xl font-mono uppercase"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Fee Type *</Label>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as "fixed" | "percentage" | "fixed_plus_percentage")}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="fixed_plus_percentage">Fixed + Percentage</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Transaction Type *</Label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="deposit">Deposit</option>
                  <option value="internal_transfer">Internal Transfer</option>
                  <option value="withdrawal">Withdrawal</option>
                  <option value="creator_gift_receipt">Creator Gift Receipt</option>
                  <option value="product_sale">Product Sale</option>
                  <option value="business_sale">Business Sale</option>
                  <option value="badge_purchase">Verification Badge</option>
                  <option value="payment">Payment</option>
                  <option value="receive">Receive</option>
                  <option value="transfer_out">Transfer Out</option>
                  <option value="transfer_in">Transfer In</option>
                  <option value="donation_out">Donation Out</option>
                  <option value="donation_in">Donation In</option>
                  <option value="escrow_hold">Escrow Hold</option>
                  <option value="escrow_release">Escrow Release</option>
                  <option value="escrow_refund">Escrow Refund</option>
                  <option value="fee">Fee</option>
                  <option value="refund">Refund</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(feeType === "percentage" || feeType === "fixed_plus_percentage") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Percentage (%)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentageInput}
                    onChange={(e) => setPercentageInput(e.target.value)}
                    className="rounded-xl font-mono"
                  />
                </div>
              )}

              {(feeType === "fixed" || feeType === "fixed_plus_percentage") && (
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">Fixed Amount ({currencySymbol(currency)})</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fixedAmountInput}
                    onChange={(e) => setFixedAmountInput(e.target.value)}
                    className="rounded-xl font-mono"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Minimum Fee ({currencySymbol(currency)})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimumFeeInput}
                  onChange={(e) => setMinimumFeeInput(e.target.value)}
                  className="rounded-xl font-mono"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Maximum Fee Cap ({currencySymbol(currency)})</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unlimited"
                  value={maximumFeeInput}
                  onChange={(e) => setMaximumFeeInput(e.target.value)}
                  className="rounded-xl font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Currency</Label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="NGN">NGN (₦)</option>
                  <option value="USD">USD ($)</option>
                  <option value="EUR">EUR (€)</option>
                  <option value="GBP">GBP (£)</option>
                  <option value="KES">KES (KSh)</option>
                  <option value="GHS">GHS (GH₵)</option>
                  <option value="UGX">UGX (USh)</option>
                  <option value="ZAR">ZAR (R)</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Target Role (Optional)</Label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any</option>
                  <option value="creator">Creator</option>
                  <option value="vendor">Vendor</option>
                  <option value="member">Member</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Wallet Type</Label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                  className="w-full rounded-xl border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any</option>
                  <option value="fiat">Fiat</option>
                  <option value="coin">Coin</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Payment Method</Label>
                <Input
                  placeholder="e.g. card, transfer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold">Country Code</Label>
                <Input
                  placeholder="e.g. NG, US"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="rounded-xl uppercase"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-border/40">
              <Button
                type="button"
                variant="outline"
                onClick={() => setShowModal(false)}
                className="rounded-xl font-bold"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={submitting || !name || !code}
                className="bg-[#2164b6] hover:bg-[#2d94c2] text-white font-bold rounded-xl h-10 px-5"
              >
                {submitting ? <Spinner weight="bold" className="h-4 w-4 mr-2 animate-spin" /> : null}
                Save Rule
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
