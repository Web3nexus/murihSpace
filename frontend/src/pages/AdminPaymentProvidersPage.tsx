import { useState, useEffect, useCallback } from 'react';
import {
  CreditCard,
  ArrowsClockwise as RefreshCw,
  CheckCircle as CheckCircle2,
  XCircle,
  Warning as AlertTriangle,
  Waveform as Activity,
  Cpu,
  Shuffle,
  CurrencyDollar as DollarSign,
  HardDrives,
  Lightning as Zap,
  Plus,
  Key,
  ShieldCheck,
  Trash,
  X,
  Info
} from '@phosphor-icons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { authFetch } from '@/lib/api/authFetch';
import { getAuthToken } from '@/lib/auth/token';

interface ProviderCapability {
  id: number;
  capability: string;
  country_code: string;
  currency: string;
  status: string;
  min_amount: number | null;
  max_amount: number | null;
}

interface PaymentProvider {
  id: number;
  code: string;
  name: string;
  is_enabled: boolean;
  environment: string;
  priority: number;
  health_status: 'healthy' | 'degraded' | 'down' | 'maintenance';
  credential_status: 'Configured' | 'Not configured';
  has_credentials?: boolean;
  public_key_preview?: string | null;
  last_health_check_at: string | null;
  last_successful_request_at: string | null;
  last_failed_request_at: string | null;
  capabilities: ProviderCapability[];
}

interface ProviderRoute {
  id: number;
  name: string;
  transaction_type: string;
  country_code: string;
  currency: string;
  payment_method: string;
  primary_provider: PaymentProvider;
  fallback_provider: PaymentProvider | null;
  priority: number;
  is_active: boolean;
}

interface PaymentStats {
  total_volume_minor: number;
  total_fees_minor: number;
  net_revenue_minor: number;
  successful_count: number;
  failed_count: number;
  pending_count: number;
  refunded_count: number;
  provider_distribution: Array<{ provider: string; count: number; total_amount: number }>;
}

