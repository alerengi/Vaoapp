# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 1 (Base) completada al 100% · Lista para iniciar Fase 2 (Núcleo)
* **Tarea actual:** Tarea 1.5 finalizada
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
* **Migración 002:** `supabase/migrations/002_agregar_photo_author.sql` para añadir la columna `photo_author`.
* **Rate Limiter:** Módulo `lib/rate-limiter.ts` con ventana deslizante en memoria (60 req/min por IP) y limpieza automática.
* **Route Handler del Proxy:** `app/api/places/photo/route.ts` con validación de referencia en la BD, streaming de imagen y cabeceras de caché.
* **Script de carga manual:** `scripts/seed-places.ts` con 6 consultas exactas a Places API (New), filtro estricto por distrito y extracción de autor. Carga exitosa ejecutada por el usuario (79 restaurantes únicos guardados en Supabase).
* **7 pruebas automatizadas** (`tests/proxy-places.test.ts`).

### Tarea 1.5 · Pantalla principal (Home) mobile-first
* **`RestaurantCard`:** Tarjeta móvil accesible (ancho adaptado a 375 px) con etiqueta `<img>` y `loading="lazy"` para evitar doble procesamiento y dosificar el consumo del proxy; incluye badges de distrito y cocina, rango de precio, atribución obligatoria de autor ("Foto: {autor}") y datos ("Datos de Google Maps"), y botón táctil "¡Vao!" que abre la ruta en Google Maps.
* **`FilterChips`:** Selector táctil de al menos 44 px para alternar distritos (Todos, Miraflores, Barranco) y categorías (Todas, Makis, Ceviche, Burgers).
* **`RestaurantExplorer`:** Explorador reactivo con paginación de 20 en 20 locales (evita superar el límite de 60 req/min de imágenes) y estado vacío con sugerencia amigable si la combinación de filtros no tiene locales.
* **`createPublicClient`:** Cliente ligero en `lib/supabase/server.ts` sin acceso a cookies para consultas públicas, permitiendo a Next.js 16 pre-renderizar estáticamente con Partial Prerendering (PPR).
* **`RestaurantListSkeleton`:** Skeleton animado de carga integrado en `app/page.tsx` dentro de `<Suspense>` para streaming instantáneo.
* **9 nuevas pruebas automatizadas** (`tests/home-ui.test.tsx`) que verifican renderizado, lazy loading, atribuciones, botón de Google Maps, paginación de 20 en 20, filtros y estados vacíos.
* **Total acumulado: 51 pruebas automatizadas pasando**, 0 vulnerabilidades en dependencias de producción y build de Next.js 16 verificado en verde.

---

## 3. Estado de Fases

### Fase 1 · Base (Completada al 100%)
* [x] Tarea 1.1 · Inicialización del proyecto Next.js + Tailwind + Vitest
* [x] Tarea 1.2 · Migración completa de base de datos y tipos TypeScript
* [x] Tarea 1.3 · Autenticación con Google y proxy de sesión
* [x] Tarea 1.4 · Proxy seguro de fotos y carga inicial de Google Places (79 restaurantes)
* [x] Tarea 1.5 · Pantalla principal Home mobile-first (375 px, 20 en 20, lazy loading, filtros y botón Vao)

*Criterio de éxito de Fase 1 cumplido:* Un usuario se registra con Google y ve la lista de restaurantes de Miraflores y Barranco.

### Fase 2 · Núcleo (Siguiente fase)
* [ ] **Tarea 2.1 · Bucket de Supabase Storage para recomendaciones:**
  * Crear bucket `recomendaciones` con políticas de seguridad RLS en Storage (solo autor puede subir/reemplazar/borrar en su propia subcarpeta `recomendaciones/<usuario_id>/` y bloqueo de path traversal `..`).
* [ ] **Tarea 2.2 · Búsqueda por plato, restaurante o cocina:**
  * Barra de búsqueda reactiva (tolerante a tildes y sinónimos) con ordenamiento bayesiano por Puntaje Vao (HU-01).
* [ ] **Tarea 2.3 · Recomendar un plato con foto (HU-02):**
  * Formulario completable en <60s, compresión de imagen en cliente (<5 MB) y subida a Supabase Storage.
* [ ] **Tarea 2.4 · Validar recomendación con "¡Confirmo!" (HU-03):**
  * Validación optimista reversible, bloqueo de auto-validación y recálculo automático del Puntaje Vao.

---

## 4. Pendientes para Fases Posteriores

### Fase 2 · Storage
> ⚠️ **Bucket de Supabase Storage** — Configurar el bucket `recomendaciones`:
> * **INSERT (subir):** solo usuarios autenticados pueden subir archivos a `recomendaciones/<su_id>/`. Prohibido `..`.
> * **UPDATE (reemplazar):** un usuario solo puede reemplazar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **DELETE (borrar):** un usuario solo puede borrar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **SELECT (leer/descargar):** lectura pública para todos.

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
   Google Maps Platform utiliza cupos gratuitos mensuales por SKU. El field mask utilizado activa el SKU **Places - Text Search (Pro)** que otorga 1,000 llamadas mensuales gratuitas. Al realizar solo 6 consultas, el costo facturado fue **$0.00 USD**.

5. **Atribución de fotos de Google Places y Datos:**
   Se incluye la columna `photo_author` en `restaurantes` para guardar `authorAttributions[0].displayName`, y en cada tarjeta se exhibe "Datos de Google Maps" junto a "Foto: {autor}".

6. **Paginación móvil (20 en 20) y `loading="lazy"`:**
   Para no saturar el rate limit del proxy (60 req/min por IP) ni consumir ancho de banda innecesario en celulares, se renderizan 20 locales inicialmente con botón "Ver más", y las fotos se cargan de forma diferida con `loading="lazy"`.

7. **Separación de cliente público y autenticado en servidor:**
   Se implementó `createPublicClient()` en `lib/supabase/server.ts` para consultas públicas (catálogo de restaurantes) sin tocar cookies, evitando que Next.js cancele el pre-renderizado estático de la página principal.

---

## 6. Siguiente paso
* Probar la interfaz mobile-first en celular o con la herramienta de emulación móvil del navegador en 375 px de ancho.
* Dar inicio a la **Fase 2 (Núcleo)** con la **Tarea 2.1**: configuración del bucket de Storage con políticas de seguridad.
