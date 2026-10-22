import { Suspense } from 'react'
import { AuthButton } from '@/components/AuthButton'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center justify-between p-4 sm:p-6 selection:bg-amber-500 selection:text-neutral-950">
      {/* Header móvil */}
      <header className="w-full max-w-md flex items-center justify-between py-4 border-b border-neutral-900">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-black text-neutral-950 text-lg shadow-lg shadow-orange-500/20">
            V
          </div>
          <span className="font-extrabold text-xl tracking-tight text-white">Vao</span>
        </div>
        <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-neutral-900 text-neutral-400 border border-neutral-800">
          Fase 1 · MVP
        </span>
      </header>

      {/* Contenido principal Mobile-First */}
      <main className="w-full max-w-md flex flex-col items-center text-center my-auto py-10 px-2">
        <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-amber-500/10 text-amber-400 text-xs font-semibold mb-6 border border-amber-500/20">
          <span>✨</span>
          <span>Dónde comer rico en Lima</span>
        </div>

        <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight text-white leading-tight mb-4">
          Encuentra los platos más <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">validados por foodies</span>
        </h1>

        <p className="text-neutral-400 text-sm sm:text-base max-w-sm mb-8 leading-relaxed">
          Recomendaciones reales de makis, ceviche y hamburguesas en Miraflores y Barranco.
        </p>

        {/* Notificación de error si falló OAuth (en Suspense para compatibilidad con Next.js 16) */}
        <Suspense fallback={null}>
          <AuthErrorBanner />
        </Suspense>

        {/* Botón de autenticación OAuth */}
        <div className="w-full flex justify-center">
          <AuthButton />
        </div>

        {/* Indicadores de cobertura del MVP */}
        <div className="w-full grid grid-cols-2 gap-3 mt-12 pt-8 border-t border-neutral-900 text-left">
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Distritos</p>
            <p className="text-xs text-neutral-200 mt-1 font-medium">Miraflores & Barranco</p>
          </div>
          <div className="p-3 rounded-xl bg-neutral-900/40 border border-neutral-800/60">
            <p className="text-[11px] font-semibold text-neutral-400 uppercase tracking-wider">Categorías</p>
            <p className="text-xs text-neutral-200 mt-1 font-medium">Makis, Ceviche, Burgers</p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full max-w-md py-4 text-center text-xs text-neutral-400 border-t border-neutral-900">
        Vao · Lima, Perú
      </footer>
    </div>
  )
}
