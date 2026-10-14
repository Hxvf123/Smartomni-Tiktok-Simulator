// Run: node --experimental-strip-types --test contracts/validator/contract.test.ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { loadContracts, CONTRACTS_DIR } from "./contract.ts";
import { validateSchema } from "./schema.ts";
import { signApiRequest, signWebhook, verifyWebhook, apiStringToSign } from "../signing/sign.ts";

const c = loadContracts();
const ops = c.manifest.operations as any[];
const byId = new Map(ops.map((o) => [o.id, o]));
const readJson = (p: string) => JSON.parse(readFileSync(join(CONTRACTS_DIR, p), "utf8"));
const SECRET = "test_app_secret_not_real";
const baseQuery = (extra: Record<string, string> = {}) => ({ app_key: "test_app_key_not_real", timestamp: "1700000000", ...extra });
const signed = (path: string, query: Record<string, string>, body: string | null = null) => ({ ...query, sign: signApiRequest(SECRET, path, query, body) });

test("manifest: metadata, snapshots and honest status gates", () => {
  for (const o of ops) {
    assert.ok(["supported", "unverified", "unsupported"].includes(o.status), o.id);
    assert.equal(o.accessDate, "2026-10-14", o.id);
    assert.ok(o.blocker || o.status === "supported", `${o.id} needs a blocker`);
    assert.ok(o.verification && o.scope && o.market && o.versionChoice, `${o.id} lacks verification/scope/market/versionChoice`);
    if (o.schemaRef) c.loadSchema(o.schemaRef);
    if (o.requestSchemaRef) c.loadSchema(o.requestSchemaRef);
    if (o.status === "supported") {
      // gates in manifest.statusLegend.supported; none is met today, so this must never be true by accident
      assert.equal(o.evidence, "official-oas", o.id);
      assert.ok(!/unresolved|unverified|undocumented|not checked|unknown/.test(JSON.stringify(o.verification)), `${o.id} promoted with open gates`);
    }
    if (o.evidence === "official-oas" && o.host === "openapi") {
      assert.ok(o.snapshot && existsSync(join(CONTRACTS_DIR, o.snapshot)), `${o.id} snapshot`);
      const snap = readJson(o.snapshot);
      assert.equal(snap.method, o.method, o.id);
      assert.equal(snap.path, o.path, o.id);
      assert.match(snap._meta.sha256OfCanonicalOperation, /^[0-9a-f]{64}$/);
      assert.ok(o.request.params.some((p: any) => p.name === "x-tts-access-token" && p.required), `${o.id} access-token header`);
    }
  }
});

test("manifest: required gaps, locks and resolved questions are recorded", () => {
  assert.equal(byId.get("promotion.coupon_create").status, "unsupported");
  assert.match(byId.get("promotion.coupon_create").blocker, /LOCKED/);
  assert.match(byId.get("cs.send_message").notes, /missing from the bundled OAS/);
  assert.equal(byId.get("cs.send_message").schemaRef, null);
  assert.equal(byId.get("cs.send_message").version, "202606");
  assert.equal(byId.get("cs.send_message_202309").version, "202309");
  assert.match(byId.get("return.search").versionChoice, /RMA 202604 is NOT in the bundle and does NOT replace Search Returns/);
  assert.equal(byId.get("return.rma_202604").status, "unsupported");
  assert.equal(byId.get("auth.authorization_url").status, "unsupported");
  assert.equal(byId.get("webhook.NEW_MESSAGE").status, "unverified");
  assert.ok(byId.has("webhook.NEW_CONVERSATION") && byId.has("webhook.REVERSE_STATUS_UPDATE"));
  assert.equal(byId.get("product.search").version, "202502");
  assert.equal(byId.get("order.detail").version, "202507");
  assert.match(byId.get("product.detail").versionChoice, /202509.*PUT EditProduct/);
  assert.equal(ops.filter((o) => o.status === "supported").length, 0);
});

test("manifest: pagination is recorded per list operation from its own schema", () => {
  for (const id of ["product.search", "order.search", "return.search", "cancellation.search", "cs.conversations", "cs.messages", "promotion.coupon_search"]) {
    const p = byId.get(id).pagination;
    assert.equal(p.style, "cursor", id);
    assert.ok(p.requestParams.some((x: any) => x.name === "page_size") && p.requestParams.some((x: any) => x.name === "page_token"), id);
    assert.ok(p.responseFields.includes("next_page_token"), id);
  }
  const desc = (id: string) => byId.get(id).pagination.requestParams.find((x: any) => x.name === "page_size").description;
  assert.match(desc("product.search"), /1-100/);
  assert.match(desc("return.search"), /10-50/);
  assert.equal(typeof byId.get("order.detail").pagination, "string");
});

