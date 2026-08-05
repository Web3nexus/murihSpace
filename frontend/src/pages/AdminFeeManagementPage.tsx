import { useState, useEffect, useCallback } from "react";
import {
  Receipt,
  Plus,
  RefreshCw,
  Sliders,
  Pencil,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { toast } from "sonner";
import { apiClient, type ApiError } from "@/lib/api/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";

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
      const res = await apiClient.get("/securegate/fees");
      const list = Array.isArray(res.data?.data) ? res.data.data : Array.isArray(res.data?.data?.data) ? res.data.data.data : Array.isArray(res.data) ? res.data : [];
      setRules(list);
    } catch {
      toast.error("Failed to load platform fee rules.");
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
      await apiClient.post(`/securegate/fees/${rule.id}/toggle`);
      toast.success(`Fee rule "${rule.name}" ${rule.enabled ? "disabled" : "enabled"}.`);
      fetchRules();
    } catch {
      toast.error("Failed to toggle fee rule status.");
    }
  };

  const handleDelete = async (rule: FeeRule) => {
    if (!confirm(`Delete fee rule "${rule.name}"?`)) return;
    try {
      await apiClient.delete(`/securegate/fees/${rule.id}`);
      toast.success("Fee rule deleted.");
      fetchRules();
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
      if (editingRule) {
        await apiClient.put(`/securegate/fees/${editingRule.id}`, payload);
        toast.success("Fee rule updated successfully!");
      } else {
        await apiClient.post("/securegate/fees", payload);
        toast.success("Fee rule created successfully!");
      }
      setShowModal(false);
      fetchRules();
    } catch (err: unknown) {
      const apiErr = err as ApiError;
      toast.error(apiErr.message || "Failed to save fee rule.");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredRules = rules.filter((r) => {
    if (filterCategory === "all") return true;
    return (r.transaction_type || "").includes(filterCategory) || r.code.toLowerCase().includes(filterCategory);
  });

  return (
    <div className="p-6 lg:p-8 space-y-6 max-w-7xl mx-auto w-full">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground flex items-center gap-2">
            <Receipt className="h-6 w-6 text-primary" /> Platform Fee & Charge Management
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure platform commissions, gateway deposit fees, withdrawal processing charges, and transfer rules.
          </p>
        </div>

        <button
          onClick={handleOpenAdd}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-primary text-primary-foreground font-semibold text-sm rounded-xl hover:opacity-90 transition shadow-sm"
        >
          <Plus className="h-4 w-4" /> Add Fee Rule
        </button>
      </div>

      {/* Category Filter Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-3 overflow-x-auto">
        {["all", "deposit", "transfer", "withdrawal", "gift", "commerce"].map((cat) => (
          <button
            key={cat}
            onClick={() => setFilterCategory(cat)}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold uppercase tracking-wider transition ${
              filterCategory === cat
                ? "bg-primary text-primary-foreground shadow-sm"
                : "bg-card border border-border text-muted-foreground hover:text-foreground"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Rules Table */}
      <div className="p-6 rounded-2xl border border-border bg-card shadow-sm space-y-4">
        {loading ? (
          <div className="flex items-center justify-center py-12 text-muted-foreground">
            <RefreshCw className="h-6 w-6 animate-spin mr-2" /> Loading fee rules...
          </div>
        ) : filteredRules.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground text-sm">No platform fee rules configured.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-border text-xs uppercase tracking-wider text-muted-foreground bg-muted/20">
                  <th className="px-4 py-3 font-semibold">Rule Code / Name</th>
                  <th className="px-4 py-3 font-semibold">Fee Structure</th>
                  <th className="px-4 py-3 font-semibold">Min / Max Caps</th>
                  <th className="px-4 py-3 font-semibold">Target Type</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filteredRules.map((rule) => (
                  <tr key={rule.id} className="hover:bg-muted/10 transition">
                    <td className="px-4 py-3">
                      <div className="font-bold text-foreground">{rule.name}</div>
                      <div className="text-xs font-mono text-muted-foreground">{rule.code}</div>
                    </td>

                    <td className="px-4 py-3 text-xs font-semibold">
                      {rule.fee_type === "fixed" && `${rule.currency === "USD" ? "$" : "₦"}${(rule.fixed_amount / 100).toFixed(2)} Fixed`}
                      {rule.fee_type === "percentage" && `${rule.percentage}%`}
                      {rule.fee_type === "fixed_plus_percentage" &&
                        `${rule.currency === "USD" ? "$" : "₦"}${(rule.fixed_amount / 100).toFixed(2)} + ${rule.percentage}%`}
                    </td>

                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      <div>Min: {rule.currency === "USD" ? "$" : "₦"}{(rule.minimum_fee / 100).toFixed(2)}</div>
                      <div>Max: {rule.maximum_fee ? `${rule.currency === "USD" ? "$" : "₦"}${(rule.maximum_fee / 100).toFixed(2)}` : "None"}</div>
                    </td>

                    <td className="px-4 py-3 text-xs capitalize text-muted-foreground">
                      {rule.transaction_type || "All"}
                    </td>

                    <td className="px-4 py-3">
                      <button
                        onClick={() => handleToggle(rule)}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold border transition ${
                          rule.enabled
                            ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20"
                            : "bg-muted text-muted-foreground border-border"
                        }`}
                      >
                        {rule.enabled ? <ToggleRight className="h-4 w-4" /> : <ToggleLeft className="h-4 w-4" />}
                        {rule.enabled ? "Active" : "Disabled"}
                      </button>
                    </td>

                    <td className="px-4 py-3 text-right space-x-1">
                      <button
                        onClick={() => handleOpenEdit(rule)}
                        className="p-1.5 rounded-lg border border-border text-muted-foreground hover:text-foreground hover:bg-accent transition"
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(rule)}
                        className="p-1.5 rounded-lg border border-destructive/30 text-destructive hover:bg-destructive/10 transition"
                      >
                        <Trash2 className="h-4 w-4" />
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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Sliders className="h-5 w-5 text-primary" /> {editingRule ? "Edit Fee Rule" : "Create Platform Fee Rule"}
            </DialogTitle>
            <DialogDescription>Configure platform charges, percentage rates, and minimum/maximum fee caps.</DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 pt-2">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Rule Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Deposit Fee"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Rule Code
                </label>
                <input
                  type="text"
                  placeholder="DEPOSIT_FEE"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-primary"
                  required
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Fee Type
                </label>
                <select
                  value={feeType}
                  onChange={(e) => setFeeType(e.target.value as any)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="percentage">Percentage (%)</option>
                  <option value="fixed">Fixed Amount</option>
                  <option value="fixed_plus_percentage">Fixed + Percentage</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Transaction Type
                </label>
                <select
                  value={transactionType}
                  onChange={(e) => setTransactionType(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
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
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={percentageInput}
                    onChange={(e) => setPercentageInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}

              {(feeType === "fixed" || feeType === "fixed_plus_percentage") && (
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                    Fixed Amount ({currency === "USD" ? "$" : "₦"})
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={fixedAmountInput}
                    onChange={(e) => setFixedAmountInput(e.target.value)}
                    className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                  />
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Minimum Fee ({currency === "USD" ? "$" : "₦"})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={minimumFeeInput}
                  onChange={(e) => setMinimumFeeInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Maximum Fee Cap ({currency === "USD" ? "$" : "₦"})
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="Unlimited"
                  value={maximumFeeInput}
                  onChange={(e) => setMaximumFeeInput(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Currency
                </label>
                <select
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="NGN">NGN</option>
                  <option value="USD">USD</option>
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Role (Optional)
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any</option>
                  <option value="creator">Creator</option>
                  <option value="vendor">Vendor</option>
                  <option value="member">Member</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Wallet Type
                </label>
                <select
                  value={walletType}
                  onChange={(e) => setWalletType(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                >
                  <option value="">Any</option>
                  <option value="fiat">Fiat</option>
                  <option value="coin">Coin</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Payment Method
                </label>
                <input
                  type="text"
                  placeholder="e.g. card, transfer"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">
                  Country
                </label>
                <input
                  type="text"
                  placeholder="e.g. NG, US"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  className="w-full rounded-xl border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium text-muted-foreground hover:bg-accent hover:text-foreground transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting || !name || !code}
                className="flex-1 py-2.5 rounded-xl bg-primary text-primary-foreground font-bold text-sm shadow hover:opacity-90 transition disabled:opacity-50 inline-flex items-center justify-center gap-1.5"
              >
                {submitting ? <RefreshCw className="h-4 w-4 animate-spin" /> : "Save Rule"}
              </button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
