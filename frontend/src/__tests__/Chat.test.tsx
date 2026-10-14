import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ChatWorkspace } from '../features/chat.shared';

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
const msg = (id: string, role: string, text: string | null, type = 'TEXT') => ({ id, index: 1, type, role, roleLabel: role, nickname: 'n', at: '2026-10-14T00:00:00Z', text, supported: type === 'TEXT', visible: true });
const summary = { id: 'c1', buyerNickname: 'Buyer A', agentJoined: false, canSendMessage: true, unread: 1, latest: null };

describe('ChatWorkspace', () => {
  const calls: { url: string; method: string; body?: unknown }[] = [];
  beforeEach(() => {
    calls.length = 0;
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        const method = init?.method ?? 'GET';
        calls.push({ url, method, body: init?.body ? JSON.parse(String(init.body)) : undefined });
        if (method === 'POST') return json({ message: msg('m9', 'BUYER', 'hi') }, 201);
        if (url.endsWith('/messages')) return json({ conversation: summary, items: [msg('m1', 'BUYER', 'Hello shop'), msg('m2', 'SYSTEM', null, 'IMAGE')] });
        return json({ supportedTypes: ['TEXT'], unsupported: 'IMAGE, VIDEO', items: [summary] });
      }),
    );
  });
  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it('shows the supported/unsupported types and labels an unsupported message instead of rendering it as text', async () => {
    render(<ChatWorkspace shopId="s" token="t" role="BUYER" />);
    expect(await screen.findByText(/Hello shop/)).toBeTruthy();
    expect(screen.getByRole('note').textContent).toContain('Supported message types: TEXT');
    expect(screen.getByText('[unsupported message type IMAGE]')).toBeTruthy();
  });

  it('a buyer sends plain text to the conversation; empty text cannot be sent', async () => {
    render(<ChatWorkspace shopId="s" token="t" role="BUYER" />);
    const input = (await screen.findByLabelText('message')) as HTMLInputElement;
    const send = screen.getByText('Send') as HTMLButtonElement;
    expect(send.disabled).toBe(true);
    fireEvent.change(input, { target: { value: 'Xin chào' } });
    fireEvent.click(send);
    await waitFor(() => expect(calls.some((c) => c.method === 'POST')).toBe(true));
    const post = calls.find((c) => c.method === 'POST')!;
    expect(post.url).toBe('/demo/shops/s/chat/conversations/c1/messages');
    expect(post.body).toEqual({ text: 'Xin chào' });
  });

  it('the seller picks a conversation before replying', async () => {
    render(<ChatWorkspace shopId="s" token="t" role="SELLER" />);
    expect(await screen.findByText('Select a conversation')).toBeTruthy();
    expect(screen.queryByLabelText('message')).toBeNull();
    fireEvent.click(await screen.findByText('Buyer A'));
    expect(await screen.findByLabelText('message')).toBeTruthy();
  });
});