test("per-operation fixtures: success/empty/multi-page validate; error cases are undocumented test faults", () => {
  let fixtureFiles = 0;
  for (const o of ops) {
    if (!o.fixtures || !o.fixtures.startsWith("fixtures/ops/")) continue;
    fixtureFiles++;
    const fx = readJson(o.fixtures);
    const schema = c.loadSchema(fx.schema);
    const names = fx.cases.map((k: any) => k.case);
    assert.ok(names.includes("success"), `${o.id} success`);
    assert.ok(["invalid_input", "token_expired", "missing_scope"].every((n) => names.includes(n)), `${o.id} error cases`);
    if (o.pagination && typeof o.pagination === "object" && o.pagination.responseFields.includes("next_page_token")) {
      assert.ok(names.includes("multi_page_first") && names.includes("multi_page_last"), `${o.id} multi-page`);
    }
    for (const k of fx.cases) {
      if (k.response) {
        const errs = validateSchema(schema, k.response);
        assert.equal(errs.length === 0, k.expect === "valid", `${o.id}/${k.case}: ${errs.join("; ")}`);
        assert.equal(c.validateResponse(o.id, k.response).ok, k.expect === "valid", `${o.id}/${k.case} via validateResponse`);
        if (k.case === "multi_page_first") assert.notEqual(k.response.data.next_page_token, "");
        if (k.case === "multi_page_last") assert.equal(k.response.data.next_page_token, "");
        if (k.case === "empty" && "total_count" in (k.response.data ?? {})) assert.equal(k.response.data.total_count, 0);
      } else {
        assert.equal(k.classification, "test_fault_undocumented", `${o.id}/${k.case}`);
        assert.ok(!("code" in k) && !("message" in k), `${o.id}/${k.case} must not invent codes`);
      }
    }
  }
  assert.ok(fixtureFiles >= 30, `expected >= 30 per-op fixture files, got ${fixtureFiles}`);
});

test("per-operation fixtures: invalid_input with a missing required param fails request validation", () => {
  let checked = 0;
  for (const o of ops) {
    if (!o.fixtures?.startsWith("fixtures/ops/")) continue;
    const k = readJson(o.fixtures).cases.find((x: any) => x.case === "invalid_input");
    if (!k.requestMustFailValidation) continue;
    checked++;
    const path = o.path.replace(/\{[^}]+\}/g, "123");
    const r = c.validateRequest(o.id, { method: o.method, path, query: baseQuery({ sign: "x" }), headers: { "x-tts-access-token": "t", "content-type": "application/json" } });
    assert.ok(!r.ok && r.errors.some((e) => /required by the OAS/.test(e)), `${o.id}: ${r.errors.join("; ")}`);
  }
  assert.ok(checked >= 5);
});

test("fixtures: token and webhook (provisional) pass/fail as declared; errors stay test faults", () => {
  for (const f of ["token", "webhook"]) {
    const fx = readJson(`fixtures/${f}.json`);
    const schema = c.loadSchema(fx.schema);
    for (const k of fx.cases) {
      const errs = validateSchema(schema, k.response);
      assert.equal(errs.length === 0, k.expect === "valid", `${f}/${k.case}: ${errs.join("; ")}`);
    }
  }
  const fx = readJson("fixtures/errors.json");
  assert.equal(fx.classification, "test_fault_undocumented");
  for (const k of fx.cases) if (k.documentedResponse === null) assert.ok(!("code" in k) && !("response" in k), k.case);
  assert.ok(fx.faqReferences.items.some((i: any) => i.code === 36004001 && /LEGACY/.test(i.meaning)));
});

test("auth.shops: official fields, seller_type enum, VN is a synthetic unverified case", () => {
  const fx = readJson("fixtures/ops/auth.shops.json");
  const vn = fx.cases.find((k: any) => k.case === "local_shop_region_vn_unverified");
  assert.ok(vn && /NOT documented/.test(vn.note));
  assert.ok(c.validateResponse("auth.shops", vn.response).ok);
  const shop = { cipher: "C", code: "X", id: "7000000000000000001", name: "n", region: "VN", seller_type: "LOCAL" };
  const resp = (s: object) => ({ code: 0, message: "Success", request_id: "r", data: { shops: [s] } });
  assert.ok(c.validateResponse("auth.shops", resp(shop)).ok);
  assert.ok(!c.validateResponse("auth.shops", resp({ ...shop, seller_type: "TEST" })).ok);
  const { cipher: _omit, ...noCipher } = shop;
  assert.ok(c.validateResponse("auth.shops", resp(noCipher)).errors.some((e) => e.includes("cipher")));
  assert.ok(!c.validateResponse("auth.shops", { code: 0 }).ok);
});

test("validateResponse: unsupported/unknown never pass; error envelope shape; type violations rejected", () => {
  assert.ok(!c.validateResponse("promotion.coupon_create", { code: 0, message: "ok", request_id: "x" }).ok);
  assert.ok(!c.validateResponse("nope", {}).ok);
  const err = c.validateResponse("order.search", { code: 99999999, message: "boom", request_id: "r" });
  assert.ok(err.ok && err.warnings.some((w) => /error code values are undocumented/.test(w)));
  assert.ok(!c.validateResponse("order.search", { code: 99999999, message: "boom" }).ok);
  assert.ok(!c.validateResponse("order.search", { code: 0, message: "Success", request_id: "r", data: { total_count: "3" } }).ok);
  assert.ok(c.validateResponse("order.search", { code: 0, message: "Success", request_id: "r", data: { total_count: 3, next_page_token: "" } }).ok);
  const noSchema = c.validateResponse("cs.send_message", { code: 0, message: "Success", request_id: "r", data: {} });
  assert.ok(noSchema.ok && noSchema.warnings.some((w) => w.includes("envelope")));
});

