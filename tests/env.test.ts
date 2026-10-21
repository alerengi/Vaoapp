import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { validatePublicEnv, validateServerEnv } from '../lib/env';

describe('Validación de Variables de Entorno y Seguridad', () => {
  it('debe detectar variables públicas faltantes', () => {
    const invalidEnv = {
      NEXT_PUBLIC_SUPABASE_URL: '',
    };
    const result = validatePublicEnv(invalidEnv);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_URL');
    expect(result.missing).toContain('NEXT_PUBLIC_SUPABASE_ANON_KEY');
  });

  it('debe validar correctamente cuando las variables públicas están completas', () => {
    const validEnv = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
    };
    const result = validatePublicEnv(validEnv);
    expect(result.isValid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('debe validar que las claves secretas de servidor no tengan prefijo NEXT_PUBLIC_', () => {
    const envExamplePath = path.resolve(__dirname, '../.env.example');
    expect(fs.existsSync(envExamplePath)).toBe(true);

    const content = fs.readFileSync(envExamplePath, 'utf-8');
    const lines = content
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'));

    // Las claves secretas nunca deben empezar con NEXT_PUBLIC_
    const secretKeys = ['SUPABASE_SERVICE_ROLE_KEY', 'GOOGLE_PLACES_API_KEY'];
    secretKeys.forEach((secret) => {
      expect(content).toContain(`${secret}=`);
      expect(content).not.toContain(`NEXT_PUBLIC_${secret}`);
    });

    // Validar que no hay valores reales quemados en .env.example
    lines.forEach((line) => {
      const [key, value] = line.split('=');
      if (key && value) {
        expect(value.toLowerCase()).toMatch(/(tu-|localhost|ejemplo)/);
      }
    });
  });

  it('debe rechazar configuración de servidor si faltan claves privadas', () => {
    const partialEnv = {
      NEXT_PUBLIC_SUPABASE_URL: 'https://test.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'test-anon-key',
      SUPABASE_SERVICE_ROLE_KEY: '',
      GOOGLE_PLACES_API_KEY: '',
    };
    const result = validateServerEnv(partialEnv);
    expect(result.isValid).toBe(false);
    expect(result.missing).toContain('SUPABASE_SERVICE_ROLE_KEY');
    expect(result.missing).toContain('GOOGLE_PLACES_API_KEY');
  });
});
