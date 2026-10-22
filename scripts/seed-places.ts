/**
 * Script manual de sincronización de restaurantes desde Google Places API (New).
 *
 * Ejecución segura en Windows:
 *   npm run seed:places
 *
 * Características:
 * 1. Exactamente 6 consultas (2 distritos × 3 categorías).
 * 2. FieldMask mínimo para optimización de cuota (SKU Text Search Pro).
 * 3. Filtro estricto por distrito: descarta cualquier local fuera de Miraflores o Barranco.
 * 4. Extracción de photo_reference y authorAttributions de la foto de portada.
 * 5. Upsert idempotente en Supabase (evita duplicados con google_place_id).
 */

import { createClient } from '@supabase/supabase-js'

interface GooglePlacesPhoto {
  name: string
  widthPx?: number
  heightPx?: number
  authorAttributions?: Array<{
    displayName: string
    uri?: string
    photoUri?: string
  }>
}

interface GooglePlaceItem {
  id: string
  displayName?: {
    text: string
    languageCode?: string
  }
  formattedAddress?: string
  location?: {
    latitude: number
    longitude: number
  }
  priceLevel?:
    | 'PRICE_LEVEL_UNSPECIFIED'
    | 'PRICE_LEVEL_FREE'
    | 'PRICE_LEVEL_INEXPENSIVE'
    | 'PRICE_LEVEL_MODERATE'
    | 'PRICE_LEVEL_EXPENSIVE'
    | 'PRICE_LEVEL_VERY_EXPENSIVE'
  photos?: GooglePlacesPhoto[]
}

interface QueryPlan {
  distrito: 'Miraflores' | 'Barranco'
  categoria: 'makis' | 'ceviche' | 'hamburguesas'
  textQuery: string
}

const QUERIES: QueryPlan[] = [
  { distrito: 'Miraflores', categoria: 'makis', textQuery: 'makis en Miraflores, Lima, Perú' },
  { distrito: 'Barranco', categoria: 'makis', textQuery: 'makis en Barranco, Lima, Perú' },
  { distrito: 'Miraflores', categoria: 'ceviche', textQuery: 'ceviche en Miraflores, Lima, Perú' },
  { distrito: 'Barranco', categoria: 'ceviche', textQuery: 'ceviche en Barranco, Lima, Perú' },
  { distrito: 'Miraflores', categoria: 'hamburguesas', textQuery: 'hamburguesas en Miraflores, Lima, Perú' },
  { distrito: 'Barranco', categoria: 'hamburguesas', textQuery: 'hamburguesas en Barranco, Lima, Perú' },
]

function mapPriceLevel(priceLevel?: string): 1 | 2 | 3 | 4 | null {
  switch (priceLevel) {
    case 'PRICE_LEVEL_INEXPENSIVE':
      return 1
    case 'PRICE_LEVEL_MODERATE':
      return 2
    case 'PRICE_LEVEL_EXPENSIVE':
      return 3
    case 'PRICE_LEVEL_VERY_EXPENSIVE':
      return 4
    default:
      return null
  }
}

function addressBelongsToDistrict(address: string | undefined, distrito: string): boolean {
  if (!address) return false
  const normalized = address.toLowerCase()
  return normalized.includes(distrito.toLowerCase())
}

async function main() {
  console.log('\n================================================================')
  console.log('🍽️  VAO · Carga Manual de Restaurantes (Google Places API New)')
  console.log('================================================================\n')

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const googleApiKey = process.env.GOOGLE_PLACES_API_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Error: Faltan variables de Supabase (NEXT_PUBLIC_SUPABASE_URL o SUPABASE_SERVICE_ROLE_KEY).')
    console.error('   Asegúrate de que .env.local contenga estos valores.')
    process.exit(1)
  }

  if (!googleApiKey) {
    console.error('❌ Error: Falta la variable GOOGLE_PLACES_API_KEY en .env.local.')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  })

  console.log('📋 Plan de Ejecución:')
  console.log(`   * Consultas programadas: ${QUERIES.length} exactas`)
  console.log('   * SKU aplicable: Places - Text Search (Pro)')
  console.log('   * Costo esperado: $0.00 USD (dentro del cupo mensual gratuito)\n')

  let totalInsertados = 0
  let totalDescartados = 0

  for (let i = 0; i < QUERIES.length; i++) {
    const q = QUERIES[i]
    const indice = i + 1
    console.log(`🔍 [${indice}/${QUERIES.length}] Buscando "${q.categoria}" en ${q.distrito}...`)

    const fieldMask = [
      'places.id',
      'places.displayName',
      'places.formattedAddress',
      'places.location',
      'places.priceLevel',
      'places.photos',
    ].join(',')

    const response = await fetch('https://places.googleapis.com/v1/places:searchText', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': googleApiKey,
        'X-Goog-FieldMask': fieldMask,
      },
      body: JSON.stringify({
        textQuery: q.textQuery,
        languageCode: 'es',
        maxResultCount: 15,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error(`   ❌ Error de Google Places API (HTTP ${response.status}):`, errorText)
      continue
    }

    const data = (await response.json()) as { places?: GooglePlaceItem[] }
    const places = data.places || []
    console.log(`   → Google retornó ${places.length} candidatos`)

    let guardadosEnConsulta = 0
    let descartadosEnConsulta = 0

    for (const place of places) {
      const address = place.formattedAddress || ''
      const name = place.displayName?.text || 'Restaurante sin nombre'

      // Filtro estricto por distrito
      if (!addressBelongsToDistrict(address, q.distrito)) {
        descartadosEnConsulta++
        totalDescartados++
        continue
      }

      // Procesar foto de portada y atribución de autor
      const primeraFoto = place.photos && place.photos.length > 0 ? place.photos[0] : null
      const photoReference = primeraFoto ? primeraFoto.name : null
      const photoAuthor =
        primeraFoto?.authorAttributions && primeraFoto.authorAttributions.length > 0
          ? primeraFoto.authorAttributions[0].displayName
          : null

      const fila = {
        google_place_id: place.id,
        nombre: name.slice(0, 200),
        direccion: address || null,
        distrito: q.distrito,
        lat: place.location?.latitude ?? null,
        lng: place.location?.longitude ?? null,
        tipo_cocina: q.categoria,
        rango_precio: mapPriceLevel(place.priceLevel),
        photo_reference: photoReference,
        photo_author: photoAuthor,
        fecha_sync: new Date().toISOString(),
      }

      const { error: upsertError } = await supabase
        .from('restaurantes')
        .upsert(fila, { onConflict: 'google_place_id' })

      if (upsertError) {
        console.error(`   ⚠️ Error al guardar "${name}":`, upsertError.message)
      } else {
        guardadosEnConsulta++
        totalInsertados++
      }
    }

    console.log(
      `   ✅ Guardados/Actualizados en ${q.distrito}: ${guardadosEnConsulta} | Descartados por no pertenecer al distrito: ${descartadosEnConsulta}\n`
    )
  }

  console.log('================================================================')
  console.log('🎉 RESUMEN FINAL DE LA CARGA')
  console.log('================================================================')
  console.log(`* Consultas a Google Places: ${QUERIES.length} realizadas`)
  console.log(`* Restaurantes registrados en la BD: ${totalInsertados}`)
  console.log(`* Restaurantes descartados fuera de distrito: ${totalDescartados}`)
  console.log('* Costo total de API: $0.00 USD (cupo gratuito mensual)')
  console.log('================================================================\n')
}

main().catch((err) => {
  console.error('Fatal error en seed-places:', err)
  process.exit(1)
})
