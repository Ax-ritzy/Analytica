import React from "react";

export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-xl bg-white/5 border border-white/5 ${className}`}
    />
  );
}

export function StatCardSkeleton() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-5">
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
      <Skeleton className="mt-4 h-8 w-16" />
      <Skeleton className="mt-2 h-2.5 w-32" />
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-white/10 bg-[#0f172a] p-6 space-y-4">
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-32" />
        <Skeleton className="h-6 w-16 rounded-md" />
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="space-y-2">
        <Skeleton className="h-3 w-5/6" />
        <Skeleton className="h-3 w-4/6" />
      </div>
    </div>
  );
}

export function TableRowSkeleton({ cols = 5 }: { cols?: number }) {
  return (
    <tr className="border-b border-white/5">
      {Array.from({ length: cols }).map((_, i) => (
        <td key={i} className="py-3 px-3">
          <Skeleton className="h-4 w-full" />
        </td>
      ))}
    </tr>
  );
}
