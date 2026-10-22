import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  C_BAYESIANO,
  PESO_POR_VALIDACION,
  TOPE_PESO_VALIDACION,
  FACTOR_ANTIGUEDAD_RECIENTE,
  FACTOR_ANTIGUEDAD_ANTIGUA,
  FALLBACK_PROMEDIO_CATEGORIA,
  HORAS_MINIMAS_ANTIGUEDAD_VALIDADOR,
  calcularPesoRecomendacion,
  calcularPuntajeVao,
  isValidadorElegible,
  calcularPuntajeRestaurante,
} from '../lib/puntaje-vao';

describe('Motor de Puntaje Vao · Constantes y Parámetros', () => {
  it('las constantes coinciden exactamente con la especificación de negocio', () => {
    expect(C_BAYESIANO).toBe(5.0);
    expect(PESO_POR_VALIDACION).toBe(0.25);
    expect(TOPE_PESO_VALIDACION).toBe(3.0);
    expect(FACTOR_ANTIGUEDAD_RECIENTE).toBe(1.0);
    expect(FACTOR_ANTIGUEDAD_ANTIGUA).toBe(0.5);
    expect(FALLBACK_PROMEDIO_CATEGORIA).toBe(3.5);
    expect(HORAS_MINIMAS_ANTIGUEDAD_VALIDADOR).toBe(24);
  });
});

describe('Motor de Puntaje Vao · Cálculo de Peso w_i', () => {
  it('sin validaciones y reciente: peso es exactamente 1.0', () => {
    const peso = calcularPesoRecomendacion(0, FACTOR_ANTIGUEDAD_RECIENTE);
    expect(peso).toBe(1.0);
  });

  it('con 4 validaciones y reciente: w_i = 1 + 0.25*4 = 2.0', () => {
    const peso = calcularPesoRecomendacion(4, FACTOR_ANTIGUEDAD_RECIENTE);
    expect(peso).toBe(2.0);
  });

  it('tope de peso: 20 validaciones no superan el tope de 3.0', () => {
    const peso = calcularPesoRecomendacion(20, FACTOR_ANTIGUEDAD_RECIENTE);
    expect(peso).toBe(3.0);
  });

  it('factor de antigüedad: recomendación de >= 12 meses reduce peso a la mitad', () => {
    // 4 validaciones -> peso base 2.0 * 0.5 = 1.0
    const peso = calcularPesoRecomendacion(4, FACTOR_ANTIGUEDAD_ANTIGUA);
    expect(peso).toBe(1.0);
  });
});

describe('Motor de Puntaje Vao · Fórmula Bayesiana de Plato', () => {
  it('caso sin recomendaciones: devuelve fallback m = 3.50', () => {
    const puntaje = calcularPuntajeVao(null, [], []);
    expect(puntaje).toBe(3.5);
  });

  it('caso 1: 1 recomendación de 5 estrellas sin validaciones amortiguada por C=5 da exactamente 3.75', () => {
    // C=5, m=3.5, r1=5, w1=1.0 -> (5*3.5 + 1*5)/(5 + 1) = 22.5/6 = 3.75
    const peso = calcularPesoRecomendacion(0, 1.0);
    const puntaje = calcularPuntajeVao(3.5, [5.0], [peso]);
    expect(puntaje).toBe(3.75);
  });

  it('caso con tope de validaciones: r1=5 con 20 validaciones da 4.06', () => {
    // w1 topado en 3.0 -> (5*3.5 + 3*5)/(5 + 3) = 32.5/8 = 4.0625 -> 4.06
    const peso = calcularPesoRecomendacion(20, 1.0); // 3.0
    const puntaje = calcularPuntajeVao(3.5, [5.0], [peso]);
    expect(puntaje).toBe(4.06);
  });

  it('caso recomendación antigua: 4 validaciones (peso 1.0), calif 4, m=3.0 da 3.17', () => {
    // w1 = 1.0 -> (5*3.0 + 1*4)/(5 + 1) = 19/6 = 3.1666... -> 3.17
    const peso = calcularPesoRecomendacion(4, 0.5); // 1.0
    const puntaje = calcularPuntajeVao(3.0, [4.0], [peso]);
    expect(puntaje).toBe(3.17);
  });

  it('caso múltiples recomendaciones combinadas da 3.47', () => {
    // m = 3.2
    // Reco 1: calif 5, peso 2.0 (4 validaciones recientes)
    // Reco 2: calif 4, peso 1.0 (0 validaciones)
    // Reco 3: calif 2, peso 1.5 (8 validaciones, antigua: 3.0 * 0.5 = 1.5)
    // Numerador: 5*3.2 + 2*5 + 1*4 + 1.5*2 = 16 + 10 + 4 + 3 = 33.0
    // Denominador: 5 + (2.0 + 1.0 + 1.5) = 9.5
    // 33.0 / 9.5 = 3.4736... -> 3.47
    const calificaciones = [5.0, 4.0, 2.0];
    const pesos = [2.0, 1.0, 1.5];
    const puntaje = calcularPuntajeVao(3.2, calificaciones, pesos);
    expect(puntaje).toBe(3.47);
  });
});

