'use client'

import React from 'react'

export type DistritoFiltro = 'todos' | 'Miraflores' | 'Barranco'
export type CategoriaFiltro = 'todas' | 'makis' | 'ceviche' | 'hamburguesas'

interface FilterChipsProps {
  selectedDistrito: DistritoFiltro
  onSelectDistrito: (distrito: DistritoFiltro) => void
  selectedCategoria: CategoriaFiltro
  onSelectCategoria: (categoria: CategoriaFiltro) => void
}

const DISTRITOS: { id: DistritoFiltro; label: string }[] = [
  { id: 'todos', label: 'Todos' },
  { id: 'Miraflores', label: 'Miraflores' },
  { id: 'Barranco', label: 'Barranco' },
]

const CATEGORIAS: { id: CategoriaFiltro; label: string; icon: string }[] = [
  { id: 'todas', label: 'Todas', icon: '🍽️' },
  { id: 'makis', label: 'Makis', icon: '🍣' },
  { id: 'ceviche', label: 'Ceviche', icon: '🍋' },
  { id: 'hamburguesas', label: 'Burgers', icon: '🍔' },
]

export function FilterChips({
  selectedDistrito,
  onSelectDistrito,
  selectedCategoria,
  onSelectCategoria,
}: FilterChipsProps) {
  return (
    <div className="w-full flex flex-col gap-3 py-2">
      {/* Selector de Distrito */}
      <div className="flex flex-col gap-1.5 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 px-1">
          Distrito
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {DISTRITOS.map((d) => {
            const isActive = selectedDistrito === d.id
            return (
              <button
                key={d.id}
                onClick={() => onSelectDistrito(d.id)}
                className={`min-h-[44px] px-4 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                  isActive
                    ? 'bg-amber-500 text-neutral-950 shadow-md shadow-amber-500/20'
                    : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                {d.label}
              </button>
            )
          })}
        </div>
      </div>

      {/* Selector de Categoría */}
      <div className="flex flex-col gap-1.5 text-left">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400 px-1">
          Tipo de cocina
        </span>
        <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
          {CATEGORIAS.map((c) => {
            const isActive = selectedCategoria === c.id
            return (
              <button
                key={c.id}
                onClick={() => onSelectCategoria(c.id)}
                className={`min-h-[44px] px-3.5 rounded-xl text-xs font-semibold whitespace-nowrap flex items-center gap-1.5 transition-all cursor-pointer ${
                  isActive
                    ? 'bg-orange-500 text-neutral-950 shadow-md shadow-orange-500/20'
                    : 'bg-neutral-900 text-neutral-300 border border-neutral-800 hover:border-neutral-700'
                }`}
              >
                <span>{c.icon}</span>
                <span>{c.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
