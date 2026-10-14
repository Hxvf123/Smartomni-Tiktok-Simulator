import { useState } from 'react';
import { StatusPanel } from './console/StatusPanel';
import { ShopsPanel } from './console/ShopsPanel';
import { ResetPanel } from './console/ResetPanel';
import { ClockPanel } from './console/ClockPanel';
import { HttpLogPanel } from './console/HttpLogPanel';
import { WebhooksPanel } from './console/WebhooksPanel';
import { FaultsPanel } from './console/FaultsPanel';
import { TokensPanel } from './console/TokensPanel';
import { api } from '../lib/api';
import { useAsync } from '../lib/useAsync';
import type { ShopSummary } from './console/types';

const TABS = ['Status', 'Shop & scenario', 'Reset', 'Clock', 'HTTP log', 'Authorization', 'Webhooks', 'Faults'] as const;
type Tab = (typeof TABS)[number];

export function ConsolePage() {
  const [tab, setTab] = useState<Tab>('Status');
  const [shopId, setShopId] = useState<string>('');
  const shops = useAsync(() => api<{ items: ShopSummary[] }>('/test-admin/shops'), []);
  const list = shops.data?.items ?? [];
  const selected = shopId || list[0]?.id || '';

  return (
    <div>
      <div className="row">
        <h1>Test Console</h1>
        <label className="inline">
          Shop{' '}
          <select value={selected} onChange={(e) => setShopId(e.target.value)} disabled={list.length === 0} aria-label="Selected shop">
            {list.length === 0 ? <option value="">(no shops - seed first)</option> : null}
            {list.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t} role="tab" aria-selected={tab === t} className={tab === t ? 'active' : ''} onClick={() => setTab(t)}>
            {t}
          </button>
        ))}
      </div>
      <div className="panel">
        {tab === 'Status' && <StatusPanel onSeeded={shops.reload} />}
        {tab === 'Shop & scenario' && <ShopsPanel shops={shops} />}
        {tab === 'Reset' && <ResetPanel shops={list} defaultShopId={selected} onDone={shops.reload} />}
        {tab === 'Clock' && <ClockPanel />}
        {tab === 'HTTP log' && <HttpLogPanel shopId={selected} />}
        {tab === 'Authorization' && <TokensPanel shopId={selected} />}
        {tab === 'Webhooks' && <WebhooksPanel shopId={selected} />}
        {tab === 'Faults' && <FaultsPanel shopId={selected} />}
      </div>
    </div>
  );
}
