import type { ReactNode } from 'react';
import { ApiError } from '../lib/api';

interface Props<T> {
  data: T | undefined;
  loading: boolean;
  error: Error | undefined;
  /** Return true when the loaded data should render the empty state. */
  isEmpty?: (data: T) => boolean;
  emptyText?: string;
  onRetry?: () => void;
  children: (data: T) => ReactNode;
}

/** One consistent loading / error / empty treatment for every list and panel. */
export function AsyncState<T>({ data, loading, error, isEmpty, emptyText = 'Nothing here yet.', onRetry, children }: Props<T>) {
  if (loading && data === undefined) return <div className="state state-loading" role="status">Loading...</div>;
  if (error && data === undefined) {
    return (
      <div className="state state-error" role="alert">
        <strong>Something went wrong.</strong> {error.message}
        {error instanceof ApiError && error.requestId ? <div className="muted">request id: {error.requestId}</div> : null}
        {onRetry ? <button onClick={onRetry}>Retry</button> : null}
      </div>
    );
  }
  if (data === undefined) return null;
  if (isEmpty?.(data)) return <div className="state state-empty">{emptyText}</div>;
  return <>{children(data)}</>;
}
