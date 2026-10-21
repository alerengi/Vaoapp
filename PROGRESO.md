# Registro de Progreso · Proyecto Vao

## 1. Fase y tarea actuales
* **Fase:** Fase 1 (Base)
* **Tarea actual:** Tarea 1.1 finalizada · Lista para iniciar Tarea 1.2
* **Fecha de actualización:** 2026-10-21

---

## 2. Qué quedó terminado
* **Inicialización técnica:** Proyecto configurado con Next.js 16 (App Router), TypeScript y Tailwind CSS.
* **Seguridad de variables y secretos:**
  * `.gitignore` actualizado para ignorar de forma estricta cualquier archivo `.env*` con valores y permitir únicamente `.env.example`.
  * `.env.example` creado y documentado con las variables requeridas para Supabase y Google Places (sin secretos expuestos).
  * Módulo `lib/env.ts` para validación tipada de variables públicas y de servidor.
* **Infraestructura de pruebas automatizadas:**
  * Vitest + jsdom + `@testing-library/react` instalados y configurados en `vitest.config.mts` con alias `@/`.
  * Scripts `test` y `test:watch` integrados en `package.json`.
  * Suite de 4 pruebas en `tests/env.test.ts` pasando al 100% (verificación de presencia de variables, prevención de prefijo `NEXT_PUBLIC_` en secretos y validación de `.env.example`).
* **Verificación de compilación:** `npm run build` ejecutado y pasando sin errores.
* **Control de versiones:** Primer commit realizado (`chore: inicializar proyecto nextjs, tailwind y vitest con configuracion segura`).

---

## 3. Qué falta (Fase 1 - Base)
* [ ] **Tarea 1.2 · Migración completa de base de datos en Supabase:**
  * Archivo SQL con las 7 tablas (`usuarios`, `restaurantes`, `categorias`, `platos`, `recomendaciones`, `validaciones`, `reportes`).
  * Políticas RLS (Row Level Security) completas para cada tabla.
  * Trigger automático para sincronizar nuevos usuarios de Supabase Auth con la tabla `usuarios`.
  * Datos semilla para las 3 categorías iniciales (`makis`, `ceviche`, `hamburguesas`) con sinónimos.
  * Tipos de TypeScript derivados del esquema y prueba automatizada.
* [ ] **Tarea 1.3 · Autenticación con Google (Supabase Auth):**
  * Guía paso a paso para Google Cloud Console y panel de Supabase.
  * Clientes `@supabase/ssr` para cliente y servidor.
  * Pantalla `/login` y ruta `/auth/callback`.
  * Prueba automatizada de sesión/redirección.
* [ ] **Tarea 1.4 · Proxy seguro de fotos y carga manual de Google Places:**
  * Route Handler `/api/places/photo` con rate-limiting por IP y validación de que la referencia exista en la tabla `restaurantes`.
  * Script manual `scripts/seed-places.ts` (6 consultas calculadas: 2 distritos × 3 categorías).
  * Pruebas automatizadas de seguridad del proxy.
* [ ] **Tarea 1.5 · Pantalla principal (Home) mobile-first:**
  * Vista principal en 375 px listando restaurantes con fotos, distritos y tipo de cocina.
  * Estados visuales: cargando (skeletons), vacío amigable y errores.
  * Prueba de interfaz sin desbordamiento horizontal.

---

## 4. Decisiones tomadas
1. **Modelo de datos integral en la primera migración:**
   Se incluirán las 7 tablas del modelo desde la Tarea 1.2 (con sus RLS y relaciones) para no realizar cambios estructurales destructivos en la Fase 2.
2. **Seguridad absoluta en fotos de Google Places:**
   La clave de Google nunca se expondrá en URLs del cliente. Las fotos se servirán mediante un endpoint proxy interno (`/api/places/photo`), el cual validará que la referencia solicitada exista en la base de datos de restaurantes y aplicará un límite de peticiones por IP para proteger la cuota.
3. **Control y transparencia de cuota de Google Places:**
   La carga de restaurantes será un script que el usuario ejecutará manualmente, con conocimiento explícito previo de que consumirá exactamente 6 consultas de búsqueda.
4. **Política Plan First y calidad continua:**
   Cada tarea se acompaña de al menos una prueba automatizada en Vitest, se cierra con un commit específico en español y se detiene para la validación del usuario antes de pasar a la siguiente.

---

## 5. Siguiente paso
* Iniciar la **Tarea 1.2**: Generar el script SQL de migración completa (`supabase/migrations/001_modelo_completo_vao.sql`), crear los tipos base de TypeScript, añadir la prueba unitaria correspondiente y proporcionar la guía paso a paso para ejecutar el SQL en el editor de Supabase.
