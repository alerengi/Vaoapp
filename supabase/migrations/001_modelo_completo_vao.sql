-- =============================================================================
-- MIGRACIÓN 001: Modelo de Datos Completo de Vao
-- =============================================================================
-- Descripción: Crea las 7 tablas del modelo, funciones auxiliares, trigger de
--              sincronización de usuarios, políticas RLS y datos semilla de
--              categorías. Esta es la única migración de esquema de la Fase 1.
-- Convenciones:
--   - Todos los ids son UUID generados por PostgreSQL.
--   - Las fechas se almacenan en UTC con zona horaria (timestamptz).
--   - Los nombres de campos están en español para coincidir con el modelo.
--   - RLS habilitado en todas las tablas.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- EXTENSIONES
-- -----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "pg_trgm";   -- búsqueda tolerante a errores de tipeo
CREATE EXTENSION IF NOT EXISTS "unaccent";  -- búsqueda sin distinción de tildes


-- =============================================================================
-- TABLA 1: usuarios
-- Cada fila representa un usuario registrado. El id es el mismo que auth.users.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.usuarios (
    id               UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    nombre           TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 100),
    email            TEXT NOT NULL UNIQUE,
    foto_url         TEXT,
    distrito         TEXT,
    fecha_registro   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    nivel_confianza  SMALLINT NOT NULL DEFAULT 1 CHECK (nivel_confianza BETWEEN 1 AND 5)
);

-- Activa la seguridad por fila
ALTER TABLE public.usuarios ENABLE ROW LEVEL SECURITY;

-- Política: Cualquier persona puede ver el perfil público de un usuario
CREATE POLICY "usuarios_lectura_publica"
    ON public.usuarios FOR SELECT
    USING (true);

-- Política: Solo el propio usuario puede editar su perfil
CREATE POLICY "usuarios_edicion_propia"
    ON public.usuarios FOR UPDATE
    USING (auth.uid() = id)
    WITH CHECK (auth.uid() = id);

-- NOTA: La política de INSERT en 'usuarios' se elimina intencionalmente.
-- El trigger handle_new_user() (SECURITY DEFINER) es el único responsable de
-- crear la fila al registrarse. Un INSERT directo desde el cliente es innecesario
-- y representa una superficie de ataque evitable.

-- Permisos por columna en 'usuarios'
-- El rol 'authenticated' NO puede tocar email, fecha_registro ni nivel_confianza.
-- Primero quitamos el permiso genérico de UPDATE y luego lo devolvemos solo en
-- las columnas que el usuario debe poder editar.
REVOKE UPDATE ON public.usuarios FROM authenticated;
GRANT  UPDATE (nombre, foto_url, distrito) ON public.usuarios TO authenticated;


-- =============================================================================
-- TABLA 2: categorias
-- Lista cerrada de tipos de platos buscables. Los sinónimos permiten encontrar
-- la categoría aunque el usuario escriba "maki", "makis" o "sushi roll".
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.categorias (
    id        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    nombre    TEXT NOT NULL UNIQUE CHECK (char_length(nombre) BETWEEN 1 AND 60),
    sinonimos TEXT[] NOT NULL DEFAULT '{}'
);

ALTER TABLE public.categorias ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver las categorías (es un catálogo público)
CREATE POLICY "categorias_lectura_publica"
    ON public.categorias FOR SELECT
    USING (true);

-- Política: Nadie puede insertar/editar/borrar categorías desde el cliente.
--           Solo el rol service_role (servidor/scripts) puede modificarlas.
-- (Sin políticas de escritura = el cliente no puede escribir aunque intente)


-- =============================================================================
-- TABLA 3: restaurantes
-- Datos sincronizados desde Google Places. El campo google_place_id es la llave
-- que evita duplicados. photo_reference almacena el token de foto de Google;
-- la URL real nunca llega al cliente (se sirve vía proxy).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.restaurantes (
    id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    google_place_id  TEXT NOT NULL UNIQUE,
    nombre           TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 200),
    direccion        TEXT,
    distrito         TEXT NOT NULL,
    lat              DOUBLE PRECISION,
    lng              DOUBLE PRECISION,
    tipo_cocina      TEXT,
    rango_precio     SMALLINT CHECK (rango_precio BETWEEN 1 AND 4),
    photo_reference  TEXT,   -- Token privado de Google Places (nunca al cliente)
    fecha_sync       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.restaurantes ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden leer la lista de restaurantes
