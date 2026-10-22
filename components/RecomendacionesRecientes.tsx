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

import { connection } from 'next/server';
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
  await connection();
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
      <div className="mb-6 px-1">
        <h2 className="text-xl sm:text-2xl font-extrabold text-stone-900 tracking-tight">
          Recomendaciones recientes
        </h2>
        <p className="text-xs sm:text-sm text-stone-500 mt-0.5">
          Platos aprobados por foodies reales con el botón &ldquo;¡Confirmo!&rdquo;
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
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
              className="w-full bg-white border border-stone-200/80 rounded-2xl overflow-hidden shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
              aria-label={`Recomendación de ${plato?.nombre ?? 'plato'} en ${restaurante?.nombre ?? 'restaurante'}`}
            >
              <div>
                {/* Foto del plato */}
                <div className="relative w-full aspect-video bg-stone-100 overflow-hidden">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={fotoUrl}
                    alt={`Foto de ${plato?.nombre ?? 'plato'} en ${restaurante?.nombre ?? 'restaurante'}`}
                    className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
                    loading="lazy"
                  />
                  {/* Badge de calificación */}
                  <div className="absolute top-2.5 right-2.5 bg-white/95 backdrop-blur-sm rounded-full px-2.5 py-1 flex items-center gap-1 shadow-sm border border-stone-200/80">
                    <span className="text-[#EA580C] text-xs leading-none">
                      {'★'.repeat(reco.calificacion)}
                    </span>
                    <span className="text-stone-300 text-xs leading-none">
                      {'★'.repeat(5 - reco.calificacion)}
                    </span>
                  </div>
                </div>

                {/* Contenido */}
                <div className="p-4">
                  {/* Plato y restaurante */}
                  <div className="mb-2.5">
                    <p className="font-extrabold text-stone-900 text-base leading-snug">
                      {plato?.nombre ?? '—'}
                    </p>
                    {restaurante && (
                      <p className="text-xs text-stone-500 mt-0.5">
                        <span className="font-medium text-stone-700">{restaurante.nombre}</span>
                        <span className="mx-1.5 text-stone-300">·</span>
                        <span>{restaurante.distrito}</span>
                      </p>
                    )}
                  </div>

                  {/* Comentario */}
                  {reco.comentario && (
                    <p className="text-xs text-stone-600 leading-relaxed mb-4 line-clamp-3 bg-stone-50/80 p-2.5 rounded-xl border border-stone-100">
                      &ldquo;{reco.comentario}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* Footer: autor + tiempo + botón */}
              <div className="p-4 pt-0">
                <div className="flex items-center justify-between gap-2 pt-3 border-t border-stone-100">
                  {/* Autor */}
                  <div className="flex items-center gap-2 min-w-0">
                    {autor?.foto_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={autor.foto_url}
                        alt={displayName}
                        className="w-8 h-8 rounded-full object-cover border border-stone-200 flex-shrink-0"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-orange-100 text-[#C2410C] flex items-center justify-center text-xs font-bold border border-orange-200 flex-shrink-0">
                        {inicial}
                      </div>
                    )}
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-stone-800 truncate">{displayName}</p>
                      <p className="text-[11px] text-stone-600">{tiempoRelativo(reco.fecha)}</p>
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
    <section className="w-full py-6" aria-hidden="true">
      <div className="h-6 w-52 bg-stone-200 rounded-full mb-6 animate-pulse" />
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className="w-full bg-white border border-stone-200/80 rounded-2xl overflow-hidden animate-pulse shadow-sm"
          >
            <div className="w-full aspect-video bg-stone-100" />
            <div className="p-4 flex flex-col gap-3">
              <div className="h-5 w-36 bg-stone-200 rounded" />
              <div className="h-3.5 w-24 bg-stone-100 rounded" />
              <div className="h-12 w-full bg-stone-50 rounded-xl" />
              <div className="flex items-center justify-between pt-3 border-t border-stone-100">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-stone-200" />
                  <div className="h-3 w-20 bg-stone-100 rounded" />
                </div>
                <div className="h-10 w-24 rounded-full bg-stone-200" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
