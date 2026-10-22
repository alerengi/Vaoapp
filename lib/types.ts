/**
 * Tipos de TypeScript sincronizados con el esquema de Supabase (Postgres).
 * Regla: si cambia el esquema SQL, este archivo debe actualizarse en el mismo commit.
 */

// ---------------------------------------------------------------------------
// Enumeraciones y literales compartidos
// ---------------------------------------------------------------------------

export type EstadoRecomendacion = 'visible' | 'oculta';

export type MotivoReporte = 'spam' | 'ofensivo' | 'no_es_comida' | 'otro';

export type Distrito = 'Miraflores' | 'Barranco';

// ---------------------------------------------------------------------------
// Tabla: usuarios
// Columnas editables por el usuario (authenticated): nombre, foto_url, distrito
// Columnas de solo lectura: id, email, fecha_registro, nivel_confianza
// ---------------------------------------------------------------------------
export interface Usuario {
  id: string;               // UUID, igual que auth.users.id
  nombre: string;
  email: string;
  foto_url: string | null;
  distrito: string | null;
  fecha_registro: string;   // ISO 8601 UTC
  nivel_confianza: number;  // 1–5, solo el servidor puede modificarlo
}

// Solo las columnas que el usuario autenticado puede editar
export type UsuarioEditable = Pick<Usuario, 'nombre' | 'foto_url' | 'distrito'>;

// ---------------------------------------------------------------------------
// Tabla: categorias
// ---------------------------------------------------------------------------
export interface Categoria {
  id: string;
  nombre: string;
  sinonimos: string[];
}

// ---------------------------------------------------------------------------
// Tabla: restaurantes
// photo_reference es privado (token de Google Places). La app usa el proxy
// /api/places/photo para servir la imagen; este campo nunca llega al cliente.
// ---------------------------------------------------------------------------
export interface Restaurante {
  id: string;
  google_place_id: string;
  nombre: string;
  direccion: string | null;
  distrito: string;
  lat: number | null;
  lng: number | null;
  tipo_cocina: string | null;
  rango_precio: 1 | 2 | 3 | 4 | null;
  photo_author: string | null; // Atribución requerida por Google Places
  fecha_sync: string;
  // photo_reference se omite de Restaurante para no exponerlo al cliente
}

// Representación completa de la fila en Postgres (solo para servidor y scripts)
export interface RestauranteDB extends Restaurante {
  photo_reference: string | null;
}

// ---------------------------------------------------------------------------
// Tabla: platos
// Columnas insertables por authenticated: restaurante_id, categoria_id, nombre, precio_aprox
// Columnas de solo lectura (servidor): puntaje_vao, total_recomendaciones
// ---------------------------------------------------------------------------
export interface Plato {
  id: string;
  restaurante_id: string;
  categoria_id: string;
  nombre: string;
  nombre_normalizado: string;   // columna GENERATED, solo lectura
  precio_aprox: number | null;
  puntaje_vao: number;          // 0.00–5.00, calculado por el servidor
  total_recomendaciones: number;
}

// Campos que el usuario puede proporcionar al crear un plato
export type PlatoNuevo = Pick<Plato, 'restaurante_id' | 'categoria_id' | 'nombre' | 'precio_aprox'>;

// ---------------------------------------------------------------------------
// Tabla: recomendaciones
// foto_path: ruta relativa dentro del bucket 'recomendaciones', formato: <usuario_id>/<archivo>
// La URL pública se construye en la app: NEXT_PUBLIC_SUPABASE_URL + /storage/v1/object/public/recomendaciones/ + foto_path
//
// Columnas editables por authenticated (autor): calificacion, comentario, foto_path
// Columnas de solo lectura: id, usuario_id, plato_id, estado, fecha
// ---------------------------------------------------------------------------
export interface Recomendacion {
  id: string;
  usuario_id: string;
  plato_id: string;
  calificacion: 1 | 2 | 3 | 4 | 5;
  comentario: string | null;
  foto_path: string;            // ruta relativa dentro del bucket, ej: <uid>/abc123.webp
  estado: EstadoRecomendacion;
  fecha: string;                // ISO 8601 UTC, fijado por trigger (no por el cliente)
}

// Campos al crear una recomendación
export type RecomendacionNueva = Pick<
  Recomendacion,
  'usuario_id' | 'plato_id' | 'calificacion' | 'comentario' | 'foto_path'
>;

// Campos que el autor puede editar
export type RecomendacionEditable = Pick<Recomendacion, 'calificacion' | 'comentario' | 'foto_path'>;

// Utilidad: convierte foto_path a URL pública de Supabase Storage
export function buildFotoUrl(
  supabaseUrl: string,
  bucketName: string,
  fotoPath: string
): string {
  const cleanBase = supabaseUrl.replace(/\/+$/, '');
  const cleanPath = fotoPath.replace(/^\/+/, '');
  return `${cleanBase}/storage/v1/object/public/${bucketName}/${cleanPath}`;
}

// Utilidad: valida que un foto_path tenga exactamente dos segmentos (<usuario_id>/<archivo>)
export function isFotoPathValida(fotoPath: string, usuarioId: string): boolean {
  if (!fotoPath || !usuarioId) return false;
  if (fotoPath.includes('..')) return false;
  const prefijo = `${usuarioId.toLowerCase()}/`;
  if (!fotoPath.toLowerCase().startsWith(prefijo)) return false;
  const segmentos = fotoPath.split('/');
  return segmentos.length === 2 && Boolean(segmentos[1] && segmentos[1].trim().length > 0);
}

// ---------------------------------------------------------------------------
// Tabla: validaciones
// ---------------------------------------------------------------------------
export interface Validacion {
  id: string;
  usuario_id: string;
  recomendacion_id: string;
  fecha: string;
}

// ---------------------------------------------------------------------------
// Tabla: reportes
// ---------------------------------------------------------------------------
export interface Reporte {
  id: string;
  usuario_id: string;
  recomendacion_id: string;
  motivo: MotivoReporte;
  fecha: string;
}

// ---------------------------------------------------------------------------
// Respuesta estándar de la API (todos los endpoints responden con esta forma)
// ---------------------------------------------------------------------------
export type ApiResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: { codigo: string; mensaje: string } };
