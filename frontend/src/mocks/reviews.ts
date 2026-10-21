/*
 * Delete this folder when the backend provides these fields.
 * Mock ratings and reviews for the product page; the /demo API has no reviews.
 */

export interface MockReview {
  id: string;
  author: string;
  rating: number;
  variant: string;
  date: string;
  text: string;
  photos: number;
}

export interface MockReviewSummary {
  score: number;
  total: number;
  /** Count per star, index 0 = 5 stars ... index 4 = 1 star. */
  distribution: [number, number, number, number, number];
  reviews: MockReview[];
}

export const mockReviewSummary: MockReviewSummary = {
  score: 4.8,
  total: 1286,
  distribution: [1068, 154, 39, 13, 12],
  reviews: [
    { id: 'r1', author: 'Linh T.', rating: 5, variant: 'White / M', date: '2026-10-12', text: 'Soft fabric and true to size. Arrived in two days, well packed.', photos: 2 },
    { id: 'r2', author: 'Minh P.', rating: 5, variant: 'Black / M', date: '2026-10-09', text: 'Exactly like the pictures. I bought a second one for my brother.', photos: 1 },
    { id: 'r3', author: 'Hoa N.', rating: 4, variant: 'White / L', date: '2026-10-03', text: 'Good quality for the price. A little long for me but still nice.', photos: 0 },
    { id: 'r4', author: 'Quan D.', rating: 5, variant: 'White / M', date: '2026-09-28', text: 'Fast delivery and the seller answered my questions quickly.', photos: 3 },
  ],
};
