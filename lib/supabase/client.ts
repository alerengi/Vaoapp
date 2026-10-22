import { createBrowserClient } from '@supabase/ssr'

/**
 * Crea y retorna una instancia del cliente de Supabase para su uso en el navegador (Client Components).
 * Persiste la sesión automáticamente en cookies compatibles con el servidor.
 */
export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error(
      'Faltan las variables de entorno NEXT_PUBLIC_SUPABASE_URL o NEXT_PUBLIC_SUPABASE_ANON_KEY'
    )
  }

  return createBrowserClient(supabaseUrl, supabaseAnonKey)
}
