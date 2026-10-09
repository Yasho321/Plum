/**
 * OWNER    : Tejas
 * TASK     : Semantic table primitives with consistent styling + tabular figures.
 * STATUS   : DONE
 */
import { cn } from '../../lib/cn';

export function Table({ className, ...props }) {
  return (
    <div className="w-full overflow-x-auto">
      <table className={cn('w-full text-sm border-collapse', className)} {...props} />
    </div>
  );
}

export function THead({ className, ...props }) {
  return (
    <thead
      className={cn(
        'text-[11px] uppercase tracking-wide text-muted-foreground [&_th]:font-medium [&_th]:text-left [&_th]:px-3 [&_th]:py-2.5',
        className
      )}
      {...props}
    />
  );
}

export function TBody({ className, ...props }) {
  return <tbody className={cn('[&_td]:px-3 [&_td]:py-2.5 [&_tr]:border-b [&_tr]:border-border/50 [&_tr:last-child]:border-0', className)} {...props} />;
}

export function Tr({ className, ...props }) {
  return <tr className={cn('transition-colors hover:bg-secondary/40', className)} {...props} />;
}

export default Table;
