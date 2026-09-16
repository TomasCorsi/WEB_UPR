import { useEffect, useState, type FormEvent } from "react";
import { Link, NavLink, Outlet } from "react-router-dom";
import {
  LayoutDashboard,
  Shirt,
  ClipboardList,
  ScanLine,
  Settings,
  LogOut,
} from "lucide-react";
import type { Session } from "@supabase/supabase-js";
import { configured, db } from "../../lib/supabase";
import { Notice } from "../../components/UI";
export default function AdminLayout() {
  const [session, setSession] = useState<Session | null>(null);
  const [admin, setAdmin] = useState(false);
  const [loading, setLoading] = useState(configured);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!configured) return;
    let alive = true;
    async function check(s: Session | null) {
      if (!alive) return;
      setSession(s);
      if (s) {
        const { data, error } = await db()
          .from("admin_users")
          .select("user_id")
          .eq("user_id", s.user.id)
          .maybeSingle();
        if (!alive) return;
        setAdmin(Boolean(data) && !error);
      } else setAdmin(false);
      setLoading(false);
    }
    void db()
      .auth.getSession()
      .then(({ data }) => check(data.session));
    const { data } = db().auth.onAuthStateChange((_event, s) => {
      setTimeout(() => void check(s), 0);
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  async function login(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const f = new FormData(e.currentTarget);
    const { error } = await db().auth.signInWithPassword({
      email: String(f.get("email")),
      password: String(f.get("password")),
    });
    if (error) setError("No pudimos iniciar sesión. Revisá tus datos.");
    setBusy(false);
  }
  if (loading)
    return (
      <div className="container page">
        <div className="skeleton" />
      </div>
    );
  if (!configured)
    return (
      <div className="container page">
        <Notice>
          La conexión con Supabase todavía no está configurada. Consultá el
          README del proyecto para activar la administración.
        </Notice>
        <Link to="/">Volver a la tienda</Link>
      </div>
    );
  if (!session)
    return (
      <div className="login">
        <Link className="logo" to="/">
          UPR
          <span>
            20
            <br />
            26
          </span>
          <i />
        </Link>
        <h1>Hola, equipo.</h1>
        <p>Ingresá para administrar la tienda.</p>
        <form onSubmit={login}>
          <label>
            Email
            <input name="email" type="email" autoComplete="username" required />
          </label>
          <label>
            Contraseña
            <input
              name="password"
              type="password"
              autoComplete="current-password"
              required
            />
          </label>
          {error && <Notice error>{error}</Notice>}
          <button className="button primary full" disabled={busy}>
            {busy ? "INGRESANDO…" : "INGRESAR →"}
          </button>
        </form>
        <Link className="back" to="/">
          ← Volver a la tienda
        </Link>
      </div>
    );
  if (!admin)
    return (
      <div className="container page">
        <Notice error>Tu cuenta no tiene permisos de administración.</Notice>
        <button className="button" onClick={() => void db().auth.signOut()}>
          Cerrar sesión
        </button>
      </div>
    );
  const links = [
    ["", "Resumen", LayoutDashboard],
    ["productos", "Productos", Shirt],
    ["pedidos", "Pedidos", ClipboardList],
    ["entregas", "Entregas", ScanLine],
    ["configuracion", "Configuración", Settings],
  ] as const;
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="logo" to="/">
          UPR
          <span>
            20
            <br />
            26
          </span>
          <i />
        </Link>
        <div className="eyebrow">ADMINISTRACIÓN</div>
        <nav>
          {links.map(([path, label, Icon]) => (
            <NavLink end to={`/admin${path ? `/${path}` : ""}`} key={path}>
              <Icon size={20} />
              {label}
            </NavLink>
          ))}
        </nav>
        <button
          className="text-button"
          onClick={() => void db().auth.signOut()}
        >
          <LogOut size={18} /> Cerrar sesión
        </button>
        <Link className="back" to="/">
          Ver tienda ↗
        </Link>
      </aside>
      <main className="admin-content">
        <Outlet />
      </main>
    </div>
  );
}
