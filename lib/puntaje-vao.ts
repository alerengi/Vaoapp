/**
 * Módulo del Motor de Puntaje Vao (Espejo TypeScript de la migración SQL 004).
 *
 * Mantiene las mismas constantes y lógica exacta que las funciones SQL:
 * - public.calcular_peso_recomendacion(v_i, f_i)
 * - public.calcular_puntaje_vao(m, calificaciones[], pesos[])
 *
 * Fórmula Bayesiana:
 *   Puntaje = (C * m + SUM(w_i * r_i)) / (C + SUM(w_i))
 *   w_i     = min(1 + 0.25 * v_i, 3.0) * f_i
 */

export const C_BAYESIANO = 5.0;
export const PESO_POR_VALIDACION = 0.25;
export const TOPE_PESO_VALIDACION = 3.0;
export const FACTOR_ANTIGUEDAD_RECIENTE = 1.0;
export const FACTOR_ANTIGUEDAD_ANTIGUA = 0.5;
export const FALLBACK_PROMEDIO_CATEGORIA = 3.5;
export const HORAS_MINIMAS_ANTIGUEDAD_VALIDADOR = 24;

/**
 * Calcula el peso w_i de una recomendación:
 * w_i = min(1 + 0.25 * v_i, 3.0) * f_i
 *
 * @param validacionesElegibles Cantidad de confirmaciones de usuarios cuya cuenta tiene >= 24h
 * @param factorAntiguedad 1.0 si tiene menos de 12 meses; 0.5 si tiene 12 meses o más
 */
export function calcularPesoRecomendacion(
  validacionesElegibles: number,
  factorAntiguedad: number = FACTOR_ANTIGUEDAD_RECIENTE
): number {
  const v_i = Math.max(0, validacionesElegibles || 0);
  const f_i = factorAntiguedad ?? FACTOR_ANTIGUEDAD_RECIENTE;

  const pesoBase = Math.min(1.0 + PESO_POR_VALIDACION * v_i, TOPE_PESO_VALIDACION);
  const resultado = pesoBase * f_i;

  return Math.round(resultado * 10000) / 10000;
}

/**
 * Calcula el Puntaje Vao de un plato mediante promedio bayesiano ponderado:
 * Puntaje = (C * m + SUM(w_i * r_i)) / (C + SUM(w_i))
 *
 * @param m Promedio de calificaciones de la categoría en el distrito (fallback 3.5 si no hay)
 * @param calificaciones Array de calificaciones r_i (1 a 5)
 * @param pesos Array de pesos w_i correspondientes a cada recomendación
 * @returns Puntaje redondeado a 2 decimales
 */
export function calcularPuntajeVao(
  m: number | null | undefined,
  calificaciones: number[],
  pesos: number[]
): number {
  const v_m = m !== null && m !== undefined && !isNaN(m) ? m : FALLBACK_PROMEDIO_CATEGORIA;

  if (!calificaciones || calificaciones.length === 0) {
    return Math.round(v_m * 100) / 100;
  }

  let suma_w_r = 0.0;
  let suma_w = 0.0;

  for (let i = 0; i < calificaciones.length; i++) {
    const calif = calificaciones[i];
    const peso = pesos && pesos[i] !== undefined ? pesos[i] : 1.0;

    suma_w_r += peso * calif;
    suma_w += peso;
  }

  const puntaje = (C_BAYESIANO * v_m + suma_w_r) / (C_BAYESIANO + suma_w);

  return Math.round(puntaje * 100) / 100;
}

/**
 * Regla anti-spam para validaciones:
 * Solo son elegibles las confirmaciones de cuentas que tenían al menos 24 horas
 * de registradas al momento en que emitieron la validación.
 */
export function isValidadorElegible(
  fechaRegistroUsuario: string | Date,
  fechaValidacion: string | Date
): boolean {
  const regTime = new Date(fechaRegistroUsuario).getTime();
  const valTime = new Date(fechaValidacion).getTime();

  if (isNaN(regTime) || isNaN(valTime)) {
    return false;
  }

  const horasDiferencia = (valTime - regTime) / (1000 * 60 * 60);
  return horasDiferencia >= HORAS_MINIMAS_ANTIGUEDAD_VALIDADOR;
}

/**
 * Calcula el Puntaje Vao de un restaurante según la especificación:
 * - Búsqueda por plato: el puntaje de su mejor plato coincidente.
 * - Búsqueda por nombre o tipo de cocina: el promedio de sus 3 mejores platos.
 *
 * @param puntajesPlatos Array con los puntajes de los platos del restaurante
 * @param tipoBusqueda 'plato' o 'general'
 */
export function calcularPuntajeRestaurante(
  puntajesPlatos: number[],
  tipoBusqueda: 'plato' | 'general' = 'general'
): number {
  if (!puntajesPlatos || puntajesPlatos.length === 0) {
    return 0.0;
  }

  // Ordenar de mayor a menor
  const ordenados = [...puntajesPlatos].sort((a, b) => b - a);

  if (tipoBusqueda === 'plato') {
    return ordenados[0];
  }

  // Búsqueda general: promedio de los 3 mejores platos (o los que tenga si son < 3)
  const top3 = ordenados.slice(0, 3);
  const suma = top3.reduce((acc, val) => acc + val, 0);
  const promedio = suma / top3.length;

  return Math.round(promedio * 100) / 100;
}