test("validateRequest: method, path, required OAS params, body schema, signature incl. body", () => {
  const path = "/product/202502/products/search";
  const headers = { "x-tts-access-token": "t", "content-type": "application/json" };
  const body = "{\"seller_skus\":[\"SKU-1\"]}";
  const query = signed(path, baseQuery({ shop_cipher: "TEST_CIPHER_0001", page_size: "10" }), body);
  assert.ok(c.validateRequest("product.search", { method: "POST", path, query, headers, body }, { appSecret: SECRET }).ok);
  // body tampered after signing
  const tampered = c.validateRequest("product.search", { method: "POST", path, query, headers, body: "{\"seller_skus\":[\"SKU-2\"]}" }, { appSecret: SECRET });
  assert.ok(!tampered.ok && tampered.errors.some((e) => e.includes("sign")));
  // a signature that ignores the body (the old, wrong behaviour) is rejected
  const bodyless = baseQuery({ shop_cipher: "TEST_CIPHER_0001", page_size: "10" });
  const bodylessSigned = { ...bodyless, sign: signApiRequest(SECRET, path, bodyless, null) };
  assert.ok(!c.validateRequest("product.search", { method: "POST", path, query: bodylessSigned, headers, body }, { appSecret: SECRET }).ok);
  // OAS-required query param page_size missing
  const noPage = signed(path, baseQuery({ shop_cipher: "x" }), body);
  assert.ok(c.validateRequest("product.search", { method: "POST", path, query: noPage, headers, body }).errors.some((e) => e.includes("page_size")));
  // body field of the wrong type / not JSON
  const badBody = "{\"seller_skus\":\"SKU-1\"}";
  assert.ok(!c.validateRequest("product.search", { method: "POST", path, query: signed(path, baseQuery({ page_size: "10" }), badBody), headers, body: badBody }).ok);
  assert.ok(!c.validateRequest("product.search", { method: "POST", path, query, headers, body: "{oops" }).ok);
  assert.ok(!c.validateRequest("product.search", { method: "GET", path, query, headers, body }).ok);
  // missing header and missing common params
  assert.ok(!c.validateRequest("product.search", { method: "POST", path, query, headers: { "content-type": "application/json" }, body }).ok);
  assert.ok(!c.validateRequest("auth.shops", { method: "GET", path: "/authorization/202309/shops", query: { app_key: "k" } }).ok);
  // GET without a body validates; path templates match; unsupported never validates
  const gq = signed("/authorization/202309/shops", baseQuery({ access_token: "t" }));
  assert.ok(c.validateRequest("auth.shops", { method: "GET", path: "/authorization/202309/shops", query: gq, headers }, { appSecret: SECRET }).ok);
  assert.ok(c.validateRequest("product.detail", { method: "GET", path: "/product/202309/products/123", query: baseQuery({ sign: "s" }), headers }).ok);
  assert.ok(!c.validateRequest("promotion.coupon_create", { method: "POST", path: "/x", query: baseQuery({ sign: "s" }) }).ok);
});

test("signing: vectors (toolkit signer, Python hmac, OpenSSL, sign.ts) incl. request bodies", () => {
  const v = readJson("signing/test-vectors.json");
  assert.ok(v.api.length >= 5 && v.api.some((a: any) => a.body));
  for (const a of v.api) {
    assert.equal(apiStringToSign(a.app_secret, a.path, a.query, a.body), a.string_to_sign, a.name);
    assert.equal(signApiRequest(a.app_secret, a.path, a.query, a.body), a.sign, a.name);
  }
  const withBody = v.api.find((a: any) => a.body);
  assert.notEqual(signApiRequest(withBody.app_secret, withBody.path, withBody.query, null), withBody.sign);
  assert.equal(signApiRequest(withBody.app_secret, withBody.path, withBody.query, Buffer.from(withBody.body, "utf8")), withBody.sign);
  assert.throws(() => signApiRequest("s", "/p", {}, "x", "multipart/form-data; boundary=1"), /multipart/);
  for (const w of v.webhook) {
    assert.equal(signWebhook(w.app_key, w.app_secret, w.raw_body), w.signature);
    assert.ok(verifyWebhook(w.app_key, w.app_secret, w.raw_body, w.signature));
    assert.ok(!verifyWebhook(w.app_key, w.app_secret, w.raw_body + " ", w.signature));
    assert.ok(!verifyWebhook(w.app_key, w.app_secret, w.raw_body, "abc"));
  }
});
