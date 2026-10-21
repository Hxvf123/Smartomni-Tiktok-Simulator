/*
 * Delete this folder when the backend provides these fields.
 * Mock merchandising data (prices before discount, ratings, sold counts, free shipping, image tiles) and a
 * public catalog for guests, which the /demo API does not provide.
 */
import type { StorefrontProduct } from '@/lib/types';

/** Fields the Tiptop Shop design shows that the backend does not have yet. */
export interface MockProductFields {
  originalPriceVnd: number;
  /** 0 when there is no discount. */
  discountPct: number;
  rating: number;
  sold: number;
  freeShipping: boolean;
  trending: boolean;
  /** Background of the image tile when there is no real photo. */
  imageBg: string;
}

export type EnrichedProduct = StorefrontProduct & MockProductFields & { shopName?: string };

export const imageBackgrounds = ['#FDE2E4', '#E2ECE9', '#FFF1E6', '#DFE7FD', '#F0EFEB', '#E6F4F3', '#FAEDCB', '#E8E1F5'];

/** Price before discount, rounded up to 1,000 VND. */
export const originalPrice = (priceVnd: number, discountPct: number) =>
  discountPct > 0 ? Math.ceil(priceVnd / (1 - discountPct / 100) / 1000) * 1000 : priceVnd;

interface SeedEntry {
  id: string;
  title: string;
  description: string;
  shopName: string;
  skus: { name: string; priceVnd: number; stock: number }[];
  discountPct: number;
  rating: number;
  sold: number;
  freeShipping: boolean;
  trending?: boolean;
}

const entries: SeedEntry[] = [
  { id: 'mock-1', title: 'Oversized cotton tee', description: '100% cotton, relaxed fit, pre-washed.', shopName: 'Demo Shop VN', skus: [{ name: 'White / M', priceVnd: 129000, stock: 40 }, { name: 'White / L', priceVnd: 129000, stock: 0 }, { name: 'Black / M', priceVnd: 135000, stock: 12 }], discountPct: 35, rating: 4.8, sold: 2400, freeShipping: true, trending: true },
  { id: 'mock-2', title: 'Insulated water bottle 500ml', description: 'Keeps drinks cold for 24h and hot for 12h.', shopName: 'Demo Shop VN', skus: [{ name: 'Sage', priceVnd: 189000, stock: 25 }, { name: 'Sand', priceVnd: 189000, stock: 8 }], discountPct: 20, rating: 4.9, sold: 1300, freeShipping: true },
  { id: 'mock-3', title: 'Canvas tote bag', description: 'Heavy canvas with an inner pocket.', shopName: 'Demo Shop VN', skus: [{ name: 'Natural', priceVnd: 99000, stock: 60 }], discountPct: 15, rating: 4.7, sold: 870, freeShipping: false },
  { id: 'mock-4', title: 'Hand-painted ceramic mug', description: 'Each mug is painted by hand; colors vary slightly.', shopName: 'Demo Shop VN', skus: [{ name: 'Blue floral', priceVnd: 145000, stock: 14 }, { name: 'Red floral', priceVnd: 145000, stock: 0 }], discountPct: 25, rating: 4.8, sold: 640, freeShipping: true, trending: true },
  { id: 'mock-5', title: 'Hardcover notebook A5', description: '160 dotted pages, lay-flat binding.', shopName: 'Demo Shop VN', skus: [{ name: 'Dotted', priceVnd: 69000, stock: 100 }, { name: 'Lined', priceVnd: 69000, stock: 80 }], discountPct: 0, rating: 4.6, sold: 3100, freeShipping: false },
  { id: 'mock-6', title: 'Crackle-glaze flower vase', description: 'Stoneware vase, 18 cm tall.', shopName: 'Demo Shop VN', skus: [{ name: 'Ivory', priceVnd: 259000, stock: 6 }], discountPct: 10, rating: 4.9, sold: 210, freeShipping: true },
  { id: 'mock-7', title: 'Tea set for two', description: 'Teapot with two cups, porcelain.', shopName: 'Demo Shop VN', skus: [{ name: 'White', priceVnd: 349000, stock: 9 }, { name: 'Celadon', priceVnd: 369000, stock: 4 }], discountPct: 30, rating: 4.7, sold: 450, freeShipping: true },
  { id: 'mock-8', title: 'Wooden keychain', description: 'Laser-engraved beech wood.', shopName: 'Demo Shop VN', skus: [{ name: 'Heart', priceVnd: 39000, stock: 200 }, { name: 'Star', priceVnd: 39000, stock: 150 }], discountPct: 0, rating: 4.5, sold: 5200, freeShipping: false },
  { id: 'mock-9', title: 'Linen bucket hat', description: 'Breathable linen blend, one size.', shopName: 'Demo Shop VN', skus: [{ name: 'Beige', priceVnd: 159000, stock: 30 }, { name: 'Olive', priceVnd: 159000, stock: 0 }], discountPct: 20, rating: 4.8, sold: 980, freeShipping: true, trending: true },
  { id: 'mock-10', title: 'Minimal phone case', description: 'Matte finish, raised camera edge.', shopName: 'Demo Shop VN', skus: [{ name: 'iPhone 15', priceVnd: 119000, stock: 45 }, { name: 'iPhone 15 Pro', priceVnd: 119000, stock: 20 }], discountPct: 40, rating: 4.6, sold: 4100, freeShipping: true },
];

