'use server';

import { createClient } from '@/lib/supabase/server';
import {
  BUCKET_RECOMENDACIONES,
  SERVER_ACTION_MAX_FILE_SIZE,
  generateSecureImagePath,
  validateImageBuffer,
  getPublicImageUrl,
} from '@/lib/storage';
import type { ApiResponse } from '@/lib/types';

export interface GuardarRecomendacionResult {
  id: string;
  plato_id: string;
  restaurante_id: string;
  foto_path: string;
  foto_url: string;
  esEdicion: boolean;
}

export interface RestauranteOption {
  id: string;
  nombre: string;
  distrito: string;
}

export interface CategoriaOption {
  id: string;
  nombre: string;
  sinonimos: string[];
}

export interface PlatoOption {
  id: string;
  nombre: string;
  categoria_id: string;
}

/**
 * Obtiene los restaurantes y categorías para los selectores del formulario.
 */
export async function obtenerDatosInicialesRecomendacion(): Promise<
  ApiResponse<{
    restaurantes: RestauranteOption[];
    categorias: CategoriaOption[];
  }>
> {
  try {
    const supabase = await createClient();

    const [resRestaurantes, resCategorias] = await Promise.all([
      supabase
        .from('restaurantes')
        .select('id, nombre, distrito')
        .order('nombre', { ascending: true }),
      supabase
        .from('categorias')
        .select('id, nombre, sinonimos')
        .order('nombre', { ascending: true }),
    ]);

    if (resRestaurantes.error) {
      return {
        ok: false,
        error: {
          codigo: 'ERROR_RESTAURANTES',
          mensaje: 'Error al cargar la lista de restaurantes.',
        },
      };
    }

    if (resCategorias.error) {
      return {
        ok: false,
        error: {
          codigo: 'ERROR_CATEGORIAS',
          mensaje: 'Error al cargar la lista de categorías.',
        },
      };
    }

    return {
      ok: true,
      data: {
        restaurantes: (resRestaurantes.data as RestauranteOption[]) || [],
        categorias: (resCategorias.data as CategoriaOption[]) || [],
      },
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        codigo: 'ERROR_INESPERADO',
        mensaje: err instanceof Error ? err.message : 'Error al obtener datos iniciales.',
      },
    };
  }
}

/**
 * Obtiene los platos ya existentes registrados en un restaurante.
 */
export async function obtenerPlatosDeRestaurante(
  restauranteId: string
): Promise<ApiResponse<PlatoOption[]>> {
  try {
    if (!restauranteId) {
      return { ok: true, data: [] };
    }

    const supabase = await createClient();
    const { data, error } = await supabase
      .from('platos')
      .select('id, nombre, categoria_id')
      .eq('restaurante_id', restauranteId)
      .order('nombre', { ascending: true });

    if (error) {
      return {
        ok: false,
        error: {
          codigo: 'ERROR_PLATOS',
          mensaje: 'Error al consultar platos del restaurante.',
        },
      };
    }

    return {
      ok: true,
      data: (data as PlatoOption[]) || [],
    };
  } catch (err: unknown) {
    return {
      ok: false,
      error: {
        codigo: 'ERROR_INESPERADO',
        mensaje: err instanceof Error ? err.message : 'Error al consultar platos.',
      },
    };
  }
}

/**
 * Server Action principal para publicar o editar una recomendación.
 *
 * Implementa los siguientes requerimientos:
 * 1. Validación de sesión con getUser().
 * 2. Manejo de platos con concurrencia (captura unique 23505 y reutiliza plato).
 * 3. NO usa upsert en recomendaciones: consulta previa e INSERT o UPDATE según corresponda.
 * 4. Subida a Storage con ruta relativa <usuario_id>/<uuid>.<ext>.
 * 5. Limpieza de Storage: rollback inmediato si falla la base de datos;
 *    borrado de foto antigua solo tras éxito en edición con nueva foto.
 */
