/**
 * OWNER    : Tejas
 * TASK     : Badge / Pill primitive. Status tones always pair an icon with the label
 *            (never colour alone) per the brief + dataviz rules.
 * STATUS   : DONE
 */
import { cva } from 'class-variance-authority';
import { cn } from '../../lib/cn';

const badgeVariants = cva(
  'inline-flex items-center gap-1.5 rounded-full font-semibold whitespace-nowrap border',
  {
    variants: {
      tone: {
        neutral: 'bg-secondary text-muted-foreground border-border',
        brand: 'bg-primary/12 text-primary border-primary/25',
        accent: 'bg-accent/15 text-accent border-accent/30',
        success: 'bg-success/12 text-success border-success/25',
        warning: 'bg-warning/12 text-warning border-warning/25',
        danger: 'bg-destructive/12 text-destructive border-destructive/25',
      },
      size: {
        sm: 'px-2 py-0.5 text-[11px]',
        md: 'px-2.5 py-1 text-xs',
      },
    },
    defaultVariants: { tone: 'neutral', size: 'md' },
  }
);

export function Badge({ className, tone, size, icon: Icon, children, ...props }) {
  return (
    <span className={cn(badgeVariants({ tone, size }), className)} {...props}>
      {Icon && <Icon size={size === 'sm' ? 11 : 13} strokeWidth={2.4} aria-hidden />}
      {children}
    </span>
  );
}

export default Badge;
