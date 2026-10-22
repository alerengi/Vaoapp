import { describe, it, expect, vi, beforeEach } from 'vitest'
import { getSafeRedirectPath } from '../lib/auth-utils'
import { GET } from '../app/auth/callback/route'
import { updateSession } from '../lib/supabase/proxy'
import { NextRequest } from 'next/server'

// Mocks para @supabase/ssr y next/headers
vi.mock('@supabase/ssr', () => ({
  createBrowserClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn(),
      signInWithOAuth: vi.fn(),
      signOut: vi.fn(),
      onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
    },
  })),
  createServerClient: vi.fn(() => ({
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'usr-123', email: 'test@vao.pe' } }, error: null }),
      exchangeCodeForSession: vi.fn((code: string) => {
        if (code === 'valid_code') {
          return Promise.resolve({ data: { session: {} }, error: null })
        }
        return Promise.resolve({ data: { session: null }, error: { message: 'Invalid code' } })
      }),
    },
  })),
}))

vi.mock('next/headers', () => ({
  cookies: vi.fn(async () => ({
    getAll: vi.fn(() => []),
    set: vi.fn(),
  })),
}))

describe('Seguridad de Autenticación y Redirecciones', () => {
  describe('getSafeRedirectPath (Protección Open Redirect)', () => {
    it('permite rutas internas válidas', () => {
      expect(getSafeRedirectPath('/')).toBe('/')
      expect(getSafeRedirectPath('/buscar')).toBe('/buscar')
      expect(getSafeRedirectPath('/restaurantes/central')).toBe('/restaurantes/central')
      expect(getSafeRedirectPath('/perfil?tab=favoritos')).toBe('/perfil?tab=favoritos')
      expect(getSafeRedirectPath('/platos#destacados')).toBe('/platos#destacados')
    })

    it('bloquea URLs absolutas externas y retorna fallback', () => {
      expect(getSafeRedirectPath('https://malicious.com')).toBe('/')
      expect(getSafeRedirectPath('http://phishing.site/login')).toBe('/')
      expect(getSafeRedirectPath('ftp://servidor.com')).toBe('/')
    })

    it('bloquea URLs scheme-relative (//malicious.com)', () => {
      expect(getSafeRedirectPath('//malicious.com')).toBe('/')
      expect(getSafeRedirectPath('//google.com/path')).toBe('/')
    })

    it('bloquea intentos de evasión con backslashes (\\malicious.com)', () => {
      expect(getSafeRedirectPath('/\\malicious.com')).toBe('/')
      expect(getSafeRedirectPath('\\malicious.com')).toBe('/')
    })

    it('bloquea esquemas peligrosos como javascript:', () => {
      expect(getSafeRedirectPath('javascript:alert(1)')).toBe('/')
      expect(getSafeRedirectPath('data:text/html,<script>alert(1)</script>')).toBe('/')
    })

    it('maneja valores vacíos, nulos o indefinidos usando el fallback indicado', () => {
      expect(getSafeRedirectPath(null)).toBe('/')
      expect(getSafeRedirectPath(undefined)).toBe('/')
      expect(getSafeRedirectPath('')).toBe('/')
      expect(getSafeRedirectPath('   ')).toBe('/')
      expect(getSafeRedirectPath(null, '/inicio')).toBe('/inicio')
    })
  })

  describe('Route Handler /auth/callback', () => {
    beforeEach(() => {
      process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://fake.supabase.co'
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'fake-anon-key'
    })

    it('intercambia código válido y redirige a la ruta interna solicitada', async () => {
      const request = new Request('http://localhost:3000/auth/callback?code=valid_code&next=/explorar')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/explorar')
    })

    it('si se envía un target externo en next, sanitiza y redirige al fallback interno /', async () => {
      const request = new Request('http://localhost:3000/auth/callback?code=valid_code&next=https://evil.com')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/')
    })

    it('si no viene código OAuth, redirige con indicador de error', async () => {
      const request = new Request('http://localhost:3000/auth/callback')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/?auth_error=oauth_failed')
    })

    it('si el intercambio de código falla, redirige con indicador de error', async () => {
      const request = new Request('http://localhost:3000/auth/callback?code=invalid_code')
      const response = await GET(request)

      expect(response.status).toBe(307)
      expect(response.headers.get('location')).toBe('http://localhost:3000/?auth_error=oauth_failed')
    })
  })

  describe('Proxy de Sesión (updateSession)', () => {
    it('valida la sesión invocando getUser() sin errores', async () => {
      const req = new NextRequest('http://localhost:3000/')
      const res = await updateSession(req)

      expect(res).toBeDefined()
      expect(res.status).toBe(200)
    })
  })
})
