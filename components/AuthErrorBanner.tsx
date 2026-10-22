'use client'

import { useSearchParams } from 'next/navigation'

export function AuthErrorBanner() {
  const searchParams = useSearchParams()
  const authError = searchParams.get('auth_error')

  if (!authError) {
    return null
  }

  return (
    <div className="w-full mb-4 p-3 rounded-xl bg-red-50 border border-red-200 text-red-800 text-xs text-center font-medium shadow-2xs">
      ⚠️ Ocurrió un error al autenticarte con Google. Por favor intenta nuevamente.
    </div>
  )
}
