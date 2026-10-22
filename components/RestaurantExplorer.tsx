'use client'

import React, { useState, useMemo } from 'react'
import type { RestauranteDB } from '@/lib/types'
import { RestaurantCard } from '@/components/RestaurantCard'
import { FilterChips, type DistritoFiltro, type CategoriaFiltro } from '@/components/FilterChips'

interface RestaurantExplorerProps {
  initialRestaurantes: RestauranteDB[]
}

const PAGE_SIZE = 20

export function RestaurantExplorer({ initialRestaurantes }: RestaurantExplorerProps) {
  const [selectedDistrito, setSelectedDistrito] = useState<DistritoFiltro>('todos')
  const [selectedCategoria, setSelectedCategoria] = useState<CategoriaFiltro>('todas')
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)

  // Filtrado reactivo en memoria
  const filteredRestaurantes = useMemo(() => {
    return initialRestaurantes.filter((r) => {
      const matchDistrito =
        selectedDistrito === 'todos' ||
        r.distrito.toLowerCase() === selectedDistrito.toLowerCase()

      const matchCategoria =
        selectedCategoria === 'todas' ||
        (r.tipo_cocina && r.tipo_cocina.toLowerCase() === selectedCategoria.toLowerCase())

      return matchDistrito && matchCategoria
    })
  }, [initialRestaurantes, selectedDistrito, selectedCategoria])

  const handleSelectDistrito = (distrito: DistritoFiltro) => {
    setSelectedDistrito(distrito)
    setVisibleCount(PAGE_SIZE)
  }

  const handleSelectCategoria = (categoria: CategoriaFiltro) => {
    setSelectedCategoria(categoria)
    setVisibleCount(PAGE_SIZE)
  }

  const handleVerMas = () => {
    setVisibleCount((prev) => prev + PAGE_SIZE)
  }

  const handleResetFiltros = () => {
    setSelectedDistrito('todos')
    setSelectedCategoria('todas')
    setVisibleCount(PAGE_SIZE)
  }

  const visibleList = filteredRestaurantes.slice(0, visibleCount)
  const hasMore = visibleCount < filteredRestaurantes.length

  return (
    <section className="w-full flex flex-col items-center">
      {/* Selector de Filtros */}
      <FilterChips
        selectedDistrito={selectedDistrito}
        onSelectDistrito={handleSelectDistrito}
        selectedCategoria={selectedCategoria}
        onSelectCategoria={handleSelectCategoria}
      />

      {/* Contador de resultados */}
      <div className="w-full flex items-center justify-between text-xs text-neutral-400 py-3 px-1">
        <span>
          Mostrando{' '}
          <strong className="text-neutral-200">
            {filteredRestaurantes.length > 0 ? visibleList.length : 0}
          </strong>{' '}
          de <strong className="text-neutral-200">{filteredRestaurantes.length}</strong> locales
        </span>

        {(selectedDistrito !== 'todos' || selectedCategoria !== 'todas') && (
          <button
            onClick={handleResetFiltros}
            className="text-amber-400 hover:text-amber-300 underline font-medium cursor-pointer"
          >
            Limpiar filtros
          </button>
        )}
      </div>

      {/* Lista de Restaurantes */}
      {visibleList.length > 0 ? (
        <div className="w-full flex flex-col gap-4 mt-2" data-testid="restaurant-list">
          {visibleList.map((restaurante) => (
            <RestaurantCard key={restaurante.id} restaurante={restaurante} />
          ))}
        </div>
      ) : (
        /* Estado Vacío Amigable */
        <div
          data-testid="empty-state"
          className="w-full py-12 px-4 rounded-2xl bg-neutral-900/40 border border-neutral-800 text-center flex flex-col items-center gap-3 mt-4"
        >
          <span className="text-4xl">🔍</span>
          <h3 className="text-base font-bold text-neutral-200">Sin restaurantes disponibles</h3>
          <p className="text-xs text-neutral-400 max-w-xs leading-relaxed">
            No encontramos locales en{' '}
            <strong className="text-neutral-300">
              {selectedDistrito === 'todos' ? 'cualquier distrito' : selectedDistrito}
            </strong>{' '}
            para la categoría{' '}
            <strong className="text-neutral-300">
              {selectedCategoria === 'todas' ? 'seleccionada' : selectedCategoria}
            </strong>
            .
          </p>
          <button
            onClick={handleResetFiltros}
            className="mt-2 min-h-[44px] px-5 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-200 font-semibold text-xs transition-colors cursor-pointer"
          >
            Ver todos los restaurantes
          </button>
        </div>
      )}

      {/* Botón Ver Más (Paginación de 20 en 20 para cuidar cuota y rate-limit) */}
      {hasMore && (
        <div className="w-full pt-6 pb-4 flex justify-center">
          <button
            data-testid="ver-mas-btn"
            onClick={handleVerMas}
            className="w-full min-h-[44px] py-3 px-6 rounded-xl bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-700 text-neutral-200 font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
          >
            <span>Ver más restaurantes (+{PAGE_SIZE})</span>
            <span className="text-neutral-500">
              ({filteredRestaurantes.length - visibleList.length} restantes)
            </span>
          </button>
        </div>
      )}

      {/* Atribución general obligatoria de Google Places */}
      <footer className="w-full pt-8 pb-4 text-center">
        <p className="text-[11px] text-neutral-400">
          📍 Datos de lugares y mapas provistos por Google Maps Platform.
        </p>
      </footer>
    </section>
  )
}
