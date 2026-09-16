export interface Variant {
  id: string;
  product_id: string;
  color: string;
  color_hex: string;
  size: string;
  sku: string;
  stock: number;
  reserved: number;
  active: boolean;
}
export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  color: string | null;
  position: number;
}
export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string;
  price: number;
  active: boolean;
  featured: boolean;
  product_variants: Variant[];
  product_images: ProductImage[];
}
export interface SizeRow {
  size: string;
  width: string;
  length: string;
}
export interface Settings {
  id: boolean;
  event_name: string;
  event_date: string;
  event_location: string;
  instagram: string;
  whatsapp: string;
  sales_enabled: boolean;
  pickup_message: string;
  size_guide: SizeRow[];
  returns_text: string;
  privacy_text: string;
  terms_text: string;
}
export interface CartLine {
  variant_id: string;
  quantity: number;
}
export interface OrderItem {
  id: string;
  product_name: string;
  color: string;
  size: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
}
export interface Order {
  id: string;
  order_number: string;
  customer_name: string;
  customer_last_name: string;
  email: string;
  phone: string;
  total: number;
  status: "pending" | "paid" | "delivered" | "cancelled";
  payment_status: string;
  created_at: string;
  paid_at: string | null;
  delivered_at: string | null;
  order_items: OrderItem[];
  review_required: boolean;
  stock_applied?: boolean;
  preference_state?: "new" | "creating" | "ready" | "uncertain";
  payment_events?: {
    payment_id: string;
    status: string;
    review_reason: string | null;
  }[];
}
