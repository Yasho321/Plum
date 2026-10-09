/**
 * OWNER    : Tejas
 * TASK     : class-name merge helper (clsx + tailwind-merge) for ui primitives.
 * STATUS   : DONE
 */
import { clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}
