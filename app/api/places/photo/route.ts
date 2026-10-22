import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { checkRateLimit } from '@/lib/rate-limiter'

/**
 * Route Handler: Proxy seguro de fotos para Google Places (Places API New).
 *
 * Medidas de seguridad y optimización:
 * 1. Rate limiting por IP: máximo 60 peticiones/minuto.
 * 2. Validación en base de datos: solo acepta referencias (photo_reference) que pertenezcan
 *    a un restaurante registrado en la tabla `restaurantes`. Rechaza cualquier otra con 403.
 * 3. Protección de secretos: La clave GOOGLE_PLACES_API_KEY se usa solo en el servidor.
 * 4. Cabeceras de caché: Cache-Control agresivo para CDN y navegador (1 día cliente, 7 días CDN),
 *    evitando repetir llamadas innecesarias a Google.
 */
export async function GET(request: Request) {
  // 1. Obtener IP del cliente y aplicar rate limiting
  const forwardedFor = request.headers.get('x-forwarded-for')
  const clientIp = forwardedFor ? forwardedFor.split(',')[0].trim() : '127.0.0.1'

  const rateLimit = checkRateLimit(clientIp, 60, 60 * 1000)
  if (!rateLimit.success) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: 'LIMITE_EXCEDIDO',
          mensaje: 'Has superado el límite de peticiones de imágenes. Intenta más tarde.',
        },
      },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.reset),
        },
      }
    )
  }

  // 2. Extraer y validar el parámetro ref
  const { searchParams } = new URL(request.url)
  const ref = searchParams.get('ref')

  if (!ref || ref.trim() === '') {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: 'PARAMETRO_REQUERIDO',
          mensaje: 'El parámetro "ref" con la referencia de la foto es obligatorio.',
        },
      },
      { status: 400 }
    )
  }

  // 3. Validar que la referencia exista en la base de datos (Anti-Abuso / Anti-DDoS)
  try {
    const supabase = await createClient()
    const { data: restaurante, error: dbError } = await supabase
      .from('restaurantes')
      .select('id')
      .eq('photo_reference', ref)
      .limit(1)
      .maybeSingle()

    if (dbError) {
      console.error('Error al validar photo_reference en base de datos:', dbError)
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: 'ERROR_BASE_DATOS',
            mensaje: 'No se pudo verificar la referencia de la foto.',
          },
        },
        { status: 500 }
      )
    }

    if (!restaurante) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: 'FOTO_NO_AUTORIZADA',
            mensaje: 'La referencia solicitada no pertenece a ningún restaurante registrado.',
          },
        },
        { status: 403 }
      )
    }
  } catch (err) {
    console.error('Excepción al conectar con Supabase en photo proxy:', err)
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: 'ERROR_INTERNO',
          mensaje: 'Error interno al procesar la solicitud.',
        },
      },
      { status: 500 }
    )
  }

  // 4. Obtener clave de Google Places desde variables de entorno del servidor
  const apiKey = process.env.GOOGLE_PLACES_API_KEY
  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: 'CONFIGURACION_INVALIDA',
          mensaje: 'La clave de Google Places no está configurada en el servidor.',
        },
      },
      { status: 500 }
    )
  }

  // 5. Descargar la foto desde Google Places API (New)
  // Formato Places API (New): places/{PLACE_ID}/photos/{PHOTO_RESOURCE}/media
  const googlePhotoUrl = `https://places.googleapis.com/v1/${ref}/media?maxHeightPx=800&maxWidthPx=800&key=${apiKey}`

  try {
    const response = await fetch(googlePhotoUrl, {
      method: 'GET',
      headers: {
        Accept: 'image/*',
      },
    })

    if (!response.ok) {
      return NextResponse.json(
        {
          ok: false,
          error: {
            codigo: 'ERROR_GOOGLE_PLACES',
            mensaje: `Google Places respondió con estado ${response.status}`,
          },
        },
        { status: response.status }
      )
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const imageArrayBuffer = await response.arrayBuffer()

    return new Response(imageArrayBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400, s-maxage=604800, stale-while-revalidate=86400',
      },
    })
  } catch (fetchErr) {
    console.error('Error al descargar foto de Google Places:', fetchErr)
    return NextResponse.json(
      {
        ok: false,
        error: {
          codigo: 'ERROR_DESCARGA',
          mensaje: 'No se pudo descargar la imagen desde el proveedor.',
        },
      },
      { status: 502 }
    )
  }
}
