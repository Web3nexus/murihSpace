import React, { useState, useEffect, useCallback } from 'react';
import {
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Send,
  Gift,
  Plus,
  Lock,
  Loader2,
  RefreshCcw,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle2,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

import type { Wallet as WalletType, LedgerEntry, TransferPayload, DonationPayload, WithdrawalPayload } from '@/types/wallet';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function formatAmount(amount: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function getAuthHeaders() {
  const token = localStorage.getItem('auth_token') || localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

type ActionType = 'transfer' | 'donate' | 'withdraw' | 'pin' | null;

export function WalletPage() {
  const [wallet, setWallet] = useState<WalletType | null>(null);
  const [transactions, setTransactions] = useState<LedgerEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showBalance, setShowBalance] = useState(true);
  const [activeAction, setActiveAction] = useState<ActionType>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [txnFilter, setTxnFilter] = useState('');

  const fetchWallet = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/wallet`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setWallet(json.data?.data ?? null);
      }
    } catch (e) { console.error('Failed to fetch wallet', e); }
  }, []);

  const fetchTransactions = useCallback(async () => {
    try {
      const params = txnFilter ? `?type=${txnFilter}` : '';
      const res = await fetch(`${API_BASE}/wallet/transactions${params}`, { headers: getAuthHeaders() });
      if (res.ok) {
        const json = await res.json();
        setTransactions(json.data?.data ?? []);
      }
    } catch (e) { console.error('Failed to fetch transactions', e); }
  }, [txnFilter]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    Promise.all([fetchWallet(), fetchTransactions()]).finally(() => setIsLoading(false));
  }, [fetchWallet, fetchTransactions]);

  const handleTransfer = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    const form = new FormData(e.currentTarget);
    const payload: TransferPayload = {
      recipient_username: form.get('username') as string,
      amount: parseInt(form.get('amount') as string) * 100,
      note: (form.get('note') as string) || undefined,
      pin: form.get('pin') as string,
    };
    try {
      const res = await fetch(`${API_BASE}/wallet/transfers/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Sent ${formatAmount(payload.amount)} successfully!` });
        setActiveAction(null);
        fetchWallet();
        fetchTransactions();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'Transfer failed.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDonate = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    const form = new FormData(e.currentTarget);
    const payload: DonationPayload = {
      recipient_username: form.get('username') as string,
      amount: parseInt(form.get('amount') as string) * 100,
      message: (form.get('message') as string) || undefined,
      is_anonymous: form.get('is_anonymous') === 'on',
      pin: form.get('pin') as string,
    };
    try {
      const res = await fetch(`${API_BASE}/wallet/donations/send`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: `Donated ${formatAmount(payload.amount)} successfully!` });
        setActiveAction(null);
        fetchWallet();
        fetchTransactions();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'Donation failed.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    const form = new FormData(e.currentTarget);
    const payload: WithdrawalPayload = {
      amount: parseInt(form.get('amount') as string) * 100,
      pin: form.get('pin') as string,
    };
    try {
      const res = await fetch(`${API_BASE}/wallet/withdrawals`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: 'Withdrawal request submitted for review.' });
        setActiveAction(null);
      } else {
        setActionMessage({ type: 'error', text: json.message || 'Withdrawal request failed.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSetupPin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsSubmitting(true);
    setActionMessage(null);
    const form = new FormData(e.currentTarget);
    const pin = form.get('pin') as string;
    const confirm = form.get('confirm_pin') as string;
    if (pin !== confirm) {
      setActionMessage({ type: 'error', text: 'PINs do not match.' });
      setIsSubmitting(false);
      return;
    }
    try {
      const endpoint = wallet?.has_pin ? 'pin/update' : 'pin/setup';
      const res = await fetch(`${API_BASE}/wallet/${endpoint}`, {
        method: 'POST',
        headers: getAuthHeaders(),
        body: JSON.stringify({ pin, current_pin: form.get('current_pin') as string }),
      });
      const json = await res.json();
      if (res.ok) {
        setActionMessage({ type: 'success', text: wallet?.has_pin ? 'PIN updated successfully.' : 'PIN set successfully.' });
        setActiveAction(null);
        fetchWallet();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'Failed to set PIN.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  const txnTypeLabel: Record<string, string> = {
    payment: 'Purchase',
    receive: 'Payment Received',
    transfer_out: 'Transfer Sent',
    transfer_in: 'Transfer Received',
    donation_out: 'Donation Sent',
    donation_in: 'Donation Received',
    withdrawal: 'Withdrawal',
    fee: 'Platform Fee',
    refund: 'Refund',
  };

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
          <Wallet className="h-6 w-6 text-secondary" />
          MurihPay Wallet
        </h1>
        <p className="text-xs text-muted-foreground mt-1">
          Manage your balance, send money, and track transaction history.
        </p>
      </div>

      {/* Balance Card */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary via-primary/90 to-primary/80 p-6 sm:p-8 text-primary-foreground shadow-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/2" />
        <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/5 rounded-full translate-y-1/2 -translate-x-1/2" />
        <div className="relative space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-white/70 uppercase tracking-wider">Available Balance</p>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-white/70 hover:text-white"
              onClick={() => setShowBalance(!showBalance)}
            >
              {showBalance ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </Button>
          </div>
          <p className="text-4xl sm:text-5xl font-black tracking-tight">
            {showBalance ? formatAmount(wallet?.balance ?? 0, wallet?.currency ?? 'NGN') : '••••••'}
          </p>
          <div className="flex items-center gap-2 text-xs text-white/60">
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${wallet?.has_pin ? 'bg-emerald-400/20 text-emerald-200' : 'bg-amber-400/20 text-amber-200'}`}>
              <Lock className="h-3 w-3" />
              {wallet?.has_pin ? 'PIN Set' : 'PIN Not Set'}
            </span>
            <span className="capitalize">{wallet?.status}</span>
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {[
          { label: 'Send Money', icon: Send, action: 'transfer' as ActionType, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950' },
          { label: 'Send Tip', icon: Gift, action: 'donate' as ActionType, color: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950' },
          { label: 'Withdraw', icon: ArrowUpRight, action: 'withdraw' as ActionType, color: 'text-amber-600 bg-amber-100 dark:text-amber-400 dark:bg-amber-950' },
          { label: wallet?.has_pin ? 'Change PIN' : 'Set PIN', icon: Plus, action: 'pin' as ActionType, color: 'text-emerald-600 bg-emerald-100 dark:text-emerald-400 dark:bg-emerald-950' },
        ].map((btn) => (
          <button
            key={btn.label}
            onClick={() => { setActiveAction(btn.action); setActionMessage(null); }}
            className="flex items-center gap-3 p-4 rounded-2xl border border-border bg-card hover:shadow-md hover:border-secondary/30 transition-all text-left"
          >
            <div className={`p-2.5 rounded-xl ${btn.color} shrink-0`}>
              <btn.icon className="h-5 w-5" />
            </div>
            <span className="text-sm font-bold text-foreground">{btn.label}</span>
          </button>
        ))}
      </div>

      {/* Action Dialogs */}
      <Dialog open={activeAction !== null} onOpenChange={() => { setActiveAction(null); setActionMessage(null); }}>
        <DialogContent className="sm:max-w-[420px] bg-card border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              {activeAction === 'transfer' && <><Send className="h-5 w-5 text-blue-500" /> Send Money</>}
              {activeAction === 'donate' && <><Gift className="h-5 w-5 text-rose-500" /> Send a Tip</>}
              {activeAction === 'withdraw' && <><ArrowUpRight className="h-5 w-5 text-amber-500" /> Withdraw Funds</>}
              {activeAction === 'pin' && <><Lock className="h-5 w-5 text-emerald-500" /> {wallet?.has_pin ? 'Change PIN' : 'Set Transaction PIN'}</>}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {activeAction === 'transfer' && 'Send money to another MurihSpace user.'}
              {activeAction === 'donate' && 'Support a creator with a tip or donation.'}
              {activeAction === 'withdraw' && 'Request a withdrawal of your available balance.'}
              {activeAction === 'pin' && 'Your 4-digit PIN is required for all transactions.'}
            </DialogDescription>
          </DialogHeader>

          {actionMessage && (
            <div className={`p-3 rounded-xl text-xs font-bold flex items-center gap-2 ${
              actionMessage.type === 'success' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20' : 'bg-destructive/10 text-destructive border border-destructive/20'
            }`}>
              {actionMessage.type === 'success' ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertCircle className="h-4 w-4 shrink-0" />}
              {actionMessage.text}
            </div>
          )}

          <form onSubmit={
            activeAction === 'transfer' ? handleTransfer :
            activeAction === 'donate' ? handleDonate :
            activeAction === 'withdraw' ? handleWithdraw :
            handleSetupPin
          } className="space-y-3">
            {activeAction === 'transfer' && (
              <>
                <Input name="username" placeholder="Recipient username" required className="text-sm" />
                <Input name="amount" type="number" min="1" placeholder="Amount (in your currency)" required className="text-sm" />
                <Input name="note" placeholder="What's this for? (optional)" className="text-sm" />
                <Input name="pin" type="password" maxLength={4} inputMode="numeric" placeholder="Transaction PIN" required className="text-sm" />
              </>
            )}
            {activeAction === 'donate' && (
              <>
                <Input name="username" placeholder="Creator username" required className="text-sm" />
                <Input name="amount" type="number" min="1" placeholder="Amount (in your currency)" required className="text-sm" />
                <Input name="message" placeholder="Leave a message (optional)" className="text-sm" />
                <label className="flex items-center gap-2 text-xs text-muted-foreground">
                  <input type="checkbox" name="is_anonymous" className="rounded" />
                  Donate anonymously
                </label>
                <Input name="pin" type="password" maxLength={4} inputMode="numeric" placeholder="Transaction PIN" required className="text-sm" />
              </>
            )}
            {activeAction === 'withdraw' && (
              <>
                <Input name="amount" type="number" min="1" placeholder="Amount (in your currency)" required className="text-sm" />
                <Input name="pin" type="password" maxLength={4} inputMode="numeric" placeholder="Transaction PIN" required className="text-sm" />
              </>
            )}
            {activeAction === 'pin' && (
              <>
                {wallet?.has_pin && <Input name="current_pin" type="password" maxLength={4} inputMode="numeric" placeholder="Current PIN" required className="text-sm" />}
                <Input name="pin" type="password" maxLength={4} inputMode="numeric" placeholder="New 4-digit PIN" required className="text-sm" />
                <Input name="confirm_pin" type="password" maxLength={4} inputMode="numeric" placeholder="Confirm new PIN" required className="text-sm" />
              </>
            )}
            <Button type="submit" disabled={isSubmitting} className="w-full text-sm font-bold">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              {activeAction === 'transfer' ? 'Send Money' :
               activeAction === 'donate' ? 'Send Tip' :
               activeAction === 'withdraw' ? 'Request Withdrawal' :
               wallet?.has_pin ? 'Update PIN' : 'Set PIN'}
            </Button>
          </form>
        </DialogContent>
      </Dialog>

      {/* Transaction History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-black text-foreground">Transaction History</h2>
          <div className="flex gap-1">
            {(['', 'payment', 'transfer', 'donation', 'withdrawal'] as const).map((f) => (
              <button
                key={f}
                onClick={() => setTxnFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors ${
                  txnFilter === f ? 'bg-secondary text-white' : 'bg-muted text-muted-foreground hover:text-foreground'
                }`}
              >
                {f === '' ? 'All' : f === 'transfer' ? 'Transfer' : f === 'donation' ? 'Donation' : txnTypeLabel[f] ?? f}
              </button>
            ))}
          </div>
        </div>

        {transactions.length === 0 ? (
          <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
            <RefreshCcw className="h-10 w-10 text-muted-foreground/30 mx-auto" />
            <h3 className="text-sm font-bold text-foreground">No transactions yet</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Your transaction history will appear here once you make a purchase, receive a payment, or send funds.
            </p>
          </div>
        ) : (
          <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
            <div className="divide-y divide-border/50">
              {transactions.map((txn) => (
                <div key={txn.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={`p-2 rounded-xl shrink-0 ${
                      txn.entry_type === 'credit' ? 'bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400' : 'bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400'
                    }`}>
                      {txn.entry_type === 'credit' ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">
                        {txnTypeLabel[txn.type] ?? txn.type}
                      </p>
                      {txn.description && <p className="text-[11px] text-muted-foreground truncate">{txn.description}</p>}
                    </div>
                  </div>
                  <div className="text-right shrink-0 ml-4">
                    <p className={`text-sm font-extrabold ${txn.entry_type === 'credit' ? 'text-emerald-600' : 'text-foreground'}`}>
                      {txn.entry_type === 'credit' ? '+' : '-'}{txn.formatted}
                    </p>
                    <p className="text-[10px] text-muted-foreground">
                      {new Date(txn.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
