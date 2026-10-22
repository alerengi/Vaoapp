import React from 'react'

export function RestaurantListSkeleton() {
  return (
    <div className="w-full flex flex-col gap-4 py-2 animate-pulse" data-testid="restaurant-skeleton">
      {/* Skeletons de chips de filtro */}
      <div className="flex flex-col gap-3 py-2">
        <div className="h-3 w-16 bg-neutral-800 rounded" />
        <div className="flex gap-2">
          <div className="h-11 w-20 bg-neutral-900 rounded-xl border border-neutral-800" />
          <div className="h-11 w-24 bg-neutral-900 rounded-xl border border-neutral-800" />
          <div className="h-11 w-24 bg-neutral-900 rounded-xl border border-neutral-800" />
        </div>
      </div>

      {/* Skeletons de tarjetas */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div
          key={i}
          className="w-full bg-neutral-900/60 border border-neutral-800 rounded-2xl overflow-hidden flex flex-col"
        >
          <div className="w-full h-48 bg-neutral-800/60" />
          <div className="p-4 flex flex-col gap-3">
            <div className="flex justify-between items-center">
              <div className="h-5 w-40 bg-neutral-800 rounded" />
              <div className="h-4 w-8 bg-neutral-800 rounded" />
            </div>
            <div className="h-3.5 w-56 bg-neutral-800/80 rounded" />
            <div className="pt-2 flex justify-between items-center border-t border-neutral-800">
              <div className="h-3 w-28 bg-neutral-800 rounded" />
              <div className="h-11 w-20 bg-neutral-800 rounded-xl" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}
