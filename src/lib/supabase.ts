import { createClient } from "@supabase/supabase-js";
const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
export const configured = Boolean(url && key);
export const supabase = configured ? createClient(url, key) : null;
export function db() {
  if (!supabase) throw new Error("La tienda todavía no está conectada.");
  return supabase;
}
export async function invoke<T>(name: string, body: object): Promise<T> {
  const { data, error } = await db().functions.invoke(name, { body });
  if (error) {
    let message = "No pudimos completar la operación. Volvé a intentarlo.";
    try {
      const detail = await error.context.json();
      if (typeof detail.error === "string") message = detail.error;
    } catch {
      /* network failure */
    }
    throw new Error(message);
  }
  return data as T;
}
export const money = (value: number) =>
  new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency: "ARS",
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(value);
export const whatsappUrl = (phone: string, text: string) =>
  `https://wa.me/${phone.replace(/\D/g, "")}?text=${encodeURIComponent(text)}`;
