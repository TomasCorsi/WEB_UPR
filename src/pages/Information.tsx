import { Link, useParams } from "react-router-dom";
import { useStore } from "../lib/store";
import { whatsappUrl } from "../lib/supabase";
import { Notice, Pickup } from "../components/UI";
export default function Information() {
  const { kind } = useParams();
  const { settings: s } = useStore();
  const data: Record<string, { title: string; text: string }> = {
    cambios: { title: "Cambios y devoluciones", text: s.returns_text },
    privacidad: { title: "Privacidad", text: s.privacy_text },
    terminos: { title: "Términos y condiciones", text: s.terms_text },
    contacto: {
      title: "Hablemos.",
      text: "Escribinos por consultas sobre tu remera o tu pedido.",
    },
    arrepentimiento: {
      title: "Botón de arrepentimiento",
      text: "Contactanos para solicitar la cancelación de tu compra. Indicá el número de pedido y el email con el que compraste.",
    },
  };
  const info = data[kind || ""];
  return (
    <div className="container page prose">
      <Link className="back" to="/">
        ← Volver a la tienda
      </Link>
      <h1>{info?.title || "Página no encontrada"}</h1>
      {info?.text ? (
        <p className="pre-wrap">{info.text}</p>
      ) : (
        <Notice>
          Esta información está pendiente de publicación por la organización.
          Consultanos antes de comprar.
        </Notice>
      )}
      {s.whatsapp ? (
        <a
          className="button primary"
          href={whatsappUrl(
            s.whatsapp,
            kind === "arrepentimiento"
              ? "Hola! Quiero solicitar la cancelación de mi compra. Mi número de pedido es: "
              : "Hola! Tengo una consulta sobre UPR 2026.",
          )}
          target="_blank"
          rel="noreferrer"
        >
          CONTACTAR POR WHATSAPP ↗
        </a>
      ) : (
        <p>El canal de contacto se publicará próximamente.</p>
      )}
      <Pickup compact />
    </div>
  );
}
