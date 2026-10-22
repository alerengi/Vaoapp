import React from 'react'
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { RestaurantCard } from '../components/RestaurantCard'
import { RestaurantExplorer } from '../components/RestaurantExplorer'
import type { RestauranteDB } from '../lib/types'

// Mock de createBrowserClient para componentes
vi.mock('@/lib/supabase/client', () => ({
  createClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      onAuthStateChange: vi.fn(() => ({
        data: { subscription: { unsubscribe: vi.fn() } },
      })),
    },
  })),
}))

const mockRestaurante: RestauranteDB = {
  id: 'rest-001',
  google_place_id: 'ChIJ1234567890',
  nombre: 'Cevichería El Buen Sabor',
  direccion: 'Av. Larco 123, Miraflores',
  distrito: 'Miraflores',
  lat: -12.1234,
  lng: -77.0298,
  tipo_cocina: 'ceviche',
  rango_precio: 2,
  photo_reference: 'places/ChIJ123/photos/sample_photo_token',
  photo_author: 'Carlos Foodie',
  fecha_sync: '2026-10-21T00:00:00Z',
}

function generarListaRestaurantes(cantidad: number): RestauranteDB[] {
  return Array.from({ length: cantidad }, (_, i) => ({
    id: `rest-${i + 1}`,
    google_place_id: `place-id-${i + 1}`,
    nombre: `Restaurante Gourmet ${i + 1}`,
    direccion: `Calle Falsa ${i + 1}`,
    distrito: i % 2 === 0 ? 'Miraflores' : 'Barranco',
    lat: -12.12,
    lng: -77.03,
    tipo_cocina: i % 3 === 0 ? 'makis' : i % 3 === 1 ? 'ceviche' : 'hamburguesas',
    rango_precio: ((i % 4) + 1) as 1 | 2 | 3 | 4,
    photo_reference: `places/place-${i + 1}/photos/photo-${i + 1}`,
    photo_author: `Fotógrafo ${i + 1}`,
    fecha_sync: '2026-10-21T00:00:00Z',
  }))
}

describe('Componentes UI Mobile-First (Tarea 1.5)', () => {
  describe('RestaurantCard', () => {
    it('renderiza nombre, distrito, cocina y precio', () => {
      render(<RestaurantCard restaurante={mockRestaurante} />)

      expect(screen.getByText('Cevichería El Buen Sabor')).toBeDefined()
      expect(screen.getByText('Miraflores')).toBeDefined()
      expect(screen.getByText('ceviche')).toBeDefined()
      expect(screen.getByText('$$')).toBeDefined()
    })

    it('utiliza <img> con loading="lazy" y ruta del proxy de fotos', () => {
      render(<RestaurantCard restaurante={mockRestaurante} />)

      const img = screen.getByRole('img', { name: /Foto de Cevichería El Buen Sabor/i })
      expect(img).toBeDefined()
      expect(img.getAttribute('loading')).toBe('lazy')
      expect(img.getAttribute('src')).toBe(
        '/api/places/photo?ref=places%2FChIJ123%2Fphotos%2Fsample_photo_token'
      )
    })

    it('muestra las atribuciones requeridas: Datos de Google Maps y autor de foto', () => {
      render(<RestaurantCard restaurante={mockRestaurante} />)

      expect(screen.getByText('Datos de Google Maps')).toBeDefined()
      expect(screen.getByText(/Carlos Foodie/)).toBeDefined()
    })

    it('el botón ¡Vao! apunta a Google Maps en nueva pestaña', () => {
      render(<RestaurantCard restaurante={mockRestaurante} />)

      const botonVao = screen.getByRole('link', { name: /Ir a Cevichería El Buen Sabor/i })
      expect(botonVao).toBeDefined()
      expect(botonVao.getAttribute('target')).toBe('_blank')
      expect(botonVao.getAttribute('href')).toContain('google.com/maps/search')
      expect(botonVao.getAttribute('href')).toContain('ChIJ1234567890')
    })
  })

  describe('RestaurantExplorer (Paginación y Filtros)', () => {
    it('muestra inicialmente un máximo de 20 restaurantes', () => {
      const lista35 = generarListaRestaurantes(35)
      render(<RestaurantExplorer initialRestaurantes={lista35} />)

      const tarjetas = screen.getAllByTestId('restaurant-card')
      expect(tarjetas.length).toBe(20)
    })

    it('muestra el botón "Ver más restaurantes" si hay más de 20 y carga los siguientes al hacer clic', () => {
      const lista35 = generarListaRestaurantes(35)
      render(<RestaurantExplorer initialRestaurantes={lista35} />)

      const verMasBtn = screen.getByTestId('ver-mas-btn')
      expect(verMasBtn).toBeDefined()
      expect(verMasBtn.textContent).toContain('Ver más restaurantes')

      // Hacer clic en Ver Más
      fireEvent.click(verMasBtn)

      const tarjetasActualizadas = screen.getAllByTestId('restaurant-card')
      expect(tarjetasActualizadas.length).toBe(35)

      // Ya no debe mostrar el botón porque se mostraron todos
      expect(screen.queryByTestId('ver-mas-btn')).toBeNull()
    })

    it('filtra correctamente por distrito al hacer clic en el chip', () => {
      const lista30 = generarListaRestaurantes(30)
      render(<RestaurantExplorer initialRestaurantes={lista30} />)

      // Clic en chip Barranco
      const chipBarranco = screen.getByRole('button', { name: 'Barranco' })
      fireEvent.click(chipBarranco)

      const tarjetas = screen.getAllByTestId('restaurant-card')
      expect(tarjetas.length).toBeGreaterThan(0)
      tarjetas.forEach((tarjeta) => {
        expect(tarjeta.textContent).toContain('Barranco')
        expect(tarjeta.textContent).not.toContain('Miraflores')
      })
    })

    it('filtra correctamente por categoría al hacer clic en el chip', () => {
      const lista30 = generarListaRestaurantes(30)
      render(<RestaurantExplorer initialRestaurantes={lista30} />)

      // Clic en chip Ceviche
      const chipCeviche = screen.getByRole('button', { name: /Ceviche/i })
      fireEvent.click(chipCeviche)

      const tarjetas = screen.getAllByTestId('restaurant-card')
      tarjetas.forEach((tarjeta) => {
        expect(tarjeta.textContent?.toLowerCase()).toContain('ceviche')
      })
    })

    it('muestra el estado vacío si la combinación de filtros no produce resultados', () => {
      // Lista con solo makis en Miraflores
      const listaSoloMakis: RestauranteDB[] = [
        {
          ...mockRestaurante,
          id: 'maki-1',
          distrito: 'Miraflores',
          tipo_cocina: 'makis',
        },
      ]

      render(<RestaurantExplorer initialRestaurantes={listaSoloMakis} />)

      // Filtrar por Barranco
      const chipBarranco = screen.getByRole('button', { name: 'Barranco' })
      fireEvent.click(chipBarranco)

      expect(screen.getByTestId('empty-state')).toBeDefined()
      expect(screen.getByText('Sin restaurantes disponibles')).toBeDefined()
    })
  })
})
