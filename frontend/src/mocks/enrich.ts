/*
 * Delete this folder when the backend provides these fields.
 * Merges mock merchandising fields into a real storefront product. Real data (title, prices, SKUs, stock)
 * is never overwritten.
 */
import type { StorefrontProduct } from '@/lib/types';
import { imageBackgrounds, mockCatalog, originalPrice, seedProductMocks, type EnrichedProduct, type MockProductFields } from './catalog';

/** Lowercase, no Vietnamese diacritics, single spaces: "Bình giữ nhiệt 500ml" -> "binh giu nhiet 500ml". */
export function normalizeTitle(title: string): string {
  return title
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) >>> 0;
  return h;
}

/** Stable pseudo-random values per product id, so the same product always shows the same numbers. */
function fallback(id: string): Omit<MockProductFields, 'originalPriceVnd'> {
  const h = hash(id);
  return {
    discountPct: [0, 10, 15, 20, 25, 35][h % 6],
    rating: (45 + ((h >>> 3) % 5)) / 10,
    sold: 50 + ((h >>> 6) % 40) * 50,
    freeShipping: (h >>> 11) % 3 !== 0,
    trending: (h >>> 13) % 5 === 0,
    imageBg: imageBackgrounds[(h >>> 16) % imageBackgrounds.length],
  };
}

export function enrichProduct(p: StorefrontProduct): EnrichedProduct {
  const byId = mockCatalog.find((m) => m.id === p.id);
  const mock = byId ?? seedProductMocks[normalizeTitle(p.title)] ?? fallback(p.id);
  return {
    ...p,
    discountPct: mock.discountPct,
    rating: mock.rating,
    sold: mock.sold,
    freeShipping: mock.freeShipping,
    trending: mock.trending,
    imageBg: mock.imageBg,
    originalPriceVnd: originalPrice(p.minPriceVnd, mock.discountPct),
  };
}
