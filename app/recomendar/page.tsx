import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { connection } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { obtenerDatosInicialesRecomendacion } from '@/app/actions/recomendar';
import RecomendacionForm from '@/components/RecomendacionForm';
import { AuthButton } from '@/components/AuthButton';

export const metadata: Metadata = {
  title: 'Recomendar un plato · Vao',
  description:
    'Recomienda tus platos favoritos con foto y calificación para la comunidad foodie de Lima en Miraflores y Barranco.',
};

interface PageProps {
  searchParams: Promise<{
    restaurante_id?: string;
    plato_id?: string;
  }>;
}

function RecomendarSkeleton() {
  return (
    <div className="max-w-md mx-auto px-4 pt-5 animate-pulse">
      <div className="h-6 w-48 bg-gray-200 rounded-md mb-2" />
      <div className="h-4 w-64 bg-gray-100 rounded-md mb-6" />
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex flex-col gap-4">
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
        <div className="h-10 bg-gray-100 rounded-xl w-full" />
        <div className="h-12 bg-gray-100 rounded-xl w-3/4" />
        <div className="h-32 bg-gray-100 rounded-xl w-full" />
      </div>
    </div>
  );
}

async function RecomendarContent({ searchParams }: PageProps) {
  await connection();
  const { restaurante_id, plato_id } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="max-w-md mx-auto px-4 pt-8 text-center">
        <div className="bg-white rounded-3xl p-7 shadow-sm border border-orange-100 flex flex-col items-center">
          <span className="text-4xl mb-3">🍽️</span>
          <h2 className="text-xl font-bold text-gray-900 mb-2">
            ¡Recomienda un plato en Vao!
          </h2>
          <p className="text-sm text-gray-600 mb-6 leading-relaxed">
            Para publicar fotos y calificaciones validadas por la comunidad,
            necesitas ingresar con tu cuenta de Google.
          </p>

          <div className="w-full flex justify-center">
            <AuthButton />
          </div>
        </div>
      </div>
    );
  }

  const resInicial = await obtenerDatosInicialesRecomendacion();
  const restaurantes = resInicial.ok ? resInicial.data.restaurantes : [];
  const categorias = resInicial.ok ? resInicial.data.categorias : [];

  return (
    <div className="max-w-md mx-auto px-4 pt-5">
      <div className="mb-4">
        <h2 className="text-lg font-bold text-gray-900">
          Comparte tu experiencia foodie
        </h2>
        <p className="text-xs text-gray-600 mt-0.5">
          Una foto apetitosa y tu calificación honesta ayudan a otros foodies a elegir bien.
        </p>
      </div>

      <RecomendacionForm
        restaurantes={restaurantes}
        categorias={categorias}
        initialRestauranteId={restaurante_id}
        initialPlatoId={plato_id}
      />
    </div>
  );
}

export default function RecomendarPage({ searchParams }: PageProps) {
  return (
    <main className="min-h-screen bg-[#FAFAF9] text-stone-900 pb-16">
      {/* Cabecera blanca unificada con logo Vao */}
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-stone-200/80 shadow-2xs">
        <div className="max-w-4xl mx-auto px-4 py-3.5 flex items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 group min-h-[44px]"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-[#EA580C] to-[#F97316] flex items-center justify-center font-black text-white text-base shadow-sm group-hover:scale-105 transition-transform">
              V
            </div>
            <div className="flex flex-col text-left">
              <span className="font-extrabold text-base tracking-tight text-stone-900 leading-none">
                Vao
              </span>
              <span className="text-[10px] text-stone-500 font-semibold">
                ← Volver al inicio
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-block text-xs font-bold text-stone-700">
              Recomendar plato
            </span>
            <Suspense fallback={<div className="w-16 h-8 bg-stone-100 rounded-lg animate-pulse" />}>
              <AuthButton />
            </Suspense>
          </div>
        </div>
      </header>

      {/* Contenido dinámico envuelto en Suspense para Partial Prerendering de Next.js 16 */}
      <div className="max-w-xl mx-auto px-4 pt-6">
        <Suspense fallback={<RecomendarSkeleton />}>
          <RecomendarContent searchParams={searchParams} />
        </Suspense>
      </div>
    </main>
  );
}
