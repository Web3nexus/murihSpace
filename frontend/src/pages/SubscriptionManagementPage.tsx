import React, { useState, useEffect, useCallback } from 'react';
import {
  Crown, Plus, Loader2, Pencil, Trash2, X,
  Users, Banknote, Calendar, Eye, EyeOff, AlertCircle,
} from 'lucide-react';
import type { SubscriptionPlan, SubscriptionStats, CreatePlanPayload } from '@/types/subscription';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';

function getAuthHeaders() {
  const token = localStorage.getItem('murihspace-token');
  return {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function formatPrice(cents: number, currency = 'NGN'): string {
  const symbols: Record<string, string> = { NGN: '₦', USD: '$', GBP: '£', EUR: '€' };
  const sym = symbols[currency] ?? currency + ' ';
  return sym + (cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2 });
}

export function SubscriptionManagementPage() {
  const [plans, setPlans] = useState<SubscriptionPlan[]>([]);
  const [stats, setStats] = useState<SubscriptionStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<CreatePlanPayload>({
    name: '', description: '', price: 0, billing_cycle: 'monthly', features: [], is_active: true,
  });
  const [featureInput, setFeatureInput] = useState('');

  const fetchData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [plansRes, statsRes] = await Promise.all([
        fetch(`${API_BASE}/subscriptions/plans/my`, { headers: getAuthHeaders() }),
        fetch(`${API_BASE}/subscriptions/stats`, { headers: getAuthHeaders() }),
      ]);
      if (plansRes.ok) {
        const json = await plansRes.json();
        setPlans(json.data?.data ?? []);
      }
      if (statsRes.ok) {
        const json = await statsRes.json();
        setStats(json.data?.data ?? json.data ?? null);
      }
    } catch { /* ignore */ }
    setIsLoading(false);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    fetchData();
  }, [fetchData]);

  const resetForm = () => {
    setForm({ name: '', description: '', price: 0, billing_cycle: 'monthly', features: [], is_active: true });
    setFeatureInput('');
    setEditingId(null);
    setShowForm(false);
    setError(null);
  };

  const editPlan = (plan: SubscriptionPlan) => {
    setForm({
      name: plan.name,
      description: plan.description ?? '',
      price: plan.price,
      billing_cycle: plan.billing_cycle,
      features: plan.features ?? [],
      is_active: plan.is_active,
    });
    setEditingId(plan.id);
    setShowForm(true);
    setError(null);
  };

  const addFeature = () => {
    const val = featureInput.trim();
    if (!val) return;
    setForm((f) => ({ ...f, features: [...(f.features ?? []), val] }));
    setFeatureInput('');
  };

  const removeFeature = (idx: number) => {
    setForm((f) => ({ ...f, features: (f.features ?? []).filter((_, i) => i !== idx) }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const url = editingId
        ? `${API_BASE}/subscriptions/plans/${editingId}`
        : `${API_BASE}/subscriptions/plans`;
      const method = editingId ? 'PUT' : 'POST';
      const res = await fetch(url, { method, headers: getAuthHeaders(), body: JSON.stringify(form) });
      const json = await res.json();
      if (!res.ok) {
        setError(json.message ?? 'Failed to save plan');
        setSaving(false);
        return;
      }
      resetForm();
      fetchData();
    } catch {
      setError('Network error');
    }
    setSaving(false);
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Delete this plan? Active subscriptions will prevent deletion.')) return;
    try {
      const res = await fetch(`${API_BASE}/subscriptions/plans/${id}`, { method: 'DELETE', headers: getAuthHeaders() });
      const json = await res.json();
      if (!res.ok) { alert(json.message); return; }
      fetchData();
    } catch (e) { console.error(e); }
  };

  const toggleActive = async (plan: SubscriptionPlan) => {
    try {
      await fetch(`${API_BASE}/subscriptions/plans/${plan.id}`, {
        method: 'PUT',
        headers: getAuthHeaders(),
        body: JSON.stringify({ is_active: !plan.is_active }),
      });
      fetchData();
    } catch (e) { console.error(e); }
  };

  const formatCycle = (c: string) => c === 'yearly' ? '/yr' : '/mo';

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-secondary" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-foreground flex items-center gap-2">
            <Crown className="h-5 w-5 text-amber-500" />
            Subscriptions & Memberships
          </h1>
          <p className="text-xs text-muted-foreground mt-1">Create membership tiers and manage recurring revenue.</p>
        </div>
        <button onClick={() => { resetForm(); setShowForm(true); }} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 transition-colors shadow-sm">
          <Plus className="h-3.5 w-3.5" /> New Plan
        </button>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
              <Users className="h-3.5 w-3.5" /> Active Subscribers
            </div>
            <p className="text-2xl font-extrabold text-foreground">{stats.active_subscribers}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
              <Banknote className="h-3.5 w-3.5" /> Monthly Revenue
            </div>
            <p className="text-2xl font-extrabold text-foreground">{formatPrice(stats.total_monthly_revenue)}</p>
          </div>
          <div className="rounded-xl border border-border bg-card p-4">
            <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold mb-1">
              <Calendar className="h-3.5 w-3.5" /> Recent Signups
            </div>
            <p className="text-2xl font-extrabold text-foreground">{stats.recent_subscriptions?.length ?? 0}</p>
          </div>
        </div>
      )}

      {/* Plans List */}
      <div className="space-y-3">
        <h2 className="text-sm font-extrabold text-foreground">Your Plans</h2>
        {plans.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border p-8 text-center">
            <Crown className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
            <p className="text-xs font-bold text-foreground">No plans yet</p>
            <p className="text-[11px] text-muted-foreground mt-1">Create your first membership tier to start earning recurring revenue.</p>
          </div>
        ) : (
          plans.map((plan) => (
            <div key={plan.id} className="rounded-xl border border-border bg-card p-4 flex items-start justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-extrabold text-foreground">{plan.name}</span>
                  <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${plan.is_active ? 'bg-green-500/15 text-green-600' : 'bg-muted text-muted-foreground'}`}>
                    {plan.is_active ? 'Active' : 'Inactive'}
                  </span>
                  {plan.billing_cycle === 'yearly' && (
                    <span className="px-1.5 py-0.5 rounded-full bg-amber-500/15 text-amber-600 text-[10px] font-bold">Yearly</span>
                  )}
                </div>
                {plan.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{plan.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-lg font-extrabold text-foreground">{formatPrice(plan.price, plan.currency)}<span className="text-xs text-muted-foreground font-normal">{formatCycle(plan.billing_cycle)}</span></span>
                  {plan.active_subscribers !== undefined && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1"><Users className="h-3 w-3" /> {plan.active_subscribers} subscriber{plan.active_subscribers !== 1 ? 's' : ''}</span>
                  )}
                </div>
                {plan.features && plan.features.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    {plan.features.map((f, i) => (
                      <span key={i} className="px-2 py-0.5 rounded-full bg-muted text-[10px] text-muted-foreground font-medium">{f}</span>
                    ))}
                  </div>
                )}
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => toggleActive(plan)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors" title={plan.is_active ? 'Deactivate' : 'Activate'}>
                  {plan.is_active ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
                <button onClick={() => editPlan(plan)} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors">
                  <Pencil className="h-3.5 w-3.5" />
                </button>
                <button onClick={() => handleDelete(plan.id)} className="p-1.5 rounded-lg hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors">
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Recent Subscribers */}
      {stats?.recent_subscriptions && stats.recent_subscriptions.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-sm font-extrabold text-foreground">Recent Subscribers</h2>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {stats.recent_subscriptions.map((rs) => (
              <div key={rs.id} className="flex items-center gap-3 px-4 py-3">
                <div className="h-8 w-8 rounded-full bg-gradient-to-br from-primary to-secondary text-white text-[10px] font-bold flex items-center justify-center shrink-0">
                  {rs.subscriber.name.charAt(0)}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-bold text-foreground truncate">{rs.subscriber.name}</p>
                  <p className="text-[10px] text-muted-foreground">@{rs.subscriber.username} &middot; {rs.plan.name}</p>
                </div>
                <span className="text-[10px] text-muted-foreground">{new Date(rs.created_at).toLocaleDateString()}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showForm && (
        <>
          {/* eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */}
          <div className="fixed inset-0 bg-black/40 z-40" onClick={resetForm} />
          <div className="fixed inset-0 flex items-center justify-center z-50 p-4">
            <div className="w-full max-w-lg rounded-2xl border border-border bg-card shadow-2xl p-6 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-extrabold text-foreground">{editingId ? 'Edit Plan' : 'New Plan'}</h3>
                <button onClick={resetForm} className="p-1 rounded-lg hover:bg-muted text-muted-foreground"><X className="h-4 w-4" /></button>
              </div>

              {error && (
                <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-destructive/10 text-destructive text-xs font-medium mb-4">
                  <AlertCircle className="h-3.5 w-3.5" /> {error}
                </div>
              )}

              <form onSubmit={handleSave} className="space-y-4">
                <div>
                  <label htmlFor="plan-name" className="text-xs font-bold text-foreground block mb-1">Plan Name</label>
                  <input
                    id="plan-name"
                    type="text" value={form.name} required
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                    placeholder="e.g. Premium Tier"
                  />
                </div>

                <div>
                  <label htmlFor="plan-desc" className="text-xs font-bold text-foreground block mb-1">Description</label>
                  <textarea
                    id="plan-desc"
                    value={form.description ?? ''}
                    onChange={(e) => setForm({ ...form, description: e.target.value })}
                    className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary resize-none"
                    rows={2}
                    placeholder="What's included in this tier?"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label htmlFor="plan-price" className="text-xs font-bold text-foreground block mb-1">Price (in cents)</label>
                    <input
                      id="plan-price"
                      type="number" value={form.price} required min={0}
                      onChange={(e) => setForm({ ...form, price: parseInt(e.target.value) || 0 })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                      placeholder="e.g. 500 = $5.00"
                    />
                    <p className="text-[10px] text-muted-foreground mt-0.5">Enter amount in cents (e.g. 500 = {formatPrice(500)})</p>
                  </div>
                  <div>
                    <label htmlFor="plan-cycle" className="text-xs font-bold text-foreground block mb-1">Billing Cycle</label>
                    <select
                      id="plan-cycle"
                      value={form.billing_cycle}
                      onChange={(e) => setForm({ ...form, billing_cycle: e.target.value as 'monthly' | 'yearly' })}
                      className="w-full px-3 py-2 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                    >
                      <option value="monthly">Monthly</option>
                      <option value="yearly">Yearly</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label htmlFor="plan-feature" className="text-xs font-bold text-foreground block mb-1">Features / Benefits</label>
                  <div className="flex gap-2 mb-2">
                    <input
                      id="plan-feature"
                      type="text" value={featureInput}
                      onChange={(e) => setFeatureInput(e.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addFeature())}
                      className="flex-1 px-3 py-1.5 text-xs rounded-xl bg-muted border-0 outline-none focus:ring-1 focus:ring-secondary"
                      placeholder="e.g. Exclusive content"
                    />
                    <button type="button" onClick={addFeature} className="px-3 py-1.5 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90">Add</button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {(form.features ?? []).map((f, i) => (
                      <span key={i} className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-muted text-[10px] font-medium">
                        {f}
                        <button type="button" onClick={() => removeFeature(i)} className="text-muted-foreground hover:text-foreground"><X className="h-2.5 w-2.5" /></button>
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <label htmlFor="plan-active" className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                    <input
                      id="plan-active"
                      type="checkbox" checked={form.is_active}
                      onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                      className="rounded border-border"
                    />
                    Active (visible to members)
                  </label>
                  <div className="flex gap-2">
                    <button type="button" onClick={resetForm} className="px-3 py-1.5 text-xs font-bold rounded-xl border border-border hover:bg-muted transition-colors">Cancel</button>
                    <button type="submit" disabled={saving} className="px-4 py-1.5 text-xs font-bold rounded-xl bg-secondary text-secondary-foreground hover:bg-secondary/90 disabled:opacity-50 transition-all flex items-center gap-1.5">
                      {saving && <Loader2 className="h-3 w-3 animate-spin" />}
                      {editingId ? 'Update' : 'Create'} Plan
                    </button>
                  </div>
                </div>
              </form>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
