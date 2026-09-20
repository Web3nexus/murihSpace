import { useCallback, useEffect, useState } from 'react';
import {
  CreditCard as CreditCard,
  CheckCircle as CheckCircle2,
  WarningCircle as AlertCircle,
  Globe as Globe,
  MapPin as MapPin,
  Package as Package,
  Spinner as Loader2,
} from '@phosphor-icons/react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { authFetch } from '@/lib/api/authFetch';

const API_BASE = (import.meta.env.VITE_API_BASE_URL || import.meta.env.VITE_API_URL) ?? 'http://localhost:8000/api/v1';

interface ShippingAddress {
  id: number;
  label: string;
  full_name: string;
  phone?: string;
  street_line1: string;
  street_line2?: string | null;
  city: string;
  state: string;
  postal_code?: string;
  country: string;
  type: string;
  is_default: boolean;
}

interface FulfilmentEstimate {
  subtotal: number;
  shipping_cost: number;
  platform_fee: number;
  tax: number;
  tax_rate?: number | null;
  tax_name?: string | null;
  tax_type?: string | null;
  tax_country_code?: string | null;
  currency: string;
  total: number;
}

interface PlacedOrder {
  id: number;
  order_number: string;
  total: number;
  currency: string;
  status: string;
}

interface PhysicalCheckoutModalProps {
  open: boolean;
  onClose: () => void;
  onPlaced: () => void;
}

type Step = 'review' | 'processing' | 'success' | 'error';

function formatMoney(cents: number | undefined, currency = 'NGN'): string {
  const amount = Number(cents ?? 0);
  if (isNaN(amount)) return `${currency} 0.00`;
  return `${(amount / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 }) } ${currency}`;
}

function formatCountry(code: string | null | undefined): string {
  if (!code) return '';
  return code.length === 2 ? code.toUpperCase() : code;
}

