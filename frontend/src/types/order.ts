export type OrderStatus = 'pending' | 'processing' | 'completed' | 'failed' | 'refunded';
export type PaymentProvider = 'stripe' | 'paypal' | 'mock';

export interface Order {
  id: number;
  order_number: string;
  buyer_id: number;
  creator_id: number;
  product_id: number;
  subtotal: number;
  platform_fee: number;
  total: number;
  currency: string;
  status: OrderStatus;
  payment_provider: PaymentProvider;
  payment_intent_id?: string;
  paid_at?: string;
  created_at: string;
  product?: {
    id: number;
    title: string;
    slug: string;
    cover_url?: string;
    category: string;
    file_original_name?: string;
  };
  buyer?: { id: number; name: string; username: string };
  creator?: { id: number; name: string; username: string };
  download_url?: string;
}

export interface CreatorSaleRow extends Order {
  net_payout: number;
}

export interface CheckoutIntentPayload {
  product_id: number;
  payment_provider?: PaymentProvider;
  idempotency_key: string;
}

export interface CheckoutBreakdown {
  subtotal: number;
  platform_fee: number;
  total: number;
  currency: string;
}

export interface CheckoutResult {
  order: Order;
  intent?: { provider: string; intent_id: string };
  breakdown?: CheckoutBreakdown;
  is_free?: boolean;
}