CREATE POLICY "restaurantes_lectura_publica"
    ON public.restaurantes FOR SELECT
    USING (true);

-- Política: Solo el servidor (service_role) puede insertar o actualizar restaurantes.
-- (Sin políticas de escritura para usuarios = el cliente no puede modificarlos)


-- =============================================================================
-- TABLA 4: platos
-- Un plato pertenece a un restaurante y a una categoría. El nombre se normaliza
-- para evitar duplicados ("Maki Spicy" vs "maki spicy"). puntaje_vao se
-- recalcula al crear, editar o validar una recomendación.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.platos (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    restaurante_id        UUID NOT NULL REFERENCES public.restaurantes(id) ON DELETE CASCADE,
    categoria_id          UUID NOT NULL REFERENCES public.categorias(id),
    nombre                TEXT NOT NULL CHECK (char_length(nombre) BETWEEN 1 AND 150),
    nombre_normalizado    TEXT GENERATED ALWAYS AS (lower(trim(nombre))) STORED,
    precio_aprox          NUMERIC(8,2),
    puntaje_vao           NUMERIC(4,2) NOT NULL DEFAULT 0 CHECK (puntaje_vao BETWEEN 0 AND 5),
    total_recomendaciones INTEGER NOT NULL DEFAULT 0 CHECK (total_recomendaciones >= 0),
    UNIQUE (restaurante_id, nombre_normalizado)   -- no duplicados por restaurante
);

ALTER TABLE public.platos ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver los platos
CREATE POLICY "platos_lectura_publica"
    ON public.platos FOR SELECT
    USING (true);

-- Política: Solo usuarios autenticados pueden crear platos (al recomendar)
CREATE POLICY "platos_insercion_autenticada"
    ON public.platos FOR INSERT
    WITH CHECK (auth.role() = 'authenticated');

-- Política: El servidor (service_role) puede actualizar puntaje_vao y contadores.
-- Los usuarios NO pueden modificar platos directamente.

-- Permisos por columna en 'platos'
-- Un usuario autenticado solo puede proporcionar los campos descriptivos al crear
-- un plato. Los campos puntaje_vao y total_recomendaciones tienen DEFAULT 0 y
-- el rol authenticated no puede sobreescribirlos.
REVOKE INSERT ON public.platos FROM authenticated;
GRANT  INSERT (restaurante_id, categoria_id, nombre, precio_aprox) ON public.platos TO authenticated;


-- =============================================================================
-- TABLA 5: recomendaciones
-- La unidad de valor de Vao. Un usuario recomienda un plato con foto,
-- calificación y comentario opcional. Estado 'visible' por defecto; pasa a
-- 'oculta' si acumula 3 reportes de usuarios distintos.
--
-- foto_path: ruta relativa dentro del bucket de Supabase Storage.
-- Formato obligatorio: recomendaciones/<usuario_id>/<nombre_archivo>
-- La URL pública se construye en la app concatenando la URL base del proyecto.
-- Nunca se guarda la URL completa para que el path no dependa del entorno.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.recomendaciones (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id    UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    plato_id      UUID NOT NULL REFERENCES public.platos(id) ON DELETE CASCADE,
    calificacion  SMALLINT NOT NULL CHECK (calificacion BETWEEN 1 AND 5),
    comentario    TEXT CHECK (char_length(comentario) <= 280),
    foto_path     TEXT NOT NULL,   -- ruta relativa en Storage: recomendaciones/<uid>/<archivo>
    estado        TEXT NOT NULL DEFAULT 'visible' CHECK (estado IN ('visible', 'oculta')),
    fecha         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, plato_id)  -- una recomendación por usuario y plato
);

ALTER TABLE public.recomendaciones ENABLE ROW LEVEL SECURITY;

-- Política: Cualquiera puede ver recomendaciones visibles
CREATE POLICY "recomendaciones_lectura_visibles"
    ON public.recomendaciones FOR SELECT
    USING (estado = 'visible');

