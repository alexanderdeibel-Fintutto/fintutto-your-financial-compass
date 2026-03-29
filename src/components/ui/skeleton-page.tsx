/**
 * SkeletonPage – Universelles Loading-Skeleton für alle Seiten
 * Verhindert Layout-Shifts beim Laden von Seiten
 */
import { Skeleton } from '@/components/ui/skeleton';

interface SkeletonPageProps {
  rows?: number;
  cards?: number;
  showHeader?: boolean;
  showStats?: boolean;
}

export function SkeletonPage({ rows = 5, cards = 4, showHeader = true, showStats = true }: SkeletonPageProps) {
  return (
    <div className="space-y-6 animate-pulse">
      {showHeader && (
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <Skeleton className="h-8 w-64" />
            <Skeleton className="h-4 w-96" />
          </div>
          <div className="flex gap-2">
            <Skeleton className="h-9 w-28" />
            <Skeleton className="h-9 w-28" />
          </div>
        </div>
      )}

      {showStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: cards }).map((_, i) => (
            <div key={i} className="border rounded-lg p-4 space-y-2">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-7 w-32" />
              <Skeleton className="h-3 w-16" />
            </div>
          ))}
        </div>
      )}

      <div className="border rounded-lg p-4 space-y-3">
        <Skeleton className="h-5 w-32" />
        {Array.from({ length: rows }).map((_, i) => (
          <div key={i} className="flex items-center gap-3">
            <Skeleton className="h-10 w-10 rounded-full" />
            <div className="flex-1 space-y-1">
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
            </div>
            <Skeleton className="h-6 w-20" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div className="border rounded-lg p-4 space-y-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-24 w-full" />
      <div className="flex gap-2">
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
      </div>
    </div>
  );
}

export function SkeletonTable({ cols = 5, rows = 8 }: { cols?: number; rows?: number }) {
  return (
    <div className="border rounded-lg overflow-hidden">
      <div className="flex gap-4 p-3 border-b bg-muted/50">
        {Array.from({ length: cols }).map((_, i) => <Skeleton key={i} className="h-4 flex-1" />)}
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-4 p-3 border-b last:border-0">
          {Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className="h-4 flex-1" />)}
        </div>
      ))}
    </div>
  );
}
