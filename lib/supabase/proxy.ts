import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Función middleware/proxy que refresca automáticamente la sesión del usuario
 * en cookies antes de renderizar cualquier ruta protegida o componente.
 *
 * Usa estrictamente `supabase.auth.getUser()` para validar el token JWT contra
 * los servidores de Supabase, evitando suplantaciones o tokens revocados.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    // Si no están configuradas las variables, continuar sin bloquear el flujo
    return supabaseResponse
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll()
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value)
        })
        supabaseResponse = NextResponse.next({
          request,
        })
        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, options)
        })
      },
    },
  })

  // IMPORTANTE: getUser() contacta a la API de Supabase Auth para verificar el token.
  // NO usar getSession() aquí porque no garantiza que el usuario siga siendo válido o no haya revocado la sesión.
  await supabase.auth.getUser()

  return supabaseResponse
}
