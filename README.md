# UPR 2026 — Remeras oficiales

Tienda de preventa para retiro presencial el día de UPR 2026. Sin envíos ni registro de compradores. React, TypeScript, Vite, Tailwind, React Router, Supabase y Mercado Pago Checkout Pro.

## Estado de la entrega

El código de la tienda, administración, migraciones y funciones está implementado. Para vender faltan las credenciales del proyecto, desplegar Supabase/funciones, cargar productos reales y validar el circuito en las cuentas de prueba de Mercado Pago. No se efectuaron cobros, despliegues remotos ni cambios en cuentas externas.

Sin variables de Supabase, la portada funciona con el catálogo vacío y ventas deshabilitadas. La remera de portada es una ilustración conceptual, identificada como tal; **no representa un diseño aprobado ni un producto a la venta**. No hay productos ni métricas ficticias en producción. Las medidas, fecha, lugar, contactos y textos informativos quedan pendientes de carga.

## 1. Instalación y ejecución

Requiere Node.js 22.12+ (verificado con Node 24) y npm.

```powershell
npm ci
Copy-Item .env.example .env
npm run dev
```

Abrir la dirección que muestra Vite. Comandos adicionales:

```powershell
npm run build
npm run preview
npm test
```

El build estático queda en `dist/`. El panel es `/admin`, con rutas `/admin/productos`, `/admin/pedidos`, `/admin/entregas` y `/admin/configuracion`.

## 2. Variables públicas

Completar `.env`:

```dotenv
VITE_SUPABASE_URL=https://TU_PROYECTO.supabase.co
VITE_SUPABASE_ANON_KEY=CLAVE_PUBLICA_DEL_PROYECTO
VITE_SITE_URL=https://tu-dominio.example
```

`VITE_SITE_URL` es el origen HTTPS público, sin ruta. Si está configurado, el build agrega URL canónica, OpenGraph con `og.png` y un sitemap de la portada. La imagen social está incluida y se puede regenerar con `node scripts/social-card.mjs`.

Las variables `VITE_` son públicas. **Nunca poner allí el service role ni el access token de Mercado Pago.** `.env` está excluido de Git. Reiniciar Vite después de editar variables.

## 3. Supabase y migraciones

Instalar la CLI oficial de Supabase y autenticarla con tu cuenta. En la raíz:

```powershell
supabase login
supabase link --project-ref TU_PROJECT_REF
supabase db push
```

Las migraciones crean tablas, restricciones, índices, funciones SQL, RLS, el bucket público `products` y sus políticas. No cargan productos de ejemplo. El bucket admite JPG, PNG y WebP de hasta 5 MB; solo administradores pueden escribir. La configuración inicial tiene `sales_enabled = false`.

Para una instalación local completa, la CLI requiere Docker: `supabase start`, `supabase db reset` y `supabase functions serve --env-file supabase/functions/.env`. Usar las URL y claves locales que entregue la CLI. Las pruebas unitarias del repositorio usan PostgreSQL embebido en memoria y no requieren Docker.

## 4. Crear el primer administrador

1. Crear manualmente un usuario de email/contraseña desde Supabase → Authentication → Users. No existe formulario público de registro.
2. Copiar su UUID y ejecutar en el SQL Editor:

```sql
insert into public.admin_users(user_id)
values ('UUID_DEL_USUARIO_AUTH');
```

3. En la configuración de Auth del proyecto remoto, deshabilitar el registro público. `supabase/config.toml` también lo deshabilita para el entorno local.
4. Entrar en `/admin`. Una cuenta Auth sin fila en `admin_users` no puede administrar ni ver compradores.

No agregar usuarios a `admin_users` desde el cliente. Esa tabla no tiene políticas de escritura para usuarios autenticados.

## 5. Secretos de Edge Functions

Usar `supabase/functions/.env.example` como referencia y guardar los valores privados en Supabase → Edge Functions → Secrets, o mediante `supabase secrets set --env-file RUTA_ARCHIVO_PRIVADO`.

| Secreto                      | Uso                                                                |
| ---------------------------- | ------------------------------------------------------------------ |
| `SITE_URL`                   | Origen exacto de la web, sin barra final. CORS y regreso del pago. |
| `MERCADOPAGO_ACCESS_TOKEN`   | Token privado del vendedor.                                        |
| `MERCADOPAGO_WEBHOOK_SECRET` | Firma secreta generada en la configuración de Webhooks.            |
| `MERCADOPAGO_COLLECTOR_ID`   | ID numérico de la cuenta vendedora. Se valida en cada pago.        |
| `MERCADOPAGO_LIVE_MODE`      | `false` en pruebas; `true` en producción.                          |

`SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` son inyectados por Supabase en las funciones desplegadas. Nunca se devuelven al navegador. No compartir secretos por Git ni incorporarlos a comandos versionados.

## 6. Desplegar las funciones

```powershell
supabase functions deploy create-order
supabase functions deploy create-mercadopago-preference
supabase functions deploy mercadopago-webhook
supabase functions deploy order-status
supabase functions deploy reconcile-order
```

La configuración por función utiliza `verify_jwt = false` porque las compras son como invitado y Mercado Pago no envía JWT. La autorización se implementa dentro de cada operación:

- `create-order`: validación, límite por IP/email, precios y reservas calculados en PostgreSQL.
- `create-mercadopago-preference` y `order-status`: UUID del pedido **más token secreto del comprador**. Un número `UPR-XXXX` no permite consultar datos.
- `mercadopago-webhook`: HMAC SHA-256, consulta del pago al proveedor y validación de vendedor, entorno, moneda e importe.
- `reconcile-order`: sesión Auth válida y pertenencia a `admin_users`.

El estado del pedido no se deduce de `status`, `payment_id` ni otros parámetros de la URL. `/compra-exitosa` sigue mostrando procesamiento hasta que la base confirma el pago.

## 7. Mercado Pago Checkout Pro

1. Crear una integración Checkout Pro para la cuenta vendedora correspondiente.
2. Configurar credenciales y comprador/vendedor de prueba según el flujo oficial; usar `MERCADOPAGO_LIVE_MODE=false` y el collector de pruebas. No mezclar cuentas ni credenciales de prueba y producción.
3. Registrar el Webhook para eventos **Pagos** en:

```text
https://TU_PROYECTO.supabase.co/functions/v1/mercadopago-webhook
```

4. Copiar la firma secreta del Webhook en `MERCADOPAGO_WEBHOOK_SECRET`.
5. La preferencia configura automáticamente retornos a `/compra-exitosa`, `/pago-pendiente` y `/pago-fallido`, con `order` como identificador. Usar un sitio HTTPS para las pruebas integrales de retorno.
6. Probar aprobado, pendiente, rechazado, reintento, notificación duplicada y reembolso con la cuenta de prueba. Verificar el pedido también desde `/admin/pedidos`.
7. Recién después, cambiar token, collector y modo a producción, verificar nuevamente la firma y activar las ventas.

El pago se realiza en la página de Mercado Pago. La aplicación no solicita datos de tarjeta. Se excluyen ticket/cajero para reducir pagos diferidos. La preferencia vence a los 30 minutos; **el vencimiento de la preferencia no prueba que un pago ya iniciado haya fallado**.

