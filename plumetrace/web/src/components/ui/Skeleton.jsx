/**
 * OWNER    : Tejas
 * TASK     : Skeleton primitive — shaped like the content it stands in for.
 * STATUS   : DONE
 */
import { cn } from '../../lib/cn';

export function Skeleton({ className, ...props }) {
  return <div className={cn('pt-skeleton', className)} {...props} />;
}

/** Repeated skeleton rows for a table/list body. */
export function SkeletonRows({ rows = 5, className, rowClassName }) {
  return (
    <div className={className}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className={cn('px-4 py-3.5', rowClassName)}>
          <Skeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export default Skeleton;
