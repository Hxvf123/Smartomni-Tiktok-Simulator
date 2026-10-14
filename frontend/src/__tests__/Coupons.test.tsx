import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CouponCodeInput } from '../components/CouponCodeInput';
import { SellerCoupons } from '../features/coupons.seller';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('Seller coupons', () => {
  const calls: { url: string; method: string; body?: Record<string, unknown> }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if ((init?.method ?? 'GET') === 'GET') return json({ items: [] });
        return json({});
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('only enables Create for a valid code and amount, and posts the discount in the API shape', async () => {
    render(<SellerCoupons shopId="shop" token="tok" />);
    await screen.findByText(/No coupons yet/);
    const create = screen.getByText('Create coupon') as HTMLButtonElement;
    expect(create.disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('coupon title'), { target: { value: 'Spring' } });
    fireEvent.change(screen.getByLabelText('coupon promo code'), { target: { value: 'ab' } });
    fireEvent.change(screen.getByLabelText('discount value'), { target: { value: '20000' } });
    expect(create.disabled).toBe(true); // code too short
    fireEvent.change(screen.getByLabelText('coupon promo code'), { target: { value: 'spring10' } });
    expect(create.disabled).toBe(false);
    fireEvent.click(create);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/demo/shops/shop/coupons');
    expect(post.body).toMatchObject({ title: 'Spring', promoCode: 'SPRING10', discount: { type: 'AMOUNT_OFF', amountVnd: 20000 }, audience: 'ALL' });
  });

  it('rejects a percentage above 100 in the form', async () => {
    render(<SellerCoupons shopId="shop" token="tok" />);
    await screen.findByText(/No coupons yet/);
    fireEvent.change(screen.getByLabelText('coupon title'), { target: { value: 'Big' } });
    fireEvent.change(screen.getByLabelText('coupon promo code'), { target: { value: 'BIGPERCENT' } });
    fireEvent.change(screen.getByLabelText('discount type'), { target: { value: 'PERCENT_OFF' } });
    fireEvent.change(screen.getByLabelText('discount value'), { target: { value: '150' } });
    expect((screen.getByText('Create coupon') as HTMLButtonElement).disabled).toBe(true);
    fireEvent.change(screen.getByLabelText('discount value'), { target: { value: '15' } });
    expect((screen.getByText('Create coupon') as HTMLButtonElement).disabled).toBe(false);
  });
});

describe('CouponCodeInput', () => {
  it('keeps only upper-case letters and digits', () => {
    const onChange = vi.fn();
    render(<CouponCodeInput value="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('coupon code'), { target: { value: 'ab-12 c' } });
    expect(onChange).toHaveBeenCalledWith('AB12C');
    cleanup();
  });
});