describe('Motor de Puntaje Vao · Reglas Anti-Spam de Validación', () => {
  it('descarta validaciones de cuentas creadas hace menos de 24 horas', () => {
    const registro = '2026-10-21T10:00:00Z';
    const validacionReciente = '2026-10-21T12:00:00Z'; // 2 horas después
    expect(isValidadorElegible(registro, validacionReciente)).toBe(false);
  });

  it('descarta validaciones de cuentas creadas a 23h 59m', () => {
    const registro = new Date('2026-10-20T10:00:00Z');
    const validacion = new Date('2026-10-21T09:59:00Z'); // 23h 59m
    expect(isValidadorElegible(registro, validacion)).toBe(false);
  });

  it('acepta validaciones de cuentas creadas con al menos 24 horas de antigüedad', () => {
    const registro = '2026-10-20T10:00:00Z';
    const validacion = '2026-10-21T10:00:00Z'; // exactamente 24 horas
    expect(isValidadorElegible(registro, validacion)).toBe(true);

    const validacionPosterior = '2026-10-25T10:00:00Z'; // 5 días después
    expect(isValidadorElegible(registro, validacionPosterior)).toBe(true);
  });
});

describe('Motor de Puntaje Vao · Ranking de Restaurante', () => {
  const platos = [4.8, 4.5, 4.2, 3.0, 2.5];

  it('búsqueda por plato: toma el puntaje del mejor plato coincidente', () => {
    const puntaje = calcularPuntajeRestaurante(platos, 'plato');
    expect(puntaje).toBe(4.8);
  });

  it('búsqueda general: toma el promedio de los 3 mejores platos', () => {
    // (4.8 + 4.5 + 4.2) / 3 = 13.5 / 3 = 4.50
    const puntaje = calcularPuntajeRestaurante(platos, 'general');
    expect(puntaje).toBe(4.5);
  });

  it('restaurante con menos de 3 platos promedia los que tenga', () => {
    const pocosPlatos = [4.5, 3.5];
    const puntaje = calcularPuntajeRestaurante(pocosPlatos, 'general');
    expect(puntaje).toBe(4.0);
  });

  it('restaurante sin platos devuelve 0.0', () => {
    expect(calcularPuntajeRestaurante([], 'general')).toBe(0.0);
  });
});

