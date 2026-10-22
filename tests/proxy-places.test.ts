import { describe, it, expect, vi, beforeEach } from 'vitest'
import { checkRateLimit, resetRateLimits } from '../lib/rate-limiter'
import { GET } from '../app/api/places/photo/route'

// Mock de Supabase server
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn(async () => ({
    from: vi.fn((table: string) => {
      if (table === 'restaurantes') {
        return {
          select: vi.fn(() => ({
            eq: vi.fn((col: string, val: string) => ({
              limit: vi.fn(() => ({
                maybeSingle: vi.fn(() => {
                  if (val === 'places/valid_place/photos/valid_photo') {
                    return Promise.resolve({ data: { id: 'rest-123' }, error: null })
                  }
                  return Promise.resolve({ data: null, error: null })
                }),
              })),
            })),
          })),
        }
      }
      return {}
    }),
  })),
}))

describe('Seguridad de Rate Limiter y Proxy de Fotos', () => {
  beforeEach(() => {
    resetRateLimits()
    process.env.GOOGLE_PLACES_API_KEY = 'fake-google-key'
    vi.restoreAllMocks()
  })

  describe('Rate Limiter en memoria (lib/rate-limiter.ts)', () => {
    it('permite peticiones dentro del límite', () => {
      const ip = '192.168.1.1'
      const res1 = checkRateLimit(ip, 5, 1000)
      expect(res1.success).toBe(true)
      expect(res1.remaining).toBe(4)

      const res2 = checkRateLimit(ip, 5, 1000)
      expect(res2.success).toBe(true)
      expect(res2.remaining).toBe(3)
    })

    it('bloquea peticiones al exceder el límite y calcula el tiempo de reseteo', () => {
      const ip = '192.168.1.2'
      for (let i = 0; i < 3; i++) {
        expect(checkRateLimit(ip, 3, 2000).success).toBe(true)
      }

      // 4ta petición: debe fallar
      const bloqueada = checkRateLimit(ip, 3, 2000)
      expect(bloqueada.success).toBe(false)
      expect(bloqueada.remaining).toBe(0)
      expect(bloqueada.reset).toBeGreaterThan(0)
    })

    it('distingue límites entre diferentes direcciones IP', () => {
      const ipA = '10.0.0.1'
      const ipB = '10.0.0.2'

      expect(checkRateLimit(ipA, 1, 1000).success).toBe(true)
      expect(checkRateLimit(ipA, 1, 1000).success).toBe(false)

      // ipB aún debe tener cuota
      expect(checkRateLimit(ipB, 1, 1000).success).toBe(true)
    })
  })

  describe('Route Handler /api/places/photo', () => {
    it('rechaza peticiones sin parámetro ref con error 400 estructurado', async () => {
      const req = new Request('http://localhost:3000/api/places/photo')
      const res = await GET(req)

      expect(res.status).toBe(400)
      const json = await res.json()
      expect(json).toEqual({
        ok: false,
        error: {
          codigo: 'PARAMETRO_REQUERIDO',
          mensaje: expect.any(String),
        },
      })
    })

    it('rechaza referencias no registradas en la tabla restaurantes con error 403', async () => {
      const req = new Request(
        'http://localhost:3000/api/places/photo?ref=places/unauthorized/photos/xyz'
      )
      const res = await GET(req)

      expect(res.status).toBe(403)
      const json = await res.json()
      expect(json).toEqual({
        ok: false,
        error: {
          codigo: 'FOTO_NO_AUTORIZADA',
          mensaje: expect.any(String),
        },
      })
    })

    it('bloquea clientes que superan el rate limit con error 429', async () => {
      const ip = '180.20.10.5'
      // Consumir el límite de 60 peticiones
      for (let i = 0; i < 60; i++) {
        checkRateLimit(ip, 60, 60000)
      }

      const req = new Request(
        'http://localhost:3000/api/places/photo?ref=places/valid_place/photos/valid_photo',
        {
          headers: { 'x-forwarded-for': ip },
        }
      )
      const res = await GET(req)

      expect(res.status).toBe(429)
      expect(res.headers.get('Retry-After')).toBeDefined()
      const json = await res.json()
      expect(json).toEqual({
        ok: false,
        error: {
          codigo: 'LIMITE_EXCEDIDO',
          mensaje: expect.any(String),
        },
      })
    })

    it('retorna la imagen y cabeceras Cache-Control al validar una referencia legítima', async () => {
      // Mock del fetch de Google Places
      const fakeImageBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]) // JPEG header
      const globalFetchMock = vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(fakeImageBytes, {
          status: 200,
          headers: { 'content-type': 'image/jpeg' },
        })
      )

      const req = new Request(
        'http://localhost:3000/api/places/photo?ref=places/valid_place/photos/valid_photo'
      )
      const res = await GET(req)

      expect(res.status).toBe(200)
      expect(res.headers.get('Content-Type')).toBe('image/jpeg')
      expect(res.headers.get('Cache-Control')).toContain('public')
      expect(res.headers.get('Cache-Control')).toContain('max-age=86400')
      expect(res.headers.get('Cache-Control')).toContain('s-maxage=604800')

      globalFetchMock.mockRestore()
    })
  })
})
