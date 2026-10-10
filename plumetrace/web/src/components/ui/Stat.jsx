/**
 * OWNER    : Tejas
 * TASK     : Stat tile — label, large tabular hero number (optionally tweened +
 *            coloured by meaning), range/subtext, loading skeleton.
 * STATUS   : DONE
 */
import { useEffect, useRef, useState } from 'react';
import { cn } from '../../lib/cn';

const prefersReduced = () =>
  typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

/** Smoothly tweens a number on mount / change. Respects reduced-motion. */
export function useCountUp(target, { duration = 650 } = {}) {
  const [val, setVal] = useState(target ?? 0);
  const fromRef = useRef(target ?? 0);
  useEffect(() => {
    if (target == null || prefersReduced()) { setVal(target); return; }
    const from = fromRef.current ?? 0;
    const to = target;
    const start = performance.now();
    let raf;
    const tick = (now) => {
      const t = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - t, 3);
      setVal(from + (to - from) * eased);
      if (t < 1) raf = requestAnimationFrame(tick);
      else fromRef.current = to;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return val;
}

export function Stat({
  label,
  icon: Icon,
  value,
  unit,
  sub,
  tone,
  valueColor,
  loading = false,
  animate = false,
  className,
}) {
  const numeric = typeof value === 'number';
  const tweened = useCountUp(animate && numeric ? value : null);
  const display = animate && numeric ? Math.round(tweened) : value;

  return (
    <div className={cn('pt-card p-4', className)}>
      <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
        {Icon && <Icon size={13} strokeWidth={2.2} aria-hidden />}
        {label}
      </div>
      {loading ? (
        <div className="pt-skeleton h-8 w-20 mt-2.5" />
      ) : (
        <div className="mt-1.5 flex items-baseline gap-1.5">
          <span
            className={cn('text-[26px] font-extrabold leading-none tracking-tight tnum', tone)}
            style={valueColor ? { color: valueColor } : undefined}
          >
            {display ?? '—'}
          </span>
          {unit && <span className="text-xs text-muted-foreground">{unit}</span>}
        </div>
      )}
      {!loading && sub && <div className="text-[11px] text-muted-foreground mt-1 tnum">{sub}</div>}
    </div>
  );
}

export default Stat;
