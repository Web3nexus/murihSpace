import { useState, useEffect, useCallback } from 'react';
import { 
  CreditCard, 
  RefreshCw, 
  CheckCircle2, 
  XCircle, 
  AlertTriangle, 
  Activity, 
  Cpu, 
  Shuffle, 
  DollarSign, 
  Server,
  Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
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

  // Simulator state
  const [simType, setSimType] = useState('payment');
  const [simCountry, setSimCountry] = useState('NG');
  const [simCurrency, setSimCurrency] = useState('NGN');
  const [simMethod, setSimMethod] = useState('card');
  const [simAmount, setSimAmount] = useState('500000'); // 5,000 NGN in kobo
  const [simResult, setSimResult] = useState<any | null>(null);
  const [simulating, setSimulating] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    setActionMsg(null);
    try {
      const [resProv, resRoutes, resStats] = await Promise.all([
        authFetch('/securegate/payment-providers', { headers: authHeaders() }),
        authFetch('/securegate/payment-routes', { headers: authHeaders() }),
        authFetch('/securegate/payments/stats', { headers: authHeaders() }),
      ]);

      if (resProv.ok) {
        const j = await resProv.json();
        setProviders(j?.data ?? []);
      }
      if (resRoutes.ok) {
        const j = await resRoutes.json();
        setRoutes(j?.data ?? []);
      }
      if (resStats.ok) {
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
    <div className="w-full mx-auto max-w-[1400px] space-y-6 p-6 lg:p-10">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-black tracking-tight flex items-center gap-2.5">
            <CreditCard className="h-6 w-6 text-[#2164b6] dark:text-[#7ab0ff]" />
            Payment Infrastructure & Gateways
          </h1>
          <p className="text-xs text-muted-foreground mt-1">
            Enterprise multi-gateway control hub: Airwallex, Paystack, Flutterwave, and Capability Routing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={loadData} disabled={loading} className="text-xs">
            <RefreshCw className={`h-3.5 w-3.5 mr-1.5 ${loading ? 'animate-spin' : ''}`} />
            Refresh Status
          </Button>
        </div>
      </div>

      {/* Action Messages */}
      {actionMsg && (
        <div
          className={`flex items-center gap-2 rounded-xl px-4 py-3 text-xs font-bold border ${
            actionMsg.ok
              ? 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20'
              : 'bg-destructive/10 text-destructive border-destructive/20'
          }`}
        >
          {actionMsg.ok ? <CheckCircle2 className="h-4 w-4 shrink-0" /> : <AlertTriangle className="h-4 w-4 shrink-0" />}
          {actionMsg.text}
        </div>
      )}

      {/* Metrics Summary Cards */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Total Volume</span>
              <DollarSign className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {(stats.total_volume_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">{stats.successful_count} successful transactions</div>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Platform Net Revenue</span>
              <Zap className="h-4 w-4 text-[#2164b6]" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {(stats.net_revenue_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">
              Fees: {(stats.total_fees_minor / 100).toLocaleString(undefined, { minimumFractionDigits: 2 })}
            </div>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Active Providers</span>
              <Server className="h-4 w-4 text-blue-500" />
            </div>
            <div className="text-xl font-black mt-2 text-foreground">
              {providers.filter((p) => p.is_enabled).length} / {providers.length}
            </div>
            <div className="text-[10px] text-muted-foreground mt-1">Airwallex, Paystack, Flutterwave</div>
          </div>

          <div className="bg-card border border-border p-4 rounded-2xl shadow-sm">
            <div className="flex items-center justify-between text-muted-foreground text-xs">
              <span>Health Status</span>
              <Activity className="h-4 w-4 text-emerald-500" />
            </div>
            <div className="text-xl font-black mt-2 text-emerald-500">
              {providers.every((p) => p.health_status === 'healthy') ? 'All Operational' : 'Attention Needed'}
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
          <Server className="h-3.5 w-3.5 mr-1.5" />
          Gateway Providers & Health
        </Button>
        <Button
          variant={activeTab === 'routes' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('routes')}
          className="text-xs"
        >
          <Shuffle className="h-3.5 w-3.5 mr-1.5" />
          Routing Rules Matrix
        </Button>
        <Button
          variant={activeTab === 'simulator' ? 'default' : 'ghost'}
          size="sm"
          onClick={() => setActiveTab('simulator')}
          className="text-xs"
        >
          <Cpu className="h-3.5 w-3.5 mr-1.5" />
          Capability Simulator
        </Button>
      </div>

      {/* TAB 1: PROVIDERS & HEALTH */}
      {activeTab === 'providers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {providers.map((p) => {
            const isProd = p.environment === 'production' || p.environment === 'live';
            const isHealthy = p.health_status === 'healthy';

            return (
              <div
                key={p.code}
                className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm flex flex-col justify-between"
              >
                <div className="p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-base text-foreground flex items-center gap-2">
                      <span>{p.name}</span>
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] font-bold uppercase tracking-wider ${
                        isHealthy ? 'border-emerald-500/30 text-emerald-500 bg-emerald-500/10' : 'border-rose-500/30 text-rose-500 bg-rose-500/10'
                      }`}
                    >
                      ● {p.health_status}
                    </Badge>
                  </div>

                  <div className="space-y-2.5 text-xs">
                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Status:</span>
                      <span className={`font-semibold ${p.is_enabled ? 'text-emerald-500' : 'text-muted-foreground'}`}>
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
                      <span className={`font-semibold ${p.credential_status === 'Configured' ? 'text-emerald-500' : 'text-rose-500'}`}>
                        {p.credential_status}
                      </span>
                    </div>

                    <div className="flex justify-between py-1 border-b border-border/50">
                      <span className="text-muted-foreground">Webhook Endpoint:</span>
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

                    {/* Capabilities Tags */}
                    <div>
                      <span className="text-muted-foreground block mb-1.5 font-medium">Confirmed Capabilities:</span>
                      <div className="flex flex-wrap gap-1">
                        {p.capabilities
                          .filter((c) => c.status === 'CONFIRMED')
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
                  </div>
                </div>

                {/* Card Footer Actions */}
                <div className="p-4 bg-muted/20 border-t border-border flex items-center justify-between gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs flex-1"
                    disabled={testingProvider === p.code}
                    onClick={() => handleTestConnection(p.code)}
                  >
                    <Activity className={`h-3.5 w-3.5 mr-1 ${testingProvider === p.code ? 'animate-spin' : ''}`} />
                    Test Connection
                  </Button>

                  <Button
                    variant="outline"
                    size="sm"
                    className="text-xs"
                    onClick={() => handleToggleEnvironment(p)}
                  >
                    {isProd ? 'Sandbox' : 'Production'}
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
      )}

      {/* TAB 2: ROUTING MATRIX */}
      {activeTab === 'routes' && (
        <div className="border border-border bg-card rounded-2xl overflow-hidden shadow-sm">
          <div className="px-6 py-4 border-b border-border bg-muted/10 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-bold text-foreground">Active Dynamic Provider Routes</h2>
              <p className="text-xs text-muted-foreground">
                Priority-ordered database rules. If primary gateway is unhealthy or unavailable, auto-routes to fallback.
              </p>
            </div>
          </div>

          <div className="divide-y divide-border">
            {routes.map((r) => (
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
                  <div className="text-xs text-muted-foreground flex items-center gap-3">
                    <span>Type: <b className="text-foreground">{r.transaction_type}</b></span>
                    <span>Country: <b className="text-foreground">{r.country_code}</b></span>
                    <span>Currency: <b className="text-foreground">{r.currency}</b></span>
                    <span>Method: <b className="text-foreground">{r.payment_method}</b></span>
                  </div>
                </div>

                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-right text-xs">
                    <div className="text-muted-foreground">Primary: <b className="text-emerald-500">{r.primary_provider.name}</b></div>
                    <div className="text-muted-foreground">
                      Fallback: {r.fallback_provider ? <b className="text-blue-400">{r.fallback_provider.name}</b> : 'None'}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 3: ROUTING SIMULATOR */}
      {activeTab === 'simulator' && (
        <div className="border border-border bg-card rounded-2xl p-6 shadow-sm max-w-2xl mx-auto space-y-6">
          <div>
            <h2 className="text-base font-bold flex items-center gap-2">
              <Cpu className="h-5 w-5 text-primary" /> Routing Engine Simulator
            </h2>
            <p className="text-xs text-muted-foreground mt-1">
              Simulate how the capability-based router resolves transactions before execution.
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
                <option value="payment">Payment Collection</option>
                <option value="payout">Creator Payout</option>
                <option value="refund">Refund</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1">Country (ISO 2)</label>
              <Input
                value={simCountry}
                onChange={(e) => setSimCountry(e.target.value.toUpperCase())}
                placeholder="NG, US, GB..."
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
                <option value="mobile_money">Mobile Money</option>
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

          <Button onClick={handleSimulate} disabled={simulating} className="w-full text-xs font-bold">
            {simulating ? 'Evaluating Capabilities...' : 'Run Simulation'}
          </Button>

          {simResult && (
            <div
              className={`p-4 rounded-xl border text-xs space-y-2 ${
                simResult.success ? 'bg-emerald-500/10 border-emerald-500/30' : 'bg-destructive/10 border-destructive/30'
              }`}
            >
              <div className="font-bold flex items-center gap-2">
                {simResult.success ? (
                  <>
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                    <span>Resolved Gateway: {simResult.provider_name} ({simResult.resolved_provider})</span>
                  </>
                ) : (
                  <>
                    <XCircle className="h-4 w-4 text-destructive" />
                    <span>Routing Unsuccessful</span>
                  </>
                )}
              </div>
              <p className="text-muted-foreground">
                {simResult.success
                  ? 'Criteria matched active routing rule with verified CONFIRMED capability.'
                  : simResult.message}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
export default AdminPaymentProvidersPage;
