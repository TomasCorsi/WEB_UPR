import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { configured, db } from "./supabase";
import type { Product, Settings } from "../types";
export const defaultSettings: Settings = {
  id: true,
  event_name: "UPR 2026",
  event_date: "",
  event_location: "",
  instagram: "",
  whatsapp: "",
  sales_enabled: false,
  pickup_message:
    "Todas las compras se retiran personalmente el día de UPR 2026.",
  size_guide: [],
  returns_text: "",
  privacy_text: "",
  terms_text: "",
};
interface Store {
  products: Product[];
  settings: Settings;
  loading: boolean;
  error: string;
  refresh: () => Promise<void>;
}
const Context = createContext<Store | null>(null);
export function StoreProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [settings, setSettings] = useState(defaultSettings);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const refresh = useCallback(async () => {
    if (!configured) return;
    setError("");
    try {
      const [p, s] = await Promise.all([
        db()
          .from("products")
          .select("*, product_variants(*), product_images(*)")
          .eq("active", true)
          .order("featured", { ascending: false })
          .order("created_at"),
        db().from("store_settings").select("*").single(),
      ]);
      if (p.error || s.error) throw new Error();
      setProducts(p.data as Product[]);
      setSettings(s.data as Settings);
    } catch {
      setError(
        "No pudimos cargar la tienda. Revisá tu conexión e intentá nuevamente.",
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void refresh();
    const onFocus = () => {
      void refresh();
    };
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);
  return (
    <Context.Provider value={{ products, settings, loading, error, refresh }}>
      {children}
    </Context.Provider>
  );
}
export function useStore() {
  const value = useContext(Context);
  if (!value) throw new Error("StoreProvider missing");
  return value;
}
