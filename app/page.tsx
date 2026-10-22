import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase/server'
import { AuthButton } from '@/components/AuthButton'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { RestaurantExplorer } from '@/components/RestaurantExplorer'
import { RestaurantListSkeleton } from '@/components/RestaurantListSkeleton'
import type { RestauranteDB } from '@/lib/types'

async function RestaurantFeed() {
  let restaurantes: RestauranteDB[] = []

  try {
    const supabase = createPublicClient()
    const { data, error } = await supabase
      .from('restaurantes')
      .select(
        'id, google_place_id, nombre, direccion, distrito, lat, lng, tipo_cocina, rango_precio, photo_reference, photo_author, fecha_sync'
      )
      .order('nombre', { ascending: true })

    if (!error && data) {
      restaurantes = data as RestauranteDB[]
    }
  } catch (err) {
    console.error('Error al cargar restaurantes desde Supabase en Home:', err)
  }

  return <RestaurantExplorer initialRestaurantes={restaurantes} />
}

export default function Home() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center p-4 sm:p-6 selection:bg-amber-500 selection:text-neutral-950">
      {/* Contenedor Principal Mobile-First (ajustado a celulares desde 375px) */}
      <div className="w-full max-w-md flex flex-col items-center">
        {/* Header móvil */}
        <header className="w-full flex items-center justify-between py-4 border-b border-neutral-900 sticky top-0 bg-neutral-950/90 backdrop-blur-md z-30">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-600 to-orange-500 flex items-center justify-center font-black text-neutral-950 text-lg shadow-lg shadow-orange-500/20">
              V
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-xl tracking-tight text-white leading-none">
                Vao
              </span>
              <span className="text-[10px] text-neutral-400 font-medium">Dónde comer rico</span>
            </div>
          </div>

          <span className="text-[11px] font-semibold px-2.5 py-1 rounded-full bg-neutral-900 text-amber-400/90 border border-neutral-800">
            Fase 1 · MVP
          </span>
        </header>

        {/* Sección de bienvenida e inicio de sesión */}
        <section className="w-full flex flex-col items-center text-center py-6 px-1 border-b border-neutral-900/60">
          <h1 className="text-2xl font-extrabold tracking-tight text-white leading-tight mb-2">
            Dónde comer en{' '}
            <span className="text-transparent bg-clip-text bg-gradient-to-r from-amber-400 to-orange-500">
              Miraflores & Barranco
            </span>
          </h1>

          <p className="text-neutral-400 text-xs sm:text-sm max-w-xs mb-5 leading-relaxed">
            Explora restaurantes reales de makis, ceviche y hamburguesas validados por la comunidad.
          </p>

          {/* Notificación de error si falló OAuth */}
          <Suspense fallback={null}>
            <AuthErrorBanner />
          </Suspense>

          {/* Botón de sesión OAuth con Google */}
          <div className="w-full flex justify-center mb-1">
            <AuthButton />
          </div>
        </section>

        {/* Explorador de Restaurantes en Suspense para Streaming con Partial Prerendering de Next.js 16 */}
        <main className="w-full py-4">
          <Suspense fallback={<RestaurantListSkeleton />}>
            <RestaurantFeed />
          </Suspense>
        </main>
      </div>
    </div>
  )
}