describe('Migración 004 · Estructura SQL y Verificación de Triggers', () => {
  let sql004: string;

  beforeAll(() => {
    const sqlPath = path.resolve(__dirname, '../supabase/migrations/004_puntaje_vao_recalculo.sql');
    expect(fs.existsSync(sqlPath), 'La migración 004 debe existir').toBe(true);
    sql004 = fs.readFileSync(sqlPath, 'utf-8');
  });

  it('define calcular_peso_recomendacion como función pura IMMUTABLE con factor 0.25 y tope 3.0', () => {
    expect(sql004).toContain('CREATE OR REPLACE FUNCTION public.calcular_peso_recomendacion');
    expect(sql004).toContain('IMMUTABLE');
    expect(sql004).toContain('LEAST(1.0 + 0.25 *');
    expect(sql004).toContain('3.0');
  });

  it('define calcular_puntaje_vao como función pura IMMUTABLE con constante C=5.0 y fallback 3.5', () => {
    expect(sql004).toContain('CREATE OR REPLACE FUNCTION public.calcular_puntaje_vao');
    expect(sql004).toContain('IMMUTABLE');
    expect(sql004).toContain('v_c CONSTANT NUMERIC := 5.0;');
    expect(sql004).toContain('COALESCE(p_m, 3.5)');
    expect(sql004).toContain('(v_c * v_m + v_sum_w_r) / (v_c + v_sum_w)');
  });

  it('recalcular_platos_categoria_distrito utiliza SECURITY DEFINER y SET search_path = public', () => {
    expect(sql004).toContain('CREATE OR REPLACE FUNCTION public.recalcular_platos_categoria_distrito');
    expect(sql004).toContain('SECURITY DEFINER');
    expect(sql004).toContain('SET search_path = public');
    expect(sql004).toContain("INTERVAL '24 hours'");
    expect(sql004).toContain("INTERVAL '12 months'");
  });

  it('trigger de validaciones tolera borrados en cascada sin error', () => {
    expect(sql004).toContain('handle_validacion_recalcular()');
    expect(sql004).toContain('IF v_categoria_id IS NOT NULL AND v_distrito IS NOT NULL THEN');
    expect(sql004).toContain('RETURN COALESCE(NEW, OLD);');
  });

  it('define triggers automáticos en recomendaciones y validaciones', () => {
    expect(sql004).toContain('CREATE TRIGGER on_recomendacion_recalcular_plato');
    expect(sql004).toContain('AFTER INSERT OR UPDATE OF calificacion, estado OR DELETE ON public.recomendaciones');
    expect(sql004).toContain('CREATE TRIGGER on_validacion_recalcular_plato');
    expect(sql004).toContain('AFTER INSERT OR DELETE ON public.validaciones');
  });

  it('revoca la ejecución directa de recalcular_platos_categoria_distrito a PUBLIC, anon y authenticated', () => {
    expect(sql004).toContain(
      'REVOKE EXECUTE ON FUNCTION public.recalcular_platos_categoria_distrito(UUID, TEXT) FROM PUBLIC, anon, authenticated;'
    );
  });

  it('fuerza fecha = NOW() en validaciones mediante trigger BEFORE INSERT y permisos por columna', () => {
    expect(sql004).toContain('CREATE OR REPLACE FUNCTION public.handle_validacion_before_insert()');
    expect(sql004).toContain('NEW.fecha := NOW();');
    expect(sql004).toContain('CREATE TRIGGER on_validacion_before_insert');
    expect(sql004).toContain('BEFORE INSERT ON public.validaciones');
    expect(sql004).toContain('REVOKE INSERT ON public.validaciones FROM authenticated, anon;');
    expect(sql004).toContain('GRANT INSERT (usuario_id, recomendacion_id) ON public.validaciones TO authenticated;');
    expect(sql004).toContain('REVOKE UPDATE ON public.validaciones FROM authenticated, anon;');
  });

  it('fuerza fecha = NOW() en reportes mediante trigger BEFORE INSERT y permisos por columna', () => {
    expect(sql004).toContain('CREATE OR REPLACE FUNCTION public.handle_reporte_before_insert()');
    expect(sql004).toContain('NEW.fecha := NOW();');
    expect(sql004).toContain('CREATE TRIGGER on_reporte_before_insert');
    expect(sql004).toContain('BEFORE INSERT ON public.reportes');
    expect(sql004).toContain('REVOKE INSERT ON public.reportes FROM authenticated, anon;');
    expect(sql004).toContain('GRANT INSERT (usuario_id, recomendacion_id, motivo) ON public.reportes TO authenticated;');
    expect(sql004).toContain('REVOKE UPDATE ON public.reportes FROM authenticated, anon;');
  });
});
