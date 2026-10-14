// Minimal JSON Schema subset validator (no dependencies).
// Supported: type, required, properties, items, enum, const, pattern, minLength, minimum, additionalProperties:false.
// Unknown keywords (including x-*) are ignored.
export type Json = null | boolean | number | string | Json[] | { [k: string]: Json };
export type Schema = { [k: string]: any };

function typeOf(v: unknown): string {
  if (v === null) return "null";
  if (Array.isArray(v)) return "array";
  if (typeof v === "number") return Number.isInteger(v) ? "integer" : "number";
  return typeof v;
}

function typeMatches(expected: string, v: unknown): boolean {
  const t = typeOf(v);
  return expected === t || (expected === "number" && t === "integer");
}

export function validateSchema(schema: Schema, value: unknown, at = "$"): string[] {
  const errs: string[] = [];
  if (schema.type !== undefined) {
    const types: string[] = Array.isArray(schema.type) ? schema.type : [schema.type];
    if (!types.some((t) => typeMatches(t, value))) {
      errs.push(`${at}: expected ${types.join("|")}, got ${typeOf(value)}`);
      return errs;
    }
  }
  if (schema.const !== undefined && value !== schema.const) errs.push(`${at}: expected const ${JSON.stringify(schema.const)}`);
  if (schema.enum && !schema.enum.includes(value)) errs.push(`${at}: value not in enum`);
  if (typeof value === "string") {
    if (schema.minLength !== undefined && value.length < schema.minLength) errs.push(`${at}: shorter than minLength ${schema.minLength}`);
    if (schema.pattern && !new RegExp(schema.pattern).test(value)) errs.push(`${at}: does not match pattern ${schema.pattern}`);
  }
  if (typeof value === "number" && schema.minimum !== undefined && value < schema.minimum) errs.push(`${at}: below minimum ${schema.minimum}`);
  if (Array.isArray(value) && schema.items) {
    value.forEach((item, i) => errs.push(...validateSchema(schema.items, item, `${at}[${i}]`)));
  }
  if (value !== null && typeof value === "object" && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    for (const r of schema.required ?? []) if (!(r in obj)) errs.push(`${at}.${r}: required property missing`);
    const props = schema.properties ?? {};
    for (const [k, sub] of Object.entries(props)) if (k in obj) errs.push(...validateSchema(sub as Schema, obj[k], `${at}.${k}`));
    if (schema.additionalProperties === false) for (const k of Object.keys(obj)) if (!(k in props)) errs.push(`${at}.${k}: additional property not allowed`);
  }
  return errs;
}
