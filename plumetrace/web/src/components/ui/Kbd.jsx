/**
 * OWNER    : Tejas
 * TASK     : Keyboard-key hint primitive.
 * STATUS   : DONE
 */
import { cn } from '../../lib/cn';

export function Kbd({ children, className }) {
  return (
    <kbd
      className={cn(
        'inline-flex items-center justify-center min-w-[1.4rem] h-5 px-1.5 rounded border border-border',
        'bg-secondary text-[10px] font-semibold text-muted-foreground font-sans',
        className
      )}
    >
      {children}
    </kbd>
  );
}

export default Kbd;
