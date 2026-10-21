---
trigger: always_on
---

# Agente Vao · Parte 2: Especificación y criterios de éxito

Este archivo complementa `vao-01-rol-y-restricciones.md`. Aplica ambos siempre.

---

## 04 · ESPECIFICACIÓN — Inputs, datos y funcionalidades

### Especificación operativa (obligatoria en toda tarea)

Ante cualquier tarea o requerimiento, aplica obligatoriamente:

1. **Validación de inputs y reglas de negocio:** identifica con exactitud las entradas de datos requeridas, sus tipos, formatos, longitudes y rangos permitidos (ver "Inputs del usuario y validaciones").
2. **Protocolo "Plan First" (3 pasos obligatorios):** antes de escribir o modificar cualquier línea de código, entrega un plan estructurado:
    - **Paso 1 · Diagnóstico e impacto:** historia de usuario que atiendes, archivos a crear o modificar, tablas o servicios involucrados (Supabase, Google Places) y posibles impactos sobre lo que ya funciona.
    - **Paso 2 · Cambios atómicos:** lógica detallada, funciones o componentes a intervenir, manteniendo la compatibilidad con lo existente. Cada cambio debe ser pequeño y verificable por sí solo.
    - **Paso 3 · Estrategia de pruebas:** casos de prueba del flujo exitoso, de errores de validación y de casos límite (por ejemplo: foto de 6 MB, calificación 0, validar la propia recomendación, búsqueda sin resultados).
3. **Sincronización de capas:** los nombres de variables, propiedades y campos en común deben coincidir exactamente entre la interfaz, la lógica de negocio y la base de datos. Usa los nombres del modelo de datos (por ejemplo `puntaje_vao`, `calificacion`, `recomendacion_id`) y genera los tipos de TypeScript a partir del esquema de Supabase.

### Modelo de datos (Postgres en Supabase)

| Tabla | Campos | Reglas |
| --- | --- | --- |
| `usuarios` | id (uuid, = auth.users.id), nombre, email, foto_url, distrito, fecha_registro, nivel_confianza | Se crea al registrarse |
| `restaurantes` | id, google_place_id (único), nombre, direccion, distrito, lat, lng, tipo_cocina, rango_precio (1–4), foto_url | Se sincroniza desde Google Places |
| `categorias` | id, nombre, sinonimos (text[]) | Ej.: makis → {maki, makis, sushi roll} |
| `platos` | id, restaurante_id, categoria_id, nombre, precio_aprox, puntaje_vao, total_recomendaciones | Único por restaurante + nombre normalizado |
| `recomendaciones` | id, usuario_id, plato_id, calificacion (1–5), comentario (≤ 280 caracteres), foto_url, estado (visible / oculta), fecha | Única por usuario + plato |
| `validaciones` | id, usuario_id, recomendacion_id, fecha | Única por usuario + recomendación |
| `reportes` | id, usuario_id, recomendacion_id, motivo (spam / ofensivo / no es comida / otro), fecha | Único por usuario + recomendación |

### Inputs del usuario y validaciones

- **Búsqueda:** texto libre (1 a 60 caracteres) + distrito (lista cerrada: Miraflores, Barranco). Tolerante a mayúsculas, tildes, plurales y errores de tipeo simples, usando la tabla de sinónimos.
- **Recomendación:** restaurante (autocompletado de Google Places), plato (elegir existente o crear), calificación entera de 1 a 5 (obligatoria), foto JPG/PNG/WEBP de máximo 5 MB (obligatoria, se comprime antes de subir), comentario opcional de máximo 280 caracteres.
- **Validación:** un toque en "¡Confirmo!", reversible.

### Puntaje Vao de un plato

Promedio bayesiano ponderado por validaciones:

```
Puntaje = (C·m + Σ wᵢ·rᵢ) / (C + Σ wᵢ)
wᵢ = min(1 + 0.25·vᵢ, 3) · fᵢ
```

- rᵢ = calificación de la recomendación; vᵢ = sus validaciones.
- fᵢ = 1 si la recomendación tiene menos de 12 meses; 0.5 si es más antigua.
- m = promedio de la categoría en el distrito; C = 5.
- Guarda C, el peso por validación y el tope como constantes configurables.
- El puntaje se recalcula al crear, editar o validar una recomendación, nunca en cada búsqueda.

**Puntaje del restaurante en una búsqueda:** el de su mejor plato que coincide con el texto buscado. Si se busca por nombre o tipo de cocina, el promedio de sus 3 mejores platos.

### Funcionalidades del MVP v1 (historias de usuario)

Cada tarea que hagas debe responder a una de estas historias. Al planificar, indica qué historia atiendes; al terminar, verifica sus criterios de aceptación uno por uno.

**HU-01 · Buscar dónde comer**
> Yo como foodie en Lima, quiero buscar restaurantes por plato, restaurante o tipo de cocina en un distrito y ver los mejor calificados por otros usuarios, con fotos y recomendaciones validadas por la comunidad, para decidir con confianza dónde comer sin revisar TikTok, Instagram y Google por separado.

*Criterios de aceptación:*
- Resultados ordenados por puntaje Vao, con nombre, foto, puntaje, distrito y sus 3 platos más validados.
- Sin resultados: sugerir otra categoría o distrito.
- Respuesta en menos de 2 segundos.

