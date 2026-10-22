/**
 * RecomendacionesRecientes — Server Component.
 *
 * Muestra las últimas 10 recomendaciones visibles con foto, plato, restaurante,
 * calificación, comentario, autor y <BotonConfirmar>.
 *
 * Necesita sesión para determinar:
 *   - yaConfirme: si el usuario actual ya validó cada recomendación.
 *   - usuarioId: para deshabilitar el botón en recomendaciones propias.
 *
 * Usa createClient() (con cookies) para acceder al contexto del usuario.
 * Esto hace la sección dinámica; por eso se envuelve en <Suspense> desde page.tsx.
 */

import { createClient } from '@/lib/supabase/server';
import { buildFotoUrl } from '@/lib/types';
import { BotonConfirmar } from '@/components/BotonConfirmar';

interface RecomendacionConRelaciones {
  id: string;
  calificacion: number;
  comentario: string | null;
  foto_path: string;
  fecha: string;
  usuario_id: string;
  platos: {
    id: string;
    nombre: string;
    restaurantes: {
      id: string;
      nombre: string;
      distrito: string;
    } | null;
  } | null;
  usuarios: {
    nombre: string;
    foto_url: string | null;
  } | null;
  _count_validaciones: number;
}

function estrellas(n: number) {
  return '★'.repeat(n) + '☆'.repeat(5 - n);
}

function tiempoRelativo(fechaIso: string): string {
  const diff = Date.now() - new Date(fechaIso).getTime();
  const minutos = Math.floor(diff / 60_000);
  if (minutos < 1) return 'ahora mismo';
  if (minutos < 60) return `hace ${minutos} min`;
  const horas = Math.floor(minutos / 60);
  if (horas < 24) return `hace ${horas} h`;
  const dias = Math.floor(horas / 24);
  if (dias < 30) return `hace ${dias} d`;
  return `hace ${Math.floor(dias / 30)} mes${Math.floor(dias / 30) !== 1 ? 'es' : ''}`;
}

