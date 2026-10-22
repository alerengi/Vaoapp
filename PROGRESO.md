# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 1 (Base)
* **Tarea actual:** Tarea 1.3 finalizada · Lista para iniciar Tarea 1.4
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
* Script SQL `supabase/migrations/001_modelo_completo_vao.sql` con:
  * Las **7 tablas** del modelo completo: `usuarios`, `categorias`, `restaurantes`, `platos`, `recomendaciones`, `validaciones`, `reportes`.
  * **Políticas RLS** en todas las tablas (lectura pública controlada, escritura solo del propio contenido).
  * **Permisos por columna** (`REVOKE`/`GRANT` por columna) para proteger campos sensibles.
  * **Trigger `handle_new_user`**: crea automáticamente la fila en `usuarios` al registrarse con Google. Sanitiza el nombre (NULLIF, left(100), trim) para evitar fallos de login.
  * **Trigger `handle_reporte_inserted`**: oculta automáticamente una recomendación al alcanzar 3 reportes de usuarios distintos.
  * **Trigger `handle_recomendacion_before_upsert`** (BEFORE INSERT OR UPDATE OF foto_path):
    * Aplica el límite de 10 recomendaciones por usuario cada 24 horas.
    * Fuerza `fecha := NOW()` y `estado := 'visible'` en el servidor.
    * Valida que `foto_path` empiece con `recomendaciones/<usuario_id>/`.
  * **Datos semilla** de 3 categorías con sinónimos (`makis`, `ceviche`, `hamburguesas`).
  * **9 índices** de rendimiento para búsquedas frecuentes.
  * **Extensiones** `pg_trgm` y `unaccent` para búsquedas tolerantes a errores y tildes.
* Tipos TypeScript en `lib/types.ts` sincronizados con el esquema (incluye `foto_path`, `buildFotoUrl()`, `isFotoPathValida()`).
* **20 pruebas automatizadas** que verifican permisos por columna, triggers, validaciones y tipos.

### Tarea 1.3 · Autenticación con Google (Supabase Auth)
* Paquetes `@supabase/supabase-js` y `@supabase/ssr` instalados con override seguro de `braces` para `npm audit` limpio.
* Implementación de clientes Supabase:
  * `lib/supabase/client.ts`: cliente browser singleton con `createBrowserClient`.
  * `lib/supabase/server.ts`: cliente de servidor con `createServerClient` y cookies asíncronas de Next.js 16.
  * `lib/supabase/proxy.ts`: refresco automático de sesión y cookies httpOnly usando validación estricta en servidor con `supabase.auth.getUser()`.
* Archivo `proxy.ts` en raíz del proyecto (convención estándar de Next.js 16 para sustituir a `middleware.ts`).
* Route Handler `/auth/callback` con intercambio seguro de código por sesión y sanitización de ruta contra ataques de Open Redirect (`lib/auth-utils.ts`).
* Componentes de interfaz móvil-first:
  * `components/AuthButton.tsx`: botón interactivo "Continuar con Google", indicador de carga y estado autenticado (avatar, nombre, botón "Cerrar sesión").
  * `components/AuthErrorBanner.tsx`: banner de feedback de error OAuth envuelto en `<Suspense>` para compatibilidad con Partial Prerendering de Next.js 16.
  * `app/page.tsx`: pantalla de bienvenida de Vao mobile-first con el botón de login integrado.
* **11 nuevas pruebas automatizadas** (`tests/auth.test.ts`) cubriendo Open Redirect, `/auth/callback` y `updateSession`.
* **Total acumulado: 35 pruebas automatizadas pasando**, 0 vulnerabilidades en dependencias de producción y build de Next.js 16 verificado en verde.

---

## 3. Qué falta (Fase 1 - Base)

* [x] **Tarea 1.3 · Autenticación con Google (Supabase Auth)** (Terminada)
* [ ] **Tarea 1.4 · Proxy seguro de fotos y script manual de Google Places:**
  * Route Handler `/api/places/photo` con rate-limiting por IP y validación de que la referencia exista en la tabla `restaurantes`.
  * Script manual `scripts/seed-places.ts` (exactamente 6 consultas: 2 distritos × 3 categorías).
  * Pruebas automatizadas de seguridad del proxy.
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

---

## 5. Decisiones tomadas

1. **Next.js 16 y convención `proxy.ts`:**
   En Next.js 16, la convención `middleware.ts` está en desuso y se ha renombrado formalmente a `proxy.ts`. Se configuró `proxy.ts` en la raíz del proyecto para ejecutar `updateSession()` con `@supabase/ssr`.

2. **Validación estricta con `supabase.auth.getUser()`:**
   En el servidor y en el proxy no se confía ciegamente en `getSession()`. Se invoca `getUser()` que valida el JWT contra el servidor de Supabase y refresca tokens transparentemente.

3. **Protección estricta contra Open Redirect:**
   La función `getSafeRedirectPath` en `lib/auth-utils.ts` valida cualquier redirección posterior al login, garantizando que el usuario solo pueda ser redirigido a rutas internas del dominio (`/`, `/explorar`, etc.) y rechazando URLs absolutas (`https://...`), esquemas relativos (`//...`) y backslashes.

4. **Compatibilidad con Partial Prerendering de Next.js 16:**
   El banner de error que lee parámetros de búsqueda (`searchParams`) se aisló en `AuthErrorBanner` y se envolvió en `<Suspense>`, permitiendo a Next.js 16 pre-renderizar estáticamente el shell de la página de inicio.

---

## 6. Siguiente paso
* Iniciar la **Tarea 1.4**: Crear el proxy seguro `/api/places/photo` (con rate limiting y validación contra tabla `restaurantes`) y el script manual de semilla de Google Places con exactamente 6 consultas.
