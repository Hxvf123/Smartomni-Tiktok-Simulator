import { useState, type FormEvent } from 'react';
import { useSearchParams } from 'react-router-dom';
import { MessageSquare, Send } from 'lucide-react';
import { Loaded, SellerCard } from '@/components/seller/SellerUi';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { getConversationMessages, listConversations, sendConversationMessage } from '@/lib/endpoints';
import type { ChatMessage, Conversation, DemoSession } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';
import { cn } from '@/lib/utils';

/** Plain-text seller chat with the polling and rules of src/features/chat.shared.tsx (role SELLER). */

const preview = (m: ChatMessage | null) => (m ? (m.text ?? `[${m.type}]`) : '');
const time = (iso: string) => new Date(iso).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });

function ConversationList({ items, current, onSelect }: { items: Conversation[]; current: string | undefined; onSelect: (id: string) => void }) {
  if (!items.length) return <p className="p-6 text-center text-sm text-muted-foreground">No conversations.</p>;
  return (
    <ul className="flex flex-col" aria-label="Conversations">
      {items.map((c) => (
        <li key={c.id}>
          <button
            type="button"
            aria-pressed={c.id === current}
            onClick={() => onSelect(c.id)}
            className={cn('flex w-full cursor-pointer items-center gap-3 border-l-2 px-4 py-3 text-left', c.id === current ? 'border-teal bg-teal-soft' : 'border-transparent hover:bg-surface-2')}
          >
            <Avatar className="size-9">
              <AvatarFallback className="bg-surface text-sm font-semibold">{c.buyerNickname.charAt(0).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="flex min-w-0 flex-1 flex-col">
              <span className="truncate text-sm font-semibold">{c.buyerNickname}</span>
              <span className="truncate text-xs text-muted-foreground">{preview(c.latest)}</span>
            </span>
            {c.unread > 0 ? <span className="rounded-full bg-teal px-2 py-0.5 text-[11px] font-semibold text-white">{c.unread} unread</span> : null}
          </button>
        </li>
      ))}
    </ul>
  );
}

function Thread({ seller, conversationId, onSent }: { seller: DemoSession; conversationId: string | undefined; onSent: () => void }) {
  const thread = useAsync(() => (conversationId ? getConversationMessages(seller, conversationId) : Promise.resolve(undefined)), [seller.sessionToken, conversationId], 3000);
  const [text, setText] = useState('');
  const [error, setError] = useState<string>();
  const [busy, setBusy] = useState(false);

  if (!conversationId) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 p-10 text-center text-sm text-muted-foreground">
        <MessageSquare className="size-8 text-muted-2" aria-hidden />
        Select a conversation
      </div>
    );
  }
  const canSendHere = thread.data?.conversation.canSendMessage !== false;
  const canSend = text.trim().length > 0 && !busy && canSendHere;
  const send = async (e: FormEvent) => {
    e.preventDefault();
    setError(undefined);
    setBusy(true);
    try {
      await sendConversationMessage(seller, conversationId, text);
      setText('');
      thread.reload();
      onSent();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-label="Chat thread" className="flex h-full min-h-[480px] flex-col">
      <header className="border-b border-line-soft px-5 py-3 font-semibold">{thread.data?.conversation.buyerNickname ?? <Skeleton className="h-5 w-32" />}</header>
      <div className="flex flex-1 flex-col gap-2 overflow-y-auto bg-surface-2 px-5 py-4">
        {thread.loading && !thread.data ? (
          <Skeleton className="h-10 w-2/3" />
        ) : thread.error && !thread.data ? (
          <Alert variant="destructive">
            <AlertDescription>{thread.error.message}</AlertDescription>
          </Alert>
        ) : thread.data?.items.length === 0 ? (
          <p className="m-auto text-sm text-muted-foreground">No messages yet.</p>
        ) : (
          <ol className="flex flex-col gap-2" aria-label="Messages">
            {thread.data?.items.map((m) => {
              const mine = m.role !== 'BUYER';
              return (
                <li key={m.id} className={cn('flex max-w-[75%] flex-col gap-0.5', mine ? 'self-end items-end' : 'self-start items-start')}>
                  <span className="text-[11px] text-muted-2">
                    {m.roleLabel} · {time(m.at)}
                  </span>
                  <span className={cn('rounded-2xl px-3.5 py-2 text-sm', mine ? 'rounded-br-sm bg-teal text-white' : 'rounded-bl-sm bg-white ring-1 ring-line-soft')}>
                    {m.supported ? m.text : <em>[unsupported message type {m.type}]</em>}
                  </span>
                </li>
              );
            })}
          </ol>
        )}
      </div>
      {!canSendHere ? (
        <p className="border-t border-line-soft bg-buyer-soft px-5 py-2 text-xs text-buyer-ink" role="note">
          The shop cannot send messages in this conversation (can_send_message = false).
        </p>
      ) : null}
      {error ? (
        <p className="px-5 pt-2 text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}
      <form onSubmit={send} className="flex items-center gap-2 border-t border-line-soft p-3">
        <Input aria-label="Message" placeholder="Type a text message" maxLength={2000} value={text} disabled={!canSendHere} onChange={(e) => setText(e.target.value)} className="h-10 rounded-full" />
        <Button type="submit" size="icon" aria-label="Send" disabled={!canSend} className="size-10">
          <Send />
        </Button>
      </form>
    </section>
  );
}

function Messages({ seller }: { seller: DemoSession }) {
  const [params, setParams] = useSearchParams();
  const unreadOnly = params.get('filter') === 'unread';
  const list = useAsync(() => listConversations(seller), [seller.sessionToken, seller.shopId], 4000);
  const [selected, setSelected] = useState<string>();

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      {list.data ? (
        <p className="text-sm text-muted-foreground" role="note">
          Supported message types: {list.data.supportedTypes.join(', ')}. Not simulated: {list.data.unsupported}.
        </p>
      ) : null}
      <SellerCard className="grid overflow-hidden md:grid-cols-[320px_minmax(0,1fr)]">
        <div className="border-b border-line-soft md:border-b-0 md:border-r">
          <label className="flex items-center gap-2 border-b border-line-soft px-4 py-3 text-sm">
            <Checkbox checked={unreadOnly} onCheckedChange={(v) => setParams(v === true ? { filter: 'unread' } : {}, { replace: true })} />
            Unread only
          </label>
          <Loaded result={list} what="conversations">
            {(d) => <ConversationList items={unreadOnly ? d.items.filter((c) => c.unread > 0) : d.items} current={selected} onSelect={setSelected} />}
          </Loaded>
        </div>
        <Thread seller={seller} conversationId={selected} onSent={list.reload} />
      </SellerCard>
    </div>
  );
}

export function SellerMessages() {
  const { seller } = useAuth();
  // the route is guarded by RequireRole SELLER
  return seller ? <Messages key={`${seller.sessionToken}:${seller.shopId}`} seller={seller} /> : null;
}
