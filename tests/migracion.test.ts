/**
 * Pruebas de estructura y coherencia del script de migración SQL de Vao.
 * Verifican el texto del SQL (no se ejecutan contra una BD real).
 * Ver sección "¿Qué verifican estas pruebas?" al final del archivo.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isFotoPathValida, buildFotoUrl } from '../lib/types';

let sql: string;

beforeAll(() => {
  const sqlPath = path.resolve(
    __dirname,
    '../supabase/migrations/001_modelo_completo_vao.sql'
  );
  expect(fs.existsSync(sqlPath), 'El archivo de migración debe existir').toBe(true);
  sql = fs.readFileSync(sqlPath, 'utf-8');
});

// ---------------------------------------------------------------------------
// Punto 1 · Permisos por columna en 'usuarios'
// ---------------------------------------------------------------------------
describe('Punto 1 · Permisos por columna en usuarios', () => {
  it('debe revocar UPDATE genérico al rol authenticated en usuarios', () => {
    expect(sql).toMatch(/REVOKE\s+UPDATE\s+ON\s+public\.usuarios\s+FROM\s+authenticated/i);
  });

  it('debe conceder UPDATE solo en nombre, foto_url y distrito', () => {
    const match = sql.match(
      /GRANT\s+UPDATE\s*\(([^)]+)\)\s+ON\s+public\.usuarios\s+TO\s+authenticated/i
    );
    expect(match, 'Debe haber un GRANT UPDATE por columna en usuarios').toBeTruthy();
    const columnas = match![1].split(',').map((c) => c.trim().toLowerCase());
    expect(columnas).toContain('nombre');
    expect(columnas).toContain('foto_url');
    expect(columnas).toContain('distrito');
    expect(columnas).not.toContain('email');
    expect(columnas).not.toContain('fecha_registro');
    expect(columnas).not.toContain('nivel_confianza');
  });

  it('NO debe haber política usuarios_insercion_propia (eliminada)', () => {
    expect(sql).not.toContain('usuarios_insercion_propia');
  });
});

// ---------------------------------------------------------------------------
// Punto 2 · Permisos por columna en 'recomendaciones' (usa foto_path)
// ---------------------------------------------------------------------------
describe('Punto 2 · Permisos por columna en recomendaciones', () => {
  it('debe revocar UPDATE genérico al rol authenticated en recomendaciones', () => {
    expect(sql).toMatch(
      /REVOKE\s+UPDATE\s+ON\s+public\.recomendaciones\s+FROM\s+authenticated/i
    );
  });

  it('debe conceder UPDATE en calificacion, comentario y foto_path (no foto_url)', () => {
    const match = sql.match(
      /GRANT\s+UPDATE\s*\(([^)]+)\)\s+ON\s+public\.recomendaciones\s+TO\s+authenticated/i
    );
    expect(match, 'Debe haber un GRANT UPDATE por columna en recomendaciones').toBeTruthy();
    const columnas = match![1].split(',').map((c) => c.trim().toLowerCase());
    expect(columnas).toContain('calificacion');
    expect(columnas).toContain('comentario');
    expect(columnas).toContain('foto_path');
    expect(columnas).not.toContain('foto_url');  // renombrado
    expect(columnas).not.toContain('estado');
    expect(columnas).not.toContain('plato_id');
    expect(columnas).not.toContain('usuario_id');
    expect(columnas).not.toContain('fecha');
  });
});

// ---------------------------------------------------------------------------
// Punto 3 · Permisos por columna en 'platos' (INSERT)
// ---------------------------------------------------------------------------
describe('Punto 3 · Permisos por columna en platos', () => {
  it('debe revocar INSERT genérico al rol authenticated en platos', () => {
    expect(sql).toMatch(/REVOKE\s+INSERT\s+ON\s+public\.platos\s+FROM\s+authenticated/i);
  });

  it('debe conceder INSERT sin incluir puntaje_vao ni total_recomendaciones', () => {
    const match = sql.match(
      /GRANT\s+INSERT\s*\(([^)]+)\)\s+ON\s+public\.platos\s+TO\s+authenticated/i
    );
    expect(match, 'Debe haber un GRANT INSERT por columna en platos').toBeTruthy();
    const columnas = match![1].split(',').map((c) => c.trim().toLowerCase());
    expect(columnas).toContain('restaurante_id');
    expect(columnas).toContain('categoria_id');
    expect(columnas).toContain('nombre');
    expect(columnas).not.toContain('puntaje_vao');
    expect(columnas).not.toContain('total_recomendaciones');
  });
});

// ---------------------------------------------------------------------------
// Punto 4a · Trigger: límite diario de recomendaciones
// ---------------------------------------------------------------------------
describe('Punto 4a · Trigger de límite diario de recomendaciones', () => {
  it('debe existir la función handle_recomendacion_before_upsert (no la anterior)', () => {
    expect(sql).toContain('handle_recomendacion_before_upsert');
    expect(sql).not.toContain('handle_recomendacion_before_insert');
  });

  it('debe lanzar LIMITE_DIARIO_ALCANZADO cuando total_hoy >= 10', () => {
    expect(sql).toContain('LIMITE_DIARIO_ALCANZADO');
    expect(sql).toMatch(/total_hoy\s*>=\s*10/);
    expect(sql).toContain("AND fecha >= NOW() - INTERVAL '24 hours'");
  });

  it('debe forzar NEW.fecha := NOW() al insertar', () => {
    expect(sql).toContain('NEW.fecha  := NOW()');
  });

  it("debe forzar NEW.estado := 'visible' al insertar", () => {
    expect(sql).toContain("NEW.estado := 'visible'");
  });
});

// ---------------------------------------------------------------------------
// Punto 4b · Trigger: corre en INSERT y UPDATE OF foto_path
// ---------------------------------------------------------------------------
describe('Punto 4b · Trigger BEFORE INSERT OR UPDATE OF foto_path', () => {
  it('debe correr BEFORE INSERT OR UPDATE OF foto_path', () => {
    expect(sql).toMatch(
      /BEFORE\s+INSERT\s+OR\s+UPDATE\s+OF\s+foto_path\s+ON\s+public\.recomendaciones/i
    );
  });

  it('debe rechazar foto_path NULL o vacía con FOTO_REQUERIDA', () => {
    expect(sql).toContain('FOTO_REQUERIDA');
    expect(sql).toContain("NEW.foto_path IS NULL OR NEW.foto_path = ''");
  });

  it('debe validar que foto_path empiece con la carpeta del propio usuario', () => {
    expect(sql).toContain('FOTO_PATH_INVALIDA');
    expect(sql).toContain("'recomendaciones/' || NEW.usuario_id::TEXT || '/'");
    expect(sql).toContain("NEW.foto_path NOT LIKE prefijo_uid || '%'");
  });
});

// ---------------------------------------------------------------------------
// Punto 5 · handle_new_user robusto
// ---------------------------------------------------------------------------
describe('Punto 5 · handle_new_user con nombre seguro', () => {
  it('debe usar NULLIF para descartar nombres vacíos', () => {
    expect(sql).toContain("NULLIF(trim(left(NEW.raw_user_meta_data->>'full_name', 100)), '')");
  });

  it('debe recortar el nombre a 100 caracteres con left()', () => {
    expect(sql).toMatch(/left\s*\(NEW\.raw_user_meta_data->>'full_name',\s*100\)/);
  });

  it('debe usar el email como fallback si el nombre está vacío', () => {
    expect(sql).toContain("split_part(NEW.email, '@', 1)");
  });
});

// ---------------------------------------------------------------------------
// Tipos TypeScript: consistencia con el esquema SQL
// ---------------------------------------------------------------------------
describe('Tipos TypeScript · consistencia con el esquema', () => {
  it('isFotoPathValida debe aceptar paths con el prefijo correcto (<usuario_id>/<archivo>)', () => {
    const uid = 'abc-123';
    expect(isFotoPathValida(`${uid}/foto.webp`, uid)).toBe(true);
    expect(isFotoPathValida(`${uid}/foto-123.jpg`, uid)).toBe(true);
  });

  it('isFotoPathValida debe rechazar paths de otro usuario, con subcarpetas o maliciosos', () => {
    const uid = 'abc-123';
    const otroUid = 'otro-456';
    expect(isFotoPathValida(`${otroUid}/foto.webp`, uid)).toBe(false);
    expect(isFotoPathValida('foto.webp', uid)).toBe(false);
    expect(isFotoPathValida(`${uid}/subcarpeta/foto.webp`, uid)).toBe(false);
    expect(isFotoPathValida(`${uid}/../foto.webp`, uid)).toBe(false);
    expect(isFotoPathValida(`recomendaciones/${uid}/foto.webp`, uid)).toBe(false);
    expect(isFotoPathValida('https://otro.com/foto.webp', uid)).toBe(false);
  });

  it('buildFotoUrl debe construir la URL pública correcta', () => {
    const url = buildFotoUrl(
      'https://xyz.supabase.co',
      'recomendaciones',
      'abc-123/foto.webp'
    );
    expect(url).toBe(
      'https://xyz.supabase.co/storage/v1/object/public/recomendaciones/abc-123/foto.webp'
    );
  });
});
