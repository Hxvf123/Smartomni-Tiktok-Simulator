import type { ReactNode } from 'react';

/**
 * Drop-in feature tabs. A phase adds `src/features/<name>.buyer.tsx`, `<name>.seller.tsx` and/or `<name>.console.tsx`
 * whose default export is a FeatureTab[]; Vite picks them up (no edit of the shared pages, so phases never conflict).
 */
export interface FeatureContext {
  token: string;
  shopId: string;
}
export interface FeatureTab {
  /** URL segment under /buyer, /seller (routes `<path>/*`). Console tabs use it as the tab key. */
  path: string;
  label: string;
  order: number;
  render: (ctx: FeatureContext) => ReactNode;
}
export interface ConsoleContext {
  shopId: string;
}
export interface ConsoleTab {
  path: string;
  label: string;
  order: number;
  render: (ctx: ConsoleContext) => ReactNode;
}

function collect<T extends { order: number }>(modules: Record<string, { default: T[] }>): T[] {
  return Object.values(modules)
    .flatMap((m) => m.default)
    .sort((a, b) => a.order - b.order);
}

export const buyerTabs = (): FeatureTab[] => collect<FeatureTab>(import.meta.glob('./*.buyer.tsx', { eager: true }));
export const sellerTabs = (): FeatureTab[] => collect<FeatureTab>(import.meta.glob('./*.seller.tsx', { eager: true }));
export const consoleTabs = (): ConsoleTab[] => collect<ConsoleTab>(import.meta.glob('./*.console.tsx', { eager: true }));
