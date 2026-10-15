import { writeFileSync } from 'fs';
import { resolve } from 'path';
import { buildOpenApiDocument } from './openapi/build-document';

/** `npm run openapi:export [outfile]` writes the spec (default ../docs/openapi.json). */
const out = resolve(process.argv[2] ?? '../docs/openapi.json');
writeFileSync(out, JSON.stringify(buildOpenApiDocument(), null, 2) + '\n');
console.log(`wrote ${out}`);
