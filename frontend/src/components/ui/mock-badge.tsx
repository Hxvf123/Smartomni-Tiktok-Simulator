import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface Props {
  /** When given, wraps the content in the dashed "mock data" frame; otherwise renders only the label. */
  children?: ReactNode;
  className?: string;
}

const label = 'MOCK';

/** Marks UI driven by src/mocks/ (data the backend does not provide yet). */
export function MockBadge({ children, className }: Props) {
  if (children === undefined) {
    return (
      <span
        className={cn(
          'inline-flex items-center rounded-full border-2 border-dashed border-[#FE2C55] bg-buyer-soft px-2 py-px font-mono text-[10px] font-semibold tracking-wider text-buyer-ink',
          className,
        )}
      >
        {label}
      </span>
    );
  }
  return (
    <div data-mock="" className={cn('relative rounded-card border-2 border-dashed border-[#FE2C55] bg-buyer-soft', className)}>
      <span className="absolute -top-2.5 right-3 rounded-full bg-buyer-soft px-1.5 font-mono text-[10px] font-semibold tracking-wider text-buyer-ink">
        {label}
      </span>
      {children}
    </div>
  );
}
