/** Formatting for the Tiptop Shop UI (the legacy pages keep `vnd()` from ./api). */

const vndNumber = new Intl.NumberFormat('vi-VN');
const compact = new Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 });

/** "₫129.000", as on the design boards. */
export const shopPrice = (n: number): string => `₫${vndNumber.format(n)}`;

/** Hold end of an ON_HOLD order, e.g. "21/10, 21:41" (local time). */
export const holdTime = (iso: string): string =>
  new Date(iso).toLocaleString('en-GB', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

/** 2400 -> "2.4K". */
export const compactCount = (n: number): string => compact.format(n);
