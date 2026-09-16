import { Link, NavLink, Outlet, useLocation } from "react-router-dom";
import { ShoppingBag, ArrowUpRight } from "lucide-react";
import { useEffect, useState } from "react";
import { useCart } from "../features/cart/CartContext";
import { useStore } from "../lib/store";
import { whatsappUrl } from "../lib/supabase";
import { SizeGuide } from "./UI";
export default function Layout() {
  const [guide, setGuide] = useState(false);
  const { lines } = useCart();
  const { settings } = useStore();
  const location = useLocation();
  useEffect(() => {
    if (!location.hash) window.scrollTo(0, 0);
    else
      setTimeout(
        () =>
          document
            .querySelector(location.hash)
            ?.scrollIntoView({ behavior: "smooth" }),
        100,
      );
  }, [location]);
  return (
    <>
      <div className="announcement">
        EL EVENTO SE VIVE. LA REMERA QUEDA. <span>UPR 2026 ↗</span>
      </div>
      <header>
        <Link className="logo" to="/" aria-label="UPR 2026, inicio">
          UPR
          <span>
            20
            <br />
            26
          </span>
          <i />
        </Link>
        <nav>
          <NavLink to="/#remeras">Remeras</NavLink>
          <button className="text-button" onClick={() => setGuide(true)}>
            Guía de talles
          </button>
        </nav>
        <Link
          className="cart-link"
          to="/carrito"
          aria-label={`Carrito, ${lines.reduce((n, x) => n + x.quantity, 0)} unidades`}
        >
          <ShoppingBag size={21} />
          <span className="desktop">Carrito</span>
          <b>{lines.reduce((n, x) => n + x.quantity, 0)}</b>
        </Link>
      </header>
      <main>
        <Outlet />
      </main>
      <footer>
        <div className="footer-top">
          <Link className="logo" to="/">
            UPR
            <span>
              20
              <br />
              26
            </span>
            <i />
          </Link>
          <p>
            Un evento. Un recuerdo.
            <br />
            <strong>Tu remera oficial.</strong>
          </p>
          <div className="footer-social">
            {settings.instagram && (
              <a href={settings.instagram} target="_blank" rel="noreferrer">
                Instagram <ArrowUpRight size={16} />
              </a>
            )}
            {settings.whatsapp && (
              <a
                href={whatsappUrl(
                  settings.whatsapp,
                  "Hola! Tengo una consulta sobre UPR 2026.",
                )}
                target="_blank"
                rel="noreferrer"
              >
                WhatsApp <ArrowUpRight size={16} />
              </a>
            )}
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 UPR · Merch oficial</span>
          <div>
            <Link to="/informacion/contacto">Contacto</Link>
            <Link to="/informacion/cambios">Cambios y devoluciones</Link>
            <Link to="/informacion/privacidad">Privacidad</Link>
            <Link to="/informacion/terminos">Términos</Link>
            <Link to="/informacion/arrepentimiento">
              Botón de arrepentimiento
            </Link>
            <Link to="/admin">Administración</Link>
          </div>
        </div>
      </footer>
      {guide && <SizeGuide close={() => setGuide(false)} />}
    </>
  );
}
