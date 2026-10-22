'use client'

import { useEffect, useState } from 'react'
import type { User } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'

export function AuthButton() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [actionLoading, setActionLoading] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true
    const supabase = createClient()

    // 1. Obtener usuario actual con getUser() (validación en servidor)
    supabase.auth
      .getUser()
      .then(({ data: { user } }) => {
        if (mounted) {
          setUser(user)
          setLoading(false)
        }
      })
      .catch((err) => {
        if (mounted) {
          console.error('Error al obtener usuario:', err)
          setLoading(false)
        }
      })

    // 2. Suscribirse a cambios de estado de autenticación (login, logout, refresh)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        setUser(session?.user ?? null)
        setLoading(false)
        setActionLoading(false)
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const handleSignIn = async () => {
    try {
      setActionLoading(true)
      setErrorMessage(null)
      const supabase = createClient()

      const redirectTo = `${window.location.origin}/auth/callback`

      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          },
        },
      })

      if (error) {
        setErrorMessage('No se pudo iniciar sesión con Google. Intenta de nuevo.')
        setActionLoading(false)
      }
    } catch (err) {
      console.error('Error durante signInWithOAuth:', err)
      setErrorMessage('Ocurrió un error inesperado al conectar con Google.')
      setActionLoading(false)
    }
  }

  const handleSignOut = async () => {
    try {
      setActionLoading(true)
      const supabase = createClient()
      await supabase.auth.signOut()
      setUser(null)
    } catch (err) {
      console.error('Error durante signOut:', err)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 px-3 py-1.5 text-xs text-stone-500 bg-stone-100 rounded-xl border border-stone-200 animate-pulse min-h-[40px]">
        <div className="w-3.5 h-3.5 rounded-full bg-stone-300" />
        <span className="hidden sm:inline">Comprobando...</span>
      </div>
    )
  }

  if (user) {
    const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'Foodie'

    return (
      <div className="flex items-center gap-2 bg-stone-50 border border-stone-200/90 rounded-xl p-1 sm:px-2 sm:py-1 shadow-2xs">
        <div className="flex items-center gap-2">
          {avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarUrl}
              alt={displayName}
              className="w-7 h-7 sm:w-8 sm:h-8 rounded-full object-cover border border-stone-200"
              referrerPolicy="no-referrer"
            />
          ) : (
            <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-orange-100 text-[#EA580C] flex items-center justify-center font-bold text-xs border border-orange-200">
              {displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="hidden md:inline text-xs font-bold text-stone-800 max-w-[120px] truncate">
            {displayName}
          </span>
        </div>

        <button
          onClick={handleSignOut}
          disabled={actionLoading}
          className="text-xs px-2.5 py-1 rounded-lg font-medium text-stone-600 hover:text-stone-900 hover:bg-stone-200/60 transition-colors disabled:opacity-50 cursor-pointer"
        >
          {actionLoading ? '...' : 'Salir'}
        </button>
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center">
      <button
        onClick={handleSignIn}
        disabled={actionLoading}
        className="flex items-center justify-center gap-2 px-3 sm:px-3.5 py-2 min-h-[40px] rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold text-xs transition-all shadow-2xs hover:shadow-xs active:scale-95 disabled:opacity-50 disabled:pointer-events-none cursor-pointer"
        aria-label="Continuar con Google"
      >
        <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
          <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
          />
          <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
          />
          <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
          />
          <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
          />
        </svg>
        <span className="hidden sm:inline">{actionLoading ? 'Conectando...' : 'Entrar con Google'}</span>
        <span className="sm:hidden">{actionLoading ? '...' : 'Entrar'}</span>
      </button>

      {errorMessage && (
        <p className="text-[11px] text-red-600 bg-red-50 border border-red-200 px-2 py-1 rounded-lg text-center mt-1">
          {errorMessage}
        </p>
      )}
    </div>
  )
}
