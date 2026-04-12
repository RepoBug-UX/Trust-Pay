export function SkeletonCard() {
  return (
    <div className="rounded-xl border border-navy-700 bg-navy-800/50 p-5 animate-pulse">
      <div className="h-3 bg-navy-600 rounded w-1/3 mb-4" />
      <div className="h-8 bg-navy-600 rounded w-2/3 mb-2" />
      <div className="h-3 bg-navy-600 rounded w-1/2" />
    </div>
  );
}

export function SkeletonRow() {
  return (
    <div className="flex items-center gap-4 px-4 py-3 animate-pulse">
      <div className="h-3 bg-navy-600 rounded w-24" />
      <div className="h-3 bg-navy-600 rounded w-32" />
      <div className="h-3 bg-navy-600 rounded w-20" />
      <div className="h-3 bg-navy-600 rounded w-16 ml-auto" />
    </div>
  );
}

export function SkeletonRing() {
  return (
    <div className="w-[200px] h-[200px] rounded-full border-[12px] border-navy-700 animate-pulse mx-auto" />
  );
}
