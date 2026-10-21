# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 1 (Base)
* **Tarea actual:** Tarea 1.2 finalizada · Lista para iniciar Tarea 1.3
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
  * **Permisos por columna** (`REVOKE`/`GRANT` por columna) para proteger campos sensibles:
    * `usuarios`: el cliente solo puede editar `nombre`, `foto_url`, `distrito`.
    * `recomendaciones`: el cliente solo puede editar `calificacion`, `comentario`, `foto_path`.
    * `platos`: el cliente no puede definir `puntaje_vao` ni `total_recomendaciones` al insertar.
  * **Trigger `handle_new_user`**: crea automáticamente la fila en `usuarios` al registrarse con Google. Sanitiza el nombre (NULLIF, left(100), trim) para evitar fallos de login.
  * **Trigger `handle_reporte_inserted`**: oculta automáticamente una recomendación al alcanzar 3 reportes de usuarios distintos.
  * **Trigger `handle_recomendacion_before_upsert`** (BEFORE INSERT OR UPDATE OF foto_path):
    * Aplica el límite de 10 recomendaciones por usuario cada 24 horas.
    * Fuerza `fecha := NOW()` y `estado := 'visible'` en el servidor (el cliente no puede trucarlos).
    * Valida que `foto_path` empiece con `recomendaciones/<usuario_id>/` (cada usuario solo en su carpeta).
  * **Datos semilla** de 3 categorías con sinónimos (`makis`, `ceviche`, `hamburguesas`).
  * **9 índices** de rendimiento para búsquedas frecuentes.
  * **Extensiones** `pg_trgm` y `unaccent` para búsquedas tolerantes a errores y tildes.
* Tipos TypeScript en `lib/types.ts` sincronizados con el esquema (incluye `foto_path`, `buildFotoUrl()`, `isFotoPathValida()`).
* **20 pruebas automatizadas** que verifican permisos por columna, triggers, validaciones y tipos.

---

## 3. Qué falta (Fase 1 - Base)

* [ ] **Tarea 1.3 · Autenticación con Google (Supabase Auth):**
  * Guía paso a paso para Google Cloud Console y panel de Supabase.
  * Instalación y configuración de `@supabase/ssr`.
  * Clientes Supabase para navegador (`lib/supabase/client.ts`) y servidor (`lib/supabase/server.ts`).
  * Pantalla `/login` con botón de Google y ruta `/auth/callback`.
  * Prueba automatizada de sesión/redirección.

* [ ] **Tarea 1.4 · Proxy seguro de fotos y script manual de Google Places:**
  * Route Handler `/api/places/photo` con rate-limiting por IP y validación de que la referencia exista en la tabla `restaurantes`.
  * Script manual `scripts/seed-places.ts` (exactamente 6 consultas: 2 distritos × 3 categorías).
  * Pruebas automatizadas de seguridad del proxy.

* [ ] **Tarea 1.5 · Pantalla principal (Home) mobile-first:**
  * Vista principal en 375 px listando restaurantes con fotos, distritos y tipo de cocina.
  * Estados visuales: cargando (skeletons), vacío amigable y errores.
  * Prueba de interfaz sin desbordamiento horizontal.

---

## 4. Pendientes para Fase 2

> ⚠️ **Bucket de Supabase Storage** — Crear manualmente el bucket `recomendaciones` con las siguientes políticas de Storage (no es SQL de tabla, se configura en el panel de Supabase o vía API de administración):
>
> * **INSERT (subir):** solo usuarios autenticados pueden subir archivos, y únicamente a la ruta `recomendaciones/<su_id>/`. La ruta no puede contener `..` (traversal de directorios).
> * **UPDATE (reemplazar):** un usuario solo puede reemplazar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **DELETE (borrar):** un usuario solo puede borrar archivos dentro de `recomendaciones/<su_id>/`. Prohibido `..`.
> * **SELECT (leer/descargar):** lectura pública para todos (las fotos son visibles en la app).
> * Estas políticas deben crearse como Storage Policies en el panel de Supabase → Storage → Policies, o mediante el cliente `@supabase/supabase-js` con `storageFrom().createPolicy()`.

---

## 5. Decisiones tomadas

1. **Modelo de datos integral en la primera migración:**
   Las 7 tablas con sus RLS y relaciones se crearon en la Tarea 1.2 para evitar cambios estructurales destructivos en la Fase 2.

2. **`foto_path` en lugar de `foto_url` en `recomendaciones`:**
   Se guarda solo la ruta relativa dentro del bucket (`recomendaciones/<usuario_id>/<archivo>`). La URL pública se construye en la app con `buildFotoUrl()`. Esto desacopla el dato del entorno (desarrollo/producción) y facilita migraciones de bucket sin tocar la base de datos.

3. **Seguridad de fotos de Google Places:**
   Las fotos de restaurantes se sirven mediante proxy interno (`/api/places/photo`), que validará que la referencia exista en la tabla `restaurantes` y limitará peticiones por IP. La API Key de Google nunca llega al navegador.

4. **Control y transparencia de cuota de Google Places:**
   La carga de restaurantes es un script manual con cómputo explícito de consultas (6 exactas: 2 distritos × 3 categorías).

5. **Política Plan First y calidad continua:**
   Cada tarea incluye al menos una prueba automatizada, cierra con un commit descriptivo en español y tiene una pausa para validación antes de continuar.

---

## 6. Siguiente paso
* Iniciar la **Tarea 1.3**: Instalar `@supabase/ssr`, crear los clientes de Supabase para cliente y servidor, entregar la guía paso a paso para configurar OAuth con Google en Google Cloud Console y en el panel de Supabase, crear la pantalla `/login` y la ruta `/auth/callback`.
