import { cn } from '@/lib/utils';
import type { InputHTMLAttributes } from 'react';

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        'flex h-10 w-full rounded-md border border-line bg-card px-3 text-sm outline-none focus:border-accent',
        className,
      )}
      {...props}
    />
  );
}
