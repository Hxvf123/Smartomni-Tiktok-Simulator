import { readFileSync } from 'fs';
import { join } from 'path';
import { validateSchema } from '../../contracts/validator/schema';

const CONTRACTS = join(__dirname, '..', '..', 'contracts');

/**
 * Validates a response body against the schema derived from the OFFICIAL OAS (contracts/schemas/ops/*.json) with the
 * independent validator under contracts/validator. The OAS declares no required flags, so this proves field names and
 * types (e.g. money is a string, ids are strings), not completeness.
 */
export function conformErrors(schemaFile: string, body: unknown): string[] {
  const schema = JSON.parse(readFileSync(join(CONTRACTS, 'schemas', schemaFile), 'utf8'));
  return validateSchema(schema, body);
}
export function loadFixture(name: string): any {
  return JSON.parse(readFileSync(join(CONTRACTS, 'fixtures', name), 'utf8'));
}
