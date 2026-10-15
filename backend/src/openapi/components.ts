import { Json, arr, int, obj, str } from './helpers';

export const securitySchemes: Json = {
  TiktokSignedApi: {
    type: 'apiKey',
    in: 'header',
    name: 'x-tts-access-token',
    description:
      'TikTok-shaped shop API. Send the access token in `x-tts-access-token` AND the query params `app_key`, `timestamp` (Unix seconds) and `sign` (HMAC over path + sorted query + raw body, see contracts/signing). `shop_cipher` is optional but must match the token\'s shop when sent. Swagger UI "Try it out" cannot compute `sign`; use the curl samples in docs/curl-samples.md or the Postman collection for signed calls.',
  },
  TiktokAppCredentials: {
    type: 'apiKey',
    in: 'query',
    name: 'app_secret',
    description: 'Token endpoints authenticate with `app_key` + `app_secret` query parameters (not signed).',
  },
  DemoSession: {
    type: 'apiKey',
    in: 'header',
    name: 'x-demo-session',
    description: 'Session token returned once by `POST /demo/sessions`. Scoped to one shop (and one buyer for BUYER sessions). Unrelated to SmartOmni login.',
  },
  TestAdminToken: {
    type: 'apiKey',
    in: 'header',
    name: 'x-test-admin-token',
    description: 'Value of the `TEST_ADMIN_TOKEN` environment variable of the API container.',
  },
};

export const schemas: Json = {
  NestError: obj(
    { statusCode: int(), code: str('domain rule error code, e.g. invalid_transition'), message: { oneOf: [str(), arr(str())] }, error: str() },
    ['message'],
    { description: 'Default NestJS error body (`statusCode`/`error` are absent on domain rule errors, which return `{code, message}`). Validation failures (zod) return 400 with `message: "Validation failed"` and an `issues` array of `{path, message}`.', additionalProperties: true },
  ),
  TiktokFaultEnvelope: obj(
    {
      code: int('Simulator sentinel (-1), NOT a TikTok error code'),
      message: str('Prefixed with "[simulator test-fault]"'),
      request_id: str(),
      simulator_fault: obj({ kind: str('e.g. invalid_input, bad_signature, token_expired, missing_scope, order_not_found'), documented_in_tiktok_contract: { type: 'boolean' }, listed_in_contract_fixtures: { type: 'boolean' } }),
    },
    ['code', 'message', 'request_id'],
    { description: 'Error body for TikTok-router faults. Branch on HTTP status + `simulator_fault.kind`.' },
  ),
};

export const info: Json = {
  title: 'SmartOmni TikTok Shop Simulator API',
  version: '0.1.0',
  description:
    'Local simulator used to test SmartOmni\'s TikTok Shop integration. Three separate routers: **TikTok-shaped public API** (root paths, what SmartOmni calls), **Demo** (`/demo/*`, Seller/Buyer UI) and **Test admin** (`/test-admin/*`, seed/reset/clock/faults). All data is fake. TikTok contracts are still `unverified` (see docs/support-matrix.md); error codes are simulator faults, not TikTok codes.',
};
