import { cn } from '@/lib/utils';
import type { TextareaHTMLAttributes } from 'react';

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        'flex min-h-28 w-full rounded-md border border-line bg-card px-3 py-2 text-sm outline-none focus:border-accent',
        className,
      )}
      {...props}
    />
  );
}
