export type ProductCategory =
  | 'ebook'
  | 'template'
  | 'course'
  | 'audio'
  | 'graphics'
  | 'other';

export type ProductStatus = 'draft' | 'published';

export interface DigitalProduct {
  id: number;
  creator_id: number;
  title: string;
  slug: string;
  description?: string;
  cover_url?: string;
  price: number;
  currency: string;
  is_free: boolean;
  status: ProductStatus;
  category: ProductCategory;
  file_original_name?: string;
  file_mime_type?: string;
  file_size_bytes?: number;
  download_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateProductPayload {
  title: string;
  description?: string;
  cover_url?: string;
  price: number;
  currency?: string;
  is_free: boolean;
  category: ProductCategory;
  status?: ProductStatus;
  file?: File;
}