Referencias oficiales utilizadas: [Preferencias de Checkout Pro](https://www.mercadopago.com.ar/developers/es/reference/online-payments/checkout-pro-preferences/create-preference/post), [firma de Webhooks](https://www.mercadopago.com.ar/developers/es/docs/checkout-bricks/additional-content/your-integrations/notifications/webhooks).

## 8. Stock, reintentos y pagos pendientes

- `stock`: unidades físicas todavía no descontadas por pagos aprobados.
- `reserved`: unidades retenidas por pedidos que pueden pagarse.
- Disponible para comprar: `stock - reserved`, solo en variantes/productos activos.
- Crear un pedido bloquea las variantes en orden estable, verifica stock y precios, guarda el snapshot y reserva unidades en **una única transacción**.
- Confirmar un pago bloquea el pedido y sus variantes, descuenta `stock`, libera la reserva y marca `stock_applied`. Un webhook repetido no vuelve a descontar.
- El cliente usa una clave de reintento por compra. Cambiar el carrito o los datos con una clave ya usada es rechazado para evitar cobrar un pedido distinto al mostrado.
- El dashboard calcula stock físico + unidades descontadas, ventas y facturación a partir de la base; no contiene un total fijo de 160.

**Decisión conservadora:** no liberar automáticamente reservas con preferencia creada, aunque se abandone el navegador, expire el enlace o un intento sea rechazado. Checkout Pro puede tener otro intento pendiente. Así se evita reasignar una unidad todavía comprometida. El panel muestra esas reservas, permite verificar pagos con Mercado Pago y cancelar pedidos que nunca iniciaron una preferencia. Las reservas con preferencia requieren conciliación del organizador; no hay un botón que las libere a ciegas. Esto puede dejar unidades temporalmente no disponibles.

Si se pierde la respuesta de creación de una preferencia, no se crea otra automáticamente. El pedido queda en revisión. **Verificar con Mercado Pago** intenta recuperar la preferencia por `external_reference` y conciliar pagos. Si el proveedor no permite resolver el caso, revisar desde su panel antes de intervenir en las reservas.

Pagos duplicados, importes incorrectos, contracargos y reembolsos se marcan para revisión e impiden la entrega normal. Los reembolsos se realizan en Mercado Pago; el stock no se repone automáticamente porque una remera podría haber sido entregada. Después de verificar devolución física, ajustar stock desde administración. No editar estados de pagos manualmente para simular aprobaciones.

El límite de creación es 40 intentos por IP y 8 por email cada 15 minutos. Solo se guardan hashes de IP/email en esos contadores. CORS no reemplaza autenticación; los permisos efectivos están en RLS y las funciones.

## 9. Cargar la tienda

1. `/admin/configuracion`: WhatsApp internacional, Instagram, fecha, lugar y mensaje de retiro. Cargar medidas reales de la guía y textos aprobados de cambios, privacidad y términos.
2. `/admin/productos`: crear nombre, slug único, descripción y precio en ARS.
3. Agregar combinaciones de color/talle con SKU único y stock. S/M/L/XL/XXL son sugerencias, se permiten otros talles.
4. Subir fotografías y asociarlas a un color si corresponde. Publicar el producto.
5. Activar ventas desde el resumen o configuración.

Los productos se desactivan, no se eliminan. Los pedidos históricos conservan nombre, color, talle y precio. Las fotos se pueden eliminar sin alterar el snapshot del pedido. Editar un color no cambia automáticamente las asociaciones de imágenes existentes: volver a subir/asociar la foto cuando cambie el nombre del color.

El footer tiene un **Botón de arrepentimiento** que abre información y el contacto por WhatsApp configurado. El organizador debe completar su proceso y los textos definitivos antes de vender; no se inventaron condiciones legales.

## 10. Entregas en el evento

En `/admin/entregas`, buscar por número de pedido, nombre o WhatsApp (mínimo dos caracteres). Solo un pedido pagado, con stock descontado y sin revisión admite **Marcar como entregado**. El estado y la fecha quedan guardados. Repetir el toque no genera una segunda entrega. Un pedido ya entregado sigue mostrando **PEDIDO ENTREGADO** incluso al volver a buscarlo.

La pantalla necesita conexión a Supabase; no guarda compradores en localStorage ni simula entregas offline.

## 11. Publicar el frontend

Configurar las variables públicas en el host elegido, ejecutar `npm ci` y `npm run build`, y servir `dist/` mediante HTTPS. Todas las rutas de la SPA deben volver a `index.html`. Se incluye `public/_redirects` para hosts compatibles; en otros configurar el equivalente.

Actualizar `SITE_URL` en las funciones y `VITE_SITE_URL` en el frontend con el mismo dominio. Autorizar el dominio correspondiente en Supabase Auth. El sitemap incluye únicamente la portada: no expone administración, carrito, checkout ni pedidos. Revisar el favicon y la imagen social en el dominio final.

## Estructura y verificación

```text
src/components/        Navegación, avisos, modales y recursos visuales
src/pages/             Tienda, carrito, checkout y resultados
src/features/cart/     Carrito persistente
src/features/admin/    Auth, productos, variantes, pedidos y entregas
src/lib/               Cliente Supabase y estado del catálogo
src/types/             Tipos del dominio
supabase/migrations/   Esquema, funciones SQL, políticas y restricciones
supabase/functions/    Integración de pedidos y Mercado Pago
tests/                 Pruebas PostgreSQL y firma del Webhook
```

`npm test` ejecuta el SQL real de las migraciones en PostgreSQL embebido **solo para pruebas** (PGlite). Los esquemas Auth/Storage se sustituyen por tablas mínimas; producción utiliza exclusivamente Supabase PostgreSQL. Se comprueban precios autoritativos, reservas, rollback, reintentos, snapshots, idempotencia, RLS, entrega, reembolsos y firma HMAC. No es una prueba de concurrencia entre conexiones reales ni una prueba integral de Supabase Storage/Auth o de la API de Mercado Pago. Esas comprobaciones deben completarse en el proyecto configurado.

```powershell
npm test
npm run build
npx deno check supabase/functions/create-order/index.ts supabase/functions/create-mercadopago-preference/index.ts supabase/functions/mercadopago-webhook/index.ts supabase/functions/order-status/index.ts supabase/functions/reconcile-order/index.ts
```

La portada fue revisada en navegador a 375, 390 y 430 px, sin desbordamiento horizontal, junto con guía de talles y estados vacíos. Las vistas con datos reales y pagos deben verificarse tras configurar el proyecto.
