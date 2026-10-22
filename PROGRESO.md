# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 2 (Núcleo) en curso
* **Tarea actual:** Tarea 2.4 finalizada · Lista para Tarea 2.5
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
* **9 pruebas automatizadas** (`tests/home-ui.test.tsx`).

### Tarea 2.1 · Bucket de Supabase Storage y políticas de seguridad
* **Migración 003 (`supabase/migrations/003_storage_recomendaciones.sql`):**
  * Bucket `recomendaciones` en `storage.buckets` con límite estricto de 5 MB y tipos MIME permitidos (`image/jpeg`, `image/png`, `image/webp`).
  * Políticas RLS en `storage.objects`:
    - `SELECT`: lectura pública para cualquier visitante.
    - `INSERT`: solo usuarios autenticados pueden subir fotos a su propia subcarpeta con exactamente 2 segmentos (`<usuario_id>/<archivo>`), sin path traversal (`..`).
    - `UPDATE`: solo el autor puede actualizar sus fotos, con cláusulas `USING` y `WITH CHECK` simétricas para evitar mover archivos a carpetas de otros usuarios.
    - `DELETE`: solo el autor puede borrar sus archivos.
  * Actualización de la función trigger `handle_recomendacion_before_upsert()` en PostgreSQL para validar de forma nativa la convención de 2 segmentos `<usuario_id>/<archivo>`.
* **Módulo `lib/storage.ts`:**
  * Validador de buffers con detección de magic bytes reales (JPEG `FF D8 FF`, PNG `89 50 4E 47`, WEBP `RIFF....WEBP`), impidiendo evasiones por renombrado de extensiones.
  * Validador de tamaño máximo de 5 MB (`FOTO_MUY_PESADA`) y archivos vacíos (`FOTO_VACIA`).
  * Generador de rutas seguras `generateSecureImagePath(usuarioId, ext)` que crea `${usuarioId}/${crypto.randomUUID()}.${ext}` sanitizando IDs y extensiones.
  * Constructor de URLs públicas `getPublicImageUrl()` y validador de rutas de storage `isValidStorageFotoPath()`.
* **Sincronización en `lib/types.ts`:**
  * Actualizada función `isFotoPathValida()` para validar exactamente 2 segmentos `<usuario_id>/<archivo>` y rechazar `..` o subdirectorios.
* **19 pruebas automatizadas (`tests/storage.test.ts`).**

### Tarea 2.2 · Motor del Puntaje Vao y anti-spam
* **Migración 004 (`supabase/migrations/004_puntaje_vao_recalculo.sql`):**
  * Función pura `public.calcular_peso_recomendacion(v_i, f_i)`: `w_i = min(1 + 0.25 * v_i, 3.0) * f_i`.
  * Función pura `public.calcular_puntaje_vao(m, calificaciones[], pesos[])`: fórmula bayesiana $(C \cdot m + \sum w_i r_i) / (C + \sum w_i)$ con $C=5.0$ y fallback $m=3.5$.
  * Función orquestadora `public.recalcular_platos_categoria_distrito(categoria_id, distrito)` con `SECURITY DEFINER` y `SET search_path = public`: recalcula todos los platos de la misma categoría y distrito para sincronizar el promedio $m$. Permisos de ejecución revocados a `PUBLIC, anon, authenticated` (solo invocable internamente por triggers).
  * Triggers automáticos en `recomendaciones` y `validaciones`, con tolerancia estricta a borrados en cascada.
  * **Anti-spam estricto de fechas:** Triggers `BEFORE INSERT` en `validaciones` y `reportes` que fuerzan `fecha = NOW()`, junto a permisos por columna (`GRANT INSERT (usuario_id, recomendacion_id)` y `GRANT INSERT (usuario_id, recomendacion_id, motivo)` a `authenticated`), impidiendo que un cliente malicioso envíe fechas futuras para burlar el filtro de 24 horas.
* **Módulo `lib/puntaje-vao.ts`:**
  * Espejo tipado con las mismas constantes y funciones matemáticas de puntaje bayesiano y filtro anti-spam.
  * `calcularPuntajeRestaurante()`: puntaje del mejor plato para búsqueda por plato, o promedio de los 3 mejores platos para búsqueda general.
* **25 pruebas automatizadas (`tests/puntaje-vao.test.ts`):** Verificación exhaustiva de constantes, pesos, amortiguación bayesiana (caso 3.75), tope de validaciones, decaimiento por antigüedad, anti-spam (<24 h), triggers de fecha y revocación de permisos de ejecución.
* **Total acumulado: 95 pruebas automatizadas pasando**, 0 vulnerabilidades en dependencias y compilación de Next.js 16 en verde.

