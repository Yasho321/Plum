/**
 * OWNER    : Tejas
 * TASK     : Segmented control (tablist) — controlled, keyboard-navigable.
 * STATUS   : DONE
 */
import { useRef } from 'react';
import { cn } from '../../lib/cn';

/**
 * options: [{ value, label, icon? }]
 */
export function SegmentedControl({ options, value, onChange, size = 'md', className, ariaLabel }) {
  const ref = useRef(null);

  const onKeyDown = (e) => {
    const idx = options.findIndex((o) => o.value === value);
    if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
      e.preventDefault();
      onChange(options[(idx + 1) % options.length].value);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
      e.preventDefault();
      onChange(options[(idx - 1 + options.length) % options.length].value);
    }
  };

  const pad = size === 'sm' ? 'px-2.5 py-1 text-xs' : 'px-3.5 py-1.5 text-sm';

  return (
    <div
      ref={ref}
      role="tablist"
      aria-label={ariaLabel}
      onKeyDown={onKeyDown}
      className={cn('inline-flex items-center gap-1 rounded-[var(--radius)] bg-secondary p-1 border border-border', className)}
    >
      {options.map((o) => {
        const active = o.value === value;
        const Icon = o.icon;
        return (
          <button
            key={o.value}
            role="tab"
            type="button"
            aria-selected={active}
            tabIndex={active ? 0 : -1}
            onClick={() => onChange(o.value)}
            className={cn(
              'inline-flex items-center gap-1.5 rounded-[calc(var(--radius)-3px)] font-medium transition-colors duration-150',
              pad,
              active
                ? 'bg-card text-foreground shadow-[0_1px_0_0_rgba(255,255,255,0.04)_inset,0_6px_16px_-12px_rgba(0,0,0,0.8)]'
                : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {Icon && <Icon size={14} strokeWidth={2.2} aria-hidden />}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

export default SegmentedControl;
