import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { BuyerAftersale } from '../features/aftersale.buyer';
import { SellerAftersale } from '../features/aftersale.seller';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const request = {
  id: 'R1', orderId: 'O1', kind: 'RETURN', type: 'REFUND', status: 'RETURN_OR_REFUND_REQUEST_PENDING', reason: 'DAMAGED_ITEM', rejectReason: null, returnTrackingNumber: null,
  buyer: { name: 'An' }, refund: { subtotalVnd: 99000, shippingVnd: 0, totalVnd: 99000 }, updatedAt: '2030-01-01T00:00:00Z', items: [{ skuId: 'S1', productName: 'Bag', skuName: 'Natural', quantity: 1 }],
};
const lists = { items: [request], requestReasons: ['DAMAGED_ITEM', 'OTHER'], rejectReasons: [{ name: 'ITEM_AS_DESCRIBED', text: 'As described' }, { name: 'OTHER', text: 'Other' }] };

describe('aftersale UI', () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal('fetch', vi.fn(async (url: string, init?: RequestInit) => {
      calls.push({ url, method: init?.method ?? 'GET', body: init?.body ? JSON.parse(String(init.body)) : undefined });
      if (url.endsWith('/orders')) return json({ items: [{ id: 'O1', status: 'DELIVERED', items: [{ skuId: 'S1', productName: 'Bag', skuName: 'Natural', quantity: 3 }] }, { id: 'O2', status: 'ON_HOLD', items: [] }] });
      if ((init?.method ?? 'GET') === 'GET') return json(lists);
      return json({ request });
    }));
  });
  afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

  it('offers only delivered orders and sends the chosen units, type and reason', async () => {
    render(<BuyerAftersale shopId="shop" token="tok" />);
    const order = (await screen.findByLabelText('return order')) as HTMLSelectElement;
    expect(Array.from(order.options).map((o) => o.value)).toEqual(['', 'O1']); // ON_HOLD order is not offered
    fireEvent.change(order, { target: { value: 'O1' } });
    fireEvent.change(screen.getByLabelText('return item'), { target: { value: 'S1' } });
    fireEvent.change(screen.getByLabelText('return units'), { target: { value: '2' } });
    fireEvent.change(screen.getByLabelText('return type'), { target: { value: 'RETURN_AND_REFUND' } });
    fireEvent.click(screen.getByText('Submit request'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/demo/shops/shop/aftersale/returns');
    expect(post.body).toEqual({ orderId: 'O1', items: [{ skuId: 'S1', quantity: 2 }], returnType: 'RETURN_AND_REFUND', reason: 'DAMAGED_ITEM' });
  });

  it('seller rejects with the selected reason and shows API errors instead of success', async () => {
    render(<SellerAftersale shopId="shop" token="tok" />);
    fireEvent.change(await screen.findByLabelText('reject reason R1'), { target: { value: 'OTHER' } });
    fireEvent.click(screen.getByText('Reject'));
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    expect(calls.find((c) => c.method === 'POST')).toMatchObject({ url: '/demo/shops/shop/aftersale/R1/reject', body: { reason: 'OTHER' } });
    (fetch as unknown as ReturnType<typeof vi.fn>).mockImplementation(async (_u: string, init?: RequestInit) => ((init?.method ?? 'GET') === 'GET' ? json(lists) : json({ message: 'the request is REFUND_OR_RETURN_REQUEST_REJECT' }, 400)));
    fireEvent.click(screen.getByText('Approve'));
    expect((await screen.findByRole('alert')).textContent).toContain('REFUND_OR_RETURN_REQUEST_REJECT');
  });
});
