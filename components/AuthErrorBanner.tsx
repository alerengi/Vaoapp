'use client'

import { useSearchParams } from 'next/navigation'

export function AuthErrorBanner() {
  const searchParams = useSearchParams()
  const authError = searchParams.get('auth_error')

  if (!authError) {
    return null
  }

  return (
    <div className="w-full mb-6 p-3 rounded-xl bg-red-950/60 border border-red-800/50 text-red-300 text-xs text-center">
      ⚠️ Ocurrió un error al autenticarte con Google. Por favor intenta nuevamente.
    </div>
  )
}
