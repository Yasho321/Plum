/**
 * OWNER    : Tejas
 * TASK     : EmptyState + ErrorState primitives (shared empty/error/retry UI).
 * STATUS   : DONE
 */
import { AlertTriangle, RotateCw, Inbox } from 'lucide-react';
import { cn } from '../../lib/cn';
import { Button } from './Button';

export function EmptyState({ icon: Icon = Inbox, title, description, action, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12 gap-3', className)}>
      <div className="grid place-items-center w-11 h-11 rounded-xl bg-secondary text-muted-foreground">
        <Icon size={20} strokeWidth={2} aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-xs">{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function ErrorState({ title = 'Something went wrong', description, onRetry, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-6 py-12 gap-3', className)} role="alert">
      <div className="grid place-items-center w-11 h-11 rounded-xl bg-destructive/12 text-destructive border border-destructive/25">
        <AlertTriangle size={20} strokeWidth={2.1} aria-hidden />
      </div>
      <div className="space-y-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        {description && <p className="text-xs text-muted-foreground max-w-sm">{description}</p>}
      </div>
      {onRetry && (
        <Button variant="secondary" size="sm" onClick={onRetry}>
          <RotateCw size={13} /> Retry
        </Button>
      )}
    </div>
  );
}

export default EmptyState;
