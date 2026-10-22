'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  guardarRecomendacion,
  obtenerPlatosDeRestaurante,
  type RestauranteOption,
  type CategoriaOption,
  type PlatoOption,
  type GuardarRecomendacionResult,
} from '@/app/actions/recomendar';
import { compressImageFile } from '@/lib/image-compressor';

interface Props {
  restaurantes: RestauranteOption[];
  categorias: CategoriaOption[];
  initialRestauranteId?: string;
  initialPlatoId?: string;
}

export default function RecomendacionForm({
  restaurantes,
  categorias,
  initialRestauranteId = '',
  initialPlatoId = '',
}: Props) {
  // Estado del formulario
  const [restauranteId, setRestauranteId] = useState(initialRestauranteId);
  const [platos, setPlatos] = useState<PlatoOption[]>([]);
  const [cargandoPlatos, setCargandoPlatos] = useState(false);
  const [modoNuevoPlato, setModoNuevoPlato] = useState(false);
  const [platoId, setPlatoId] = useState(initialPlatoId);
  const [nuevoPlatoNombre, setNuevoPlatoNombre] = useState('');
  const [categoriaId, setCategoriaId] = useState('');
  const [precioAprox, setPrecioAprox] = useState('');
  const [calificacion, setCalificacion] = useState<number>(5);
  const [comentario, setComentario] = useState('');
  const [fotoOriginal, setFotoOriginal] = useState<File | null>(null);
  const [fotoPreview, setFotoPreview] = useState<string | null>(null);
  const [procesandoFoto, setProcesandoFoto] = useState(false);

  // Estado de envío y feedback
  const [isPending, startTransition] = useTransition();
  const [errorMensaje, setErrorMensaje] = useState<string | null>(null);
  const [exitoResultado, setExitoResultado] = useState<GuardarRecomendacionResult | null>(null);

  // Cargar platos cuando cambia el restaurante
  useEffect(() => {
    if (!restauranteId) {
      setPlatos([]);
      setPlatoId('');
      return;
    }

    let isMounted = true;
    setCargandoPlatos(true);

    obtenerPlatosDeRestaurante(restauranteId).then((res) => {
      if (!isMounted) return;
      setCargandoPlatos(false);

      if (res.ok) {
        setPlatos(res.data);
        if (res.data.length === 0) {
          setModoNuevoPlato(true);
        } else if (!initialPlatoId) {
          setPlatoId(res.data[0].id);
          setModoNuevoPlato(false);
        }
      }
    });

    return () => {
      isMounted = false;
    };
  }, [restauranteId, initialPlatoId]);

  // Manejo de selección de archivo con compresión y limpieza EXIF
  const handleFotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setErrorMensaje(null);
    setProcesandoFoto(true);

    try {
      // Compresión nativa en navegador: elimina metadatos EXIF/GPS y garantiza <= 3 MB
      const compressedFile = await compressImageFile(file);
      setFotoOriginal(compressedFile);

      if (fotoPreview) {
        URL.revokeObjectURL(fotoPreview);
      }
      const previewUrl = URL.createObjectURL(compressedFile);
      setFotoPreview(previewUrl);
    } catch (err: unknown) {
      setErrorMensaje(
        err instanceof Error ? err.message : 'Error al procesar la imagen.'
      );
    } finally {
      setProcesandoFoto(false);
    }
  };

  // Envío del formulario
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMensaje(null);

    if (!restauranteId) {
      setErrorMensaje('Selecciona un restaurante.');
      return;
    }

    if (!modoNuevoPlato && !platoId) {
      setErrorMensaje('Selecciona un plato o pulsa "+ Nuevo plato".');
      return;
    }

    if (modoNuevoPlato) {
      if (!nuevoPlatoNombre.trim()) {
        setErrorMensaje('Ingresa el nombre del plato.');
        return;
      }
      if (!categoriaId) {
        setErrorMensaje('Selecciona la categoría del plato.');
        return;
      }
    }

    if (!fotoOriginal && !fotoPreview) {
      setErrorMensaje('Adjunta una foto para validar tu recomendación.');
      return;
    }

    startTransition(async () => {
      const formData = new FormData();
      formData.append('restaurante_id', restauranteId);

      if (modoNuevoPlato) {
        formData.append('nuevo_plato_nombre', nuevoPlatoNombre.trim());
        formData.append('categoria_id', categoriaId);
        if (precioAprox) {
          formData.append('precio_aprox', precioAprox);
        }
      } else {
        formData.append('plato_id', platoId);
      }

      formData.append('calificacion', calificacion.toString());
      if (comentario.trim()) {
        formData.append('comentario', comentario.trim());
      }

      if (fotoOriginal) {
        formData.append('foto', fotoOriginal);
      }

      const res = await guardarRecomendacion(formData);

      if (!res.ok) {
        setErrorMensaje(res.error.mensaje);
      } else {
        setExitoResultado(res.data);
      }
    });
  };

  if (exitoResultado) {
    return (
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-emerald-100 text-center animate-fade-in">
        <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4 text-3xl">
          ✓
        </div>
        <h2 className="text-xl font-bold text-gray-900 mb-2">
          {exitoResultado.esEdicion
            ? '¡Recomendación actualizada!'
            : '¡Recomendación publicada!'}
        </h2>
        <p className="text-sm text-gray-600 mb-6">
          Gracias por sumar a la comunidad foodie de Vao. El puntaje del plato ha
          sido recalculado.
        </p>

        {exitoResultado.foto_url && (
          <div className="relative w-full h-48 rounded-xl overflow-hidden mb-6 border border-gray-100 shadow-inner">
            <img
              src={exitoResultado.foto_url}
              alt="Tu recomendación"
              className="w-full h-full object-cover"
              loading="lazy"
            />
          </div>
        )}

        <div className="flex flex-col gap-3">
          <Link
            href="/"
            className="w-full py-3.5 px-4 bg-orange-600 hover:bg-orange-700 text-white font-semibold rounded-xl transition shadow-md min-h-[44px] flex items-center justify-center"
          >
            Volver al explorador
          </Link>
          <button
            type="button"
            onClick={() => {
              setExitoResultado(null);
              setComentario('');
              setFotoOriginal(null);
              setFotoPreview(null);
              setModoNuevoPlato(false);
            }}
            className="w-full py-3 px-4 bg-gray-50 hover:bg-gray-100 text-gray-700 font-medium rounded-xl transition min-h-[44px]"
          >
            Recomendar otro plato
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-5 text-gray-900"
    >
      {/* 1. Selector de Restaurante */}
      <div>
        <label
          htmlFor="restaurante-select"
          className="block text-sm font-semibold text-gray-800 mb-1.5"
        >
          1. ¿En qué restaurante comiste? <span className="text-red-500">*</span>
        </label>
        <select
          id="restaurante-select"
          value={restauranteId}
          onChange={(e) => setRestauranteId(e.target.value)}
          className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm min-h-[44px]"
          required
        >
          <option value="">Selecciona un restaurante...</option>
          {restaurantes.map((r) => (
            <option key={r.id} value={r.id}>
              {r.nombre} ({r.distrito})
            </option>
          ))}
        </select>
      </div>

      {/* 2. Selector o Creación de Plato */}
      {restauranteId && (
        <div className="border-t border-gray-100 pt-4">
          <div className="flex items-center justify-between mb-2">
            <label className="text-sm font-semibold text-gray-800">
              2. ¿Qué plato vas a recomendar? <span className="text-red-500">*</span>
            </label>
            <button
              type="button"
              onClick={() => setModoNuevoPlato(!modoNuevoPlato)}
              className="text-xs text-orange-600 font-medium hover:underline py-1 px-2 rounded min-h-[36px]"
            >
              {modoNuevoPlato ? '← Elegir existente' : '+ Nuevo plato'}
            </button>
          </div>

          {cargandoPlatos ? (
            <div className="text-xs text-gray-500 py-2">Cargando platos del local...</div>
          ) : modoNuevoPlato ? (
            <div className="flex flex-col gap-3 bg-orange-50/60 p-3.5 rounded-xl border border-orange-100">
              <div>
                <label
                  htmlFor="nuevo-plato-input"
                  className="block text-xs font-medium text-gray-700 mb-1"
                >
                  Nombre del plato:
                </label>
                <input
                  id="nuevo-plato-input"
                  type="text"
                  maxLength={100}
                  placeholder="Ej. Maki Acevichado, Ceviche Clásico..."
                  value={nuevoPlatoNombre}
                  onChange={(e) => setNuevoPlatoNombre(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[44px]"
                  required={modoNuevoPlato}
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label
                    htmlFor="categoria-select"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Categoría:
                  </label>
                  <select
                    id="categoria-select"
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[44px]"
                    required={modoNuevoPlato}
                  >
                    <option value="">Elegir...</option>
                    {categorias.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.nombre.charAt(0).toUpperCase() + c.nombre.slice(1)}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor="precio-aprox-input"
                    className="block text-xs font-medium text-gray-700 mb-1"
                  >
                    Precio aprox. (S/.):
                  </label>
                  <input
                    id="precio-aprox-input"
                    type="number"
                    step="0.50"
                    min="1"
                    max="999"
                    placeholder="Opcional"
                    value={precioAprox}
                    onChange={(e) => setPrecioAprox(e.target.value)}
                    className="w-full px-2.5 py-2.5 rounded-lg border border-gray-200 bg-white text-gray-900 text-xs focus:outline-none focus:ring-2 focus:ring-orange-500 min-h-[44px]"
                  />
                </div>
              </div>
            </div>
          ) : platos.length > 0 ? (
            <select
              value={platoId}
              onChange={(e) => setPlatoId(e.target.value)}
              className="w-full px-3.5 py-3 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 text-sm min-h-[44px]"
              required
            >
              {platos.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          ) : (
            <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-xl">
              Este restaurante aún no tiene platos registrados. Haz clic en{' '}
              <button
                type="button"
                onClick={() => setModoNuevoPlato(true)}
                className="text-orange-600 font-semibold underline"
              >
                + Nuevo plato
              </button>{' '}
              para registrar el primero.
            </div>
          )}
        </div>
      )}

      {/* 3. Calificación Táctil (1 a 5 estrellas) */}
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-semibold text-gray-800 mb-2">
          3. Calificación del plato <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-2" role="radiogroup" aria-label="Calificación en estrellas">
          {[1, 2, 3, 4, 5].map((star) => (
            <button
              key={star}
              type="button"
              onClick={() => setCalificacion(star)}
              className="w-12 h-12 flex items-center justify-center rounded-xl transition text-2xl focus:outline-none focus:ring-2 focus:ring-orange-500"
              aria-label={`${star} estrella${star > 1 ? 's' : ''}`}
            >
              <span className={star <= calificacion ? 'text-amber-400' : 'text-gray-200'}>
                ★
              </span>
            </button>
          ))}
          <span className="text-sm font-bold text-amber-600 ml-2">
            {calificacion} / 5
          </span>
        </div>
      </div>

      {/* 4. Subida y Preview de Foto */}
      <div className="border-t border-gray-100 pt-4">
        <label className="block text-sm font-semibold text-gray-800 mb-1.5">
          4. Foto del plato <span className="text-red-500">*</span>
        </label>
        <p className="text-xs text-gray-500 mb-2.5">
          Obligatoria (máx. 3 MB). Se optimiza automáticamente y elimina metadatos privados.
        </p>

        {fotoPreview ? (
          <div className="relative w-full h-52 rounded-xl overflow-hidden border border-gray-200 mb-2 group">
            <img
              src={fotoPreview}
              alt="Vista previa de la foto"
              className="w-full h-full object-cover"
            />
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center gap-2">
              <label
                htmlFor="foto-input"
                className="cursor-pointer bg-white text-gray-800 text-xs font-semibold py-2 px-3 rounded-lg shadow-md hover:bg-gray-100 transition min-h-[44px] flex items-center"
              >
                Cambiar foto
              </label>
            </div>
          </div>
        ) : (
          <label
            htmlFor="foto-input"
            className={`w-full h-36 border-2 border-dashed rounded-xl flex flex-col items-center justify-center cursor-pointer transition min-h-[44px] ${
              procesandoFoto
                ? 'bg-gray-50 border-gray-300'
                : 'border-orange-200 bg-orange-50/40 hover:bg-orange-50/80 hover:border-orange-300'
            }`}
          >
            {procesandoFoto ? (
              <div className="flex flex-col items-center gap-2 text-xs text-gray-500">
                <span className="animate-spin text-xl">⏳</span>
                <span>Optimizando imagen...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5 text-center p-4">
                <span className="text-3xl">📷</span>
                <span className="text-xs font-semibold text-orange-700">
                  Toma una foto o elígela de tu galería
                </span>
                <span className="text-[10px] text-gray-400">JPG, PNG o WEBP</span>
              </div>
            )}
          </label>
        )}

        <input
          id="foto-input"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={handleFotoChange}
          className="sr-only"
        />
      </div>

      {/* 5. Comentario Opcional */}
      <div className="border-t border-gray-100 pt-4">
        <div className="flex items-center justify-between mb-1.5">
          <label
            htmlFor="comentario-input"
            className="text-sm font-semibold text-gray-800"
          >
            5. Tu veredicto foodie (opcional)
          </label>
          <span
            className={`text-xs ${
              comentario.length > 280 ? 'text-red-500 font-bold' : 'text-gray-400'
            }`}
          >
            {comentario.length} / 280
          </span>
        </div>
        <textarea
          id="comentario-input"
          rows={3}
          maxLength={280}
          placeholder="¿Qué te pareció el sabor, textura o punto de cocción?"
          value={comentario}
          onChange={(e) => setComentario(e.target.value)}
          className="w-full px-3.5 py-2.5 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-orange-500 resize-none"
        />
      </div>

      {/* Alerta de Error */}
      {errorMensaje && (
        <div
          role="alert"
          className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-xl text-xs flex items-center gap-2"
        >
          <span>⚠️</span>
          <span>{errorMensaje}</span>
        </div>
      )}

      {/* Botón de Submit */}
      <button
        type="submit"
        disabled={isPending || procesandoFoto}
        className="w-full py-4 px-6 bg-orange-600 hover:bg-orange-700 disabled:bg-orange-300 text-white font-bold rounded-xl transition shadow-md shadow-orange-500/20 text-base min-h-[48px] flex items-center justify-center gap-2 mt-2"
      >
        {isPending ? (
          <>
            <span className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>Publicando en Vao...</span>
          </>
        ) : (
          <span>Publicar recomendación</span>
        )}
      </button>
    </form>
  );
}
