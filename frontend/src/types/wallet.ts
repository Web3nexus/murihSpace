export interface Wallet {
  id: number;
  balance: number;
  currency: string;
  formatted: string;
  has_pin: boolean;
  status: string;
}

export interface LedgerEntry {
  id: number;
  type: string;
  entry_type: 'debit' | 'credit';
  amount: number;
  currency: string;
  formatted: string;
  balance_before: number;
  balance_after: number;
  description: string | null;
  created_at: string;
}

export interface Transfer {
  id: number;
  sender_id: number;
  recipient_id: number;
  amount: number;
  currency: string;
  note: string | null;
  status: string;
  created_at: string;
  sender?: { id: number; name: string; username: string };
  recipient?: { id: number; name: string; username: string };
}

export interface Donation {
  id: number;
  sender_id: number;
  recipient_id: number;
  amount: number;
  currency: string;
  message: string | null;
  is_anonymous: boolean;
  status: string;
  created_at: string;
  sender?: { id: number; name: string; username: string };
  recipient?: { id: number; name: string; username: string };
}

export interface WithdrawalRequest {
  id: number;
  user_id: number;
  amount: number;
  currency: string;
  status: string;
  rejection_reason: string | null;
  processed_by: number | null;
  processed_at: string | null;
  created_at: string;
}

export interface Purchase {
  id: number;
  user_id: number;
  product_id: number;
  download_count: number;
  last_downloaded_at: string | null;
  created_at: string;
  product?: {
    id: number;
    title: string;
    slug: string;
    cover_url?: string;
    category: string;
    file_original_name?: string;
    file_mime_type?: string;
    file_size_bytes?: number;
  };
  order?: {
    id: number;
    order_number: string;
    status: string;
    currency: string;
  };
}

export interface WalletPinPayload {
  pin: string;
}

export interface TransferPayload {
  recipient_username: string;
  amount: number;
  currency?: string;
  note?: string;
  pin: string;
}

export interface DonationPayload {
  recipient_username: string;
  amount: number;
  currency?: string;
  message?: string;
  is_anonymous?: boolean;
  pin: string;
}

export interface WithdrawalPayload {
  amount: number;
  currency?: string;
  pin: string;
}
