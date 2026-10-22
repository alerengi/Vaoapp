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
  const [searchQuery, setSearchQuery] = useState<string>('')
  const [heroSearchInput, setHeroSearchInput] = useState<string>('')
  const [visibleCount, setVisibleCount] = useState<number>(PAGE_SIZE)
  const [heroImageError, setHeroImageError] = useState<boolean>(false)

  // Filtrado reactivo en memoria: distrito, categoría y texto de búsqueda
  const filteredRestaurantes = useMemo(() => {
    return initialRestaurantes.filter((r) => {
      const matchSearch =
        !searchQuery ||
        r.nombre.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (r.direccion && r.direccion.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchDistrito =
        selectedDistrito === 'todos' ||
        r.distrito.toLowerCase() === selectedDistrito.toLowerCase()

      const matchCategoria =
        selectedCategoria === 'todas' ||
        (r.tipo_cocina && r.tipo_cocina.toLowerCase() === selectedCategoria.toLowerCase())

      return matchSearch && matchDistrito && matchCategoria
    })
  }, [initialRestaurantes, searchQuery, selectedDistrito, selectedCategoria])

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
    setSearchQuery('')
    setHeroSearchInput('')
    setVisibleCount(PAGE_SIZE)
  }

  const handleHeroSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setSearchQuery(heroSearchInput.trim())
    setVisibleCount(PAGE_SIZE)

    // Scroll suave hacia la sección de resultados
    const target = document.getElementById('catalogo-restaurantes')
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const visibleList = filteredRestaurantes.slice(0, visibleCount)
  const hasMore = visibleCount < filteredRestaurantes.length

  return (
    <div className="w-full flex flex-col items-center">
      {/* ============================================================ */}
      {/* HERO SECTION ESTILO AIRBNB (Tarjeta flotante + Foto grande) */}
      {/* ============================================================ */}
      <section className="w-full pt-4 pb-10 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
          {/* Columna Izquierda: Tarjeta Flotante de Búsqueda */}
          <div className="lg:col-span-5 w-full">
            <div className="bg-white rounded-3xl p-6 sm:p-8 shadow-xl shadow-stone-900/5 border border-stone-200/80 flex flex-col gap-4">
              <div>
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-orange-50 border border-orange-200/80 text-[11px] font-bold text-[#EA580C] uppercase tracking-wider mb-2.5">
                  <span>🔥</span> Recomendaciones reales
                </span>
                <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold text-stone-900 leading-tight tracking-tight">
                  ¿Qué se te antoja hoy?
                </h1>
                <p className="text-xs sm:text-sm text-stone-600 mt-2 leading-relaxed">
                  Descubre makis, ceviche y hamburguesas en Miraflores y Barranco validados por foodies.
                </p>
              </div>

              {/* Formulario de Búsqueda y Filtros */}
              <form onSubmit={handleHeroSubmit} className="flex flex-col gap-3 mt-1">
                {/* Campo de búsqueda de texto */}
                <div className="flex flex-col gap-1 text-left">
                  <label htmlFor="hero-search-input" className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                    Plato o restaurante
                  </label>
                  <div className="relative">
                    <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-stone-400 text-sm">
                      🔍
                    </span>
                    <input
                      id="hero-search-input"
                      type="text"
                      value={heroSearchInput}
                      onChange={(e) => setHeroSearchInput(e.target.value)}
                      placeholder="Ej. Makis acevichados, Don Michael..."
                      className="w-full min-h-[46px] pl-10 pr-4 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] focus:border-transparent text-stone-900 placeholder:text-stone-400 transition-all"
                    />
                  </div>
                </div>

                {/* Compartimentos estilo Airbnb: Distrito y Categoría */}
                <div className="grid grid-cols-2 gap-2.5">
                  {/* Selector Distrito */}
                  <div className="flex flex-col gap-1 text-left">
                    <label htmlFor="hero-distrito-select" className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                      Distrito
                    </label>
                    <select
                      id="hero-distrito-select"
                      value={selectedDistrito}
                      onChange={(e) => handleSelectDistrito(e.target.value as DistritoFiltro)}
                      className="w-full min-h-[44px] px-3 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] text-stone-800 font-semibold cursor-pointer"
                    >
                      <option value="todos">Todos los distritos</option>
                      <option value="Miraflores">Miraflores</option>
                      <option value="Barranco">Barranco</option>
                    </select>
                  </div>

                  {/* Selector Categoría */}
                  <div className="flex flex-col gap-1 text-left">
                    <label htmlFor="hero-categoria-select" className="text-[11px] font-bold uppercase tracking-wider text-stone-500 px-1">
                      Cocina
                    </label>
                    <select
                      id="hero-categoria-select"
                      value={selectedCategoria}
                      onChange={(e) => handleSelectCategoria(e.target.value as CategoriaFiltro)}
                      className="w-full min-h-[44px] px-3 text-xs sm:text-sm rounded-xl border border-stone-200 bg-stone-50/60 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#EA580C] text-stone-800 font-semibold cursor-pointer"
                    >
                      <option value="todas">Todas las cocinas</option>
                      <option value="makis">🍣 Makis</option>
                      <option value="ceviche">🍋 Ceviche</option>
                      <option value="hamburguesas">🍔 Burgers</option>
                    </select>
                  </div>
                </div>

                {/* Botón Buscar Naranja Vao (Contraste AA: #EA580C + texto blanco) */}
                <button
                  type="submit"
                  className="w-full min-h-[48px] mt-2 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-extrabold text-sm shadow-md shadow-orange-600/20 active:scale-98 transition-all flex items-center justify-center gap-2 cursor-pointer"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <span>Buscar</span>
                </button>
              </form>
            </div>
          </div>

          {/* Columna Derecha: Fotografía Gastronómica Destacada */}
          <div className="lg:col-span-7 w-full">
            <div className="relative w-full h-56 sm:h-80 lg:h-[420px] rounded-3xl overflow-hidden shadow-lg border border-stone-200/80 bg-gradient-to-tr from-stone-100 via-amber-50 to-orange-50 flex items-center justify-center">
              {!heroImageError ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src="/hero-food.jpg"
                  alt="Gastronomía de Lima: Makis, Ceviche y Hamburguesas"
                  onError={() => setHeroImageError(true)}
                  className="w-full h-full object-cover"
                />
              ) : (
                /* Fondo de respaldo elegante si la imagen aún no ha sido colocada en /public/hero-food.jpg */
                <div className="w-full h-full flex flex-col items-center justify-center p-6 text-center bg-gradient-to-tr from-orange-50 via-amber-50 to-stone-100">
                  <div className="w-20 h-20 rounded-2xl bg-white/80 backdrop-blur-md border border-orange-200/60 shadow-sm flex items-center justify-center text-4xl mb-3">
                    🍽️
                  </div>
                  <h3 className="font-extrabold text-lg sm:text-xl text-stone-900 mb-1">
                    Gastronomía de Lima
                  </h3>
                  <p className="text-xs text-stone-600 max-w-sm leading-relaxed">
                    Makis nikkei, ceviche fresco y hamburguesas artesanales en Miraflores y Barranco.
                  </p>
                  <span className="mt-3 text-[11px] text-stone-500 font-medium bg-white/90 px-3 py-1 rounded-full border border-stone-200">
                    Foto: public/hero-food.jpg
                  </span>
                </div>
              )}

              {/* Espacio para crédito de autor de la fotografía */}
              <div className="absolute bottom-3 right-3 left-3 sm:left-auto px-3 py-1.5 rounded-xl bg-black/60 backdrop-blur-xs text-[11px] text-white/95 flex items-center gap-1.5 shadow-sm">
                <span>📷</span>
                <span className="truncate">Gastronomía de Lima · Foto libre de derechos</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ============================================================ */}
      {/* CATÁLOGO DE RESTAURANTES (Filtros + Grid de 3 columnas) */}
      {/* ============================================================ */}
      <section id="catalogo-restaurantes" className="w-full pt-4 pb-8 flex flex-col items-center">
        {/* Chips rápidos de Filtro */}
        <FilterChips
          selectedDistrito={selectedDistrito}
          onSelectDistrito={handleSelectDistrito}
          selectedCategoria={selectedCategoria}
          onSelectCategoria={handleSelectCategoria}
        />

        {/* Indicador de búsqueda activa si hay texto */}
        {searchQuery && (
          <div className="w-full flex items-center justify-between bg-orange-50 border border-orange-200 rounded-xl px-4 py-2 mt-2 mb-1">
            <span className="text-xs text-[#C2410C] font-semibold flex items-center gap-1.5">
              <span>🔍</span> Buscando: &ldquo;<strong className="text-stone-900">{searchQuery}</strong>&rdquo;
            </span>
            <button
              onClick={() => {
                setSearchQuery('')
                setHeroSearchInput('')
              }}
              className="text-xs text-stone-600 hover:text-stone-900 font-bold px-2 py-0.5 rounded-md hover:bg-orange-100 transition-colors cursor-pointer"
            >
              Borrar filtro ✕
            </button>
          </div>
        )}

        {/* Contador de resultados */}
        <div className="w-full flex items-center justify-between text-xs text-stone-500 py-3 px-1">
          <span>
            Mostrando{' '}
            <strong className="text-stone-900 font-bold">
              {filteredRestaurantes.length > 0 ? visibleList.length : 0}
            </strong>{' '}
            de <strong className="text-stone-900 font-bold">{filteredRestaurantes.length}</strong> locales
          </span>

          {(selectedDistrito !== 'todos' || selectedCategoria !== 'todas' || searchQuery) && (
            <button
              onClick={handleResetFiltros}
              className="text-[#EA580C] hover:text-[#C2410C] underline font-bold cursor-pointer"
            >
              Limpiar filtros
            </button>
          )}
        </div>

        {/* Grid Responsive de Restaurantes: 1 col móvil, 2 cols tablet, 3 cols desktop */}
        {visibleList.length > 0 ? (
          <div
            className="w-full grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 mt-2"
            data-testid="restaurant-list"
          >
            {visibleList.map((restaurante) => (
              <RestaurantCard key={restaurante.id} restaurante={restaurante} />
            ))}
          </div>
        ) : (
          /* Estado Vacío Amigable */
          <div
            data-testid="empty-state"
            className="w-full py-16 px-6 rounded-3xl bg-white border border-stone-200/80 shadow-sm text-center flex flex-col items-center gap-3 mt-4"
          >
            <span className="text-5xl mb-1">🔍</span>
            <h3 className="text-lg font-extrabold text-stone-900">Sin restaurantes disponibles</h3>
            <p className="text-xs sm:text-sm text-stone-600 max-w-sm leading-relaxed">
              No encontramos locales que coincidan con tus filtros
              {searchQuery && (
                <span>
                  {' '}para &ldquo;<strong>{searchQuery}</strong>&rdquo;
                </span>
              )}
              . Prueba cambiando el distrito o la categoría.
            </p>
            <button
              onClick={handleResetFiltros}
              className="mt-3 min-h-[44px] px-6 rounded-xl bg-[#EA580C] hover:bg-[#C2410C] text-white font-bold text-xs shadow-sm active:scale-95 transition-all cursor-pointer"
            >
              Ver todos los restaurantes
            </button>
          </div>
        )}

        {/* Botón Ver Más (Paginación de 20 en 20) */}
        {hasMore && (
          <div className="w-full pt-8 pb-4 flex justify-center">
            <button
              data-testid="ver-mas-btn"
              onClick={handleVerMas}
              className="w-full sm:w-auto min-h-[44px] py-3 px-8 rounded-xl bg-white hover:bg-stone-50 border border-stone-200 text-stone-800 font-bold text-xs shadow-sm hover:shadow transition-all active:scale-95 cursor-pointer flex items-center justify-center gap-2"
            >
              <span>Ver más restaurantes (+{PAGE_SIZE})</span>
              <span className="text-stone-500 font-normal">
                ({filteredRestaurantes.length - visibleList.length} restantes)
              </span>
            </button>
          </div>
        )}

        {/* Atribución general obligatoria de Google Places */}
        <footer className="w-full pt-8 pb-4 text-center">
          <p className="text-[11px] text-stone-600">
            📍 Datos de lugares y mapas provistos por Google Maps Platform.
          </p>
        </footer>
      </section>
    </div>
  )
}
