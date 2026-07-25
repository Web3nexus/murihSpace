import { useState } from 'react';
import {
  ShoppingCart,
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Download,
  Loader2,
  Package,
  Tag,
  Zap,
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import type { DigitalProduct } from '@/types/digitalProduct';
import type { CheckoutResult, PaymentProvider } from '@/types/order';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:8000/api/v1';
const PLATFORM_FEE_RATE = 0.10;

interface CheckoutModalProps {
  product: DigitalProduct;
  open: boolean;
  onClose: () => void;
}

type Step = 'review' | 'processing' | 'success' | 'error';

export function CheckoutModal({ product, open, onClose }: CheckoutModalProps) {
  const [step, setStep] = useState<Step>('review');
  const [provider, setProvider] = useState<PaymentProvider>('mock');
  const [result, setResult] = useState<CheckoutResult | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const subtotal = product.is_free ? 0 : Number(product.price);
  const platformFee = product.is_free ? 0 : Math.round(subtotal * PLATFORM_FEE_RATE * 100) / 100;
  const total = product.is_free ? 0 : Math.round((subtotal + platformFee) * 100) / 100;
  const currency = product.currency ?? 'USD';

  const handlePurchase = async () => {
    setStep('processing');
    setErrorMsg(null);

    const token = localStorage.getItem('auth_token');
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
        }),
      });

      const intentJson = await intentRes.json();
      if (!intentRes.ok) throw new Error(intentJson.message ?? 'Checkout failed.');

      if (intentJson.is_free) {
        setResult(intentJson);
        setStep('success');
        return;
      }

      const orderId = intentJson.data?.order?.id;
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
        setResult({ order: receiptJson.data, breakdown: intentJson.data?.breakdown });
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
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[460px] bg-card border-border shadow-2xl rounded-2xl">
        <DialogHeader>
          <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
            <ShoppingCart className="h-5 w-5 text-secondary" />
            {step === 'success' ? 'Purchase Complete!' : 'Complete Your Purchase'}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground">
            {step === 'success'
              ? 'Your digital product is ready to download.'
              : 'Review your order and complete checkout securely.'}
          </DialogDescription>
        </DialogHeader>

        {/* Step: Review */}
        {step === 'review' && (
          <div className="space-y-4 py-2">
            {/* Product Card */}
            <div className="flex items-center gap-3 p-3.5 rounded-2xl border border-border bg-muted/20">
              <div className="h-12 w-12 rounded-xl overflow-hidden bg-muted shrink-0">
                {product.cover_url ? (
                  <img src={product.cover_url} alt={product.title} className="w-full h-full object-cover" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-bold text-foreground truncate">{product.title}</h4>
                <span className="text-[10px] font-semibold text-secondary capitalize">{product.category}</span>
              </div>
              <span className="text-sm font-black text-foreground shrink-0">
                {product.is_free ? 'FREE' : `$${subtotal.toFixed(2)}`}
              </span>
            </div>

            {/* Price Breakdown */}
            {!product.is_free && (
              <div className="p-3.5 rounded-2xl border border-border bg-muted/10 space-y-2 text-xs">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span>${subtotal.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" /> Platform fee (10%)
                  </span>
                  <span>${platformFee.toFixed(2)} {currency}</span>
                </div>
                <div className="flex justify-between font-extrabold text-foreground border-t border-border pt-2">
                  <span>Total</span>
                  <span className="text-secondary">${total.toFixed(2)} {currency}</span>
                </div>
              </div>
            )}

            {/* Payment Method Selector */}
            {!product.is_free && (
              <div className="space-y-2">
                <span className="text-xs font-bold text-foreground uppercase tracking-wider">
                  Payment Method
                </span>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { value: 'mock' as const, label: 'Test Payment', icon: <Zap className="h-4 w-4" /> },
                    { value: 'stripe' as const, label: 'Credit Card', icon: <CreditCard className="h-4 w-4" />, disabled: true },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      disabled={opt.disabled}
                      onClick={() => !opt.disabled && setProvider(opt.value)}
                      className={`flex items-center gap-2 p-3 rounded-xl border text-xs font-semibold transition-all ${
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
              className="w-full text-xs font-bold bg-secondary hover:bg-secondary/90 text-secondary-foreground h-10 rounded-xl shadow-md gap-2"
            >
              {product.is_free ? (
                <><Download className="h-4 w-4" /> Download Free Product</>
              ) : (
                <><ShoppingCart className="h-4 w-4" /> Pay ${total.toFixed(2)} {currency}</>
              )}
            </Button>
          </div>
        )}

        {/* Step: Processing */}
        {step === 'processing' && (
          <div className="py-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 animate-spin text-secondary mx-auto" />
            <p className="text-sm font-bold text-foreground">Processing your payment…</p>
            <p className="text-xs text-muted-foreground">Please wait, do not close this window.</p>
          </div>
        )}

        {/* Step: Success */}
        {step === 'success' && (
          <div className="py-6 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mx-auto">
              <CheckCircle2 className="h-8 w-8 text-emerald-500" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Order #{result?.order?.order_number}</h3>
              <p className="text-xs text-muted-foreground mt-1">{product.title}</p>
            </div>

            {result?.order?.download_url && (
              <a
                href={`${API_BASE}/products/${result.order.product_id}/download`}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-secondary text-secondary-foreground text-xs font-bold shadow-md hover:bg-secondary/90 transition-colors"
              >
                <Download className="h-4 w-4" />
                Download Your Product
              </a>
            )}

            <Button variant="outline" size="sm" onClick={handleClose} className="text-xs font-semibold w-full rounded-xl">
              Close
            </Button>
          </div>
        )}

        {/* Step: Error */}
        {step === 'error' && (
          <div className="py-8 text-center space-y-4">
            <div className="h-16 w-16 rounded-full bg-destructive/10 border border-destructive/20 flex items-center justify-center mx-auto">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
            <div>
              <h3 className="text-base font-bold text-foreground">Payment Failed</h3>
              <p className="text-xs text-muted-foreground mt-1">{errorMsg}</p>
            </div>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={handleClose} className="flex-1 text-xs font-semibold rounded-xl">
                Cancel
              </Button>
              <Button size="sm" onClick={() => setStep('review')} className="flex-1 text-xs font-bold bg-secondary text-secondary-foreground rounded-xl">
                Try Again
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
