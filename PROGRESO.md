# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 1 (Base)
* **Tarea actual:** Tarea 1.4 finalizada (código) · Lista para ejecución manual del seed por el usuario
* **Fecha de actualización:** 2026-10-21

---

## 2. Qué quedó terminado

### Tarea 1.1 · Inicialización del proyecto
* Proyecto configurado con Next.js 16 (App Router), TypeScript y Tailwind CSS.
* `.gitignore` actualizado: ignora todos los `.env*` con valores, permite únicamente `.env.example`.
* `.env.example` creado y documentado con las variables de Supabase y Google Places (sin secretos).
* Módulo `lib/env.ts` para validación tipada de variables públicas y de servidor.
* Vitest + jsdom + `@testing-library/react` instalados y configurados (`vitest.config.mts`).
* Scripts `test` y `test:watch` integrados en `package.json`.
* Compilación de Next.js (`npm run build`) verificada sin errores.
* **24 pruebas automatizadas pasando** (4 de entorno + 20 de migración SQL).

### Tarea 1.2 · Migración completa de base de datos
* Script SQL `supabase/migrations/001_modelo_completo_vao.sql` con las 7 tablas, RLS completas, triggers de usuario y reportes, permisos por columna e índices.
* Tipos TypeScript en `lib/types.ts` sincronizados con el esquema.
* **20 pruebas automatizadas** de estructura SQL y tipos.

### Tarea 1.3 · Autenticación con Google (Supabase Auth)
* Implementación de autenticación con Google OAuth usando `@supabase/ssr`.
* Clientes de navegador y servidor (`lib/supabase/client.ts`, `server.ts`) y proxy de sesión (`proxy.ts` de Next.js 16).
* Route Handler `/auth/callback` con protección contra Open Redirect (`lib/auth-utils.ts`).
* Componentes móviles `AuthButton` y `AuthErrorBanner` con `<Suspense>` para Partial Prerendering.
* **11 pruebas automatizadas** de seguridad y autenticación.

### Tarea 1.4 · Proxy seguro de fotos y script manual de Google Places
* **Migración 002:** `supabase/migrations/002_agregar_photo_author.sql` para añadir la columna `photo_author` requerida por los términos de servicio de Google Places.
* **Tipos actualizados:** `Restaurante` y `RestauranteDB` en `lib/types.ts` incorporan `photo_author` y `photo_reference`.
* **Rate Limiter:** Módulo `lib/rate-limiter.ts` con ventana deslizante en memoria (60 req/min por IP) y limpieza automática.
* **Route Handler del Proxy:** `app/api/places/photo/route.ts`:
  * Aplica rate limiting por IP (429 si excede con `Retry-After`).
  * Valida que `photo_reference` exista en `public.restaurantes` antes de pedirla a Google (403 si es ajena).
  * Solicita la imagen a Google Places API (New) sin exponer la API key al cliente.
  * Responde con binario de imagen y cabeceras de caché `public, max-age=86400, s-maxage=604800`.
* **Script de carga manual:** `scripts/seed-places.ts`:
  * Configurado para ejecutarse con `npm run seed:places`.
  * Realiza **exactamente 6 consultas** a Google Places API (New) Text Search (2 distritos × 3 categorías).
  * FieldMask mínimo: `places.id,places.displayName,places.formattedAddress,places.location,places.priceLevel,places.photos`.
  * Filtro estricto por distrito: descarta cualquier local que no pertenezca a Miraflores o Barranco.
  * Extrae `photo_reference` y `photo_author` (authorAttributions) de la primera foto.
  * Realiza `upsert` idempotente en Supabase por `google_place_id`.
* **7 nuevas pruebas automatizadas** (`tests/proxy-places.test.ts`) cubriendo rate limiter, validación de referencias, rechazo 403, 400, 429 y streaming de imagen con cabeceras de caché.
* **Total acumulado: 42 pruebas automatizadas pasando**, 0 vulnerabilidades en producción y build de Next.js 16 verificado en verde.

---

## 3. Qué falta (Fase 1 - Base)

