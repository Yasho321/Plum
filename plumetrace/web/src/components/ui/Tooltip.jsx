/**
 * OWNER    : Tejas
 * TASK     : Tooltip primitive (Radix) with app styling + Kbd hint support.
 * STATUS   : DONE
 */
import * as RadixTooltip from '@radix-ui/react-tooltip';
import { cn } from '../../lib/cn';

export function TooltipProvider({ children, delayDuration = 200 }) {
  return <RadixTooltip.Provider delayDuration={delayDuration}>{children}</RadixTooltip.Provider>;
}

export function Tooltip({ content, children, side = 'top', align = 'center', className }) {
  if (!content) return children;
  return (
    <RadixTooltip.Root>
      <RadixTooltip.Trigger asChild>{children}</RadixTooltip.Trigger>
      <RadixTooltip.Portal>
        <RadixTooltip.Content
          side={side}
          align={align}
          sideOffset={6}
          className={cn(
            'z-50 max-w-xs rounded-[var(--radius-sm)] bg-popover text-popover-foreground px-2.5 py-1.5 text-xs',
            'border border-border shadow-xl pt-fade',
            className
          )}
        >
          {content}
          <RadixTooltip.Arrow className="fill-popover" />
        </RadixTooltip.Content>
      </RadixTooltip.Portal>
    </RadixTooltip.Root>
  );
}

export default Tooltip;
