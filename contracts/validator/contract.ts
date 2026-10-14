// Contract validator for request/response checks against contracts/manifest.json.
// Usage: const c = loadContracts(); c.validateRequest(opId, req); c.validateResponse(opId, body)
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { validateSchema, type Schema } from "./schema.ts";
import { signApiRequest, safeEqualHex } from "../signing/sign.ts";

export interface ParamSpec { in: "query" | "path" | "header"; name: string; required: boolean; type: string | null }
export interface Operation {
  id: string; method: string; path: string; status: "supported" | "unverified" | "unsupported";
  schemaRef: string | null; requestSchemaRef?: string | null; blocker: string | null; host: string;
  request?: { params: ParamSpec[]; contentType: string } | null;
}
export interface ValidationResult { ok: boolean; errors: string[]; warnings: string[] }
export interface RequestLike {
  method: string; path: string; query?: Record<string, string>; headers?: Record<string, string>;
  /** Raw body exactly as sent (it is what enters the signature). */
  body?: string | null;
}

const here = dirname(fileURLToPath(import.meta.url));
export const CONTRACTS_DIR = join(here, "..");

function result(errors: string[], warnings: string[] = []): ValidationResult {
  return { ok: errors.length === 0, errors, warnings };
}

export function pathMatches(template: string, actual: string): boolean {
  const re = new RegExp("^" + template.replace(/[.*+?^$()|[\]\\]/g, "\\$&").replace(/\{[^}]+\}/g, "[^/]+") + "$");
  return re.test(actual);
}

export function loadContracts(dir: string = CONTRACTS_DIR) {
  const manifest = JSON.parse(readFileSync(join(dir, "manifest.json"), "utf8")) as { operations: Operation[] };
  const ops = new Map(manifest.operations.map((o) => [o.id, o]));
  const schemaCache = new Map<string, Schema>();
  const loadSchema = (ref: string): Schema => {
    if (!schemaCache.has(ref)) schemaCache.set(ref, JSON.parse(readFileSync(join(dir, ref), "utf8")));
    return schemaCache.get(ref)!;
  };
  const get = (id: string): Operation | string => ops.get(id) ?? `unknown operation '${id}'`;

  return {
    manifest, loadSchema,

    /**
     * Locked-out operations never validate. A response with code != 0 is checked against the error envelope
     * (shape only: error code values are undocumented); otherwise against the operation's official-OAS-derived schema.
     */
    validateResponse(opId: string, body: unknown): ValidationResult {
      const op = get(opId);
      if (typeof op === "string") return result([op]);
      if (op.status === "unsupported") return result([`${opId} is unsupported: ${op.blocker}`]);
      const warnings: string[] = [];
      if (op.status === "unverified") warnings.push(`${opId}: contract is unverified, a pass is not a compatibility claim`);
      const code = body !== null && typeof body === "object" ? (body as Record<string, unknown>).code : undefined;
      if (typeof code === "number" && code !== 0) {
        warnings.push(`${opId}: non-zero code; only the envelope shape was checked (error code values are undocumented)`);
        return result(validateSchema(loadSchema("schemas/error-envelope.json"), body), warnings);
      }
      let schemaRef = op.schemaRef;
      if (!schemaRef) {
        schemaRef = "schemas/envelope.json";
        warnings.push(`${opId}: no operation schema; only the generic envelope was checked`);
      }
      return result(validateSchema(loadSchema(schemaRef), body), warnings);
    },

    /**
     * Checks method, path template, required query/path/header params from the official OAS, the common signed-request
     * query params, the JSON body shape (when the OAS has a body schema) and the signature (query + raw body).
     */
    validateRequest(opId: string, req: RequestLike, opts: { appSecret?: string } = {}): ValidationResult {
      const op = get(opId);
      if (typeof op === "string") return result([op]);
      if (op.status === "unsupported") return result([`${opId} is unsupported: ${op.blocker}`]);
      const errors: string[] = [];
      const warnings: string[] = [];
      if (op.method !== req.method) errors.push(`method ${req.method} != ${op.method}`);
      if (!pathMatches(op.path, req.path)) errors.push(`path ${req.path} does not match ${op.path}`);
      const q = req.query ?? {};
      const headers = Object.fromEntries(Object.entries(req.headers ?? {}).map(([k, v]) => [k.toLowerCase(), v]));
      for (const k of ["app_key", "timestamp", "sign"]) if (!q[k]) errors.push(`query.${k} missing`);
      for (const p of op.request?.params ?? []) {
        if (!p.required) continue;
        if (p.in === "query" && !q[p.name]) errors.push(`query.${p.name} is required by the OAS`);
        if (p.in === "header" && !headers[p.name.toLowerCase()]) errors.push(`header ${p.name} is required by the OAS`);
      }
      const contentType = headers["content-type"] ?? op.request?.contentType ?? "application/json";
      if (op.requestSchemaRef && req.body) {
        try {
          errors.push(...validateSchema(loadSchema(op.requestSchemaRef), JSON.parse(req.body), "$body"));
        } catch {
          errors.push("body is not valid JSON");
        }
      }
      if (opts.appSecret && q.sign && op.host === "openapi") {
        try {
          const expected = signApiRequest(opts.appSecret, req.path, q, req.body ?? null, contentType);
          if (!safeEqualHex(expected, q.sign)) errors.push("query.sign does not match the signing algorithm (query + raw body)");
        } catch (e) {
          errors.push(String((e as Error).message));
        }
      }
      if (op.status === "unverified") warnings.push(`${opId}: request rules unverified`);
      return result(errors, warnings);
    },
  };
}