**HU-02 · Recomendar un plato**
> Yo como foodie, quiero recomendar un plato con foto y calificación, para ayudar a otros y que mi recomendación gane validaciones.

*Criterios de aceptación:*
- Formulario completable en menos de 60 segundos.
- Una recomendación por usuario y plato; editable por su autor.

**HU-03 · Validar una recomendación**
> Yo como usuario que ya probó un plato, quiero confirmar la recomendación de otro con un "¡Confirmo!", para reforzar la confianza en ella.

*Criterios de aceptación:*
- Una validación por usuario y recomendación; reversible.
- Prohibido validar las propias recomendaciones.
- El contador se actualiza al instante (actualización optimista).

**HU-04 · Ficha del restaurante**
> Yo como foodie, quiero ver en un solo lugar los platos recomendados de un restaurante y cómo llegar, para saber qué pedir y decidir ir.

*Criterios de aceptación:*
- Dirección, mapa y horario desde Google Places.
- Platos ordenados por puntaje, con fotos, validaciones y las 3 recomendaciones más validadas de cada uno.
- Botón "¡Vao!" que abre la ruta en Google Maps.

### Moderación y calidad de datos (sin IA)

El MVP v1 no usa inteligencia artificial. La calidad se cuida con reglas simples:

1. **Reportes de la comunidad:** cada recomendación tiene un botón "Reportar" con motivo. Con 3 reportes de usuarios distintos, pasa a estado `oculta` hasta revisión manual.
2. **Platos sin duplicados:** al recomendar, el campo del plato autocompleta los platos que ya existen en ese restaurante, para elegir uno en vez de crear otro. La categoría se asigna con la tabla de sinónimos o la elige el usuario de una lista.
3. **Revisión manual:** un usuario con rol de administrador puede ver las recomendaciones ocultas, restaurarlas o eliminarlas.

La IA (resúmenes, moderación automática y búsqueda en lenguaje natural) queda para la v2.

---

## 06 · CRITERIOS DE ÉXITO — Resultado esperado

### Estándares de todo entregable técnico

- **Backend y datos:** todas las respuestas de la API son JSON estructurado y predecible, con el mismo formato en éxito y en error. Por ejemplo: `{ "ok": true, "data": {...} }` o `{ "ok": false, "error": { "codigo": "FOTO_MUY_PESADA", "mensaje": "La foto supera los 5 MB" } }`.
- **Frontend y UX:** interfaz responsiva, moderna y accesible, con feedback visual claro en pantalla: estados de carga, mensajes de éxito, errores en lenguaje simple junto al campo que falló y estados vacíos con una sugerencia.
- **Calidad:** código modular, documentado en los puntos críticos (cálculo del puntaje Vao, reglas anti-spam, reportes, políticas RLS) y sin errores ni advertencias en la consola del navegador ni en la terminal.

### Plan de construcción por fases

| Fase | Entregable | Listo cuando… |
| --- | --- | --- |
| 1. Base | Proyecto Next.js + Supabase, login, esquema y migraciones, carga de restaurantes desde Google Places | Un usuario se registra con Google y ve la lista de restaurantes de Miraflores y Barranco |
| 2. Núcleo | Búsqueda, ranking, publicar y validar recomendaciones | HU-01, HU-02 y HU-03 cumplen todos sus criterios |
| 3. Ficha y moderación | Ficha del restaurante, botón "¡Vao!", reportes y panel de administrador | HU-04 cumple sus criterios y una recomendación con 3 reportes queda oculta |
| 4. Pulido | PWA instalable, estados vacíos, de carga y de error, despliegue en Vercel | La app se instala en el celular y pasa la lista de verificación final |

### Lista de verificación final

- [ ] Las 4 historias de usuario cumplen todos sus criterios de aceptación.
- [ ] La búsqueda responde en menos de 2 segundos con datos de prueba (300 recomendaciones).
- [ ] Publicar una recomendación toma menos de 60 segundos.
- [ ] Ninguna clave secreta aparece en el código del cliente.
- [ ] RLS impide editar o borrar contenido ajeno (probado con dos usuarios).
- [ ] `.env.local` no está en el repositorio de GitHub y existe `.env.example` sin valores.
- [ ] Una recomendación con 3 reportes de usuarios distintos queda oculta.
- [ ] Un usuario no puede borrar ni reemplazar fotos ajenas en el Storage.
- [ ] El límite de peticiones bloquea un exceso de solicitudes con un error JSON claro.
- [ ] `npm audit` no reporta vulnerabilidades altas ni críticas.
- [ ] Pruebas automatizadas para la fórmula del puntaje Vao y las reglas anti-spam.
- [ ] La app funciona en un celular de 375 px de ancho sin desplazamiento horizontal.
- [ ] Lighthouse móvil: 85 o más en rendimiento y accesibilidad.
- [ ] Un script de datos semilla carga restaurantes y recomendaciones de prueba.
- [ ] README con instalación, variables de entorno y despliegue.

### Formato de cada entrega

Al terminar cada tarea, responde con:
1. **Qué hice:** resumen en 2 o 3 líneas.
2. **Archivos creados o modificados.**
3. **Cómo probarlo:** pasos concretos.
4. **Pendientes o riesgos detectados.**
5. **Siguiente paso propuesto.**