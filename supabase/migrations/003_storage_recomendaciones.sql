-- =============================================================================
-- MIGRACIÓN 003: Bucket de Storage y Políticas de Seguridad para Recomendaciones
-- =============================================================================
-- Descripción:
--   1. Crea/actualiza el bucket 'recomendaciones' en storage.buckets con límite
--      de 5 MB y tipos permitidos (image/jpeg, image/png, image/webp).
--   2. Define políticas RLS en storage.objects para que:
--      - SELECT: Cualquier persona (pública) pueda ver las fotos.
--      - INSERT: Solo el autor autenticado pueda subir fotos a su propia carpeta:
--                <usuario_id>/<archivo> (exactamente dos segmentos, sin '..').
--      - UPDATE: Solo el autor autenticado pueda reemplazar sus fotos, con
--                USING y WITH CHECK para impedir mover archivos a carpetas ajenas.
--      - DELETE: Solo el autor autenticado pueda borrar sus fotos.
--   3. Actualiza la función handle_recomendacion_before_upsert() para sincronizar
--      la convención unificada de rutas: <usuario_id>/<archivo> (exactamente
--      dos segmentos, sin prefijo redundante 'recomendaciones/').
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. BUCKET DE STORAGE: 'recomendaciones'
-- -----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'recomendaciones',
    'recomendaciones',
    true,
    5242880, -- 5 MB (5 * 1024 * 1024 bytes)
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO UPDATE SET
    public = EXCLUDED.public,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;


-- -----------------------------------------------------------------------------
-- 2. POLÍTICAS RLS EN storage.objects
-- -----------------------------------------------------------------------------
-- Limpieza de políticas previas para ejecución idempotente
DROP POLICY IF EXISTS "recomendaciones_storage_lectura_publica" ON storage.objects;
DROP POLICY IF EXISTS "recomendaciones_storage_insercion_propia" ON storage.objects;
DROP POLICY IF EXISTS "recomendaciones_storage_edicion_propia" ON storage.objects;
DROP POLICY IF EXISTS "recomendaciones_storage_borrado_propio" ON storage.objects;

-- SELECT: Lectura pública de fotos del bucket 'recomendaciones'
CREATE POLICY "recomendaciones_storage_lectura_publica"
ON storage.objects FOR SELECT
TO public
USING (
    bucket_id = 'recomendaciones'
);

-- INSERT: Solo usuarios autenticados suben fotos a su propia carpeta:
--         <usuario_id>/<archivo> (exactamente dos segmentos, sin '..')
CREATE POLICY "recomendaciones_storage_insercion_propia"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
    bucket_id = 'recomendaciones'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND name NOT LIKE '%..%'
);

-- UPDATE: Solo el autor puede reemplazar su foto.
--         Requiere USING (objeto existente) y WITH CHECK (nuevo estado)
--         para impedir mover archivos hacia carpetas de otros usuarios.
CREATE POLICY "recomendaciones_storage_edicion_propia"
ON storage.objects FOR UPDATE
TO authenticated
USING (
    bucket_id = 'recomendaciones'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND name NOT LIKE '%..%'
)
WITH CHECK (
    bucket_id = 'recomendaciones'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND name NOT LIKE '%..%'
);

-- DELETE: Solo el autor puede borrar sus fotos
CREATE POLICY "recomendaciones_storage_borrado_propio"
ON storage.objects FOR DELETE
TO authenticated
USING (
    bucket_id = 'recomendaciones'
    AND (storage.foldername(name))[1] = auth.uid()::text
    AND array_length(string_to_array(name, '/'), 1) = 2
    AND name NOT LIKE '%..%'
);


-- -----------------------------------------------------------------------------
-- 3. ACTUALIZACIÓN DEL TRIGGER EN public.recomendaciones
--    Sincroniza la convención unificada de foto_path:
--    <usuario_id>/<archivo> (dos segmentos exactos, relativo al bucket)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_recomendacion_before_upsert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    total_hoy   INTEGER;
    prefijo_uid TEXT;
    segmentos   TEXT[];
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
    -- Convención unificada: <usuario_id>/<nombre_archivo>
    -- Exactamente dos segmentos, sin path traversal '..' y con nombre de archivo no vacío.
    prefijo_uid := NEW.usuario_id::TEXT || '/';
    segmentos   := string_to_array(NEW.foto_path, '/');

    IF NEW.foto_path NOT LIKE prefijo_uid || '%'
       OR array_length(segmentos, 1) != 2
       OR NEW.foto_path LIKE '%..%'
       OR length(segmentos[2]) = 0 THEN
        RAISE EXCEPTION 'FOTO_PATH_INVALIDA'
            USING HINT = 'La foto debe tener formato <usuario_id>/<archivo> en tu carpeta personal',
                  ERRCODE = 'P0003';
    END IF;

    RETURN NEW;
END;
$$;
