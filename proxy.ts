import type { NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/proxy'

/**
 * Proxy de Next.js 16 (convención que reemplaza a middleware.ts).
 * Se ejecuta en cada petición antes del renderizado para mantener sincronizada la sesión de Supabase.
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Coincide con todas las rutas excepto:
     * - _next/static (archivos estáticos de compilación)
     * - _next/image (optimización de imágenes)
     * - favicon.ico (icono del sitio)
     * - Archivos multimedia y estáticos (svg, png, jpg, jpeg, gif, webp)
     */
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
