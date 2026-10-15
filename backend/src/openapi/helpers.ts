/** Small builders so the hand-written path files stay compact. Specs are derived from the controllers; test/openapi.spec.ts fails on drift. */
export type Json = Record<string, unknown>;
export type Router = 'tiktok' | 'demo' | 'test-admin' | 'system';

export interface OpInput {
  tag: string;
  summary: string;
  description?: string;
  /** Name of the handler, e.g. "OrdersController.search" - for traceability to the code. */
  handler: string;
  /** Security scheme names (keys of components.securitySchemes). Empty array = public. */
  security: string[];
  /** Extra non-path parameters: query/header. Path params listed by `pathParams`. */
  query?: Param[];
  pathParams?: Param[];
  body?: { schema: Json; example?: unknown; required?: boolean; contentType?: string };
  /** 200 response. */
  ok: { description: string; schema?: Json; example?: unknown; contentType?: string };
  /** Additional status codes (besides the shared ones added from `security`). */
  errors?: Record<number, string>;
  /** Error response kind: TikTok fault envelope or Nest default. */
  errorShape: 'tiktok' | 'nest';
  scope?: string;
  status?: number;
}

export interface Param {
  name: string;
  required?: boolean;
  description?: string;
  schema?: Json;
  example?: unknown;
}

const ERR_REF = { tiktok: '#/components/schemas/TiktokFaultEnvelope', nest: '#/components/schemas/NestError' };

export function op(i: OpInput): Json {
  const parameters: Json[] = [
    ...(i.pathParams ?? []).map((p) => ({ name: p.name, in: 'path', required: true, description: p.description, schema: p.schema ?? { type: 'string' }, example: p.example })),
    ...(i.query ?? []).map((p) => ({ name: p.name, in: 'query', required: p.required ?? false, description: p.description, schema: p.schema ?? { type: 'string' }, example: p.example })),
  ];
  const responses: Json = {};
  const ct = i.ok.contentType ?? 'application/json';
  const status = String(i.status ?? 200);
  responses[status] = {
    description: i.ok.description,
    content: i.ok.schema ? { [ct]: { schema: i.ok.schema, ...(i.ok.example !== undefined ? { example: i.ok.example } : {}) } } : undefined,
  };
  for (const [code, description] of Object.entries(i.errors ?? {})) {
    responses[code] = { description, content: { 'application/json': { schema: { $ref: ERR_REF[i.errorShape] } } } };
  }
  const o: Json = {
    tags: [i.tag],
    summary: i.summary,
    description: [i.description, `Handler: \`${i.handler}\`.`, i.scope ? `Required scope (simulator placeholder): \`${i.scope}\`.` : ''].filter(Boolean).join('\n\n'),
    operationId: i.handler.replace(/[^A-Za-z0-9]+/g, '_'),
    security: i.security.length ? i.security.map((s) => ({ [s]: [] })) : [],
    responses,
  };
  if (parameters.length) o.parameters = parameters;
  if (i.body) {
    o.requestBody = {
      required: i.body.required ?? true,
      content: { [i.body.contentType ?? 'application/json']: { schema: i.body.schema, ...(i.body.example !== undefined ? { example: i.body.example } : {}) } },
    };
  }
  return JSON.parse(JSON.stringify(o)) as Json;
}

export const str = (description?: string, extra: Json = {}): Json => ({ type: 'string', ...(description ? { description } : {}), ...extra });
export const int = (description?: string, extra: Json = {}): Json => ({ type: 'integer', ...(description ? { description } : {}), ...extra });
export const bool = (description?: string): Json => ({ type: 'boolean', ...(description ? { description } : {}) });
export const arr = (items: Json): Json => ({ type: 'array', items });
export const obj = (properties: Record<string, Json>, required: string[] = [], extra: Json = {}): Json => ({
  type: 'object',
  properties,
  ...(required.length ? { required } : {}),
  ...extra,
});
export const ref = (name: string): Json => ({ $ref: `#/components/schemas/${name}` });
/** TikTok success envelope wrapping `data`. */
export const envelope = (data: Json): Json => obj({ code: int('0 on success'), message: str(), request_id: str(), data }, ['code', 'message', 'request_id']);

export type PathsFragment = Record<string, Record<string, Json>>;
