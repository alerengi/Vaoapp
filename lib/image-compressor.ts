/**
 * Módulo de compresión y sanitización de imágenes en el cliente (Browser).
 *
 * Características:
 * 1. Privacidad: Elimina metadatos EXIF (incluyendo coordenadas GPS, modelo de
 *    cámara y fechas de captura) al redibujar el archivo en un <canvas> de HTML5.
 * 2. Rendimiento y límites: Asegura que la imagen final no supere los 3 MB,
 *    garantizando compatibilidad estricta con el límite de Vercel (4.5 MB) y
 *    de las Server Actions de Next.js (4 MB).
 * 3. Sin dependencias externas: Utiliza únicamente las APIs nativas del navegador.
 */

export const CLIENT_MAX_IMAGE_BYTES = 3 * 1024 * 1024; // 3 MB
export const DEFAULT_MAX_DIMENSION = 1600; // píxeles máximos en ancho o alto
export const DEFAULT_QUALITY = 0.85;

export interface CompressOptions {
  maxDimension?: number;
  quality?: number;
  maxSizeBytes?: number;
}

/**
 * Carga un File en un elemento Image usando Object URL.
 */
function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };

    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('ERROR_CARGAR_IMAGEN: No se pudo decodificar el archivo de imagen.'));
    };

    img.src = url;
  });
}

/**
 * Calcula las nuevas dimensiones manteniendo la relación de aspecto.
 */
export function calculateAspectRatioFit(
  srcWidth: number,
  srcHeight: number,
  maxDimension: number
): { width: number; height: number } {
  if (srcWidth <= 0 || srcHeight <= 0) {
    return { width: Math.max(1, maxDimension), height: Math.max(1, maxDimension) };
  }

  if (srcWidth <= maxDimension && srcHeight <= maxDimension) {
    return { width: srcWidth, height: srcHeight };
  }

  const ratio = Math.min(maxDimension / srcWidth, maxDimension / srcHeight);
  return {
    width: Math.round(srcWidth * ratio),
    height: Math.round(srcHeight * ratio),
  };
}

/**
 * Comprime y recodifica una imagen en el navegador.
 * Siempre pasa por Canvas para remover EXIF/GPS aunque la imagen original sea pequeña.
 */
export async function compressImageFile(
  file: File,
  options: CompressOptions = {}
): Promise<File> {
  // Entorno sin navegador (SSR o Node de pruebas)
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return file;
  }

  const maxDimension = options.maxDimension ?? DEFAULT_MAX_DIMENSION;
  let quality = options.quality ?? DEFAULT_QUALITY;
  const maxSizeBytes = options.maxSizeBytes ?? CLIENT_MAX_IMAGE_BYTES;

  const img = await loadImage(file);
  const { width, height } = calculateAspectRatioFit(img.width, img.height, maxDimension);

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    throw new Error('CANVAS_NO_DISPONIBLE: No se pudo obtener el contexto 2D.');
  }

  // Redibujar en Canvas elimina metadatos EXIF
  ctx.drawImage(img, 0, 0, width, height);

  // Convertir a JPEG optimizado
  const toBlobPromise = (q: number): Promise<Blob> =>
    new Promise((resolve, reject) => {
      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('ERROR_CANVAS_BLOB: Falló la generación del blob.'));
        },
        'image/jpeg',
        q
      );
    });

  let blob = await toBlobPromise(quality);

  // Si supera el límite permitido para Vercel (3 MB), reducir calidad progresivamente
  while (blob.size > maxSizeBytes && quality > 0.4) {
    quality -= 0.15;
    blob = await toBlobPromise(quality);
  }

  const cleanName = file.name.replace(/\.[^/.]+$/, '') + '.jpg';
  return new File([blob], cleanName, { type: 'image/jpeg', lastModified: Date.now() });
}
