import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Crea y retorna una instancia del cliente de Supabase para su uso en el servidor
 * (Server Components, Route Handlers y Server Actions).
 * Lee y actualiza las cookies de sesión httpOnly.
 */
export async function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  const cookieStore = await cookies()

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options)
          })
        } catch {
          // El método setAll fue llamado desde un Server Component.
          // Esto puede ignorarse de forma segura si el proxy/middleware refresca la sesión.
        }
      },
    },
  })
}
