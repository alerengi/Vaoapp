-- =============================================================================
-- MIGRACIÓN 004: Motor de Puntaje Vao Bayesiano y Recálculo Automático
-- =============================================================================
-- Descripción:
--   1. Función pura calcular_peso_recomendacion(v_i, f_i) para calcular el peso w_i.
--   2. Función pura calcular_puntaje_vao(m, calificaciones[], pesos[]) para la
--      fórmula bayesiana: Puntaje = (C*m + SUM(w_i*r_i)) / (C + SUM(w_i)).
--   3. Función recalcular_platos_categoria_distrito(categoria_id, distrito)
--      con SECURITY DEFINER para actualizar todos los platos de esa categoría y
--      distrito cuando cambie una recomendación o validación (efecto en m).
--      Acceso revocado a PUBLIC/anon/authenticated (solo invocable por triggers).
--   4. Triggers automáticos en 'recomendaciones' y 'validaciones', con tolerancia
--      estricta a borrados en cascada.
--   5. Anti-spam estricto de fechas: triggers BEFORE INSERT en 'validaciones' y
--      'reportes' que fuerzan fecha = NOW(), y permisos por columna para impedir
--      que un cliente manipule la fecha hacia el futuro.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. FUNCIÓN PURA: calcular_peso_recomendacion
--    w_i = min(1 + 0.25 * v_i, 3.0) * f_i
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_peso_recomendacion(
    p_validaciones INTEGER,
    p_factor_antiguedad NUMERIC DEFAULT 1.0
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_v_i NUMERIC;
    v_f_i NUMERIC;
    v_peso_base NUMERIC;
BEGIN
    v_v_i := GREATEST(COALESCE(p_validaciones, 0), 0);
    v_f_i := COALESCE(p_factor_antiguedad, 1.0);

    -- Peso base con factor 0.25 y tope de 3.0
    v_peso_base := LEAST(1.0 + 0.25 * v_v_i, 3.0);

    RETURN ROUND(v_peso_base * v_f_i, 4);
END;
$$;


-- -----------------------------------------------------------------------------
-- 2. FUNCIÓN PURA: calcular_puntaje_vao
--    Fórmula Bayesiana: (C * m + SUM(w_i * r_i)) / (C + SUM(w_i))
--    Constantes: C = 5.0, Fallback m = 3.5
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.calcular_puntaje_vao(
    p_m NUMERIC,
    p_calificaciones NUMERIC[],
    p_pesos NUMERIC[]
)
RETURNS NUMERIC
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
    v_c CONSTANT NUMERIC := 5.0;
    v_m NUMERIC;
    v_sum_w_r NUMERIC := 0.0;
    v_sum_w NUMERIC := 0.0;
    v_n INTEGER;
    v_i INTEGER;
    v_puntaje NUMERIC;
BEGIN
    -- Fallback si m es NULL o menor a 1
    v_m := COALESCE(p_m, 3.5);

    -- Si no hay calificaciones, el puntaje base es m redondeado a 2 decimales
    IF p_calificaciones IS NULL
       OR array_length(p_calificaciones, 1) IS NULL
       OR array_length(p_calificaciones, 1) = 0 THEN
        RETURN ROUND(v_m, 2);
    END IF;

    v_n := array_length(p_calificaciones, 1);

    FOR v_i IN 1..v_n LOOP
        v_sum_w_r := v_sum_w_r + (COALESCE(p_pesos[v_i], 1.0) * p_calificaciones[v_i]);
        v_sum_w   := v_sum_w   + COALESCE(p_pesos[v_i], 1.0);
    END LOOP;

    -- Fórmula Bayesiana
    v_puntaje := (v_c * v_m + v_sum_w_r) / (v_c + v_sum_w);

    RETURN ROUND(v_puntaje, 2);
END;
$$;


-- -----------------------------------------------------------------------------
-- 3. FUNCIÓN DE RECALCULO POR CATEGORÍA Y DISTRITO
--    SECURITY DEFINER para permitir a los triggers actualizar platos.
--    Solo ejecutable internamente por los triggers (permisos revocados a clientes).
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recalcular_platos_categoria_distrito(
    p_categoria_id UUID,
    p_distrito TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_m NUMERIC;
    r_plato RECORD;
    v_calificaciones NUMERIC[];
    v_pesos NUMERIC[];
    v_nuevo_puntaje NUMERIC;
    v_total_recs INTEGER;
BEGIN
    IF p_categoria_id IS NULL OR p_distrito IS NULL THEN
        RETURN;
    END IF;

    -- 1. Calcular m: promedio de calificaciones de la categoría en el distrito
    --    (solo toma recomendaciones en estado 'visible')
    SELECT AVG(r.calificacion::NUMERIC)
    INTO v_m
    FROM public.recomendaciones r
    JOIN public.platos p ON p.id = r.plato_id
    JOIN public.restaurantes rest ON rest.id = p.restaurante_id
    WHERE p.categoria_id = p_categoria_id
      AND rest.distrito = p_distrito
      AND r.estado = 'visible';

    -- Si no hay recomendaciones previas, se usa el fallback de 3.5
    v_m := COALESCE(v_m, 3.5);

    -- 2. Recalcular cada plato de esa categoría en ese distrito
    FOR r_plato IN
        SELECT p.id
        FROM public.platos p
        JOIN public.restaurantes rest ON rest.id = p.restaurante_id
        WHERE p.categoria_id = p_categoria_id
          AND rest.distrito = p_distrito
    LOOP
        -- Reunir calificaciones y pesos de las recomendaciones visibles del plato
        WITH validaciones_elegibles AS (
            -- Anti-spam: solo cuentan validaciones de cuentas creadas >= 24h antes de la validación
            SELECT v.recomendacion_id, COUNT(*)::INTEGER AS total_validaciones
            FROM public.validaciones v
            JOIN public.usuarios u ON u.id = v.usuario_id
            WHERE u.fecha_registro <= v.fecha - INTERVAL '24 hours'
            GROUP BY v.recomendacion_id
        ),
        datos_recs AS (
            SELECT
                r.calificacion::NUMERIC AS calif,
                public.calcular_peso_recomendacion(
                    COALESCE(ve.total_validaciones, 0),
                    CASE WHEN r.fecha >= NOW() - INTERVAL '12 months' THEN 1.0 ELSE 0.5 END
                ) AS peso
            FROM public.recomendaciones r
            LEFT JOIN validaciones_elegibles ve ON ve.recomendacion_id = r.id
            WHERE r.plato_id = r_plato.id
              AND r.estado = 'visible'
        )
        SELECT
            COALESCE(array_agg(calif), ARRAY[]::NUMERIC[]),
            COALESCE(array_agg(peso), ARRAY[]::NUMERIC[]),
            COUNT(*)::INTEGER
        INTO v_calificaciones, v_pesos, v_total_recs
        FROM datos_recs;

        -- Calcular nuevo puntaje Vao
        v_nuevo_puntaje := public.calcular_puntaje_vao(v_m, v_calificaciones, v_pesos);

        -- Actualizar la tabla platos
        UPDATE public.platos
        SET puntaje_vao = v_nuevo_puntaje,
            total_recomendaciones = v_total_recs
        WHERE id = r_plato.id;
    END LOOP;
END;
$$;

-- Revocar permisos de ejecución a clientes directos: solo debe ser llamada por triggers
REVOKE EXECUTE ON FUNCTION public.recalcular_platos_categoria_distrito(UUID, TEXT) FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 4. ANTI-SPAM DE FECHAS: TRIGGERS BEFORE INSERT Y PERMISOS POR COLUMNA
--    Impide que un cliente envíe fechas futuras para saltarse el filtro de 24 h.
-- -----------------------------------------------------------------------------

-- Trigger para forzar fecha = NOW() en validaciones
CREATE OR REPLACE FUNCTION public.handle_validacion_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.fecha := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_validacion_before_insert ON public.validaciones;

CREATE TRIGGER on_validacion_before_insert
BEFORE INSERT ON public.validaciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_validacion_before_insert();

REVOKE EXECUTE ON FUNCTION public.handle_validacion_before_insert() FROM PUBLIC, anon, authenticated;

-- Permisos por columna en validaciones: authenticated solo inserta usuario_id y recomendacion_id
REVOKE INSERT ON public.validaciones FROM authenticated, anon;
GRANT INSERT (usuario_id, recomendacion_id) ON public.validaciones TO authenticated;
REVOKE UPDATE ON public.validaciones FROM authenticated, anon;


-- Trigger para forzar fecha = NOW() en reportes
CREATE OR REPLACE FUNCTION public.handle_reporte_before_insert()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    NEW.fecha := NOW();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_reporte_before_insert ON public.reportes;

CREATE TRIGGER on_reporte_before_insert
BEFORE INSERT ON public.reportes
FOR EACH ROW
EXECUTE FUNCTION public.handle_reporte_before_insert();

REVOKE EXECUTE ON FUNCTION public.handle_reporte_before_insert() FROM PUBLIC, anon, authenticated;

-- Permisos por columna en reportes: authenticated solo inserta usuario_id, recomendacion_id y motivo
REVOKE INSERT ON public.reportes FROM authenticated, anon;
GRANT INSERT (usuario_id, recomendacion_id, motivo) ON public.reportes TO authenticated;
REVOKE UPDATE ON public.reportes FROM authenticated, anon;


-- -----------------------------------------------------------------------------
-- 5. TRIGGER PARA RECOMENDACIONES (INSERT, UPDATE calificacion/estado, DELETE)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_recomendacion_recalcular()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_plato_id UUID;
    v_categoria_id UUID;
    v_distrito TEXT;
BEGIN
    v_plato_id := COALESCE(NEW.plato_id, OLD.plato_id);

    IF v_plato_id IS NOT NULL THEN
        SELECT p.categoria_id, rest.distrito
        INTO v_categoria_id, v_distrito
        FROM public.platos p
        JOIN public.restaurantes rest ON rest.id = p.restaurante_id
        WHERE p.id = v_plato_id;

        IF v_categoria_id IS NOT NULL AND v_distrito IS NOT NULL THEN
            PERFORM public.recalcular_platos_categoria_distrito(v_categoria_id, v_distrito);
        END IF;
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_recomendacion_recalcular_plato ON public.recomendaciones;

CREATE TRIGGER on_recomendacion_recalcular_plato
AFTER INSERT OR UPDATE OF calificacion, estado OR DELETE ON public.recomendaciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_recomendacion_recalcular();

REVOKE EXECUTE ON FUNCTION public.handle_recomendacion_recalcular() FROM PUBLIC, anon, authenticated;


-- -----------------------------------------------------------------------------
-- 6. TRIGGER PARA VALIDACIONES (INSERT, DELETE)
--    Tolerancia estricta a borrados en cascada (cuando la recomendación ya no existe)
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.handle_validacion_recalcular()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_recom_id UUID;
    v_categoria_id UUID;
    v_distrito TEXT;
BEGIN
    v_recom_id := COALESCE(NEW.recomendacion_id, OLD.recomendacion_id);

    -- Tolerancia a borrados en cascada: si la recomendación ya fue borrada,
    -- la consulta retornará NULL y no hacemos nada (el trigger de la recomendación ya recalculó).
    SELECT p.categoria_id, rest.distrito
    INTO v_categoria_id, v_distrito
    FROM public.recomendaciones r
    JOIN public.platos p ON p.id = r.plato_id
    JOIN public.restaurantes rest ON rest.id = p.restaurante_id
    WHERE r.id = v_recom_id;

    IF v_categoria_id IS NOT NULL AND v_distrito IS NOT NULL THEN
        PERFORM public.recalcular_platos_categoria_distrito(v_categoria_id, v_distrito);
    END IF;

    RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_validacion_recalcular_plato ON public.validaciones;

CREATE TRIGGER on_validacion_recalcular_plato
AFTER INSERT OR DELETE ON public.validaciones
FOR EACH ROW
EXECUTE FUNCTION public.handle_validacion_recalcular();

REVOKE EXECUTE ON FUNCTION public.handle_validacion_recalcular() FROM PUBLIC, anon, authenticated;
