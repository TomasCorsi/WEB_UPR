import { useEffect, useRef, type ReactNode } from "react";
import { ArrowUpRight, MapPin, X, Shirt } from "lucide-react";
import { useStore } from "../lib/store";
export function Pickup({ compact = false }: { compact?: boolean }) {
  const { settings } = useStore();
  return (
    <div className={`pickup ${compact ? "compact" : ""}`}>
      <span className="pickup-icon">
        <MapPin size={24} />
      </span>
      <div>
        <strong>Retiro en UPR 2026 — GRATIS</strong>
        <p>No realizamos envíos. {settings.pickup_message}</p>
      </div>
      {!compact && (
        <span className="pickup-tag">
          NOS VEMOS AHÍ <ArrowUpRight size={18} />
        </span>
      )}
    </div>
  );
}
export function Notice({
  children,
  error = false,
}: {
  children: ReactNode;
  error?: boolean;
}) {
  return (
    <div
      className={`notice ${error ? "error" : ""}`}
      role={error ? "alert" : "status"}
    >
      {children}
    </div>
  );
}
export function Empty({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <div className="empty">
      <Shirt size={38} strokeWidth={1.3} />
      <h2>{title}</h2>
      {children}
    </div>
  );
}
export function Modal({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const el = ref.current;
    el?.showModal();
    const old = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      el?.close();
      document.body.style.overflow = old;
    };
  }, []);
  return (
    <dialog
      ref={ref}
      onCancel={close}
      onClick={(e) => {
        if (e.target === ref.current) close();
      }}
    >
      <div className="dialog-inner">
        <div className="row between">
          <h2>{title}</h2>
          <button className="icon-button" aria-label="Cerrar" onClick={close}>
            <X />
          </button>
        </div>
        {children}
      </div>
    </dialog>
  );
}
export function SizeGuide({ close }: { close: () => void }) {
  const { settings } = useStore();
  return (
    <Modal title="Encontrá tu talle" close={close}>
      <p>
        Medí una remera que te quede cómoda, extendida sobre una superficie
        plana.
      </p>
      {settings.size_guide.length ? (
        <>
          <table>
            <thead>
              <tr>
                <th>Talle</th>
                <th>Ancho (cm)</th>
                <th>Largo (cm)</th>
              </tr>
            </thead>
            <tbody>
              {settings.size_guide.map((x) => (
                <tr key={x.size}>
                  <td>{x.size}</td>
                  <td>{x.width}</td>
                  <td>{x.length}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="muted">
            Ancho: de axila a axila. Largo: del hombro al borde inferior.
          </p>
        </>
      ) : (
        <Notice>
          Las medidas oficiales se publicarán próximamente. Consultanos antes de
          elegir tu talle.
        </Notice>
      )}
    </Modal>
  );
}
export function ShirtArt() {
  return (
    <svg
      className="shirt-art"
      viewBox="0 0 600 570"
      role="img"
      aria-label="Ilustración conceptual de una remera UPR. El diseño final se publicará en el catálogo."
    >
      <defs>
        <linearGradient id="fabric" x1="0" x2="1" y1="0" y2="1">
          <stop stopColor="#363b37" />
          <stop offset=".5" stopColor="#1d211e" />
          <stop offset="1" stopColor="#0d100e" />
        </linearGradient>
        <filter id="shadow">
          <feDropShadow dx="8" dy="24" stdDeviation="14" floodOpacity=".25" />
        </filter>
      </defs>
      <g transform="rotate(-10 300 285)" filter="url(#shadow)">
        <path
          d="M212 90 145 115 59 210 129 279 170 239 161 474Q300 500 439 474L430 239 471 279 541 210 455 115 388 90Q300 119 212 90Z"
          fill="url(#fabric)"
          stroke="#424941"
          strokeWidth="2"
        />
        <path
          d="M250 100Q300 157 350 100"
          fill="none"
          stroke="#111612"
          strokeWidth="16"
        />
        <path
          d="M249 104Q300 150 350 104"
          fill="none"
          stroke="#4d554a"
          strokeWidth="2"
        />
        <path
          d="m154 124 27 110M446 124l-27 110M173 465q127 21 254 0"
          fill="none"
          stroke="#5b6357"
          opacity=".45"
        />
        <text
          x="300"
          y="293"
          textAnchor="middle"
          fontFamily="Arial,sans-serif"
          fontWeight="900"
          fontSize="104"
          letterSpacing="-9"
          fill="#c1f45b"
        >
          UPR
        </text>
        <text
          x="301"
          y="322"
          textAnchor="middle"
          fontFamily="monospace"
          letterSpacing="10"
          fontSize="18"
          fill="#c1f45b"
        >
          2026
        </text>
        <path d="M245 344h110" stroke="#c1f45b" strokeWidth="1" />
        <text
          x="300"
          y="365"
          textAnchor="middle"
          fontFamily="monospace"
          fontSize="9"
          letterSpacing="2"
          fill="#c1f45b"
        >
          NOS VEMOS AHÍ.
        </text>
      </g>
    </svg>
  );
}
