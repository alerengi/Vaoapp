/**
 * Utilidades de seguridad y validación para autenticación.
 */

/**
 * Valida y sanitiza una ruta de redirección para evitar ataques de redirección abierta (Open Redirect).
 * Solo permite rutas internas que comiencen con '/' y no contengan esquemas externos ni '//'.
 *
 * @param target Ruta solicitada por el usuario o query param (ej: ?next=/explorar)
 * @param fallback Ruta por defecto si target es inválido (default: '/')
 */
export function getSafeRedirectPath(target: string | null | undefined, fallback = '/'): string {
  if (!target || typeof target !== 'string') {
    return fallback
  }

  const trimmed = target.trim()

  // Debe comenzar estrictamente con un solo '/'
  // Si empieza con '//', el navegador lo interpretaría como una URL relativa al protocolo (ej. //google.com)
  if (!trimmed.startsWith('/') || trimmed.startsWith('//')) {
    return fallback
  }

  // Bloquear diagonales invertidas que ciertos navegadores normalizan a '/'
  if (trimmed.includes('\\')) {
    return fallback
  }

  // Bloquear esquemas como 'javascript:', 'data:', etc.
  if (/^[a-zA-Z][a-zA-Z0-9+.-]*:/.test(trimmed)) {
    return fallback
  }

  try {
    // Validar el pathname resolviendo contra un origen local simulado
    const parsed = new URL(trimmed, 'http://localhost')

    // El origin debe ser idéntico al base (asegura que no mutó a un host externo)
    if (parsed.origin !== 'http://localhost') {
      return fallback
    }

    // Retorna únicamente el pathname + search + hash sanitizados
    return `${parsed.pathname}${parsed.search}${parsed.hash}`
  } catch {
    return fallback
  }
}
