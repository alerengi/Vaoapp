import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getSafeRedirectPath } from '@/lib/auth-utils'

/**
 * Route Handler para el callback OAuth de Supabase.
 * Intercambia el código temporal 'code' por una sesión con tokens y cookies persistentes.
 *
 * Protegido contra Open Redirect: solo permite redirecciones a rutas internas de la aplicación.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const next = getSafeRedirectPath(searchParams.get('next'), '/')

  if (code) {
    try {
      const supabase = await createClient()
      const { error } = await supabase.auth.exchangeCodeForSession(code)

      if (!error) {
        // Redirección exitosa a ruta interna validada
        return NextResponse.redirect(`${origin}${next}`)
      }

      console.error('Error al intercambiar código por sesión:', error.message)
    } catch (err) {
      console.error('Excepción en callback de autenticación:', err)
    }
  }

  // Si no hay código o el intercambio falló, redirigir a inicio con indicador de error
  return NextResponse.redirect(`${origin}/?auth_error=oauth_failed`)
}
