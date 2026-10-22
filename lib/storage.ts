/**
 * Módulo de validación y gestión de Supabase Storage para recomendaciones de Vao.
 *
 * Convención de rutas unificada en todas las capas:
 *   - Bucket: 'recomendaciones'
 *   - Ruta relativa dentro del bucket: '<usuario_id>/<uuid>.<ext>' (exactamente 2 segmentos)
 *   - Sin prefijo redundante del bucket en foto_path.
 */

export const BUCKET_RECOMENDACIONES = 'recomendaciones';
export const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

export const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

export type AllowedMimeType = (typeof ALLOWED_MIME_TYPES)[number];

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export interface ValidationSuccess {
  ok: true;
  data: {
    mimeType: AllowedMimeType;
    extension: 'jpg' | 'png' | 'webp';
    size: number;
  };
}

export interface ValidationError {
  ok: false;
  error: {
    codigo: string;
    mensaje: string;
  };
}

export type ImageValidationResult = ValidationSuccess | ValidationError;

/**
 * Detecta el tipo MIME real inspeccionando los magic bytes de la cabecera.
 * No confía en extensiones de archivo ni en cabeceras HTTP que el cliente pueda alterar.
 */
export function detectRealMimeType(
  bytes: Uint8Array
): { mimeType: AllowedMimeType; extension: 'jpg' | 'png' | 'webp' } | null {
  if (bytes.length < 12) {
    return null;
  }

  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
    return { mimeType: 'image/jpeg', extension: 'jpg' };
  }

  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return { mimeType: 'image/png', extension: 'png' };
  }

  // WEBP: RIFF (bytes 0..3: 52 49 46 46) + WEBP (bytes 8..11: 57 45 42 50)
  if (
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return { mimeType: 'image/webp', extension: 'webp' };
  }

  return null;
}

/**
 * Valida un buffer de imagen en el servidor:
 * - Rechaza buffers vacíos
 * - Rechaza tamaños superiores a 5 MB
 * - Verifica magic bytes para garantizar que es un JPG, PNG o WEBP real
 */
export function validateImageBuffer(
  buffer: Uint8Array | ArrayBuffer
): ImageValidationResult {
  const bytes = buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer);

  if (bytes.length === 0) {
    return {
      ok: false,
      error: {
        codigo: 'FOTO_VACIA',
        mensaje: 'El archivo de la foto está vacío.',
      },
    };
  }

  if (bytes.length > MAX_FILE_SIZE_BYTES) {
    return {
      ok: false,
      error: {
        codigo: 'FOTO_MUY_PESADA',
        mensaje: 'La foto supera los 5 MB permitidos.',
      },
    };
  }

  const realType = detectRealMimeType(bytes);

  if (!realType) {
    return {
      ok: false,
      error: {
        codigo: 'TIPO_ARCHIVO_INVALIDO',
        mensaje:
          'Formato de imagen no permitido. Solo se aceptan fotos JPG, PNG y WEBP.',
      },
    };
  }

  return {
    ok: true,
    data: {
      mimeType: realType.mimeType,
      extension: realType.extension,
      size: bytes.length,
    },
  };
}

/**
 * Genera una ruta segura de archivo dentro del bucket 'recomendaciones'.
 *
 * Cumple estrictamente con:
 * - Dos segmentos exactos: `<usuario_id>/<uuid>.<ext>`
 * - usuario_id validado contra formato UUID
 * - Nombre de archivo aleatorio generado por el sistema (UUIDv4)
 * - Prohibición de path traversal ('..')
 */
export function generateSecureImagePath(
  usuarioId: string,
  extension: string
): string {
  if (!usuarioId || !UUID_REGEX.test(usuarioId.trim())) {
    throw new Error(
      'USUARIO_ID_INVALIDO: El ID del usuario debe ser un UUID válido.'
    );
  }

  const cleanExt = extension.toLowerCase().replace(/^\./, '');
  const normalizedExt = cleanExt === 'jpeg' ? 'jpg' : cleanExt;

  if (!['jpg', 'png', 'webp'].includes(normalizedExt)) {
    throw new Error(
      `EXTENSION_INVALIDA: Extensión .${extension} no permitida. Solo jpg, png o webp.`
    );
  }

  const filename = `${crypto.randomUUID()}.${normalizedExt}`;
  const securePath = `${usuarioId.trim().toLowerCase()}/${filename}`;

  // Doble verificación defensiva
  if (!isValidStorageFotoPath(securePath, usuarioId)) {
    throw new Error('PATH_GENERADO_CORRUPTO: La ruta generada no cumple la convención.');
  }

  return securePath;
}

/**
 * Valida si una ruta cumple con la convención unificada y las reglas del trigger:
 * - Debe iniciar con `<usuario_id>/`
 * - No debe contener '..' (path traversal)
 * - Debe tener exactamente dos segmentos (<usuario_id>/<archivo>)
 * - El nombre de archivo no debe ser vacío
 */
export function isValidStorageFotoPath(
  fotoPath: string,
  usuarioId: string
): boolean {
  if (!fotoPath || !usuarioId) return false;
  if (fotoPath.includes('..')) return false;

  const prefijo = `${usuarioId.toLowerCase()}/`;
  if (!fotoPath.toLowerCase().startsWith(prefijo)) return false;

  const segmentos = fotoPath.split('/');
  if (segmentos.length !== 2) return false;
  if (!segmentos[1] || segmentos[1].trim().length === 0) return false;

  return true;
}

/**
 * Construye la URL pública del archivo en Supabase Storage
 */
export function getPublicImageUrl(supabaseUrl: string, fotoPath: string): string {
  const cleanBase = supabaseUrl.replace(/\/+$/, '');
  const cleanPath = fotoPath.replace(/^\/+/, '');
  return `${cleanBase}/storage/v1/object/public/${BUCKET_RECOMENDACIONES}/${cleanPath}`;
}
