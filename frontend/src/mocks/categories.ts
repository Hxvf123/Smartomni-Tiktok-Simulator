/*
 * Delete this folder when the backend provides these fields.
 * Product categories for the Home "Categories" row: the /demo API has no categories, so products get one
 * through catalog.ts (mock catalog and seeded titles).
 */

export interface MockCategory {
  slug: string;
  name: string;
  /** Background of the round tile. */
  bg: string;
  /** Optional picture (e.g. /categories/shoes.png in frontend/public); an icon is shown while it is empty. */
  image?: string;
}

export const mockCategories: MockCategory[] = [
  { slug: 'womenswear', name: 'Womenswear & Underwear', bg: '#F4EFEA' },
  { slug: 'phones-electronics', name: 'Phones & Electronics', bg: '#EEF1F5' },
  { slug: 'fashion-accessories', name: 'Fashion Accessories', bg: '#F5EFE6' },
  { slug: 'menswear', name: 'Menswear & Underwear', bg: '#EFF0F2' },
  { slug: 'home-supplies', name: 'Home Supplies', bg: '#EAF2F8' },
  { slug: 'beauty', name: 'Beauty & Personal Care', bg: '#F7EEF0' },
  { slug: 'shoes', name: 'Shoes', bg: '#F1F1F2' },
  { slug: 'sports-outdoor', name: 'Sports & Outdoor', bg: '#EAF3EE' },
  { slug: 'luggage-bags', name: 'Luggage & Bags', bg: '#F1F0EE' },
  { slug: 'kitchenware', name: 'Kitchenware', bg: '#F6F1E7' },
];

export const categoryBySlug = (slug: string | null | undefined) => mockCategories.find((c) => c.slug === slug);
