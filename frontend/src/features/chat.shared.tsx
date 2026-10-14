import { useState } from 'react';
import { AsyncState } from '../components/AsyncState';
import { ApiError, api } from '../lib/api';
import { useAsync } from '../lib/useAsync';

export interface ChatMsg {
  id: string;
  index: number;
  type: string;
  role: string;
  roleLabel: string;
  nickname: string;
  at: string;
  text: string | null;
  supported: boolean;
}
export interface ChatSummary {
  id: string;
  buyerNickname: string;
  agentJoined: boolean;
  canSendMessage: boolean;
  unread: number;
  latest: ChatMsg | null;
}
interface ConversationsResponse {
  supportedTypes: string[];
  unsupported: string;
  items: ChatSummary[];
}

const errText = (e: unknown): string => (e instanceof ApiError || e instanceof Error ? e.message : String(e));

/** Plain-text chat. Unsupported message types (images, cards) are listed explicitly instead of being faked. */
export function ChatWorkspace({ shopId, token, role }: { shopId: string; token: string; role: 'BUYER' | 'SELLER' }) {
  const list = useAsync(() => api<ConversationsResponse>(`/demo/shops/${shopId}/chat/conversations`, { demoSession: token }), [shopId, token], 4000);
  const [selected, setSelected] = useState<string>();
  const items = list.data?.items ?? [];
  const current = selected ?? (role === 'BUYER' ? items[0]?.id : undefined);
  return (
    <div>
      {list.data ? (
        <p className="muted" role="note">
          Supported message types: {list.data.supportedTypes.join(', ')}. Not simulated: {list.data.unsupported}.
        </p>
      ) : null}
      <div className="grid">
        {role === 'SELLER' ? (
          <section className="card" aria-label="conversations">
            <h3>Conversations</h3>
            <AsyncState {...list} onRetry={list.reload} isEmpty={(d) => d.items.length === 0} emptyText="No conversations yet.">
              {(d) => (
                <ul className="list">
                  {d.items.map((c) => (
                    <li key={c.id}>
                      <button className={c.id === current ? 'active' : ''} aria-pressed={c.id === current} onClick={() => setSelected(c.id)}>
                        {c.buyerNickname}
                        {c.unread > 0 ? <span className="pill warn">{c.unread} unread</span> : null}
                      </button>
                      <span className="muted">{c.latest?.text ?? (c.latest ? `[${c.latest.type}]` : '')}</span>
                    </li>
                  ))}
                </ul>
              )}
            </AsyncState>
          </section>
        ) : null}
        <Thread shopId={shopId} token={token} role={role} conversationId={current} onSent={list.reload} />
      </div>
    </div>
  );
}

function Thread({ shopId, token, role, conversationId, onSent }: { shopId: string; token: string; role: 'BUYER' | 'SELLER'; conversationId?: string; onSent: () => void }) {
  const thread = useAsync(
    () => (conversationId ? api<{ conversation: ChatSummary; items: ChatMsg[] }>(`/demo/shops/${shopId}/chat/conversations/${conversationId}/messages`, { demoSession: token }) : Promise.resolve(undefined)),
    [shopId, token, conversationId],
    3000,
  );
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function send() {
    setError(undefined);
    setBusy(true);
    try {
      const path = conversationId ? `/demo/shops/${shopId}/chat/conversations/${conversationId}/messages` : `/demo/shops/${shopId}/chat/messages`;
      await api(path, { method: 'POST', body: { text }, demoSession: token });
      setText('');
      thread.reload();
      onSent();
    } catch (e) {
      setError(errText(e));
    } finally {
      setBusy(false);
    }
  }
  const canSend = text.trim().length > 0 && !busy && (role === 'BUYER' || (conversationId && thread.data?.conversation.canSendMessage !== false));

  return (
    <section className="card" aria-label="chat thread">
      <h3>{role === 'BUYER' ? 'Chat with the shop' : (thread.data?.conversation.buyerNickname ?? 'Select a conversation')}</h3>
      {conversationId && thread.data ? (
        thread.data.items.length === 0 ? <div className="state state-empty">No messages yet.</div> : (
          <ul className="list" aria-label="messages">
            {thread.data.items.map((m) => (
              <li key={m.id}>
                <span><strong>{m.roleLabel}</strong>: {m.supported ? m.text : <em>[unsupported message type {m.type}]</em>}</span>
                <span className="muted">{new Date(m.at).toLocaleTimeString()}</span>
              </li>
            ))}
          </ul>
        )
      ) : role === 'BUYER' && !conversationId ? <div className="state state-empty">Say hello to start a conversation.</div> : null}
      {thread.data && thread.data.conversation.canSendMessage === false ? <div className="state state-error">The shop cannot send messages in this conversation (can_send_message = false).</div> : null}
      {error ? <div className="state state-error" role="alert">{error}</div> : null}
      {role === 'BUYER' || conversationId ? (
        <form className="row-wrap" onSubmit={(e) => { e.preventDefault(); void send(); }}>
          <input aria-label="message" placeholder="Type a text message" maxLength={2000} value={text} onChange={(e) => setText(e.target.value)} />
          <button type="submit" disabled={!canSend}>Send</button>
        </form>
      ) : null}
    </section>
  );
}