-- Política: El autor también puede ver sus propias recomendaciones (aunque estén ocultas)
CREATE POLICY "recomendaciones_lectura_propias"
    ON public.recomendaciones FOR SELECT
    USING (auth.uid() = usuario_id);

-- Política: Solo usuarios autenticados pueden crear recomendaciones
CREATE POLICY "recomendaciones_insercion_autenticada"
    ON public.recomendaciones FOR INSERT
    WITH CHECK (auth.role() = 'authenticated' AND auth.uid() = usuario_id);

-- Política: Solo el autor puede editar su propia recomendación
CREATE POLICY "recomendaciones_edicion_propia"
    ON public.recomendaciones FOR UPDATE
    USING (auth.uid() = usuario_id)
    WITH CHECK (auth.uid() = usuario_id);

-- Política: Solo el autor puede borrar su propia recomendación
CREATE POLICY "recomendaciones_borrado_propio"
    ON public.recomendaciones FOR DELETE
    USING (auth.uid() = usuario_id);

-- Permisos por columna en 'recomendaciones'
-- El autor puede editar solo los campos descriptivos de su recomendación.
-- NO puede tocar estado (para no reactivar una oculta), ni plato_id,
-- usuario_id ni fecha.
REVOKE UPDATE ON public.recomendaciones FROM authenticated;
GRANT  UPDATE (calificacion, comentario, foto_path) ON public.recomendaciones TO authenticated;


-- =============================================================================
-- TABLA 6: validaciones
-- El "¡Confirmo!" de otro usuario a una recomendación. Es reversible (se puede
-- borrar). Un usuario no puede confirmar sus propias recomendaciones.
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.validaciones (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    recomendacion_id  UUID NOT NULL REFERENCES public.recomendaciones(id) ON DELETE CASCADE,
    fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, recomendacion_id)  -- una validación por usuario y recomendación
);

ALTER TABLE public.validaciones ENABLE ROW LEVEL SECURITY;

-- Política: Todos pueden ver cuántas validaciones tiene una recomendación
CREATE POLICY "validaciones_lectura_publica"
    ON public.validaciones FOR SELECT
    USING (true);

-- Política: Solo usuarios autenticados pueden validar,
--           y no pueden validar sus propias recomendaciones.
CREATE POLICY "validaciones_insercion_autenticada"
    ON public.validaciones FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = usuario_id
        -- Verificar que la recomendación no pertenece al usuario que valida
        AND NOT EXISTS (
            SELECT 1 FROM public.recomendaciones r
            WHERE r.id = recomendacion_id AND r.usuario_id = auth.uid()
        )
    );

-- Política: Solo el propio usuario puede retirar (borrar) su validación
CREATE POLICY "validaciones_borrado_propio"
    ON public.validaciones FOR DELETE
    USING (auth.uid() = usuario_id);


-- =============================================================================
-- TABLA 7: reportes
-- Señalización comunitaria de contenido inapropiado. Con 3 reportes de usuarios
-- distintos, la recomendación pasa a estado 'oculta' automáticamente (via trigger).
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.reportes (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    usuario_id        UUID NOT NULL REFERENCES public.usuarios(id) ON DELETE CASCADE,
    recomendacion_id  UUID NOT NULL REFERENCES public.recomendaciones(id) ON DELETE CASCADE,
    motivo            TEXT NOT NULL CHECK (motivo IN ('spam', 'ofensivo', 'no_es_comida', 'otro')),
    fecha             TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (usuario_id, recomendacion_id)  -- un reporte por usuario y recomendación
);

ALTER TABLE public.reportes ENABLE ROW LEVEL SECURITY;

-- Política: Solo los administradores (service_role) pueden ver todos los reportes.
--           Un usuario solo puede ver sus propios reportes (para saber que ya reportó).
CREATE POLICY "reportes_lectura_propia"
    ON public.reportes FOR SELECT
    USING (auth.uid() = usuario_id);

-- Política: Solo usuarios autenticados pueden reportar, y no sus propios contenidos.
CREATE POLICY "reportes_insercion_autenticada"
    ON public.reportes FOR INSERT
    WITH CHECK (
        auth.role() = 'authenticated'
        AND auth.uid() = usuario_id
        AND NOT EXISTS (
            SELECT 1 FROM public.recomendaciones r
            WHERE r.id = recomendacion_id AND r.usuario_id = auth.uid()
        )
    );


