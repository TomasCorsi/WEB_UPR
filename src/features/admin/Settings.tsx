import { useEffect, useState, type FormEvent } from "react";
import { db } from "../../lib/supabase";
import { useStore } from "../../lib/store";
import { Notice } from "../../components/UI";
import type { Settings as StoreSettings } from "../../types";
export default function Settings() {
  const { settings, refresh } = useStore();
  const [form, setForm] = useState<StoreSettings>(settings);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setForm(settings), [settings]);
  function field(key: keyof StoreSettings, value: unknown) {
    setForm((f) => ({ ...f, [key]: value }));
  }
  async function save(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError("");
    setMessage("");
    const { error } = await db()
      .from("store_settings")
      .update(form)
      .eq("id", true);
    if (error)
      setError(
        "No pudimos guardar. Revisá el enlace de Instagram y el número de WhatsApp.",
      );
    else {
      await refresh();
      setMessage("Configuración guardada.");
    }
    setBusy(false);
  }
  return (
    <>
      <div className="eyebrow">A TU MANERA</div>
      <h1>Configuración.</h1>
      <form onSubmit={save}>
        <div className="panel">
          <h2>El evento</h2>
          <div className="form-grid">
            {[
              ["event_name", "Nombre del evento"],
              ["event_date", "Fecha"],
              ["event_location", "Lugar"],
              ["whatsapp", "WhatsApp con código de país"],
              ["instagram", "Instagram (https://instagram.com/…)"],
            ].map(([key, label]) => (
              <label key={key}>
                {label}
                <input
                  value={String(form[key as keyof StoreSettings])}
                  onChange={(e) =>
                    field(key as keyof StoreSettings, e.target.value)
                  }
                />
              </label>
            ))}
          </div>
          <label>
            Mensaje de retiro
            <textarea
              value={form.pickup_message}
              onChange={(e) => field("pickup_message", e.target.value)}
              required
            />
          </label>
          <label className="checkbox">
            <input
              type="checkbox"
              checked={form.sales_enabled}
              onChange={(e) => field("sales_enabled", e.target.checked)}
            />{" "}
            Habilitar ventas online
          </label>
        </div>
        <div className="panel">
          <h2>Guía de talles</h2>
          <p>
            Medidas oficiales en centímetros. Agregá los talles que necesites.
          </p>
          {form.size_guide.map((row, index) => (
            <div className="size-row" key={index}>
              {(["size", "width", "length"] as const).map((key) => (
                <label key={key}>
                  {key === "size"
                    ? "Talle"
                    : key === "width"
                      ? "Ancho"
                      : "Largo"}
                  <input
                    required
                    value={row[key]}
                    onChange={(e) =>
                      field(
                        "size_guide",
                        form.size_guide.map((r, i) =>
                          i === index ? { ...r, [key]: e.target.value } : r,
                        ),
                      )
                    }
                  />
                </label>
              ))}
              <button
                type="button"
                className="text-button"
                onClick={() =>
                  field(
                    "size_guide",
                    form.size_guide.filter((_, i) => i !== index),
                  )
                }
              >
                Eliminar
              </button>
            </div>
          ))}
          <button
            type="button"
            className="button outline"
            onClick={() =>
              field("size_guide", [
                ...form.size_guide,
                { size: "", width: "", length: "" },
              ])
            }
          >
            + AGREGAR TALLE
          </button>
        </div>
        <div className="panel">
          <h2>Información de la tienda</h2>
          <p>
            Completá los textos de tu organización antes de habilitar las
            ventas.
          </p>
          {[
            ["returns_text", "Cambios y devoluciones"],
            ["privacy_text", "Privacidad"],
            ["terms_text", "Términos y condiciones"],
          ].map(([key, label]) => (
            <label key={key}>
              {label}
              <textarea
                rows={5}
                value={String(form[key as keyof StoreSettings])}
                onChange={(e) =>
                  field(key as keyof StoreSettings, e.target.value)
                }
              />
            </label>
          ))}
        </div>
        {error && <Notice error>{error}</Notice>}
        {message && <Notice>{message}</Notice>}
        <button className="button primary" disabled={busy}>
          {busy ? "GUARDANDO…" : "GUARDAR CONFIGURACIÓN"}
        </button>
      </form>
    </>
  );
}
