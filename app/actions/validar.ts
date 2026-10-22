'use server';

import { createClient } from '@/lib/supabase/server';
import { checkRateLimit } from '@/lib/rate-limiter';
import type { ApiResponse } from '@/lib/types';

export interface ToggleConfirmarResult {
  accion: 'creada' | 'eliminada';
  validaciones: number;
}

/**
 * Alterna (toggle) la confirmación de una recomendación por parte del usuario autenticado.
 *
 * Reglas de negocio:
 * - El usuario debe estar autenticado (getUser()).
 * - No puede confirmar su propia recomendación (AUTO_VALIDACION).
 * - La recomendación debe existir y estar en estado 'visible' (NOT_FOUND).
 * - plato_id y usuario_recomendo_id se obtienen de la BD, nunca del cliente.
 * - Si ya existe la validación → DELETE (reversible).
 * - Si no existe → INSERT. Un error 23505 (race condition) se trata como 'creada' (idempotente).
 * - Límite: 30 confirmaciones por minuto por usuario.
 */
export async function toggleConfirmar(
  recomendacionId: string
): Promise<ApiResponse<ToggleConfirmarResult>> {
  if (!recomendacionId || typeof recomendacionId !== 'string' || recomendacionId.trim().length === 0) {
    return {
      ok: false,
      error: { codigo: 'PARAMETRO_INVALIDO', mensaje: 'ID de recomendación inválido.' },
    };
  }

  const supabase = await createClient();

  // 1. Verificar autenticación
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return {
      ok: false,
      error: { codigo: 'NO_AUTENTICADO', mensaje: 'Debes iniciar sesión para confirmar.' },
    };
  }

  // 2. Rate limit: 30 confirmaciones por minuto por usuario
  const rateLimit = checkRateLimit(`confirmar:${user.id}`, 30, 60 * 1000);
  if (!rateLimit.success) {
    return {
      ok: false,
      error: {
        codigo: 'LIMITE_VALIDACIONES',
        mensaje: `Demasiadas confirmaciones. Intenta en ${rateLimit.reset} segundos.`,
      },
    };
  }

  // 3. Obtener recomendación desde la BD (nunca del cliente)
  const { data: recomendacion, error: errReco } = await supabase
    .from('recomendaciones')
    .select('id, usuario_id, plato_id, estado')
    .eq('id', recomendacionId)
    .single();

  if (errReco || !recomendacion) {
    return {
      ok: false,
      error: { codigo: 'NOT_FOUND', mensaje: 'La recomendación no existe o no está disponible.' },
    };
  }

  if (recomendacion.estado !== 'visible') {
    return {
      ok: false,
      error: { codigo: 'NOT_FOUND', mensaje: 'La recomendación no está disponible.' },
    };
  }

  // 4. Bloquear auto-validación en el servidor
  if (recomendacion.usuario_id === user.id) {
    return {
      ok: false,
      error: {
        codigo: 'AUTO_VALIDACION',
        mensaje: 'No puedes confirmar tu propia recomendación.',
      },
    };
  }

  // 5. Toggle: intentar DELETE primero
  const { count: deletedCount, error: errDelete } = await supabase
    .from('validaciones')
    .delete({ count: 'exact' })
    .eq('usuario_id', user.id)
    .eq('recomendacion_id', recomendacionId);

  if (errDelete) {
    return {
      ok: false,
      error: {
        codigo: 'ERROR_VALIDACION',
        mensaje: 'Error al procesar la confirmación. Intenta de nuevo.',
      },
    };
  }

  let accion: 'creada' | 'eliminada';

  if (deletedCount && deletedCount > 0) {
    accion = 'eliminada';
  } else {
    const { error: errInsert } = await supabase.from('validaciones').insert({
      usuario_id: user.id,
      recomendacion_id: recomendacionId,
    });

    if (errInsert) {
      // 23505 = unique violation por race condition → ya está confirmada, tratar como 'creada'
      if (errInsert.code !== '23505') {
        return {
          ok: false,
          error: {
            codigo: 'ERROR_VALIDACION',
            mensaje: 'Error al registrar la confirmación. Intenta de nuevo.',
          },
        };
      }
    }

    accion = 'creada';
  }

  // 6. Contador actualizado
  const { count: totalValidaciones } = await supabase
    .from('validaciones')
    .select('id', { count: 'exact', head: true })
    .eq('recomendacion_id', recomendacionId);

  return {
    ok: true,
    data: {
      accion,
      validaciones: totalValidaciones ?? 0,
    },
  };
}