### Tarea 2.3 · Recomendar un plato con foto (HU-02)
* **Server Action `guardarRecomendacion` (`app/actions/recomendar.ts`):**
  * Validación de sesión con `supabase.auth.getUser()`.
  * Validación de inputs (restaurante, calificación 1 a 5, comentario ≤ 280 caracteres, foto obligatoria).
  * Manejo de concurrencia al crear platos: captura de error `23505` (duplicado en `restaurante_id, nombre_normalizado`) para reutilizar el plato existente sin fallar.
  * Flujo sin upsert: verifica si ya existe recomendación previa del usuario para ese plato y ejecuta `INSERT` o `UPDATE` exclusivamente en las columnas permitidas por RLS.
  * Subida segura a Storage con ruta `<usuario_id>/<uuid>.<ext>` (Decisión 8).
  * Limpieza de Storage: rollback inmediato de la foto subida si falla la persistencia en base de datos; borrado de la foto anterior únicamente tras el éxito del `UPDATE` con foto nueva.
* **Compresor y Privacidad (`lib/image-compressor.ts`):**
  * Compresión nativa con HTML5 Canvas sin dependencias npm pesadas.
  * Eliminación sistemática de metadatos EXIF (incluyendo coordenadas GPS de la cámara).
  * Límite estricto de cliente a 3 MB, garantizando compatibilidad con Vercel (4.5 MB) y Server Actions de Next.js (`4mb` configurado en `next.config.ts`).
* **Interfaz Mobile-First (`components/RecomendacionForm.tsx`, `app/recomendar/page.tsx`):**
  * Formulario completable en <60 segundos: selector de restaurante, selector/creador de plato, 5 estrellas táctiles grandes (≥ 44 px), input de foto con preview instantáneo y textarea con contador en tiempo real (`0/280`).
  * Enlace "+ Recomendar" visible en la cabecera móvil de la aplicación.
  * Renderizado compatible con Partial Prerendering (PPR) de Next.js 16 envolviendo el contenido dinámico en `<Suspense>`.
* **9 nuevas pruebas automatizadas (`tests/recomendar.test.ts`):** Verificación de compresión proporcional, límites de tamaño, rechazo a usuarios no autenticados, validaciones de inputs y rollback de Storage en caso de error de BD.
* **Total acumulado: 104 pruebas automatizadas pasando**, 0 vulnerabilidades en dependencias y compilación de Next.js 16 en verde.

---

## 3. Estado de Fases

### Fase 1 · Base (Completada al 100%)
* [x] Tarea 1.1 · Inicialización del proyecto Next.js + Tailwind + Vitest
* [x] Tarea 1.2 · Migración completa de base de datos y tipos TypeScript
* [x] Tarea 1.3 · Autenticación con Google y proxy de sesión
* [x] Tarea 1.4 · Proxy seguro de fotos y carga inicial de Google Places (79 restaurantes)
* [x] Tarea 1.5 · Pantalla principal Home mobile-first (375 px, 20 en 20, lazy loading, filtros y botón Vao)

*Criterio de éxito de Fase 1 cumplido:* Un usuario se registra con Google y ve la lista de restaurantes de Miraflores y Barranco.

### Fase 2 · Núcleo (En curso)
* [x] **Tarea 2.1 · Bucket de Supabase Storage para recomendaciones:**
  * Bucket `recomendaciones` con políticas de seguridad RLS en Storage (SELECT público, INSERT/UPDATE/DELETE exclusivos para autor con 2 segmentos exactos `<usuario_id>/<archivo>`, UPDATE con USING y WITH CHECK, trigger sincronizado y pruebas de magic bytes).
* [x] **Tarea 2.2 · Motor del Puntaje Vao y anti-spam:**
  * Funciones SQL puras en Postgres (`calcular_puntaje_vao`, `calcular_peso_recomendacion`), recálculo en bloque por categoría y distrito con `SECURITY DEFINER`, triggers tolerantes a borrado en cascada y espejo TypeScript idéntico en `lib/puntaje-vao.ts`.
* [x] **Tarea 2.3 · Recomendar un plato con foto (HU-02):**
  * Formulario mobile-first (<60s) en `/recomendar`, compresión Canvas que elimina EXIF/GPS (<3 MB), sin upsert (verificación previa y update selectivo), manejo concurrente de platos duplicados, rollback de Storage y 104 pruebas en verde.
* [x] **Tarea 2.4 · Validar recomendación con "¡Confirmo!" (HU-03):**
  * Server Action `toggleConfirmar` (`app/actions/validar.ts`): toggle DELETE→INSERT en `validaciones`, rate limit de 30/min por `confirmar:<user_id>` (no por IP), bloqueo de auto-validación en servidor, 23505 tratado como idempotente.
  * Componente `BotonConfirmar` (`components/BotonConfirmar.tsx`): `useOptimistic` + `useTransition` (patrón Next.js 16), área táctil ≥ 44 px, `aria-pressed` sincronizado, botón deshabilitado con tooltip para recomendaciones propias, flujo de login OAuth para sin-sesión.
  * Sección `RecomendacionesRecientes` (`components/RecomendacionesRecientes.tsx`): Server Component, últimas 10 recomendaciones visibles con joins a `platos`, `restaurantes` y `usuarios`, contadores y `yaConfirme` calculados en el servidor en una sola query batch.
  * Integración en `app/page.tsx` con su propio `<Suspense>` + skeleton animado.
  * **19 nuevas pruebas automatizadas** (`tests/validar.test.ts`): PARAMETRO_INVALIDO, NO_AUTENTICADO, LIMITE_VALIDACIONES, NOT_FOUND (inexistente y oculta), AUTO_VALIDACION, idempotencia 23505, clave de rate limit, firma de un solo argumento y lógica de estado optimista.
  * **Total acumulado: 123 pruebas automatizadas pasando**, 0 vulnerabilidades y build Next.js 16 en verde.
