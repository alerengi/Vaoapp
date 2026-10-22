'use client';

/**
 * BotonConfirmar — Botón "¡Confirmo!" con actualización optimista (HU-03).
 *
 * Patrón: useOptimistic + useTransition (documentado en Next.js 16 interactive-apps guide).
 * El botón actualiza el contador y su estado en el mismo frame del click,
 * antes de que la Server Action responda. Si falla, revierte automáticamente.
 */

import { useOptimistic, useTransition } from 'react';
import { toggleConfirmar } from '@/app/actions/validar';
import { createClient } from '@/lib/supabase/client';

interface BotonConfirmarProps {
  recomendacionId: string;
  /** ID del autor de la recomendación, para deshabilitar el botón si coincide con el usuario */
  autorId: string;
  /** Número inicial de validaciones, renderizado desde el servidor */
  contadorInicial: number;
  /** true si el usuario autenticado ya confirmó esta recomendación */
  yaConfirme: boolean;
  /** ID del usuario autenticado (null si no hay sesión) */
  usuarioId: string | null;
}

interface EstadoConfirmar {
  contador: number;
  confirmado: boolean;
  /** Mensaje de error transitorio para mostrar al usuario */
  errorMsg: string | null;
}

export function BotonConfirmar({
  recomendacionId,
  autorId,
  contadorInicial,
  yaConfirme,
  usuarioId,
}: BotonConfirmarProps) {
  const estadoInicial: EstadoConfirmar = {
    contador: contadorInicial,
    confirmado: yaConfirme,
    errorMsg: null,
  };

  const [optimisticEstado, setOptimisticEstado] = useOptimistic(estadoInicial);
  const [isPending, startTransition] = useTransition();

  const esPropio = usuarioId !== null && usuarioId === autorId;
  const sinSesion = usuarioId === null;

  /** Inicia login con Google si el usuario no tiene sesión */
  async function iniciarLogin() {
    const supabase = createClient();
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        queryParams: { access_type: 'offline', prompt: 'consent' },
      },
    });
  }

  async function handleClick() {
    if (isPending) return;

    if (sinSesion) {
      await iniciarLogin();
      return;
    }

    if (esPropio) return; // nunca debería llegar aquí, el botón está deshabilitado

    startTransition(async () => {
      // Actualización optimista inmediata
      setOptimisticEstado((prev) => ({
        contador: prev.confirmado ? prev.contador - 1 : prev.contador + 1,
        confirmado: !prev.confirmado,
        errorMsg: null,
      }));

      const result = await toggleConfirmar(recomendacionId);

      if (!result.ok) {
        // Revertir: dejar que useOptimistic vuelva al estado del servidor
        // No mostramos error para LIMITE_VALIDACIONES ni AUTO_VALIDACION (ya bloqueados en UI)
        // Solo loguear en consola para diagnóstico
        if (result.error.codigo !== 'AUTO_VALIDACION') {
          console.warn('[BotonConfirmar]', result.error.codigo, result.error.mensaje);
        }
      }
    });
  }

  // Tooltip y accesibilidad
  const labelBase = optimisticEstado.confirmado ? 'Retira tu confirmación' : '¡Confirmo que este plato vale!';
  const ariaLabel = esPropio
    ? 'No puedes confirmar tu propia recomendación'
    : sinSesion
    ? 'Inicia sesión para confirmar'
    : labelBase;

  return (
    <div className="flex items-center gap-1.5">
      <button
        id={`confirmar-${recomendacionId}`}
        onClick={handleClick}
        disabled={esPropio || isPending}
        aria-label={ariaLabel}
        aria-pressed={optimisticEstado.confirmado}
        title={ariaLabel}
        className={[
          // Base — área táctil ≥ 44 px
          'min-h-[44px] min-w-[44px] flex items-center justify-center gap-1.5',
          'rounded-full px-3 text-sm font-bold transition-all duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-500',
          'select-none',
          // Estado confirmado (activo)
          optimisticEstado.confirmado && !esPropio
            ? 'bg-orange-50 border border-orange-200 text-[#C2410C] shadow-2xs scale-[0.98]'
            : '',
          // Estado sin confirmar
          !optimisticEstado.confirmado && !esPropio && !sinSesion
            ? 'bg-white border border-stone-200 text-stone-700 hover:border-orange-300 hover:text-[#EA580C] hover:bg-orange-50/50 shadow-2xs active:scale-95'
            : '',
          // Sin sesión
          sinSesion
            ? 'bg-white border border-stone-200 text-stone-600 hover:border-stone-300 hover:bg-stone-50 cursor-pointer shadow-2xs active:scale-95'
            : '',
          // Propio — deshabilitado
          esPropio
            ? 'opacity-40 cursor-not-allowed border border-stone-200 text-stone-400 bg-stone-100'
            : '',
          // Pendiente (transición en vuelo)
          isPending ? 'opacity-60 pointer-events-none' : '',
        ]
          .filter(Boolean)
          .join(' ')}
      >
        {/* Ícono de check animado */}
        <span
          className={[
            'text-base leading-none transition-transform duration-150',
            optimisticEstado.confirmado ? 'scale-110 text-[#EA580C]' : 'scale-100',
          ].join(' ')}
          aria-hidden="true"
        >
          {optimisticEstado.confirmado ? '✓' : sinSesion ? '🔒' : '✓'}
        </span>
        <span className="text-xs">
          {sinSesion
            ? 'Confirmar'
            : optimisticEstado.confirmado
            ? '¡Confirmado!'
            : '¡Confirmo!'}
        </span>
      </button>

      {/* Contador de validaciones */}
      <span
        className={[
          'text-xs font-bold tabular-nums min-w-[1.5rem] text-center transition-colors duration-150',
          optimisticEstado.confirmado ? 'text-[#EA580C]' : 'text-stone-500',
        ].join(' ')}
        aria-live="polite"
        aria-label={`${optimisticEstado.contador} confirmaciones`}
      >
        {optimisticEstado.contador}
      </span>
    </div>
  );
}
