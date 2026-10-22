/**
 * Limitador de tasa (Rate Limiter) en memoria con ventana deslizante (sliding window).
 *
 * Protege endpoints sensibles como el proxy de fotos y búsquedas contra abusos y DDoS.
 * Nota: En Fase 4 (producción Vercel), se evalúa migrar a Upstash Redis o Vercel KV.
 */

interface RateLimitRecord {
  timestamps: number[]
}

const ipHistory = new Map<string, RateLimitRecord>()

// Limpieza periódica de IPs inactivas cada 5 minutos para evitar fugas de memoria
const CLEANUP_INTERVAL = 5 * 60 * 1000
let lastCleanup = Date.now()

function cleanup(windowMs: number) {
  const now = Date.now()
  if (now - lastCleanup < CLEANUP_INTERVAL) return

  lastCleanup = now
  const cutoff = now - windowMs

  for (const [ip, record] of ipHistory.entries()) {
    record.timestamps = record.timestamps.filter((ts) => ts > cutoff)
    if (record.timestamps.length === 0) {
      ipHistory.delete(ip)
    }
  }
}

export interface RateLimitResult {
  success: boolean
  limit: number
  remaining: number
  reset: number
}

/**
 * Verifica si una IP ha superado el límite de peticiones en la ventana de tiempo.
 *
 * @param ip Dirección IP del cliente
 * @param limit Máximo de peticiones permitidas en la ventana (default: 60)
 * @param windowMs Duración de la ventana en milisegundos (default: 60000 = 1 minuto)
 */
export function checkRateLimit(
  ip: string,
  limit = 60,
  windowMs = 60 * 1000
): RateLimitResult {
  const now = Date.now()
  cleanup(windowMs)

  let record = ipHistory.get(ip)
  if (!record) {
    record = { timestamps: [] }
    ipHistory.set(ip, record)
  }

  // Filtrar marcas de tiempo que quedaron fuera de la ventana
  const cutoff = now - windowMs
  record.timestamps = record.timestamps.filter((ts) => ts > cutoff)

  if (record.timestamps.length >= limit) {
    const oldest = record.timestamps[0]
    const resetTime = Math.ceil((oldest + windowMs - now) / 1000)

    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.max(1, resetTime),
    }
  }

  // Registrar la petición actual
  record.timestamps.push(now)

  return {
    success: true,
    limit,
    remaining: limit - record.timestamps.length,
    reset: Math.ceil(windowMs / 1000),
  }
}

/**
 * Restablece el almacén de rate limits (útil para pruebas unitarias).
 */
export function resetRateLimits() {
  ipHistory.clear()
}