* [ ] **Tarea 2.5 · Búsqueda por plato, restaurante o cocina (HU-01):**
  * Barra de búsqueda reactiva (tolerante a tildes y sinónimos) con ordenamiento bayesiano por Puntaje Vao.

---

## 4. Pendientes para Fases Posteriores

### Fase 2 / Fase 4 · Recálculo periódico de antigüedad ($f_i$)
> ⚠️ **Recálculo periódico de factor de antigüedad ($f_i$):**
> * Las recomendaciones pierden peso cuando superan los 12 meses ($f_i$ pasa de 1.0 a 0.5) en función del paso del tiempo, incluso si no reciben nuevas validaciones o ediciones.
> * En Fase 4 o post-v1, programar una función periódica (pg_cron en Supabase o cron en Vercel) que invoque periódicamente el recálculo para platos con recomendaciones que hayan cruzado el umbral de los 12 meses.

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

8. **Convención unificada de rutas en Storage y base de datos:**
   Se unificó en todas las capas la convención de rutas relativas al bucket:
   - Nombre de bucket: `recomendaciones`
   - Formato de ruta / `foto_path`: `<usuario_id>/<uuid>.<ext>` (exactamente 2 segmentos, sin prefijo de bucket redundante).
   - Políticas RLS de `storage.objects` validan `(storage.foldername(name))[1] = auth.uid()::text`, `array_length(string_to_array(name, '/'), 1) = 2` y `name NOT LIKE '%..%'`.
   - La política UPDATE implementa simétricamente `USING` y `WITH CHECK` para bloquear cualquier intento de mover objetos a carpetas ajenas.
   - El trigger `handle_recomendacion_before_upsert` en Postgres valida esta misma convención de 2 segmentos antes de persistir en `recomendaciones.foto_path`.
   - `lib/storage.ts` y `lib/types.ts` aplican esta misma regla para validación y generación.

9. **Motor de Puntaje Vao bayesiano y única fuente de verdad en SQL:**
   - La base de datos es la única fuente de verdad para el cálculo que se persiste: funciones puras `calcular_puntaje_vao()` y `calcular_peso_recomendacion()`.
   - Constante $C=5.0$, tope de peso por validación $3.0$ y valor de reserva/fallback $m=3.5$ cuando no existen recomendaciones previas en la categoría y distrito.
   - Regla anti-spam: las confirmaciones de usuarios cuya cuenta tiene menos de 24 horas al momento de validar nunca se contabilizan en $v_i$.
   - Como $m$ depende de todas las recomendaciones de la categoría en el distrito, la función `recalcular_platos_categoria_distrito()` recalcula todos los platos de esa combinación en bloque.
   - Las funciones de recálculo usan `SECURITY DEFINER` y `SET search_path = public` para permitir actualizar `platos` sin conceder privilegios directos de UPDATE a usuarios autenticados.
   - El trigger de `validaciones` tolera borrados en cascada evitando fallos cuando la recomendación padre se elimina.

10. **Flujo de recomendación mobile-first, privacidad y manejo de concurrencia:**
    - Re-codificación nativa en Canvas de HTML5 para remover metadatos EXIF (coordenadas GPS) sin librerías externas.
    - Límite de Server Actions configurado en `next.config.ts` (`experimental.serverActions.bodySizeLimit: '4mb'`), límite de compresión cliente a 3 MB y validación de servidor a 3.5 MB (seguro para Vercel 4.5 MB).
    - No usar upsert: se consulta existencia previa para hacer `INSERT` o `UPDATE` específico (respetando los permisos por columna de RLS).
    - Rollback en Storage: si falla la inserción en base de datos, se borra la foto recién subida. Al editar con foto nueva, la anterior se borra únicamente tras la actualización exitosa.
    - Concurrencia de platos: si dos usuarios registran el mismo plato nuevo a la vez, se captura el error `23505` (unique en `restaurante_id, nombre_normalizado`) y se asocia al plato existente sin error.

---

## 6. Siguiente paso
* Proceder con el Plan First de la **Tarea 2.5**: Búsqueda por plato, restaurante o cocina (HU-01).
  * Barra de búsqueda reactiva con tolerancia a tildes, sinónimos y ordenamiento bayesiano por Puntaje Vao.
  * Además: las tarjetas de restaurantes mostrarán el Puntaje Vao y sus platos más validados (acordado al cerrar Tarea 2.3).
  * El valor de reserva `m = 3.5` se usará hasta que la categoría tenga al menos 10 recomendaciones visibles en el distrito.
