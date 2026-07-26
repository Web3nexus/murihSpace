import React, { useState, useEffect, useCallback } from 'react';
import {
  Gift,
  Heart,
  Send,
  Loader2,
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
import type { Donation, DonationPayload } from '@/types/wallet';

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

export function DonationsPage() {
  const [sentDonations, setSentDonations] = useState<Donation[]>([]);
  const [receivedDonations, setReceivedDonations] = useState<Donation[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showSend, setShowSend] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [actionMessage, setActionMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [tab, setTab] = useState<'sent' | 'received'>('received');

  const fetchDonations = useCallback(async () => {
    try {
      const [sentRes, recvRes] = await Promise.all([
        fetch(`${API_BASE}/wallet/donations/sent`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/wallet/donations/received`, { headers: getAuthHeaders() }),
      ]);
      if (sentRes.ok) {
        const json = await sentRes.json();
        setSentDonations(json.data?.data ?? []);
      }
      if (recvRes.ok) {
        const json = await recvRes.json();
        setReceivedDonations(json.data?.data ?? []);
      }
    } catch (e) { console.error('Failed to fetch donations', e); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchDonations().finally(() => setIsLoading(false));
  }, [fetchDonations]);

  const handleSendDonation = async (e: React.FormEvent<HTMLFormElement>) => {
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
        setActionMessage({ type: 'success', text: `Sent ${formatAmount(payload.amount)} tip to @${payload.recipient_username}!` });
        setShowSend(false);
        fetchDonations();
      } else {
        setActionMessage({ type: 'error', text: json.message || 'Donation failed.' });
      }
    } catch {
      setActionMessage({ type: 'error', text: 'Network error. Please try again.' });
    } finally {
      setIsSubmitting(false);
    }
  };

  const stats = {
    totalSent: sentDonations.reduce((a, d) => a + d.amount, 0),
    totalReceived: receivedDonations.reduce((a, d) => a + d.amount, 0),
    countSent: sentDonations.length,
    countReceived: receivedDonations.length,
  };

  if (isLoading) {
    return (
      <div className="w-full flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full max-w-7xl mx-auto p-6 lg:p-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-foreground tracking-tight flex items-center gap-2.5">
            <Heart className="h-6 w-6 text-rose-500" />
            Tips & Donations
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Send and receive tips and donations from the community.
          </p>
        </div>
        <Button onClick={() => { setShowSend(true); setActionMessage(null); }} className="text-xs font-bold gap-1.5">
          <Send className="h-4 w-4" /> Send a Tip
        </Button>
      </div>

      {/* Summary Metrics */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Total Received', value: formatAmount(stats.totalReceived), sub: `${stats.countReceived} tips`, icon: Heart, color: 'text-rose-600 bg-rose-100 dark:text-rose-400 dark:bg-rose-950' },
          { label: 'Total Sent', value: formatAmount(stats.totalSent), sub: `${stats.countSent} tips`, icon: Gift, color: 'text-blue-600 bg-blue-100 dark:text-blue-400 dark:bg-blue-950' },
        ].map((m) => (
          <div key={m.label} className="border border-border rounded-2xl bg-card p-4 shadow-sm flex items-center gap-4">
            <div className={`p-2.5 rounded-xl ${m.color} shrink-0`}>
              <m.icon className="h-5 w-5" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground font-semibold">{m.label}</p>
              <p className="text-xl font-black text-foreground">{m.value}</p>
              <p className="text-[10px] text-muted-foreground">{m.sub}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1 border-b border-border pb-2">
        {(['received', 'sent'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-xs font-bold transition-colors ${
              tab === t ? 'bg-secondary/10 text-secondary' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {t === 'received' ? 'Received' : 'Sent'}
          </button>
        ))}
      </div>

      {/* Donations List */}
      {(tab === 'received' ? receivedDonations : sentDonations).length === 0 ? (
        <div className="p-12 text-center border border-dashed border-border rounded-3xl bg-card space-y-3">
          <Gift className="h-10 w-10 text-muted-foreground/30 mx-auto" />
          <h3 className="text-sm font-bold text-foreground">No {tab} donations yet</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {tab === 'received'
              ? 'When someone sends you a tip, it will appear here.'
              : 'Send a tip to a creator or community member you appreciate.'}
          </p>
        </div>
      ) : (
        <div className="border border-border rounded-2xl bg-card overflow-hidden shadow-sm">
          <div className="divide-y divide-border/50">
            {(tab === 'received' ? receivedDonations : sentDonations).map((donation) => (
              <div key={donation.id} className="flex items-center justify-between px-4 py-3.5 hover:bg-muted/10 transition-colors">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-rose-100 text-rose-600 dark:bg-rose-950 dark:text-rose-400 shrink-0">
                    <Heart className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-bold text-foreground truncate">
                      {donation.is_anonymous && tab === 'received'
                        ? 'Anonymous'
                        : tab === 'received'
                          ? donation.sender?.name ?? 'Someone'
                          : donation.recipient?.name ?? 'Someone'}
                    </p>
                    {donation.message && <p className="text-[11px] text-muted-foreground truncate italic">"{donation.message}"</p>}
                    {!donation.is_anonymous && (
                      <p className="text-[10px] text-muted-foreground">@{tab === 'received' ? donation.sender?.username : donation.recipient?.username}</p>
                    )}
                  </div>
                </div>
                <div className="text-right shrink-0 ml-4">
                  <p className="text-sm font-extrabold text-rose-600">{formatAmount(donation.amount, donation.currency)}</p>
                  <p className="text-[10px] text-muted-foreground">{new Date(donation.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Send Donation Dialog */}
      <Dialog open={showSend} onOpenChange={() => { setShowSend(false); setActionMessage(null); }}>
        <DialogContent className="sm:max-w-[400px] bg-card border-border shadow-2xl rounded-2xl">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <Gift className="h-5 w-5 text-rose-500" /> Send a Tip
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Support a creator or community member with a direct tip.
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

          <form onSubmit={handleSendDonation} className="space-y-3">
            <Input name="username" placeholder="Recipient username" required className="text-sm" />
            <Input name="amount" type="number" min="1" placeholder="Amount (in your currency)" required className="text-sm" />
            <Input name="message" placeholder="Leave a message (optional)" className="text-sm" />
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <input type="checkbox" name="is_anonymous" className="rounded" />
              Tip anonymously
            </label>
            <Input name="pin" type="password" maxLength={4} inputMode="numeric" placeholder="Transaction PIN" required className="text-sm" />
            <Button type="submit" disabled={isSubmitting} className="w-full text-sm font-bold">
              {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
              Send Tip
            </Button>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
