import React from 'react'
import type { RestauranteDB } from '@/lib/types'

interface RestaurantCardProps {
  restaurante: RestauranteDB
}

export function RestaurantCard({ restaurante }: RestaurantCardProps) {
  const photoUrl = restaurante.photo_reference
    ? `/api/places/photo?ref=${encodeURIComponent(restaurante.photo_reference)}`
    : null

  // Construir enlace directo para Google Maps
  const mapsQuery = encodeURIComponent(
    `${restaurante.nombre}, ${restaurante.direccion || restaurante.distrito}, Lima, Peru`
  )
  const mapsUrl = `https://www.google.com/maps/search/?api=1&query=${mapsQuery}&query_place_id=${restaurante.google_place_id}`

  const precioSimbolos = restaurante.rango_precio
    ? '$'.repeat(restaurante.rango_precio)
    : null

  // Verificar si photo_author es una URL o un nombre de autor
  const isAuthorUrl =
    restaurante.photo_author &&
    (restaurante.photo_author.startsWith('http://') ||
      restaurante.photo_author.startsWith('https://'))

  return (
    <article
      data-testid="restaurant-card"
      className="w-full bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all duration-200 flex flex-col group"
    >
      {/* Contenedor de Imagen de Portada */}
      <div className="relative w-full h-48 bg-stone-100 overflow-hidden">
        {photoUrl ? (
          // Usamos <img> estándar con loading="lazy" para evitar doble procesamiento y respetar el rate limit al hacer scroll
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={photoUrl}
            alt={`Foto de ${restaurante.nombre}`}
            loading="lazy"
            decoding="async"
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex flex-col items-center justify-center bg-stone-100 text-stone-600 gap-1">
            <span className="text-3xl">🍽️</span>
            <span className="text-xs font-medium">Sin foto disponible</span>
          </div>
        )}

        {/* Badges superiores sobre la imagen */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between pointer-events-none">
          <span className="px-2.5 py-1 rounded-full bg-orange-50/95 backdrop-blur-md text-[11px] font-bold text-orange-800 border border-orange-200/80 capitalize shadow-sm">
            {restaurante.tipo_cocina || 'Comida'}
          </span>

          <span className="px-2.5 py-1 rounded-full bg-white/95 backdrop-blur-md text-[11px] font-semibold text-stone-700 border border-stone-200 shadow-sm">
            {restaurante.distrito}
          </span>
        </div>

        {/* Atribución de autor de foto requerida por Google Places */}
        {restaurante.photo_author && (
          <div className="absolute bottom-2 left-2 right-2 px-2 py-0.5 rounded bg-black/60 backdrop-blur-xs text-[10px] text-white/90 truncate">
            Foto:{' '}
            {isAuthorUrl ? (
              <a
                href={restaurante.photo_author}
                target="_blank"
                rel="noopener noreferrer"
                className="underline hover:text-white"
              >
                {restaurante.photo_author}
              </a>
            ) : (
              <span className="text-white">{restaurante.photo_author}</span>
            )}
          </div>
        )}
      </div>

      {/* Contenido de la tarjeta */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-start justify-between gap-2">
            <h3 className="font-extrabold text-base text-stone-900 leading-snug line-clamp-1">
              {restaurante.nombre}
            </h3>
            {precioSimbolos && (
              <span className="text-xs font-bold text-emerald-800 bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-md shrink-0">
                {precioSimbolos}
              </span>
            )}
          </div>

          <p className="text-xs text-stone-600 line-clamp-2 mt-1 leading-relaxed">
            {restaurante.direccion || `${restaurante.distrito}, Lima`}
          </p>
        </div>

        {/* Pie de tarjeta con atribución de datos y Botón ¡Vao! */}
        <div className="flex items-center justify-between pt-3 border-t border-stone-100 mt-1">
          <span className="text-[11px] text-stone-600 font-medium tracking-tight">
            Datos de Google Maps
          </span>

          <a
            href={mapsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-1.5 px-4 min-h-[44px] rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-sm hover:shadow active:scale-95 transition-all cursor-pointer"
            aria-label={`Ir a ${restaurante.nombre} en Google Maps`}
          >
            <span>¡Vao!</span>
            <svg
              className="w-3.5 h-3.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2.5}
                d="M14 5l7 7m0 0l-7 7m7-7H3"
              />
            </svg>
          </a>
        </div>
      </div>
    </article>
  )
}
