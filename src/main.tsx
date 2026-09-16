import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route, Link } from "react-router-dom";
import { StoreProvider } from "./lib/store";
import { CartProvider } from "./features/cart/CartContext";
import Layout from "./components/Layout";
import Home from "./pages/Home";
import "./styles.css";
const Product = lazy(() => import("./pages/Product"));
const Cart = lazy(() => import("./pages/Cart"));
const Checkout = lazy(() => import("./pages/Checkout"));
const PaymentResult = lazy(() => import("./pages/PaymentResult"));
const Information = lazy(() => import("./pages/Information"));
const AdminLayout = lazy(() => import("./features/admin/AdminLayout"));
const Dashboard = lazy(() => import("./features/admin/Dashboard"));
const Products = lazy(() => import("./features/admin/Products"));
const Orders = lazy(() => import("./features/admin/Orders"));
const Settings = lazy(() => import("./features/admin/Settings"));
class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    return this.state.failed ? (
      <div className="container page">
        <h1>No pudimos abrir esta página.</h1>
        <p>Volvé a cargarla para continuar.</p>
        <button
          className="button primary"
          onClick={() => window.location.reload()}
        >
          VOLVER A CARGAR
        </button>
      </div>
    ) : (
      this.props.children
    );
  }
}
ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <StoreProvider>
          <CartProvider>
            <Suspense
              fallback={
                <div className="container page">
                  <div className="skeleton" aria-label="Cargando" />
                </div>
              }
            >
              <Routes>
                <Route element={<Layout />}>
                  <Route index element={<Home />} />
                  <Route path="producto/:slug" element={<Product />} />
                  <Route path="carrito" element={<Cart />} />
                  <Route path="checkout" element={<Checkout />} />
                  {["compra-exitosa", "pago-pendiente", "pago-fallido"].map(
                    (p) => (
                      <Route key={p} path={p} element={<PaymentResult />} />
                    ),
                  )}
                  <Route path="informacion/:kind" element={<Information />} />
                  <Route
                    path="*"
                    element={
                      <div className="container page">
                        <h1>Esta página no existe.</h1>
                        <Link className="button primary" to="/">
                          VOLVER AL INICIO
                        </Link>
                      </div>
                    }
                  />
                </Route>
                <Route path="admin" element={<AdminLayout />}>
                  <Route index element={<Dashboard />} />
                  <Route path="productos" element={<Products />} />
                  <Route path="pedidos" element={<Orders />} />
                  <Route path="entregas" element={<Orders delivery />} />
                  <Route path="configuracion" element={<Settings />} />
                </Route>
              </Routes>
            </Suspense>
          </CartProvider>
        </StoreProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </React.StrictMode>,
);
