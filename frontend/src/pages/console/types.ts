export interface ShopSummary {
  id: string;
  tiktokShopId: string;
  name: string;
  region: string;
  currency: string;
  status: string;
  activeScenarioId: string | null;
  scenarios: { id: string; key: string; name: string; description: string }[];
  counts: { products: number; buyers: number; webhookJobs: number };
}

export interface WebhookAttempt {
  id: string;
  attemptNo: number;
  workerId: string;
  status: string;
  possibleDuplicate: boolean;
  lateCompletion: boolean;
  deliveries: number;
  httpStatus: number | null;
  error: string | null;
  startedAt: string;
  finishedAt: string | null;
}

export interface WebhookJob {
  id: string;
  shopId: string;
  topic: string;
  status: string;
  attemptCount: number;
  maxAttempts: number;
  nextAttemptAt: string;
  requestId: string | null;
  replayOfId: string | null;
  lastError: string | null;
  createdAt: string;
  attempts: WebhookAttempt[];
}

export interface HttpLog {
  id: string;
  requestId: string;
  router: string;
  method: string;
  path: string;
  query: unknown;
  requestHeaders: unknown;
  requestBody: string | null;
  responseStatus: number;
  responseHeaders: unknown;
  responseBody: string | null;
  durationMs: number;
  createdAt: string;
}
