import React from 'react'

export function RestaurantListSkeleton() {
  return (
    <div className="w-full flex flex-col gap-6 py-2 animate-pulse" data-testid="restaurant-skeleton">
      {/* Skeletons de chips de filtro */}
      <div className="flex flex-col gap-3 py-2">
        <div className="h-3 w-16 bg-stone-200 rounded" />
        <div className="flex gap-2">
          <div className="h-11 w-20 bg-stone-200 rounded-xl" />
          <div className="h-11 w-24 bg-stone-200 rounded-xl" />
          <div className="h-11 w-24 bg-stone-200 rounded-xl" />
        </div>
      </div>

      {/* Skeletons de tarjetas responsive */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="w-full bg-white border border-stone-200/80 rounded-2xl overflow-hidden flex flex-col shadow-sm"
          >
            <div className="w-full h-48 bg-stone-100" />
            <div className="p-4 flex flex-col gap-3">
              <div className="flex justify-between items-center">
                <div className="h-5 w-40 bg-stone-200 rounded" />
                <div className="h-4 w-8 bg-stone-100 rounded" />
              </div>
              <div className="h-3.5 w-56 bg-stone-100 rounded" />
              <div className="pt-3 flex justify-between items-center border-t border-stone-100">
                <div className="h-3 w-28 bg-stone-100 rounded" />
                <div className="h-11 w-20 bg-stone-200 rounded-xl" />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
