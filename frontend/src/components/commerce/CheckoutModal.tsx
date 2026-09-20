import { useCallback, useEffect, useState } from 'react';
import {
  ShoppingCart as ShoppingCart,
  CreditCard as CreditCard,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  DownloadSimple as Download,
  Spinner as Loader2,
  Package as Package,
  Tag as Tag,
  Lightning as Zap,
  Globe as Globe
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { DigitalProduct } from '@/types/digitalProduct';
import type { CheckoutEstimate, CheckoutResult, PaymentProvider } from '@/types/order';
import { getAuthToken } from '@/lib/auth/token';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';
const PLATFORM_FEE_RATE = 0.10;

interface CountryOption {
  iso2: string;
  iso3: string;
  name: string;
  flag?: string;
}

interface CheckoutModalProps {
  product: DigitalProduct;
  open: boolean;
  onClose: () => void;
}

type Step = 'review' | 'processing' | 'success' | 'error';

function formatMoney(value: number | undefined, currency: string): string {
  const amount = Number(value ?? 0);
  if (isNaN(amount)) return `${currency} 0.00`;
  return `${currency} ${amount.toFixed(2)}`;
}

export function CheckoutModal({ product, open, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState<Step>('review');
  const [provider, setProvider] = useState<PaymentProvider>('mock');
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [countries, setCountries] = useState<CountryOption[]>([]);
  const [countryCode, setCountryCode] = useState<string>('');
  const [estimate, setEstimate] = useState<CheckoutEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);

  const currency = product.currency ?? 'USD';

  const clientSubtotal = product.is_free ? 0 : Number(product.price);
  const clientPlatformFee = product.is_free ? 0 : Math.round(clientSubtotal * PLATFORM_FEE_RATE * 100) / 100;
  const clientTotal = product.is_free ? 0 : Math.round((clientSubtotal + clientPlatformFee) * 100) / 100;

  const hasServerEstimate = !product.is_free && !!estimate;
  const subtotal = hasServerEstimate ? estimate.subtotal : clientSubtotal;
  const platformFee = hasServerEstimate ? estimate.platform_fee : clientPlatformFee;
  const taxAmount = hasServerEstimate ? (estimate.tax ?? 0) : 0;
  const total = hasServerEstimate ? estimate.total : clientTotal;

  const loadCountries = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/countries`, {
        headers: { Accept: 'application/json' },
      });
      if (!res.ok) return;
      const json = await res.json();
      const data = Array.isArray(json?.data) ? json.data : [];
      setCountries(
        data.map((c: CountryOption) => ({
          iso2: c.iso2,
          iso3: c.iso3,
          name: c.name,
          flag: c.flag,
        }))
      );
    } catch {
      // Countries are optional; server falls back to the buyer's profile country.
    }
  }, []);

  const fetchEstimate = useCallback(
    async (code: string) => {
      setEstimating(true);
      try {
        const token = getAuthToken();
        const res = await fetch(`${API_BASE}/checkout/estimate`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ product_id: product.id, country_code: code }),
        });
        if (!res.ok) return;
        const json = await res.json();
        setEstimate(json?.data?.data ?? null);
      } catch {
        // Fall back to client-side fee calc if the estimate is unreachable.
      } finally {
        setEstimating(false);
      }
    },
    [product.id]
  );

  useEffect(() => {
    if (open) {
      loadCountries();
    }
  }, [open, loadCountries]);

  useEffect(() => {
    if (open && !product.is_free && countryCode) {
      fetchEstimate(countryCode);
    }
  }, [open, product.is_free, countryCode, fetchEstimate]);

  const handlePurchase = async () => {
    setStep('processing');
    setErrorMsg(null);

    const token = getAuthToken();
    const idempotencyKey = `${product.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`;

    try {
      // Step 1: Create checkout intent
      const intentRes = await fetch(`${API_BASE}/checkout/intent`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Accept: 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          product_id: product.id,
          payment_provider: provider,
          idempotency_key: idempotencyKey,
          country_code: countryCode || undefined,
        }),
      });

      const intentJson = await intentRes.json();
      if (!intentRes.ok) throw new Error(intentJson.message ?? 'Checkout failed.');

      const payload = intentJson.data ?? {};
      if (payload.is_free) {
        setResult({ order: payload.order, is_free: true });
        setStep('success');
        return;
      }

      const orderId = payload?.data?.order?.id ?? payload?.order?.id;
      if (!orderId) throw new Error('Order ID missing from intent response.');

      // Step 2: Complete mock payment (test mode)
      if (provider === 'mock') {
        const completeRes = await fetch(`${API_BASE}/checkout/complete-mock`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({ order_id: orderId }),
        });

        const completeJson = await completeRes.json();
        if (!completeRes.ok) throw new Error(completeJson.message ?? 'Payment completion failed.');

        // Step 3: Get full receipt
        const receiptRes = await fetch(`${API_BASE}/orders/${orderId}/receipt`, {
          headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });

        const receiptJson = await receiptRes.json();
        setResult({ order: receiptJson.data, breakdown: payload.data?.breakdown ?? payload.breakdown });
        setStep('success');
      }
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during checkout.');
      setStep('error');
    }
  };

  const handleClose = () => {
    setStep('review');
    setResult(null);
    setErrorMsg(null);
    setEstimate(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl bg-card border-border shadow-2xl rounded-lg p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingCart weight="fill" className="h-5 w-5 text-secondary" />
            {step === 'success' ? 'Purchase Complete!' : 'Complete Your Purchase'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'success'
              ? 'Your digital product is ready to download.'
              : 'Review your order and complete checkout securely. VAT/GST is applied based on your billing country.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-4 py-2">
            {/* Product Card */}
            <div className="flex items-center gap-3 p-3.5 rounded-lg border-none bg-muted/20">
              <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted shrink-0">
                {product.cover_url ? (
                  <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package weight="fill" className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{product.title}</h4>
                <span className="text-[10px] font-semibold text-secondary capitalize">{product.category}</span>
              </div>
              <span className="text-sm font-black text-foreground shrink-0">
                {product.is_free ? 'FREE' : formatMoney(clientSubtotal, currency)}
              </span>
            </div>

            {/* Price Breakdown (with country-based VAT) */}
            {!product.is_free && (
              <>
                {/* Billing Country */}
                <div className="space-y-1.5">
                  <label
                    htmlFor="checkout-billing-country"
                    className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider"
                  >
                    <Globe weight="fill" className="h-3.5 w-3.5 text-secondary" /> Billing Country
                  </label>
                  <select
                    id="checkout-billing-country"
                    value={countryCode}
                    onChange={(e) => {
                      setCountryCode(e.target.value);
                      setEstimate(null);
                    }}
                    className="w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-secondary/50"
                  >
                    <option value="">Select a country…</option>
                    {countries.map((c) => (
                      <option key={c.iso2} value={c.iso2}>
                        {c.flag ? `${c.flag} ` : ''}{c.name} ({c.iso2})
                      </option>
                    ))}
                    {countryCode && !countries.some((c) => c.iso2 === countryCode) && (
                      <option value={countryCode}>{countryCode}</option>
                    )}
                  </select>
                  <p className="text-[10px] text-muted-foreground">
                    Tax is calculated at the statutory rate for this country. Leave empty to use your profile country.
                  </p>
                </div>

                {/* Breakdown */}
                <div className="p-3.5 rounded-lg border-none bg-muted/10 space-y-2 text-xs">
                  <div className="flex justify-between text-muted-foreground">
                    <span>Subtotal</span>
                    <span>{formatMoney(subtotal, currency)}</span>
                  </div>
                  <div className="flex justify-between text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Tag weight="fill" className="h-3 w-3" /> Platform fee (10%)
                    </span>
                    <span>{formatMoney(platformFee, currency)}</span>
                  </div>
                  {estimating && (
                    <div className="flex justify-between text-muted-foreground">
                      <span>Calculating tax…</span>
                      <span className="animate-pulse">—</span>
                    </div>
                  )}
                  {!estimating && hasServerEstimate && estimate.tax != null && (estimate.tax !== 0 || estimate.tax_name) && (
                    <div className="flex justify-between text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Tag weight="fill" className="h-3 w-3" />
                        {estimate.tax_name ?? 'Tax'}{estimate.tax_rate != null ? ` (${Number(estimate.tax_rate)}%)` : ''}
                      </span>
                      <span>{formatMoney(taxAmount, currency)}</span>
                    </div>
                  )}
                  <div className="flex justify-between font-extrabold text-foreground border-t border-border pt-2">
                    <span>Total</span>
                    <span className="text-secondary">{formatMoney(total, currency)}</span>
                  </div>
                </div>
              </>
            )}

            {/* Payment Method Selector */}
            {!product.is_free && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Payment Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mock' as const, label: 'Test Payment', icon: <Zap weight="fill" className="h-4 w-4" /> },
                    { value: 'stripe' as const, label: 'Credit Card', icon: <CreditCard weight="fill" className="h-4 w-4" />, disabled: true },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && setProvider(opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-lg border text-xs font-semibold transition-all ${
                        provider === opt.value
                          ? 'border-secondary bg-secondary/15 text-secondary'
                          : 'border-border bg-muted/20 text-muted-foreground'
                      } ${opt.disabled ? 'opacity-40 cursor-not-allowed' : 'hover:border-secondary/50'}`}
                    >
                      {opt.icon}
                      {opt.label}
                      {opt.disabled && <span className="text-[9px] ml-auto">Soon</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <Button
              onClick={handlePurchase}
              className="w-full text-xs font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground h-10 rounded-lg gap-2"
            >
              {product.is_free ? (
                <><Download weight="fill" className="h-4 w-4" /> Download Free Product</>
              ) : (
                <><ShoppingCart weight="fill" className="h-4 w-4" /> Pay {formatMoney(total, currency)}</>
              )}
            </Button>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 weight="fill" className="h-10 w-10 animate-spin text-secondary mx-auto" />
            <p className="text-sm font-bold text-foreground">Processing your payment…</p>
            <p className="text-xs text-muted-foreground">Please wait, do not close this window.</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 weight="fill" className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Order #{result?.order?.order_number}</h3>
              <p className="text-xs text-muted-foreground mt-1">{product.title}</p>
              {result?.order?.tax != null && result.order.tax > 0 && (
                <p className="text-[10px] text-muted-foreground mt-1">
                  {result.order.tax_name ?? 'VAT'} ({Number(result.order.tax_rate)}%) applied: {formatMoney(result.order.tax, result.order.currency ?? currency)}
                </p>
              )}
            </div>

            {result?.order?.download_url && (
              <a
                href={`${API_BASE}/products/${result.order.product_id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-secondary text-secondary-foreground text-xs font-bold hover:bg-secondary/90 transition-colors"
              >
                <Download weight="fill" className="h-4 w-4" />
                Download Your Product
              </a>
            )}

            <Button variant="outline" size="sm" onClick={handleClose} className="text-xs font-semibold w-full rounded-lg">
              Close
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertCircle weight="fill" className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Payment Failed</h3>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} className="flex-1 text-xs font-semibold rounded-lg">
                Cancel
              </Button>
              <Button size="sm" onClick={() => setStep('review')} className="flex-1 text-xs font-bold bg-secondary text-secondary-foreground rounded-lg">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}