export function PhysicalCheckoutModal({ open, onClose, onPlaced }: PhysicalCheckoutModalProps) {
  const [step, setStep] = useState<Step>('review');
  const [addresses, setAddresses] = useState<ShippingAddress[]>([]);
  const [addressId, setAddressId] = useState<number | null>(null);
  const [estimate, setEstimate] = useState<FulfilmentEstimate | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [placing, setPlacing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  const loadAddresses = useCallback(async () => {
    try {
      const res = await authFetch(`/addresses`, {});
      if (res.ok) {
        const json = await res.json();
        const list = Array.isArray(json?.data?.data)
          ? json.data.data
          : Array.isArray(json?.data)
            ? json.data
            : [];
        setAddresses(list);
        const def = list.find((a: ShippingAddress) => a.is_default) ?? list[0];
        setAddressId((prev) => prev ?? (def?.id ?? null));
      }
    } catch {
      // address list is optional; checkout requires a chosen address
    }
  }, []);

  useEffect(() => {
    if (open) {
      setStep('review');
      setEstimate(null);
      setErrorMsg(null);
      setPlaced(null);
      loadAddresses();
    }
  }, [open, loadAddresses]);

  const fetchEstimate = useCallback(async (id: number) => {
    setEstimating(true);
    try {
      const res = await authFetch(`${API_BASE}/store/fulfilment/checkout-estimate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping_address_id: id }),
      });
      if (!res.ok) return;
      const json = await res.json();
      setEstimate(json?.data?.data ?? json?.data ?? null);
    } catch {
      // keep previous estimate
    } finally {
      setEstimating(false);
    }
  }, []);

  useEffect(() => {
    if (open && step === 'review' && addressId) {
      fetchEstimate(addressId);
    }
  }, [open, step, addressId, fetchEstimate]);

  const handlePlaceOrder = async () => {
    if (!addressId) {
      setErrorMsg('Please select a shipping address.');
      return;
    }
    setPlacing(true);
    setErrorMsg(null);
    try {
      const res = await authFetch(`/store/fulfilment/checkout`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipping_address_id: addressId }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.message ?? 'Checkout failed.');
      setPlaced({
        id: json.data?.data?.id ?? json.data?.id,
        order_number: json.data?.data?.order_number,
        total: json.data?.data?.total,
        currency: json.data?.data?.currency ?? 'NGN',
        status: json.data?.data?.status,
      });
      setStep('success');
      onPlaced();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'An error occurred during checkout.');
      setStep('error');
    } finally {
      setPlacing(false);
    }
  };

  const handleClose = () => {
    setStep('review');
    setEstimate(null);
    setErrorMsg(null);
    setPlaced(null);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-xl md:max-w-2xl bg-card border-border shadow-2xl rounded-lg p-4 sm:p-5">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <CreditCard weight="fill" className="h-5 w-5 text-secondary" />
            {step === 'success' ? 'Order Placed!' : 'Complete Your Checkout'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'success'
              ? 'Your order has been placed successfully.'
              : 'Review your order and complete checkout. VAT/GST is applied based on your shipping country.'}
          </DialogDescription>
        </DialogHeader>

        {step === 'review' && (
          <div className="space-y-4 py-2">
            {/* Shipping address */}
            <div>
              <label htmlFor="checkout-shipping-address" className="flex items-center gap-1.5 text-xs font-bold text-foreground uppercase tracking-wider">
                <MapPin weight="fill" className="w-3.5 h-3.5 text-secondary" /> Shipping Address
              </label>
              {addresses.length === 0 ? (
                <div className="mt-2 rounded-lg border-none bg-muted/20 px-3.5 py-3 text-xs text-muted-foreground flex items-center gap-2">
                  <AlertCircle weight="fill" className="h-4 w-4 shrink-0" />
                  No saved addresses found. Add one in your profile settings to check out.
                </div>
              ) : (
                <select
                  id="checkout-shipping-address"
                  value={addressId ?? ''}
                  onChange={(e) => setAddressId(Number(e.target.value))}
                  className="mt-1.5 w-full h-10 px-3 rounded-lg border border-border bg-background text-xs font-semibold text-foreground focus:outline-none focus:ring-2 focus:ring-secondary"
                >
                  {addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label} — {a.street_line1}, {a.city}, {a.state}, {a.country}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Total breakdown */}
            {estimate && (
              <div className="rounded-lg bg-muted/20 border-none px-3.5 py-3 text-xs space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground font-medium">Subtotal</span>
                  <span className="font-bold">{formatMoney(estimate.subtotal, estimate.currency)}</span>
                </div>
                {estimate.shipping_cost > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">Shipping</span>
                    <span className="font-bold">{formatMoney(estimate.shipping_cost, estimate.currency)}</span>
                  </div>
                )}
                {estimate.platform_fee > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">Handling fee</span>
                    <span className="font-bold">{formatMoney(estimate.platform_fee, estimate.currency)}</span>
                  </div>
                )}
                {estimate.tax > 0 && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground font-medium">
                      <Globe weight="fill" className="inline h-3 w-3 mr-1" />
                      {estimate.tax_name ?? 'VAT'} ({Number(estimate.tax_rate ?? 0)}%) · {formatCountry(estimate.tax_country_code)}
                    </span>
                    <span className="font-bold">{formatMoney(estimate.tax, estimate.currency)}</span>
                  </div>
                )}
                {estimate.tax === 0 && (
                  <div className="flex justify-between">
                    <span className="text-emerald-600 font-medium">No VAT applicable</span>
                    <span className="font-bold">{formatMoney(0, estimate.currency)}</span>
                  </div>
                )}
                <div className="flex justify-between border-t border-border pt-2">
                  <span className="text-muted-foreground font-bold">Total Charged</span>
                  <span className="font-black text-secondary">{formatMoney(estimate.total, estimate.currency)}</span>
                </div>
              </div>
            )}
            {estimating && (
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Loader2 weight="fill" className="h-3.5 w-3.5 animate-spin" /> Calculating totals and VAT...
              </div>
            )}

            {errorMsg && (
              <div className="flex items-start gap-2 rounded-lg bg-red-500/10 text-red-600 text-xs px-3.5 py-2.5 border border-red-500/20">
                <AlertCircle weight="fill" className="h-4 w-4 shrink-0 mt-0.5" />
                {errorMsg}
              </div>
            )}

            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                onClick={handleClose}
                disabled={placing}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={handlePlaceOrder}
                disabled={placing || !addressId}
                className="flex-[2] bg-secondary text-white hover:bg-secondary/90 font-bold inline-flex items-center justify-center gap-1.5"
              >
                {placing ? <Loader2 weight="fill" className="h-4 w-4 animate-spin" /> : <CreditCard weight="fill" className="h-4 w-4" />}
                Place Order{estimate ? ` · ${formatMoney(estimate.total, estimate.currency)}` : ''}
              </Button>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="flex flex-col items-center gap-3 py-10 text-center">
            <Loader2 weight="fill" className="w-8 h-8 animate-spin text-secondary" />
            <p className="text-sm text-muted-foreground">Placing your order...</p>
          </div>
        )}

        {step === 'success' && placed && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-emerald-500/15 flex items-center justify-center">
              <CheckCircle2 weight="fill" className="h-8 w-8 text-emerald-500" />
            </div>
            <h3 className="text-lg font-bold text-foreground">Thank you!</h3>
            <p className="text-xs text-muted-foreground">
              Order <span className="font-bold text-foreground">#{placed.order_number}</span> has been placed
              ({formatMoney(placed.total, placed.currency)}). The seller has been notified.
            </p>
            <Button onClick={handleClose} className="mt-2 bg-secondary text-white hover:bg-secondary/90 font-bold">
              <Package weight="fill" className="h-4 w-4 mr-1.5" /> Done
            </Button>
          </div>
        )}

        {step === 'error' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <div className="h-14 w-14 rounded-full bg-red-500/15 flex items-center justify-center">
              <AlertCircle weight="fill" className="h-8 w-8 text-red-500" />
            </div>
            <p className="text-sm text-red-600">{errorMsg ?? 'Checkout failed. Please try again.'}</p>
            <Button onClick={() => setStep('review')} variant="outline" className="bg-secondary text-white hover:bg-secondary/90 border-none">
              Back to review
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}