* [x] **Tarea 1.4 · Proxy seguro de fotos y script manual de Google Places** (Código terminado · Pendiente de ejecución manual por el usuario)
* [ ] **Tarea 1.5 · Pantalla principal (Home) mobile-first:**
  * Vista principal en 375 px listando restaurantes con fotos, distritos y tipo de cocina.
  * Estados visuales: cargando (skeletons), vacío amigable y errores.
  * Prueba de interfaz sin desbordamiento horizontal.

---

## 4. Pendientes para Fases Posteriores

### Fase 2 · Storage
> ⚠️ **Bucket de Supabase Storage** — Crear manualmente el bucket `recomendaciones` con las siguientes políticas de Storage (no es SQL de tabla, se configura en el panel de Supabase o vía API de administración):
>
> * **INSERT (subir):** solo usuarios autenticados pueden subir archivos, y únicamente a la ruta `recomendaciones/<su_id>/`. La ruta no puede contener `..` (traversal de directorios).
> * **UPDATE (reemplazar):** un usuario solo puede reemplazar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **DELETE (borrar):** un usuario solo puede borrar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **SELECT (leer/descargar):** lectura pública para todos (las fotos son visibles en la app).
> * Estas políticas deben crearse como Storage Policies en el panel de Supabase → Storage → Policies, o mediante el cliente `@supabase/supabase-js` con `storageFrom().createPolicy()`.

### Fase 4 · Despliegue en Vercel
> ⚠️ **Supabase Auth URL Configuration:**
> * En **Authentication → URL Configuration**, actualizar:
>   * **Site URL:** sustituir `http://localhost:3000` por el dominio final de producción en Vercel (`https://tu-app.vercel.app`).
>   * **Redirect URLs:** agregar la URL de producción (`https://tu-app.vercel.app/auth/callback` y cualquier dominio personalizado).
>
> ⚠️ **Rate limiter distribuido:**
> * El rate limiter en memoria de `/api/places/photo` funciona por proceso/instancia y no se comparte entre funciones serverless de Vercel. En Fase 4 evaluar Upstash Redis o Vercel KV para rate limiting distribuido global.

---

## 5. Decisiones tomadas

1. **Next.js 16 y convención `proxy.ts`:**
   En Next.js 16, la convención `middleware.ts` está en desuso y se ha renombrado formalmente a `proxy.ts`. Se configuró `proxy.ts` en la raíz del proyecto para ejecutar `updateSession()` con `@supabase/ssr`.

2. **Validación estricta con `supabase.auth.getUser()`:**
   En el servidor y en el proxy no se confía ciegamente en `getSession()`. Se invoca `getUser()` que valida el JWT contra el servidor de Supabase y refresca tokens transparentemente.

3. **Protección estricta contra Open Redirect:**
   La función `getSafeRedirectPath` en `lib/auth-utils.ts` valida cualquier redirección posterior al login, garantizando que el usuario solo pueda ser redirigido a rutas internas del dominio (`/`, `/explorar`, etc.) y rechazando URLs absolutas (`https://...`), esquemas relativos (`//...`) y backslashes.

4. **Places API (New) y Modelo de Precios por SKU:**
   Google Maps Platform utiliza cupos gratuitos mensuales por SKU (ya no el crédito genérico de $200 USD). El field mask utilizado activa el SKU **Places - Text Search (Pro)** que otorga 1,000 llamadas mensuales gratuitas. Al realizar solo 6 consultas, el costo facturado es exactamente **$0.00 USD**.

5. **Atribución de fotos de Google Places:**
   Se incluye la columna `photo_author` en `restaurantes` para guardar `authorAttributions[0].displayName`, cumpliendo con la política de uso de Google que exige mostrar el crédito del fotógrafo.

---

## 6. Siguiente paso
* El usuario ejecuta en Supabase la migración 002 (`002_agregar_photo_author.sql`).
* El usuario ejecuta manualmente `npm run seed:places`.
* Una vez cargados los restaurantes, iniciamos la **Tarea 1.5** (Pantalla principal Home mobile-first en 375 px).
