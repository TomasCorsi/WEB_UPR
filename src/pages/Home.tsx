import { ArrowDown, ArrowUpRight, Check, Shirt, Ticket } from "lucide-react";
import { Link } from "react-router-dom";
import { useStore } from "../lib/store";
import { money } from "../lib/supabase";
import { Empty, Notice, Pickup, ShirtArt } from "../components/UI";
export default function Home() {
  const { products, settings, loading, error, refresh } = useStore();
  return (
    <>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <span /> MERCH OFICIAL / EDICIÓN 2026
          </div>
          <h1>
            EL EVENTO
            <br />
            TAMBIÉN
            <br />
            SE <span>LLEVA.</span>
          </h1>
          <p>
            Remeras oficiales de <strong>UPR 2026.</strong>
            <br />
            Elegí tu diseño y asegurá la tuya antes del evento.
          </p>
          <a className="button primary" href="#remeras">
            VER REMERAS <ArrowUpRight size={20} />
          </a>
          <div className="hero-note">
            <span>01 —</span> Hechas para estar ahí.
          </div>
        </div>
        <div className="hero-visual">
          <div className="visual-top">
            <span>UPR® COLLECTION</span>
            <span>2026</span>
          </div>
          <span className="background-type" aria-hidden="true">
            UPR
          </span>
          <ShirtArt />
          <div className="round-stamp">
            EDICIÓN
            <br />
            <strong>2026</strong>
            <span>MERCH OFICIAL</span>
          </div>
          <div className="visual-bottom">
            <span>ILUSTRACIÓN CONCEPTUAL · DISEÑO A CONFIRMAR</span>
            <ArrowDown size={20} />
          </div>
        </div>
      </section>
      <div className="container">
        <Pickup />
        <section id="remeras" className="collection">
          <div className="section-title">
            <div>
              <div className="eyebrow">LA COLECCIÓN</div>
              <h2>Tu próxima remera favorita.</h2>
            </div>
            <span>
              {products.length
                ? `${products.length} diseños / UPR 2026`
                : "Remeras UPR 2026"}
            </span>
          </div>
          {!settings.sales_enabled && products.length > 0 && (
            <Notice>Las ventas online están momentáneamente pausadas.</Notice>
          )}
          {error ? (
            <Notice error>
              {error}{" "}
              <button className="text-button" onClick={() => void refresh()}>
                Reintentar
              </button>
            </Notice>
          ) : loading ? (
            <div className="product-grid">
              {[1, 2, 3].map((i) => (
                <div className="skeleton" key={i} />
              ))}
            </div>
          ) : products.length ? (
            <div className="product-grid">
              {products.map((p, i) => {
                const variants = p.product_variants.filter((v) => v.active);
                const colors = [
                  ...new Map(variants.map((v) => [v.color, v])).values(),
                ];
                const stock = variants.reduce(
                  (n, v) => n + Math.max(0, v.stock - v.reserved),
                  0,
                );
                const photo = [...p.product_images].sort(
                  (a, b) => a.position - b.position,
                )[0];
                return (
                  <Link
                    to={`/producto/${p.slug}`}
                    className="product-card"
                    key={p.id}
                  >
                    <div className="product-photo">
                      {photo ? (
                        <img
                          src={photo.image_url}
                          alt={p.name}
                          loading="lazy"
                        />
                      ) : (
                        <Shirt size={100} strokeWidth={0.6} />
                      )}
                      <span className="product-index">
                        {String(i + 1).padStart(2, "0")} / UPR
                      </span>
                      <span className="product-label">
                        {stock === 0
                          ? "AGOTADO"
                          : stock <= 5
                            ? "ÚLTIMAS UNIDADES"
                            : "EDICIÓN 2026"}
                      </span>
                      <span className="product-arrow">
                        <ArrowUpRight />
                      </span>
                    </div>
                    <div className="row between">
                      <h3>{p.name}</h3>
                      <strong>{money(p.price)}</strong>
                    </div>
                    <div className="row between">
                      <div className="swatches">
                        {colors.map((v) => (
                          <span
                            key={v.color}
                            style={{ background: v.color_hex }}
                            title={v.color}
                          />
                        ))}
                        <small>{colors.map((v) => v.color).join(" · ")}</small>
                      </div>
                      <span className="small-link">VER REMERA</span>
                    </div>
                  </Link>
                );
              })}
            </div>
          ) : (
            <Empty title="La colección está en camino.">
              <p>
                Estamos preparando las remeras oficiales.
                <br />
                Los diseños y talles disponibles van a aparecer acá.
              </p>
              <span className="pill">PRÓXIMAMENTE / UPR 2026</span>
            </Empty>
          )}
        </section>
        <div className="benefits">
          <div>
            <Shirt />
            <strong>Elegí la tuya</strong>
            <span>Tu diseño, tu color, tu talle.</span>
          </div>
          <div>
            <Check />
            <strong>Asegurala online</strong>
            <span>Pagá a través de Mercado Pago.</span>
          </div>
          <div>
            <Ticket />
            <strong>Retirala en UPR</strong>
            <span>Gratis, el mismo día del evento.</span>
          </div>
        </div>
      </div>
    </>
  );
}
