import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'fs';
import path from 'path';
import {
  BUCKET_RECOMENDACIONES,
  MAX_FILE_SIZE_BYTES,
  validateImageBuffer,
  generateSecureImagePath,
  isValidStorageFotoPath,
  getPublicImageUrl,
  detectRealMimeType,
} from '../lib/storage';
import { isFotoPathValida } from '../lib/types';

describe('Módulo de Storage · Validación de Buffer y Magic Bytes', () => {
  it('detecta correctamente una imagen JPEG válida por magic bytes (FF D8 FF)', () => {
    const jpegBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01]);
    const result = validateImageBuffer(jpegBuffer);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mimeType).toBe('image/jpeg');
      expect(result.data.extension).toBe('jpg');
    }
  });

  it('detecta correctamente una imagen PNG válida por magic bytes (89 50 4E 47 0D 0A 1A 0A)', () => {
    const pngBuffer = new Uint8Array([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d,
    ]);
    const result = validateImageBuffer(pngBuffer);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mimeType).toBe('image/png');
      expect(result.data.extension).toBe('png');
    }
  });

  it('detecta correctamente una imagen WEBP válida (RIFF....WEBP)', () => {
    const webpBuffer = new Uint8Array([
      0x52, 0x49, 0x46, 0x46, // 'RIFF'
      0x24, 0x00, 0x00, 0x00, // tamaño
      0x57, 0x45, 0x42, 0x50, // 'WEBP'
      0x56, 0x50, 0x38, 0x20, // 'VP8 '
    ]);
    const result = validateImageBuffer(webpBuffer);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.data.mimeType).toBe('image/webp');
      expect(result.data.extension).toBe('webp');
    }
  });

  it('rechaza archivos vacíos con error FOTO_VACIA', () => {
    const emptyBuffer = new Uint8Array(0);
    const result = validateImageBuffer(emptyBuffer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.codigo).toBe('FOTO_VACIA');
    }
  });

  it('rechaza archivos mayores a 5 MB con error FOTO_MUY_PESADA', () => {
    // 5 MB + 1 byte
    const largeBuffer = new Uint8Array(MAX_FILE_SIZE_BYTES + 1);
    largeBuffer[0] = 0xff;
    largeBuffer[1] = 0xd8;
    largeBuffer[2] = 0xff;

    const result = validateImageBuffer(largeBuffer);

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.codigo).toBe('FOTO_MUY_PESADA');
    }
  });

  it('rechaza archivos con formatos no permitidos (PDF, ejecutable, texto) con error TIPO_ARCHIVO_INVALIDO', () => {
    // Archivo PDF (%PDF)
    const pdfBuffer = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x35, 0x00, 0x00, 0x00, 0x00]);
    const resultPdf = validateImageBuffer(pdfBuffer);
    expect(resultPdf.ok).toBe(false);
    if (!resultPdf.ok) {
      expect(resultPdf.error.codigo).toBe('TIPO_ARCHIVO_INVALIDO');
    }

    // Archivo ejecutable MZ
    const exeBuffer = new Uint8Array([0x4d, 0x5a, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00, 0x04, 0x00, 0x00, 0x00]);
    const resultExe = validateImageBuffer(exeBuffer);
    expect(resultExe.ok).toBe(false);
    if (!resultExe.ok) {
      expect(resultExe.error.codigo).toBe('TIPO_ARCHIVO_INVALIDO');
    }
  });
});