-- =============================================================================
-- FUNCIÓN Y TRIGGER: Crear fila en 'usuarios' al registrarse en Supabase Auth
-- Esto sucede automáticamente cuando alguien hace login con Google por primera vez.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER  -- corre con permisos de super usuario para poder insertar
SET search_path = public
AS $$
DECLARE
    v_nombre TEXT;
BEGIN
    -- Obtener el nombre completo del proveedor OAuth y sanearlo:
    -- 1. NULLIF descarta cadenas vacías (convierte '' en NULL).
    -- 2. left(..., 100) recorta a 100 caracteres si el nombre es muy largo.
    -- 3. trim elimina espacios sobrantes al inicio y al final.
    -- 4. Si todo lo anterior devuelve NULL, usa la parte local del email.
    v_nombre := COALESCE(
        NULLIF(trim(left(NEW.raw_user_meta_data->>'full_name', 100)), ''),
        split_part(NEW.email, '@', 1)
    );

    INSERT INTO public.usuarios (id, nombre, email, foto_url)
    VALUES (
        NEW.id,
        v_nombre,
        NEW.email,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO NOTHING;  -- idempotente: si ya existe, no falla
    RETURN NEW;
END;
$$;

-- Asociar la función al evento de nuevo usuario en Supabase Auth
CREATE OR REPLACE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_new_user();


-- =============================================================================
-- FUNCIÓN Y TRIGGER: Ocultar recomendación al acumular 3 reportes
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_reporte_inserted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_reportes INTEGER;
BEGIN
    SELECT COUNT(*) INTO total_reportes
    FROM public.reportes
    WHERE recomendacion_id = NEW.recomendacion_id;

    IF total_reportes >= 3 THEN
        UPDATE public.recomendaciones
        SET estado = 'oculta'
        WHERE id = NEW.recomendacion_id;
    END IF;

    RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER on_reporte_inserted
    AFTER INSERT ON public.reportes
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_reporte_inserted();


-- =============================================================================
-- FUNCIÓN Y TRIGGER: Límite diario + validación de foto_path
-- Corre BEFORE INSERT y BEFORE UPDATE OF foto_path, cubriendo ambos casos.
-- Reglas:
--   1. Al insertar: máximo 10 recomendaciones por usuario en las últimas 24 h.
--   2. Al insertar: fuerza fecha=NOW() y estado='visible' para evitar que un
--      cliente manipulado envíe fechas antiguas o estados alterados.
--   3. Siempre (INSERT y UPDATE de foto_path): foto_path debe empezar con
--      'recomendaciones/<usuario_id>/' para garantizar que cada usuario solo
--      sube archivos a su propia carpeta.
-- =============================================================================
CREATE OR REPLACE FUNCTION public.handle_recomendacion_before_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_hoy   INTEGER;
    prefijo_uid TEXT;
BEGIN
    -- =========================================================================
    -- BLOQUE SOLO PARA INSERT
    -- =========================================================================
    IF TG_OP = 'INSERT' THEN

        -- Regla 1: Límite de 10 recomendaciones por usuario en las últimas 24 h
        SELECT COUNT(*) INTO total_hoy
        FROM public.recomendaciones
        WHERE usuario_id = NEW.usuario_id
          AND fecha >= NOW() - INTERVAL '24 hours';

        IF total_hoy >= 10 THEN
            RAISE EXCEPTION 'LIMITE_DIARIO_ALCANZADO'
                USING HINT = 'Solo puedes publicar 10 recomendaciones por día',
                      ERRCODE = 'P0001';
        END IF;

        -- Regla 2: Forzar fecha y estado seguros
        -- Aunque el cliente envíe una fecha antigua o estado='oculta', el trigger
        -- los sobreescribe antes de que el dato llegue a la tabla.
        NEW.fecha  := NOW();
        NEW.estado := 'visible';

    END IF;

    -- =========================================================================
    -- BLOQUE PARA INSERT Y UPDATE DE foto_path
    -- =========================================================================

    -- Regla 3: foto_path obligatoria
    IF NEW.foto_path IS NULL OR NEW.foto_path = '' THEN
        RAISE EXCEPTION 'FOTO_REQUERIDA'
            USING HINT = 'Debes subir una foto para recomendar un plato',
                  ERRCODE = 'P0002';
    END IF;

    -- Regla 4: foto_path debe pertenecer a la carpeta del propio usuario.
    -- Formato esperado: recomendaciones/<usuario_id>/<nombre_archivo>
    -- Esto impide que un usuario suba fotos a la carpeta de otro.
    prefijo_uid := 'recomendaciones/' || NEW.usuario_id::TEXT || '/';

    IF NEW.foto_path NOT LIKE prefijo_uid || '%' THEN
        RAISE EXCEPTION 'FOTO_PATH_INVALIDA'
            USING HINT = 'La foto debe estar en tu carpeta personal del almacenamiento',
                  ERRCODE = 'P0003';
    END IF;

    RETURN NEW;
END;
$$;

-- El trigger corre BEFORE INSERT (límite diario + fecha/estado) y
-- BEFORE UPDATE cuando se cambia foto_path (validación de carpeta de usuario).
CREATE OR REPLACE TRIGGER on_recomendacion_before_upsert
    BEFORE INSERT OR UPDATE OF foto_path ON public.recomendaciones
    FOR EACH ROW
    EXECUTE FUNCTION public.handle_recomendacion_before_upsert();


-- =============================================================================
-- DATOS SEMILLA: Categorías iniciales con sinónimos
-- Estas filas se insertan una sola vez. Si ya existen, se actualizan los sinónimos
-- sin error (ON CONFLICT DO UPDATE).
-- =============================================================================
INSERT INTO public.categorias (nombre, sinonimos) VALUES
    ('makis',         ARRAY['maki', 'makis', 'sushi roll', 'sushi rolls', 'roll', 'rolls', 'temaki']),
    ('ceviche',       ARRAY['ceviche', 'cebiche', 'ceviche mixto', 'leche de tigre', 'tiradito']),
    ('hamburguesas',  ARRAY['hamburguesa', 'hamburguesas', 'burger', 'burgers', 'smash burger', 'smashburger'])
ON CONFLICT (nombre) DO UPDATE
    SET sinonimos = EXCLUDED.sinonimos;


-- =============================================================================
-- ÍNDICES DE RENDIMIENTO
-- Mejoran la velocidad de las búsquedas más frecuentes.
-- =============================================================================

-- Búsquedas de restaurantes por distrito
CREATE INDEX IF NOT EXISTS idx_restaurantes_distrito    ON public.restaurantes(distrito);
-- Búsquedas de platos por restaurante
CREATE INDEX IF NOT EXISTS idx_platos_restaurante       ON public.platos(restaurante_id);
-- Búsquedas de platos por categoría
CREATE INDEX IF NOT EXISTS idx_platos_categoria         ON public.platos(categoria_id);
-- Recomendaciones por plato (para calcular puntaje Vao)
CREATE INDEX IF NOT EXISTS idx_recomendaciones_plato    ON public.recomendaciones(plato_id);
-- Recomendaciones por usuario (para aplicar límite diario anti-spam)
CREATE INDEX IF NOT EXISTS idx_recomendaciones_usuario  ON public.recomendaciones(usuario_id);
-- Validaciones por recomendación (para contar votos)
CREATE INDEX IF NOT EXISTS idx_validaciones_recomend    ON public.validaciones(recomendacion_id);
-- Reportes por recomendación (para detectar las que tienen 3+ reportes)
CREATE INDEX IF NOT EXISTS idx_reportes_recomend        ON public.reportes(recomendacion_id);
-- Búsqueda por nombre normalizado de plato dentro de un restaurante
CREATE INDEX IF NOT EXISTS idx_platos_nombre_norm       ON public.platos(nombre_normalizado);
-- Búsqueda tolerante a errores de tipeo en nombres de platos (pg_trgm)
CREATE INDEX IF NOT EXISTS idx_platos_trgm              ON public.platos USING gin(nombre_normalizado gin_trgm_ops);