const authHeaders = () => {
  const token = getAuthToken();
  return {
    Accept: 'application/json',
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
};

export function AdminPaymentProvidersPage() {
  const [providers, setProviders] = useState<PaymentProvider[]>([]);
  const [routes, setRoutes] = useState<ProviderRoute[]>([]);
  const [stats, setStats] = useState<PaymentStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'providers' | 'routes' | 'simulator'>('providers');
  const [actionMsg, setActionMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  const [showGuide, setShowGuide] = useState(true);

  // Provider Configure / Add Modal state
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [editingCode, setEditingCode] = useState<string>('paystack');
  const [providerName, setProviderName] = useState<string>('');
  const [providerEnv, setProviderEnv] = useState<string>('sandbox');
  const [providerPriority, setProviderPriority] = useState<number>(10);
  const [providerPublicKey, setProviderPublicKey] = useState<string>('');
  const [providerSecretKey, setProviderSecretKey] = useState<string>('');
  const [providerClientId, setProviderClientId] = useState<string>('');
  const [providerApiKey, setProviderApiKey] = useState<string>('');
  const [providerWebhookSecret, setProviderWebhookSecret] = useState<string>('');
  const [savingProvider, setSavingProvider] = useState(false);

  // New Route Modal state
  const [routeModalOpen, setRouteModalOpen] = useState(false);
  const [routeName, setRouteName] = useState('');
  const [routeTxType, setRouteTxType] = useState('payment');
  const [routeCountry, setRouteCountry] = useState('*');
  const [routeCurrency, setRouteCurrency] = useState('NGN');
  const [routeMethod, setRouteMethod] = useState('*');
  const [routePrimaryId, setRoutePrimaryId] = useState<number>(0);
  const [routeFallbackId, setRouteFallbackId] = useState<number>(0);
  const [routePriority, setRoutePriority] = useState<number>(10);
  const [savingRoute, setSavingRoute] = useState(false);

  // Simulator state
  const [simType, setSimType] = useState('payment');
  const [simCountry, setSimCountry] = useState('NG');
  const [simCurrency, setSimCurrency] = useState('NGN');
  const [simMethod, setSimMethod] = useState('card');
  const [simAmount, setSimAmount] = useState('500000');
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const [resProv, resRoutes, resStats] = await Promise.all([
        authFetch('/securegate/payment-providers', { headers: authHeaders() }),
        authFetch('/securegate/payment-routes', { headers: authHeaders() }),
        authFetch('/securegate/payments/stats', { headers: authHeaders() }).catch(() => null),
      ]);

      if (resProv.ok) {
        const j = await resProv.json();
        const list = Array.isArray(j) ? j : (j?.data ?? []);
        setProviders(list);
      }
      if (resRoutes && resRoutes.ok) {
        const j = await resRoutes.json();
        const list = Array.isArray(j) ? j : (j?.data ?? []);
        setRoutes(list);
      }
      if (resStats && resStats.ok) {
        const j = await resStats.json();
        setStats(j?.data ?? null);
      }
    } catch {
      setActionMsg({ ok: false, text: 'Unable to load payment infrastructure data.' });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleTestConnection = async (code: string) => {
    setTestingProvider(code);
    setActionMsg(null);
    try {
      const res = await authFetch(`/securegate/payment-providers/${code}/test-connection`, {
        method: 'POST',
        headers: authHeaders(),
      });
      const j = await res.json();
      if (res.ok && j.result?.status === 'healthy') {
        setActionMsg({ ok: true, text: `✓ ${j.result.message} (${j.result.latency_ms}ms)` });
      } else {
        setActionMsg({ ok: false, text: `✗ ${j.result?.message || 'Connection test failed.'}` });
      }
      loadData();
    } catch {
      setActionMsg({ ok: false, text: 'Network failure while testing connection.' });
    } finally {
      setTestingProvider(null);
    }
  };

  const handleToggleProvider = async (provider: PaymentProvider) => {
    const nextState = !provider.is_enabled;
    try {
      const res = await authFetch(`/securegate/payment-providers/${provider.code}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          is_enabled: nextState,
          reason: `Admin toggled provider ${provider.code} to ${nextState ? 'enabled' : 'disabled'}`,
        }),
      });
      if (res.ok) {
        setActionMsg({ ok: true, text: `Provider ${provider.name} ${nextState ? 'enabled' : 'disabled'}.` });
        loadData();
      } else {
        const j = await res.json();
        setActionMsg({ ok: false, text: j.message || 'Update failed.' });
      }
    } catch {
      setActionMsg({ ok: false, text: 'Network error updating provider.' });
    }
  };

  const handleToggleEnvironment = async (provider: PaymentProvider) => {
    const isProd = provider.environment === 'production' || provider.environment === 'live';
    const nextEnv = isProd ? (provider.code === 'paystack' ? 'test' : 'sandbox') : (provider.code === 'paystack' ? 'live' : 'production');

    try {
      const res = await authFetch(`/securegate/payment-providers/${provider.code}`, {
        method: 'PUT',
        headers: authHeaders(),
        body: JSON.stringify({
          environment: nextEnv,
          reason: `Admin switched environment to ${nextEnv}`,
        }),
      });
      if (res.ok) {
        setActionMsg({ ok: true, text: `${provider.name} switched to ${nextEnv} mode.` });
        loadData();
      } else {
        const j = await res.json();
        setActionMsg({ ok: false, text: j.message || 'Update failed.' });
      }
    } catch {
      setActionMsg({ ok: false, text: 'Network error switching environment.' });
    }
  };

  const openConfigModal = (p?: PaymentProvider) => {
    if (p) {
      setEditingCode(p.code);
      setProviderName(p.name);
      setProviderEnv(p.environment || 'sandbox');
      setProviderPriority(p.priority || 10);
    } else {
      setEditingCode('paystack');
      setProviderName('Paystack Payments');
      setProviderEnv('sandbox');
      setProviderPriority(10);
    }
    setProviderPublicKey('');
    setProviderSecretKey('');
    setProviderClientId('');
    setProviderApiKey('');
    setProviderWebhookSecret('');
    setConfigModalOpen(true);
  };

  const handleSaveProvider = async () => {
    setSavingProvider(true);
    setActionMsg(null);
    try {
      const payload: Record<string, unknown> = {
        code: editingCode,
        name: providerName,
        environment: providerEnv,
        priority: providerPriority,
        is_enabled: true,
      };

      if (providerPublicKey) payload.public_key = providerPublicKey;
      if (providerSecretKey) payload.secret_key = providerSecretKey;
      if (providerClientId) payload.client_id = providerClientId;
      if (providerApiKey) payload.api_key = providerApiKey;
      if (providerWebhookSecret) payload.webhook_secret = providerWebhookSecret;

      const res = await authFetch('/securegate/payment-providers', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        setActionMsg({ ok: true, text: `✓ ${providerName} configured and saved successfully!` });
        setConfigModalOpen(false);
        loadData();
      } else {
        const j = await res.json();
        setActionMsg({ ok: false, text: j.message || 'Failed to save provider.' });
      }
    } catch {
      setActionMsg({ ok: false, text: 'Network error saving provider.' });
    } finally {
      setSavingProvider(false);
    }
  };

  const handleSaveRoute = async () => {
    if (!routeName.trim() || !routePrimaryId) {
      setActionMsg({ ok: false, text: 'Please fill in route name and choose a primary provider.' });
      return;
    }
    setSavingRoute(true);
    setActionMsg(null);
    try {
      const res = await authFetch('/securegate/payment-routes', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          name: routeName.trim(),
          transaction_type: routeTxType,
          country_code: routeCountry.trim().toUpperCase() || '*',
          currency: routeCurrency.trim().toUpperCase() || '*',
          payment_method: routeMethod,
          primary_provider_id: routePrimaryId,
          fallback_provider_id: routeFallbackId || null,
          priority: routePriority,
          is_active: true,
        }),
      });
      if (res.ok) {
        setActionMsg({ ok: true, text: `✓ Routing rule "${routeName}" created!` });
        setRouteModalOpen(false);
        setRouteName('');
        loadData();
      } else {
        const j = await res.json();
        setActionMsg({ ok: false, text: j.message || 'Failed to create route.' });
      }
    } catch {
      setActionMsg({ ok: false, text: 'Network error saving route.' });
    } finally {
      setSavingRoute(false);
    }
  };

  const handleDeleteRoute = async (id: number, name: string) => {
    if (!confirm(`Are you sure you want to delete the routing rule "${name}"?`)) return;
    try {
      const res = await authFetch(`/securegate/payment-routes/${id}`, {
        method: 'DELETE',
        headers: authHeaders(),
      });
      if (res.ok) {
        setActionMsg({ ok: true, text: 'Routing rule deleted.' });
        loadData();
      }
    } catch {
      setActionMsg({ ok: false, text: 'Network error deleting route.' });
    }
  };

  const handleSimulate = async () => {
    setSimulating(true);
    setSimResult(null);
    try {
      const res = await authFetch('/securegate/payment-routes/simulate', {
        method: 'POST',
        headers: authHeaders(),
        body: JSON.stringify({
          transaction_type: simType,
          country: simCountry,
          currency: simCurrency,
          payment_method: simMethod,
          amount: parseInt(simAmount, 10) || 500000,
        }),
      });
      const j = await res.json();
      setSimResult(j);
    } catch {
      setSimResult({ success: false, message: 'Simulation failed due to network error.' });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-4 lg:p-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-black tracking-tight flex items-center gap-2.5">
            <CreditCard weight="fill" className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
            Payment Infrastructure & Gateways
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise multi-gateway control hub: Paystack, Flutterwave, Airwallex, Stripe, and Intelligent Dynamic Routing.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowGuide(!showGuide)}
            className="text-xs"
          >
            <Info weight="fill" className="h-3.5 w-3.5 mr-1 text-[#2164b6]" />
            {showGuide ? 'Hide Guide' : 'How It Works'}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadData}
            disabled={loading}
            className="text-xs"
          >
            <RefreshCw weight="fill" className={'h-3.5 w-3.5 mr-1.5 ' + (loading ? 'animate-spin' : '')} />
            Refresh
          </Button>
          <Button
            size="sm"
            onClick={() => openConfigModal()}
            className="text-xs bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold"
          >
            <Plus weight="bold" className="h-3.5 w-3.5 mr-1" />
            Connect / Add Gateway
          </Button>
        </div>
      </div>

      {/* Action Messages */}
      {actionMsg && (
        <div
          className={'flex items-center gap-2 rounded-lg px-4 py-3 text-xs font-bold border ' + (
            actionMsg.ok
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          )}
        >
          {actionMsg.ok ? <CheckCircle2 weight="fill" className="h-4 w-4 shrink-0" /> : <AlertTriangle weight="fill" className="h-4 w-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* EDUCATIONAL GUIDE */}
      {showGuide && (
        <div className="rounded-lg bg-gradient-to-br from-[#2164b6]/5 to-[#1a6b9e]/10 border border-[#2164b6]/20 p-5 space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-2">
              <div className="h-7 w-7 rounded-md bg-[#2164b6] text-white flex items-center justify-center">
                <ShieldCheck weight="fill" className="h-4 w-4" />
              </div>
              <h2 className="text-sm font-bold text-foreground">How Payment Infrastructure Works on MurihSpace</h2>
            </div>
            <button onClick={() => setShowGuide(false)} className="text-muted-foreground hover:text-foreground">
              <X weight="bold" className="h-4 w-4" />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
            <div className="bg-card/80 p-3.5 rounded-lg border border-border/60 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <span className="h-5 w-5 rounded-full bg-[#2164b6]/10 text-[#2164b6] font-bold flex items-center justify-center text-[10px]">1</span>
                Connect Providers & API Keys
              </p>
              <p className="text-muted-foreground leading-relaxed">
                Click <b>Connect / Add Gateway</b> below to configure your <b>Paystack</b>, <b>Flutterwave</b>, <b>Airwallex</b>, or <b>Stripe</b> API keys. Set them to <i>Sandbox</i> to test, or <i>Live</i> to process real transactions.
              </p>
            </div>

            <div className="bg-card/80 p-3.5 rounded-lg border border-border/60 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <span className="h-5 w-5 rounded-full bg-[#2164b6]/10 text-[#2164b6] font-bold flex items-center justify-center text-[10px]">2</span>
                Dynamic Multi-Gateway Routing
              </p>
              <p className="text-muted-foreground leading-relaxed">
                When a customer buys a course or subscribes, MurihSpace checks currency and location. Nigerian Naira (NGN) routes to Paystack; Mobile Money (KES/UGX) to Flutterwave; Global USD/EUR cards to Airwallex/Stripe.
              </p>
            </div>

            <div className="bg-card/80 p-3.5 rounded-lg border border-border/60 space-y-1.5">
              <p className="font-bold text-foreground flex items-center gap-1.5 text-xs">
                <span className="h-5 w-5 rounded-full bg-[#2164b6]/10 text-[#2164b6] font-bold flex items-center justify-center text-[10px]">3</span>
                Auto-Failover Circuit Breaker
              </p>
              <p className="text-muted-foreground leading-relaxed">
                If your primary gateway experiences downtime, MurihSpace automatically switches checkout to your secondary fallback gateway in milliseconds. Zero lost transactions.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Metrics Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border/50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Volume</span>
              <DollarSign weight="fill" className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {(stats.total_volume_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{stats.successful_count} successful transactions</div>
          </div>

          <div className="bg-card border border-border/50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Platform Net Revenue</span>
              <Zap weight="fill" className="h-4 w-4 text-[#2164b6]" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {(stats.net_revenue_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Fees: {(stats.total_fees_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-card border border-border/50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Active Providers</span>
              <HardDrives weight="fill" className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {providers.filter((p) => p.is_enabled).length} / {providers.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Paystack, Flutterwave, Airwallex, Stripe</div>
          </div>

          <div className="bg-card border border-border/50 p-4 rounded-lg">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Health Status</span>
              <Activity weight="fill" className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black mt-2 text-emerald-500">
              {providers.length > 0 && providers.every((p) => p.health_status === 'healthy') ? 'All Operational' : 'Attention Needed'}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Live background ping check</div>
          </div>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <Button
          variant={activeTab === 'providers' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('providers')}
          className="text-xs"
        >
          <HardDrives weight="fill" className="h-3.5 w-3.5 mr-1.5" />
          Gateway Providers & Health ({providers.length})
        </Button>
        <Button
          variant={activeTab === 'routes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('routes')}
          className="text-xs"
        >
          <Shuffle weight="fill" className="h-3.5 w-3.5 mr-1.5" />
          Routing Rules Matrix ({routes.length})
        </Button>
        <Button
          variant={activeTab === 'simulator' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('simulator')}
          className="text-xs"
        >
          <Cpu weight="fill" className="h-3.5 w-3.5 mr-1.5" />
          Routing Simulator
        </Button>
      </div>

      {/* TAB 1: PROVIDERS & HEALTH */}
      {activeTab === 'providers' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              Connected payment gateways with live health status, confirmed currency capabilities, and environment toggles.
            </p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => openConfigModal()}
              className="text-xs"
            >
              <Plus weight="bold" className="h-3.5 w-3.5 mr-1" />
              Add / Configure Gateway
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((p) => {
              const isProd = p.environment === 'production' || p.environment === 'live';
              const isHealthy = p.health_status === 'healthy';

              return (
                <div
                  key={p.code}
                  className="bg-card border border-border/60 rounded-lg overflow-hidden flex flex-col justify-between hover:border-[#2164b6]/30 transition-all"
                >
                  <div className="p-5 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-base text-foreground flex items-center gap-2">
                        <span>{p.name}</span>
                      </div>
                      <Badge
                        variant="outline"
                        className={'text-[10px] font-bold uppercase tracking-wider ' + (
                          isHealthy ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                        )}
                      >
                        ● {p.health_status}
                      </Badge>
                    </div>

                    <div className="space-y-2.5 text-xs">
                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Status:</span>
                        <span className={'font-semibold ' + (p.is_enabled ? 'text-emerald-500' : 'text-muted-foreground')}>
                          {p.is_enabled ? 'Enabled' : 'Disabled'}
                        </span>
                      </div>

                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Environment:</span>
                        <Badge variant="secondary" className="text-[10px] uppercase font-bold">
                          {p.environment}
                        </Badge>
                      </div>

                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Credentials:</span>
                        <span className={'font-semibold ' + (p.credential_status === 'Configured' ? 'text-emerald-500' : 'text-rose-500')}>
                          {p.credential_status}
                        </span>
                      </div>

                      {p.public_key_preview && (
                        <div className="flex justify-between py-1 border-b border-border/50">
                          <span className="text-muted-foreground">Public Key:</span>
                          <span className="font-mono text-[10px] text-foreground truncate max-w-[150px]">
                            {p.public_key_preview.slice(0, 8)}...{p.public_key_preview.slice(-4)}
                          </span>
                        </div>
                      )}

                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Webhook URL:</span>
                        <code className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-foreground font-mono">
                          /webhooks/{p.code}
                        </code>
                      </div>

                      <div className="flex justify-between py-1 border-b border-border/50">
                        <span className="text-muted-foreground">Last Check:</span>
                        <span className="text-muted-foreground">
                          {p.last_health_check_at ? new Date(p.last_health_check_at).toLocaleTimeString() : 'Pending'}
                        </span>
                      </div>

                      {/* Capabilities Tag */}
                      {p.capabilities && p.capabilities.length > 0 && (
                        <div>
                          <span className="text-muted-foreground block mb-1.5 font-medium text-[11px]">Supported Currencies & Methods:</span>
                          <div className="flex flex-wrap gap-1">
                            {p.capabilities
                              .filter((c) => c.status === 'CONFIRMED')
                              .slice(0, 6)
                              .map((c) => (
                                <span
                                  key={c.id}
                                  className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md"
                                >
                                  {c.capability} ({c.currency})
                                </span>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Card Footer Actions */}
                  <div className="p-3.5 bg-muted/20 border-t border-border flex items-center justify-between gap-1.5 flex-wrap">
                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs flex-1"
                      disabled={testingProvider === p.code}
                      onClick={() => handleTestConnection(p.code)}
                    >
                      <Activity weight="fill" className={'h-3.5 w-3.5 mr-1 ' + (testingProvider === p.code ? 'animate-spin' : '')} />
                      Test
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => openConfigModal(p)}
                    >
                      <Key weight="fill" className="h-3 w-3 mr-1 text-amber-500" />
                      Configure Keys
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      className="text-xs"
                      onClick={() => handleToggleEnvironment(p)}
                    >
                      {isProd ? 'To Test' : 'To Live'}
                    </Button>

                    <Button
                      variant={p.is_enabled ? 'destructive' : 'default'}
                      size="sm"
                      className="text-xs"
                      onClick={() => handleToggleProvider(p)}
                    >
                      {p.is_enabled ? 'Disable' : 'Enable'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: ROUTING MATRIX */}
      {activeTab === 'routes' && (
        <div className="border border-border/60 bg-card rounded-lg overflow-hidden">
          <div className="px-6 py-4 border-b border-border bg-muted/10 flex items-center justify-between flex-wrap gap-2">
            <div>
              <h2 className="text-sm font-bold text-foreground">Active Dynamic Provider Routes</h2>
              <p className="text-xs text-muted-foreground">
                Priority-ordered rules evaluated at checkout. If the primary gateway is unavailable, payment automatically falls back.
              </p>
            </div>
            <Button
              size="sm"
              onClick={() => {
                if (providers.length > 0) {
                  setRoutePrimaryId(providers[0].id);
                }
                setRouteModalOpen(true);
              }}
              className="text-xs bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold"
            >
              <Plus weight="bold" className="h-3.5 w-3.5 mr-1" />
              Add Routing Rule
            </Button>
          </div>

          <div className="divide-y divide-border">
            {routes.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                No custom routing rules yet. Click "Add Routing Rule" to define how transactions should be processed.
              </div>
            ) : (
              routes.map((r) => (
                <div key={r.id} className="p-4 hover:bg-muted/10 transition-colors flex items-center justify-between gap-4">
                  <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-xs text-foreground">{r.name}</span>
                      <Badge variant="outline" className="text-[10px]">
                        Priority: {r.priority}
                      </Badge>
                      <Badge variant={r.is_active ? 'default' : 'secondary'} className="text-[10px]">
                        {r.is_active ? 'Active' : 'Disabled'}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-3 flex-wrap">
                      <span>Type: <b className="text-foreground">{r.transaction_type}</b></span>
                      <span>Country: <b className="text-foreground">{r.country_code}</b></span>
                      <span>Currency: <b className="text-foreground">{r.currency}</b></span>
                      <span>Method: <b className="text-foreground">{r.payment_method}</b></span>
                    </div>
                  </div>

                  <div className="flex items-center gap-4 shrink-0">
                    <div className="text-right text-xs">
                      <div className="text-muted-foreground">Primary: <b className="text-emerald-500">{r.primary_provider?.name ?? 'None'}</b></div>
                      <div className="text-muted-foreground">
                        Fallback: {r.fallback_provider ? <b className="text-blue-400">{r.fallback_provider.name}</b> : 'None'}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteRoute(r.id, r.name)}
                      className="p-1.5 rounded-md hover:bg-destructive/10 text-muted-foreground hover:text-destructive transition-colors"
                      title="Delete rule"
                    >
                      <Trash weight="bold" className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* TAB 3: ROUTING SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="border border-border/60 bg-card rounded-lg p-6 max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Cpu weight="fill" className="h-5 w-5 text-primary" /> Routing Engine Simulator
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Simulate how checkout resolves which payment gateway will be presented to the user.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 text-xs">
            <div>
              <label className="font-semibold block mb-1">Transaction Type</label>
              <select
                value={simType}
                onChange={(e) => setSimType(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 text-xs"
              >
                <option value="payment">Payment Collection (Checkout)</option>
                <option value="payout">Creator Payout</option>
                <option value="refund">Refund</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Country (ISO 2)</label>
              <Input
                value={simCountry}
                onChange={(e) => setSimCountry(e.target.value.toUpperCase())}
                placeholder="NG, US, GB, KE..."
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Currency (ISO 3)</label>
              <Input
                value={simCurrency}
                onChange={(e) => setSimCurrency(e.target.value.toUpperCase())}
                placeholder="NGN, USD, EUR, KES..."
                className="h-9 text-xs"
              />
            </div>

            <div>
              <label className="font-semibold block mb-1">Payment Method</label>
              <select
                value={simMethod}
                onChange={(e) => setSimMethod(e.target.value)}
                className="w-full bg-background border border-border rounded-lg p-2 text-xs"
              >
                <option value="card">Card</option>
                <option value="bank_transfer">Bank Transfer / Virtual Account</option>
                <option value="mobile_money">Mobile Money (M-Pesa, MTN, etc.)</option>
              </select>
            </div>

            <div className="col-span-2">
              <label className="font-semibold block mb-1">Amount (in Minor Units e.g. 500000 = 5,000.00)</label>
              <Input
                value={simAmount}
                onChange={(e) => setSimAmount(e.target.value)}
                placeholder="500000"
                className="h-9 text-xs"
              />
            </div>
          </div>

          <Button onClick={handleSimulate} disabled={simulating} className="w-full text-xs font-bold bg-[#2164b6] hover:bg-[#1a5091] text-white">
            {simulating ? 'Evaluating Capabilities...' : 'Run Simulation'}
          </Button>

          {simResult && (
            <div
              className={'p-4 rounded-lg border text-xs space-y-2 ' + (
                simResult.resolved_provider ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30'
              )}
            >
              <div className="font-bold flex items-center gap-2">
                {simResult.resolved_provider ? (
                  <>
                    <CheckCircle2 weight="fill" className="h-4 w-4 text-emerald-500" />
                    <span>Resolved Gateway: {simResult.provider_name} ({simResult.resolved_provider})</span>
                  </>
                ) : (
                  <>
                    <XCircle weight="fill" className="h-4 w-4 text-destructive" />
                    <span>Routing Unsuccessful</span>
                  </>
                )}
              </div>
              <p className="text-muted-foreground">
                {simResult.resolved_provider
                  ? 'Matched active routing rule with verified live gateway capability.'
                  : (simResult.message || 'No matching route found for this criteria.')}
              </p>
            </div>
          )}
        </div>
      )}

      {/* MODAL: CONFIGURE PROVIDER / ADD GATEWAY */}
      <Dialog open={configModalOpen} onOpenChange={setConfigModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Key weight="fill" className="h-5 w-5 text-amber-500" />
              Configure Payment Gateway Keys
            </DialogTitle>
            <DialogDescription className="text-xs">
              Enter your live or sandbox API keys to activate this gateway. Keys are stored encrypted.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Gateway Provider</label>
              <select
                value={editingCode}
                onChange={(e) => {
                  const code = e.target.value;
                  setEditingCode(code);
                  if (code === 'paystack') setProviderName('Paystack Payments');
                  else if (code === 'flutterwave') setProviderName('Flutterwave for Business');
                  else if (code === 'airwallex') setProviderName('Airwallex Global Payments');
                  else if (code === 'stripe') setProviderName('Stripe Payments');
                  else setProviderName('Custom Gateway');
                }}
                className="w-full bg-background border border-border rounded-lg p-2 text-xs"
              >
                <option value="paystack">Paystack (Africa / NGN / GHS / ZAR / KES)</option>
                <option value="flutterwave">Flutterwave (Pan-Africa / Mobile Money / Cards)</option>
                <option value="airwallex">Airwallex (Global USD / EUR / GBP Multi-Currency)</option>
                <option value="stripe">Stripe (Global Credit/Debit Cards)</option>
                <option value="custom">Custom / Other Gateway</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Display Name</label>
              <Input
                value={providerName}
                onChange={(e) => setProviderName(e.target.value)}
                placeholder="e.g. Paystack Payments"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Environment Mode</label>
                <select
                  value={providerEnv}
                  onChange={(e) => setProviderEnv(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs"
                >
                  <option value="sandbox">Sandbox / Test</option>
                  <option value="production">Live / Production</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Priority (1-100)</label>
                <Input
                  type="number"
                  value={providerPriority}
                  onChange={(e) => setProviderPriority(parseInt(e.target.value, 10) || 10)}
                  className="h-8 text-xs"
                />
              </div>
            </div>

            {/* Provider-specific Key Fields */}
            {(editingCode === 'paystack' || editingCode === 'flutterwave' || editingCode === 'stripe' || editingCode === 'custom') && (
              <div>
                <label className="font-semibold block mb-1">
                  Public Key / Publishable Key
                </label>
                <Input
                  value={providerPublicKey}
                  onChange={(e) => setProviderPublicKey(e.target.value)}
                  placeholder={editingCode === 'paystack' ? 'pk_test_... or pk_live_...' : editingCode === 'flutterwave' ? 'FLWPUBK_...' : 'pk_...'}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {(editingCode === 'paystack' || editingCode === 'flutterwave' || editingCode === 'stripe' || editingCode === 'custom') && (
              <div>
                <label className="font-semibold block mb-1">
                  Secret Key
                </label>
                <Input
                  type="password"
                  value={providerSecretKey}
                  onChange={(e) => setProviderSecretKey(e.target.value)}
                  placeholder={editingCode === 'paystack' ? 'sk_test_... or sk_live_...' : editingCode === 'flutterwave' ? 'FLWSECK_...' : 'sk_...'}
                  className="h-8 text-xs font-mono"
                />
              </div>
            )}

            {editingCode === 'airwallex' && (
              <>
                <div>
                  <label className="font-semibold block mb-1">Airwallex Client ID</label>
                  <Input
                    value={providerClientId}
                    onChange={(e) => setProviderClientId(e.target.value)}
                    placeholder="Enter Airwallex Client ID"
                    className="h-8 text-xs font-mono"
                  />
                </div>
                <div>
                  <label className="font-semibold block mb-1">Airwallex API Key</label>
                  <Input
                    type="password"
                    value={providerApiKey}
                    onChange={(e) => setProviderApiKey(e.target.value)}
                    placeholder="Enter Airwallex API Key"
                    className="h-8 text-xs font-mono"
                  />
                </div>
              </>
            )}

            <div>
              <label className="font-semibold block mb-1">Webhook Secret (Optional)</label>
              <Input
                type="password"
                value={providerWebhookSecret}
                onChange={(e) => setProviderWebhookSecret(e.target.value)}
                placeholder="Secret used to sign webhook events"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setConfigModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveProvider}
              disabled={savingProvider}
              className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold"
            >
              {savingProvider ? 'Saving...' : 'Save & Activate'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL: ADD ROUTING RULE */}
      <Dialog open={routeModalOpen} onOpenChange={setRouteModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <Shuffle weight="fill" className="h-5 w-5 text-[#2164b6]" />
              New Dynamic Routing Rule
            </DialogTitle>
            <DialogDescription className="text-xs">
              Define which gateway handles transactions for specific currencies, countries, or payment methods.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <label className="font-semibold block mb-1">Rule Name</label>
              <Input
                value={routeName}
                onChange={(e) => setRouteName(e.target.value)}
                placeholder="e.g. Nigeria Cards & Transfers"
                className="h-8 text-xs"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Transaction Type</label>
                <select
                  value={routeTxType}
                  onChange={(e) => setRouteTxType(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs"
                >
                  <option value="payment">Payment Collection</option>
                  <option value="payout">Creator Payout</option>
                  <option value="refund">Refund</option>
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Currency (or * for all)</label>
                <Input
                  value={routeCurrency}
                  onChange={(e) => setRouteCurrency(e.target.value.toUpperCase())}
                  placeholder="NGN, USD, KES, EUR, *"
                  className="h-8 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Country (ISO 2 or *)</label>
                <Input
                  value={routeCountry}
                  onChange={(e) => setRouteCountry(e.target.value.toUpperCase())}
                  placeholder="NG, US, KE, GB, *"
                  className="h-8 text-xs"
                />
              </div>

              <div>
                <label className="font-semibold block mb-1">Payment Method</label>
                <select
                  value={routeMethod}
                  onChange={(e) => setRouteMethod(e.target.value)}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs"
                >
                  <option value="*">Any Method (*)</option>
                  <option value="card">Card Only</option>
                  <option value="bank_transfer">Bank Transfer</option>
                  <option value="mobile_money">Mobile Money</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="font-semibold block mb-1">Primary Gateway</label>
                <select
                  value={routePrimaryId}
                  onChange={(e) => setRoutePrimaryId(parseInt(e.target.value, 10))}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs font-medium"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-semibold block mb-1">Fallback Gateway (Optional)</label>
                <select
                  value={routeFallbackId}
                  onChange={(e) => setRouteFallbackId(parseInt(e.target.value, 10))}
                  className="w-full bg-background border border-border rounded-lg p-2 text-xs"
                >
                  <option value={0}>None</option>
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>{p.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="font-semibold block mb-1">Priority Order (Lower = First)</label>
              <Input
                type="number"
                value={routePriority}
                onChange={(e) => setRoutePriority(parseInt(e.target.value, 10) || 10)}
                placeholder="10"
                className="h-8 text-xs"
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setRouteModalOpen(false)}>
              Cancel
            </Button>
            <Button
              size="sm"
              onClick={handleSaveRoute}
              disabled={savingRoute}
              className="bg-[#2164b6] hover:bg-[#1a5091] text-white font-bold"
            >
              {savingRoute ? 'Saving...' : 'Create Routing Rule'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default AdminPaymentProvidersPage;
