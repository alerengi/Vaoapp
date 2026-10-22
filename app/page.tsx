import Link from 'next/link'
import { Suspense } from 'react'
import { createPublicClient } from '@/lib/supabase/server'
import { AuthButton } from '@/components/AuthButton'
import { AuthErrorBanner } from '@/components/AuthErrorBanner'
import { RestaurantExplorer } from '@/components/RestaurantExplorer'
import { RestaurantListSkeleton } from '@/components/RestaurantListSkeleton'
import {
  RecomendacionesRecientes,
  RecomendacionesRecientesSkeleton,
} from '@/components/RecomendacionesRecientes'
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
    <div className="min-h-screen bg-[#FAFAF9] text-stone-900 flex flex-col selection:bg-orange-100 selection:text-orange-900">
      {/* Cabecera blanca estilo Airbnb / Rappi (ancho completo en pantallas grandes) */}
      <header className="w-full border-b border-stone-200/80 bg-white/95 backdrop-blur-md sticky top-0 z-40 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex items-center justify-between">
          {/* Logo Vao */}
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#EA580C] to-[#F97316] flex items-center justify-center font-black text-white text-lg shadow-sm shadow-orange-600/30 group-hover:scale-105 transition-transform">
              V
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-xl tracking-tight text-stone-900 leading-none">
                Vao
              </span>
              <span className="text-[10px] text-stone-600 font-semibold tracking-wide">
                Dónde comer rico
              </span>
            </div>
          </Link>

          {/* Acciones: Botón Recomendar + Sesión Google */}
          <div className="flex items-center gap-2 sm:gap-3">
            <Link
              href="/recomendar"
              className="text-xs font-bold px-3.5 py-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white shadow-sm hover:shadow transition-all min-h-[40px] flex items-center gap-1.5 active:scale-95 cursor-pointer"
            >
              <span className="text-base leading-none font-extrabold">+</span>
              <span className="hidden xs:inline">Recomendar</span>
              <span className="xs:hidden">Plato</span>
            </Link>

            <Suspense fallback={<div className="w-20 h-10 bg-stone-100 rounded-xl animate-pulse" />}>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Contenedor Principal Responsive (375px móvil hasta 3 columnas en desktop) */}
      <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col">
        {/* Notificación si hubo error de OAuth */}
        <Suspense fallback={null}>
          <AuthErrorBanner />
        </Suspense>

        {/* Explorador de Restaurantes con Hero Airbnb integrado */}
        <main className="w-full flex flex-col">
          <Suspense fallback={<RestaurantListSkeleton />}>
            <RestaurantFeed />
          </Suspense>

          {/* Sección social: últimas recomendaciones con botón ¡Confirmo! (3 columnas en desktop) */}
          <div className="w-full border-t border-stone-200/80 pt-8 mt-4">
            <Suspense fallback={<RecomendacionesRecientesSkeleton />}>
              <RecomendacionesRecientes />
            </Suspense>
          </div>
        </main>
      </div>
    </div>
  )
}