/** Public catalog shown to guests (no session, so the storefront API cannot be called). */
export const mockCatalog: EnrichedProduct[] = entries.map((e, i) => {
  const prices = e.skus.map((s) => s.priceVnd);
  const minPriceVnd = Math.min(...prices);
  return {
    id: e.id,
    title: e.title,
    description: e.description,
    imageUrl: '',
    minPriceVnd,
    maxPriceVnd: Math.max(...prices),
    skus: e.skus.map((s, j) => ({ id: `${e.id}-sku-${j + 1}`, name: s.name, attributeName: 'Variant', priceVnd: s.priceVnd, available: s.stock > 0, stock: s.stock })),
    shopName: e.shopName,
    originalPriceVnd: originalPrice(minPriceVnd, e.discountPct),
    discountPct: e.discountPct,
    rating: e.rating,
    sold: e.sold,
    freeShipping: e.freeShipping,
    trending: e.trending ?? false,
    imageBg: imageBackgrounds[i % imageBackgrounds.length],
  };
});

/** Mock fields for the products created by the backend seed (backend/src/seed/seed-data.ts), keyed by normalized title. */
export const seedProductMocks: Record<string, Omit<MockProductFields, 'originalPriceVnd'>> = {
  'ao thun cotton basic': { discountPct: 35, rating: 4.8, sold: 2400, freeShipping: true, trending: true, imageBg: '#FDE2E4' },
  'ao thun co tron': { discountPct: 20, rating: 4.7, sold: 1100, freeShipping: true, trending: false, imageBg: '#DFE7FD' },
  'basic tee': { discountPct: 15, rating: 4.6, sold: 760, freeShipping: false, trending: false, imageBg: '#F0EFEB' },
  'binh giu nhiet 500ml': { discountPct: 20, rating: 4.9, sold: 1300, freeShipping: true, trending: false, imageBg: '#E2ECE9' },
  'binh hoa men ran': { discountPct: 10, rating: 4.9, sold: 210, freeShipping: true, trending: false, imageBg: '#FAEDCB' },
  'bo am chen tra': { discountPct: 30, rating: 4.7, sold: 450, freeShipping: true, trending: true, imageBg: '#E6F4F3' },
  'coc su ve tay': { discountPct: 25, rating: 4.8, sold: 640, freeShipping: true, trending: true, imageBg: '#FFF1E6' },
  'tui tote canvas': { discountPct: 15, rating: 4.7, sold: 870, freeShipping: false, trending: false, imageBg: '#E8E1F5' },
};
