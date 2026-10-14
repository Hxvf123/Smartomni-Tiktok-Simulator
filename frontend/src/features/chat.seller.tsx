import { ChatWorkspace } from './chat.shared';
import type { FeatureTab } from './registry';

const tabs: FeatureTab[] = [{ path: 'chat', label: 'Chat', order: 80, render: (c) => <ChatWorkspace {...c} role="SELLER" /> }];
export default tabs;