export async function RecomendacionesRecientes() {
  const supabase = await createClient();

  // Sesión del usuario (puede ser null)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Últimas 10 recomendaciones visibles con joins
  const { data: recomendaciones, error } = await supabase
    .from('recomendaciones')
    .select(
      `id, calificacion, comentario, foto_path, fecha, usuario_id,
       platos ( id, nombre, restaurantes ( id, nombre, distrito ) ),
       usuarios ( nombre, foto_url )`
    )
    .eq('estado', 'visible')
    .order('fecha', { ascending: false })
    .limit(10);

  if (error || !recomendaciones || recomendaciones.length === 0) {
    return (
      <section className="w-full py-6" aria-label="Recomendaciones recientes">
        <h2 className="text-base font-bold text-neutral-200 mb-4">Recomendaciones recientes</h2>
        <p className="text-sm text-neutral-500 text-center py-8">
          Aún no hay recomendaciones. ¡Sé el primero en recomendar un plato!
        </p>
      </section>
    );
  }

  // Obtener contadores de validaciones para todas las recomendaciones de una vez
  const ids = recomendaciones.map((r) => r.id);

  const { data: contadores } = await supabase
    .from('validaciones')
    .select('recomendacion_id')
    .in('recomendacion_id', ids);

  const contadorMap = new Map<string, number>();
  (contadores ?? []).forEach((v) => {
    contadorMap.set(v.recomendacion_id, (contadorMap.get(v.recomendacion_id) ?? 0) + 1);
  });

  // Si hay sesión, obtener qué recomendaciones ya confirmó el usuario
  const yaConfirmeSet = new Set<string>();
  if (user) {
    const { data: misValidaciones } = await supabase
      .from('validaciones')
      .select('recomendacion_id')
      .eq('usuario_id', user.id)
      .in('recomendacion_id', ids);

    (misValidaciones ?? []).forEach((v) => yaConfirmeSet.add(v.recomendacion_id));
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';

  return (
    <section className="w-full py-4" aria-label="Recomendaciones recientes">
      <h2 className="text-base font-bold text-neutral-200 mb-4 px-1">
        Recomendaciones recientes
      </h2>

      <div className="flex flex-col gap-3">
        {(recomendaciones as unknown as RecomendacionConRelaciones[]).map((reco) => {
          const plato = reco.platos;
          const restaurante = plato?.restaurantes;
          const autor = reco.usuarios;
          const fotoUrl = buildFotoUrl(supabaseUrl, 'recomendaciones', reco.foto_path);
          const contador = contadorMap.get(reco.id) ?? 0;
          const yaConfirme = yaConfirmeSet.has(reco.id);
          const displayName = autor?.nombre ?? 'Foodie';
          const inicial = displayName.charAt(0).toUpperCase();

          return (
            <article
              key={reco.id}
              className="w-full bg-neutral-900/60 border border-neutral-800/60 rounded-2xl overflow-hidden shadow-sm"
              aria-label={`Recomendación de ${plato?.nombre ?? 'plato'} en ${restaurante?.nombre ?? 'restaurante'}`}
            >
              {/* Foto del plato */}
              <div className="relative w-full aspect-video bg-neutral-800">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={fotoUrl}
                  alt={`Foto de ${plato?.nombre ?? 'plato'} en ${restaurante?.nombre ?? 'restaurante'}`}
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
                {/* Badge de calificación */}
                <div className="absolute top-2 right-2 bg-neutral-950/80 backdrop-blur-sm rounded-full px-2 py-1 flex items-center gap-1">
                  <span className="text-amber-400 text-xs leading-none">
                    {'★'.repeat(reco.calificacion)}
                  </span>
                  <span className="text-neutral-400 text-xs leading-none">
                    {'★'.repeat(5 - reco.calificacion)}
                  </span>
                </div>
              </div>

              {/* Contenido */}
              <div className="p-3">
                {/* Plato y restaurante */}
                <div className="mb-2">
                  <p className="font-bold text-neutral-100 text-sm leading-tight">
                    {plato?.nombre ?? '—'}
                  </p>
                  {restaurante && (
                    <p className="text-xs text-neutral-400 mt-0.5">
                      {restaurante.nombre}
                      <span className="mx-1 text-neutral-600">·</span>
                      <span className="text-neutral-500">{restaurante.distrito}</span>
                    </p>
                  )}
                </div>

                {/* Comentario */}
                {reco.comentario && (
                  <p className="text-xs text-neutral-300 leading-relaxed mb-3 line-clamp-3">
                    &ldquo;{reco.comentario}&rdquo;
                  </p>
                )}

                {/* Footer: autor + tiempo + botón */}
                <div className="flex items-center justify-between gap-2">
                  {/* Autor */}
                  <div className="flex items-center gap-2 min-w-0">
                    {autor?.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={autor.foto_url}
                        alt={displayName}
                        className="w-7 h-7 rounded-full object-cover border border-neutral-700 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-amber-500/20 text-amber-400 flex items-center justify-center text-xs font-bold border border-neutral-700 flex-shrink-0">
                        {inicial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-neutral-300 truncate">{displayName}</p>
                      <p className="text-[10px] text-neutral-600">{tiempoRelativo(reco.fecha)}</p>
                    </div>
                  </div>

                  {/* Botón Confirmar */}
                  <BotonConfirmar
                    recomendacionId={reco.id}
                    autorId={reco.usuario_id}
                    contadorInicial={contador}
                    yaConfirme={yaConfirme}
                    usuarioId={user?.id ?? null}
                  />
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

/** Skeleton para <Suspense> mientras carga RecomendacionesRecientes */
export function RecomendacionesRecientesSkeleton() {
  return (
    <section className="w-full py-4" aria-hidden="true">
      <div className="h-5 w-44 bg-neutral-800 rounded-full mb-4 animate-pulse" />
      <div className="flex flex-col gap-3">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-full bg-neutral-900/60 border border-neutral-800/60 rounded-2xl overflow-hidden animate-pulse"
          >
            <div className="w-full aspect-video bg-neutral-800" />
            <div className="p-3 flex flex-col gap-2">
              <div className="h-4 w-32 bg-neutral-800 rounded-full" />
              <div className="h-3 w-24 bg-neutral-800/70 rounded-full" />
              <div className="h-3 w-full bg-neutral-800/50 rounded-full" />
              <div className="flex items-center justify-between mt-1">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-neutral-800" />
                  <div className="h-3 w-20 bg-neutral-800/70 rounded-full" />
                </div>
                <div className="h-9 w-28 rounded-full bg-neutral-800" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
