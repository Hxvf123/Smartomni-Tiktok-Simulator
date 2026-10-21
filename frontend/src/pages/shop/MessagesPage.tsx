import { ChatThread } from '@/components/ChatThread';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { useAuth } from '@/lib/auth';
import { listConversations } from '@/lib/endpoints';
import type { DemoSession } from '@/lib/types';
import { useAsync } from '@/lib/useAsync';

/** Buyer chat with the shop of the session (one conversation per buyer and shop, as in the former /buyer/chat). */
function Messages({ buyer }: { buyer: DemoSession }) {
  const list = useAsync(() => listConversations(buyer), [buyer.sessionToken], 4000);
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-4">
      <h1 className="text-2xl font-bold">Messages</h1>
      {list.data ? (
        <p className="text-sm text-muted-foreground" role="note">
          Supported message types: {list.data.supportedTypes.join(', ')}. Not simulated: {list.data.unsupported}.
        </p>
      ) : null}
      <div className="overflow-hidden rounded-card bg-white shadow-xs ring-1 ring-line-soft">
        {list.loading && !list.data ? (
          <Skeleton className="m-5 h-40" />
        ) : list.error && !list.data ? (
          <Alert variant="destructive" className="m-5 w-auto">
            <AlertDescription>Could not load messages: {list.error.message}</AlertDescription>
          </Alert>
        ) : (
          <ChatThread session={buyer} conversationId={list.data?.items[0]?.id} onSent={list.reload} />
        )}
      </div>
    </div>
  );
}

export function MessagesPage() {
  const { buyer } = useAuth();
  // the route is guarded by RequireRole BUYER
  return buyer ? <Messages key={buyer.sessionToken} buyer={buyer} /> : null;
}