export async function guardarRecomendacion(
  formData: FormData
): Promise<ApiResponse<GuardarRecomendacionResult>> {
  let nuevaFotoSubidaPath: string | null = null;
  const supabase = await createClient();

  try {
    // 1. Validar autenticación
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return {
        ok: false,
        error: {
          codigo: 'NO_AUTENTICADO',
          mensaje: 'Debes iniciar sesión con Google para publicar una recomendación.',
        },
      };
    }

    // 2. Extraer y validar inputs
    const restauranteId = formData.get('restaurante_id') as string;
    const platoIdInput = formData.get('plato_id') as string | null;
    const nuevoPlatoNombre = formData.get('nuevo_plato_nombre') as string | null;
    const categoriaIdInput = formData.get('categoria_id') as string | null;
    const precioAproxStr = formData.get('precio_aprox') as string | null;
    const calificacionStr = formData.get('calificacion') as string;
    const comentarioInput = formData.get('comentario') as string | null;
    const fotoFile = formData.get('foto') as File | null;

    if (!restauranteId) {
      return {
        ok: false,
        error: {
          codigo: 'RESTAURANTE_REQUERIDO',
          mensaje: 'Debes seleccionar un restaurante.',
        },
      };
    }

    const calificacion = parseInt(calificacionStr, 10);
    if (isNaN(calificacion) || calificacion < 1 || calificacion > 5) {
      return {
        ok: false,
        error: {
          codigo: 'CALIFICACION_INVALIDA',
          mensaje: 'La calificación debe ser un número entero entre 1 y 5 estrellas.',
        },
      };
    }

    const comentario = comentarioInput ? comentarioInput.trim() : null;
    if (comentario && comentario.length > 280) {
      return {
        ok: false,
        error: {
          codigo: 'COMENTARIO_MUY_LARGO',
          mensaje: 'El comentario no puede exceder los 280 caracteres.',
        },
      };
    }

    // 3. Resolver plato (existente o crear nuevo con manejo de concurrencia)
    let platoId: string;

    if (platoIdInput && platoIdInput.trim().length > 0) {
      platoId = platoIdInput.trim();
    } else if (nuevoPlatoNombre && nuevoPlatoNombre.trim().length > 0) {
      const nombreLimpio = nuevoPlatoNombre.trim();
      if (nombreLimpio.length > 100) {
        return {
          ok: false,
          error: {
            codigo: 'NOMBRE_PLATO_LARGO',
            mensaje: 'El nombre del plato no puede exceder 100 caracteres.',
          },
        };
      }

      if (!categoriaIdInput) {
        return {
          ok: false,
          error: {
            codigo: 'CATEGORIA_REQUERIDA',
            mensaje: 'Debes seleccionar la categoría del nuevo plato.',
          },
        };
      }

      let precioAprox: number | null = null;
      if (precioAproxStr && precioAproxStr.trim().length > 0) {
        const parsedPrecio = parseFloat(precioAproxStr);
        if (!isNaN(parsedPrecio) && parsedPrecio > 0) {
          precioAprox = parsedPrecio;
        }
      }

      // Intentar insertar el nuevo plato
      const { data: platoCreado, error: errPlato } = await supabase
        .from('platos')
        .insert({
          restaurante_id: restauranteId,
          categoria_id: categoriaIdInput,
          nombre: nombreLimpio,
          precio_aprox: precioAprox,
        })
        .select('id')
        .single();

      if (errPlato) {
        // Manejo de concurrencia (Ajuste 6): si otro usuario lo creó a la vez (error 23505)
        if (errPlato.code === '23505') {
          const nombreNormalizado = nombreLimpio.toLowerCase();
          const { data: platoExistente } = await supabase
            .from('platos')
            .select('id')
            .eq('restaurante_id', restauranteId)
            .eq('nombre_normalizado', nombreNormalizado)
            .single();

          if (platoExistente) {
            platoId = platoExistente.id;
          } else {
            return {
              ok: false,
              error: {
                codigo: 'ERROR_PLATO_CONCURRENTE',
                mensaje: 'El plato ya existe pero no se pudo asociar.',
              },
            };
          }
        } else {
          return {
            ok: false,
            error: {
              codigo: 'ERROR_CREAR_PLATO',
              mensaje: `Error al registrar el nuevo plato: ${errPlato.message}`,
            },
          };
        }
      } else {
        platoId = platoCreado.id;
      }
    } else {
      return {
        ok: false,
        error: {
          codigo: 'PLATO_REQUERIDO',
          mensaje: 'Debes seleccionar o ingresar un plato.',
        },
      };
    }

    // 4. Verificar si ya existe recomendación previa del usuario para este plato (Ajuste 1)
    const { data: recomendacionPrevia } = await supabase
      .from('recomendaciones')
      .select('id, foto_path')
      .eq('usuario_id', user.id)
      .eq('plato_id', platoId)
      .maybeSingle();

    const esEdicion = Boolean(recomendacionPrevia);
    let fotoPathFinal: string;

    // 5. Validar y procesar archivo de foto
    const tieneFotoNueva = fotoFile && fotoFile.size > 0;

    if (!tieneFotoNueva && !esEdicion) {
      return {
        ok: false,
        error: {
          codigo: 'FOTO_REQUERIDA',
          mensaje: 'Debes adjuntar una foto para recomendar un plato.',
        },
      };
    }

    if (tieneFotoNueva) {
      const buffer = await fotoFile.arrayBuffer();
      const validacion = validateImageBuffer(buffer, SERVER_ACTION_MAX_FILE_SIZE);

      if (!validacion.ok) {
        return {
          ok: false,
          error: validacion.error,
        };
      }

      // Generar ruta segura con 2 segmentos exactos: <usuario_id>/<uuid>.<ext>
      const nuevoPath = generateSecureImagePath(user.id, validacion.data.extension);

      // Subir a Storage
      const { error: uploadError } = await supabase.storage
        .from(BUCKET_RECOMENDACIONES)
        .upload(nuevoPath, buffer, {
          contentType: validacion.data.mimeType,
          upsert: false,
        });

      if (uploadError) {
        return {
          ok: false,
          error: {
            codigo: 'ERROR_SUBIDA_FOTO',
            mensaje: `No se pudo subir la foto: ${uploadError.message}`,
          },
        };
      }

      nuevaFotoSubidaPath = nuevoPath;
      fotoPathFinal = nuevoPath;
    } else {
      // Mantiene la foto existente en caso de edición sin nueva foto
      fotoPathFinal = recomendacionPrevia!.foto_path;
    }

    // 6. Inserción o Actualización en public.recomendaciones (Ajuste 1)
    let recomendacionId: string;

    if (esEdicion) {
      // UPDATE solo de las columnas permitidas por RLS: calificacion, comentario, foto_path
      const { data: recoActualizada, error: errUpdate } = await supabase
        .from('recomendaciones')
        .update({
          calificacion,
          comentario,
          foto_path: fotoPathFinal,
        })
        .eq('id', recomendacionPrevia!.id)
        .select('id')
        .single();

      if (errUpdate) {
        // Rollback: borrar la foto recién subida si la actualización en BD falló
        if (nuevaFotoSubidaPath) {
          await supabase.storage.from(BUCKET_RECOMENDACIONES).remove([nuevaFotoSubidaPath]);
        }

        return {
          ok: false,
          error: {
            codigo: 'ERROR_ACTUALIZAR_RECOMENDACION',
            mensaje: errUpdate.message,
          },
        };
      }

      recomendacionId = recoActualizada.id;

      // Ajuste 3: Si se subió una nueva foto y la BD se actualizó con éxito, borrar la foto anterior
      if (
        nuevaFotoSubidaPath &&
        recomendacionPrevia!.foto_path &&
        recomendacionPrevia!.foto_path !== nuevaFotoSubidaPath
      ) {
        await supabase.storage
          .from(BUCKET_RECOMENDACIONES)
          .remove([recomendacionPrevia!.foto_path]);
      }
    } else {
      // INSERT para nueva recomendación
      const { data: recoCreada, error: errInsert } = await supabase
        .from('recomendaciones')
        .insert({
          usuario_id: user.id,
          plato_id: platoId,
          calificacion,
          comentario,
          foto_path: fotoPathFinal,
        })
        .select('id')
        .single();

      if (errInsert) {
        // Rollback: borrar la foto recién subida si la BD falló
        if (nuevaFotoSubidaPath) {
          await supabase.storage.from(BUCKET_RECOMENDACIONES).remove([nuevaFotoSubidaPath]);
        }

        if (errInsert.message.includes('LIMITE_DIARIO_ALCANZADO')) {
          return {
            ok: false,
            error: {
              codigo: 'LIMITE_DIARIO_ALCANZADO',
              mensaje: 'Solo puedes publicar 10 recomendaciones por día.',
            },
          };
        }

        return {
          ok: false,
          error: {
            codigo: 'ERROR_GUARDAR_RECOMENDACION',
            mensaje: errInsert.message,
          },
        };
      }

      recomendacionId = recoCreada.id;
    }

    const publicUrl = getPublicImageUrl(
      process.env.NEXT_PUBLIC_SUPABASE_URL || '',
      fotoPathFinal
    );

    return {
      ok: true,
      data: {
        id: recomendacionId,
        plato_id: platoId,
        restaurante_id: restauranteId,
        foto_path: fotoPathFinal,
        foto_url: publicUrl,
        esEdicion,
      },
    };
  } catch (err: unknown) {
    // Rollback en caso de excepción no controlada
    if (nuevaFotoSubidaPath) {
      try {
        await supabase.storage.from(BUCKET_RECOMENDACIONES).remove([nuevaFotoSubidaPath]);
      } catch {
        // Silenciar error en rollback
      }
    }

    return {
      ok: false,
      error: {
        codigo: 'ERROR_INESPERADO',
        mensaje: err instanceof Error ? err.message : 'Error inesperado al procesar la recomendación.',
      },
    };
  }
}