describe('Módulo de Storage · Generación y Validación de Rutas Seguras', () => {
  const validUserId = 'e2b3c4d5-6789-4012-8abc-def012345678';

  it('genera una ruta válida de exactamente dos segmentos (<usuario_id>/<uuid>.<ext>)', () => {
    const pathGenerado = generateSecureImagePath(validUserId, 'jpg');
    const segmentos = pathGenerado.split('/');

    expect(segmentos.length).toBe(2);
    expect(segmentos[0]).toBe(validUserId);
    expect(segmentos[1]).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.jpg$/i);
    expect(pathGenerado).not.toContain('..');
  });

  it('normaliza extensiones jpeg a jpg', () => {
    const pathGenerado = generateSecureImagePath(validUserId, 'jpeg');
    expect(pathGenerado.endsWith('.jpg')).toBe(true);
  });

  it('rechaza IDs de usuario inválidos o maliciosos que intenten path traversal', () => {
    expect(() => generateSecureImagePath('../hacker', 'webp')).toThrowError(/USUARIO_ID_INVALIDO/);
    expect(() => generateSecureImagePath('123-not-uuid', 'png')).toThrowError(/USUARIO_ID_INVALIDO/);
    expect(() => generateSecureImagePath('', 'jpg')).toThrowError(/USUARIO_ID_INVALIDO/);
  });

  it('rechaza extensiones peligrosas o no permitidas', () => {
    expect(() => generateSecureImagePath(validUserId, 'exe')).toThrowError(/EXTENSION_INVALIDA/);
    expect(() => generateSecureImagePath(validUserId, 'svg')).toThrowError(/EXTENSION_INVALIDA/);
    expect(() => generateSecureImagePath(validUserId, 'php')).toThrowError(/EXTENSION_INVALIDA/);
  });

  it('la ruta generada pasa satisfactoriamente la validación del trigger (isValidStorageFotoPath e isFotoPathValida)', () => {
    const ruta = generateSecureImagePath(validUserId, 'webp');

    // Validador de storage
    expect(isValidStorageFotoPath(ruta, validUserId)).toBe(true);

    // Validador de base de datos / types
    expect(isFotoPathValida(ruta, validUserId)).toBe(true);

    // Comprobar la lógica exacta que evalúa el trigger en Postgres:
    // prefijo_uid := NEW.usuario_id::TEXT || '/';
    // segmentos   := string_to_array(NEW.foto_path, '/');
    const prefijoUid = `${validUserId}/`;
    const segmentos = ruta.split('/');

    const cumplePrefijo = ruta.startsWith(prefijoUid);
    const cumpleSegmentos = segmentos.length === 2;
    const sinPathTraversal = !ruta.includes('..');
    const nombreNoVacio = segmentos[1].length > 0;

    expect(cumplePrefijo).toBe(true);
    expect(cumpleSegmentos).toBe(true);
    expect(sinPathTraversal).toBe(true);
    expect(nombreNoVacio).toBe(true);
  });

  it('rechaza rutas con más de dos segmentos o con path traversal', () => {
    expect(isValidStorageFotoPath(`${validUserId}/subcarpeta/foto.jpg`, validUserId)).toBe(false);
    expect(isValidStorageFotoPath(`${validUserId}/../foto.jpg`, validUserId)).toBe(false);
    expect(isValidStorageFotoPath(`otro-id/foto.jpg`, validUserId)).toBe(false);
    expect(isValidStorageFotoPath(`${validUserId}/`, validUserId)).toBe(false);
  });

  it('construye la URL pública esperada de Supabase Storage', () => {
    const url = getPublicImageUrl('https://xyz.supabase.co', `${validUserId}/foto-1.webp`);
    expect(url).toBe(`https://xyz.supabase.co/storage/v1/object/public/${BUCKET_RECOMENDACIONES}/${validUserId}/foto-1.webp`);
  });
});

describe('Migración 003 · Verificación de Esquema SQL y Políticas de Storage', () => {
  let migrationSql: string;

  beforeAll(() => {
    const sqlPath = path.resolve(__dirname, '../supabase/migrations/003_storage_recomendaciones.sql');
    expect(fs.existsSync(sqlPath), 'La migración 003 debe existir').toBe(true);
    migrationSql = fs.readFileSync(sqlPath, 'utf-8');
  });

  it('crea el bucket recomendaciones con límite de 5 MB y tipos permitidos', () => {
    expect(migrationSql).toContain("'recomendaciones'");
    expect(migrationSql).toContain('5242880');
    expect(migrationSql).toContain("ARRAY['image/jpeg', 'image/png', 'image/webp']");
    expect(migrationSql).toContain('ON CONFLICT (id) DO UPDATE');
  });

  it('la política INSERT exige bucket recomendaciones, dos segmentos exactos y sin ..', () => {
    expect(migrationSql).toContain('recomendaciones_storage_insercion_propia');
    expect(migrationSql).toContain("bucket_id = 'recomendaciones'");
    expect(migrationSql).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(migrationSql).toContain("array_length(string_to_array(name, '/'), 1) = 2");
    expect(migrationSql).toContain("name NOT LIKE '%..%'");
  });

  it('la política UPDATE contiene USING y WITH CHECK con validación de carpeta de usuario y dos segmentos', () => {
    expect(migrationSql).toContain('recomendaciones_storage_edicion_propia');

    // Debe contener tanto USING como WITH CHECK
    const updateIndex = migrationSql.indexOf('recomendaciones_storage_edicion_propia');
    const sliceUpdate = migrationSql.slice(updateIndex, updateIndex + 900);

    expect(sliceUpdate).toContain('USING');
    expect(sliceUpdate).toContain('WITH CHECK');
    expect(sliceUpdate).toContain('(storage.foldername(name))[1] = auth.uid()::text');
    expect(sliceUpdate).toContain("array_length(string_to_array(name, '/'), 1) = 2");
  });

  it('la política DELETE permite borrar solo las fotos del propio usuario', () => {
    expect(migrationSql).toContain('recomendaciones_storage_borrado_propio');
    expect(migrationSql).toContain('ON storage.objects FOR DELETE');
  });

  it('la política SELECT permite lectura pública para el bucket recomendaciones', () => {
    expect(migrationSql).toContain('recomendaciones_storage_lectura_publica');
    expect(migrationSql).toContain('ON storage.objects FOR SELECT');
    expect(migrationSql).toContain("bucket_id = 'recomendaciones'");
  });

  it('actualiza el trigger en public.recomendaciones para la convención unificada de dos segmentos', () => {
    expect(migrationSql).toContain('CREATE OR REPLACE FUNCTION public.handle_recomendacion_before_upsert()');
    expect(migrationSql).toContain("prefijo_uid := NEW.usuario_id::TEXT || '/';");
    expect(migrationSql).toContain("segmentos   := string_to_array(NEW.foto_path, '/');");
    expect(migrationSql).toContain('array_length(segmentos, 1) != 2');
    expect(migrationSql).toContain("NEW.foto_path LIKE '%..%'");
    expect(migrationSql).toContain('length(segmentos[2]) = 0');
  });
});
