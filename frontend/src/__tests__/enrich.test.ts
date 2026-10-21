import { describe, expect, it } from 'vitest';
import type { StorefrontProduct } from '@/lib/types';
import { enrichProduct, mockCatalog, normalizeTitle } from '@/mocks';

const product = (id: string, title: string, priceVnd = 100000): StorefrontProduct => ({
  id,
  title,
  description: '',
  imageUrl: '/demo/media/products/x.svg',
  minPriceVnd: priceVnd,
  maxPriceVnd: priceVnd,
  skus: [{ id: `${id}-s`, name: 'M', attributeName: 'Size', priceVnd, available: true, stock: 3 }],
});

describe('enrichProduct', () => {
  it('matches a mock catalog entry by product id', () => {
    const mock = mockCatalog[0];
    const p = enrichProduct(product(mock.id, 'Some real title'));
    expect(p.rating).toBe(mock.rating);
    expect(p.sold).toBe(mock.sold);
    expect(p.discountPct).toBe(mock.discountPct);
  });

  it('matches a seeded product by title, ignoring case and Vietnamese diacritics', () => {
    expect(normalizeTitle('  Bình  giữ nhiệt 500ml ')).toBe('binh giu nhiet 500ml');
    const p = enrichProduct(product('7500000000000099', 'BÌNH GIỮ NHIỆT 500ML'));
    expect(p.rating).toBe(4.9);
    expect(p.sold).toBe(1300);
    expect(p.freeShipping).toBe(true);
    expect(p.category).toBe('sports-outdoor');
  });

  it('gives unknown products stable values derived from their id', () => {
    const a = enrichProduct(product('7500000000000123', 'Unknown thing'));
    const b = enrichProduct(product('7500000000000123', 'Renamed thing'));
    expect(a).toMatchObject({ rating: b.rating, sold: b.sold, discountPct: b.discountPct, imageBg: b.imageBg });
    expect(a.rating).toBeGreaterThanOrEqual(4.5);
    expect(a.rating).toBeLessThanOrEqual(4.9);
  });

  it('never overwrites real data and derives the original price from the real price', () => {
    const real = product('7500000000000077', 'Cốc sứ vẽ tay', 150000);
    const p = enrichProduct(real);
    expect(p.title).toBe(real.title);
    expect(p.minPriceVnd).toBe(150000);
    expect(p.skus).toEqual(real.skus);
    expect(p.imageUrl).toBe(real.imageUrl);
    expect(p.discountPct).toBe(25);
    expect(p.originalPriceVnd).toBe(200000);
  });
});
