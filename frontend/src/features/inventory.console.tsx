import { AsyncState } from '../components/AsyncState';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import { InventoryHistoryView, type InventoryHistory } from './inventory.seller';
import type { ConsoleTab } from './registry';

export function InventoryPanel({ shopId }: { shopId: string }) {
  const history = useAsync(() => api<InventoryHistory>(`/test-admin/inventory/history?shopId=${encodeURIComponent(shopId)}&limit=100`), [shopId], 5000);
  return (
    <div>
      <p className="muted">
        Create TIMEOUT_BEFORE_WRITE / TIMEOUT_AFTER_WRITE / APP_ERROR_200 rules on the Faults tab (target API, path match <code>/product/202309/products/</code>) to see how a client behaves when the answer is lost or an HTTP 200 carries an application error.
      </p>
      <AsyncState {...history} onRetry={history.reload}>
        {(d) => <InventoryHistoryView data={d} />}
      </AsyncState>
    </div>
  );
}

const tabs: ConsoleTab[] = [{ path: 'inventory', label: 'Inventory', order: 30, render: (c) => <InventoryPanel {...c} /> }];
export default tabs;
