/*
 * Delete this folder when the backend provides these fields.
 * Seller Center "Business overview": the /demo API has no analytics, so these numbers are invented.
 */

export interface MockMetric {
  label: string;
  value: number;
  format: 'currency' | 'count' | 'percent';
  /** Change against the previous 7 days, in percent. */
  changePct: number;
  /** Last 7 days, oldest first. */
  series: number[];
}

export const mockBusinessOverview: MockMetric[] = [
  { label: 'GMV', value: 48_650_000, format: 'currency', changePct: 12.4, series: [5.1, 6.0, 5.6, 7.2, 6.8, 8.4, 9.5] },
  { label: 'Orders', value: 312, format: 'count', changePct: 8.1, series: [38, 41, 37, 46, 44, 50, 56] },
  { label: 'Visitors', value: 9_840, format: 'count', changePct: -3.2, series: [1500, 1460, 1420, 1380, 1400, 1350, 1330] },
  { label: 'Conversion rate', value: 3.17, format: 'percent', changePct: 0.4, series: [2.9, 3.0, 3.1, 3.0, 3.2, 3.1, 3.2] },
];
