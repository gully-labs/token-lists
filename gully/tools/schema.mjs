// ajv + the @uniswap/token-lists JSON schema (pinned in package.json). 1.0.0-beta.35 on npm ships src/ only, so the
// schema is read as JSON from src/tokenlist.schema.json.
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { loadSchema } from './lib.mjs';

const schema = loadSchema();
const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);
const validate = ajv.compile(schema);

/** Returns schema errors as strings (empty = valid). */
export function validateSchema(list) {
  if (validate(list)) return [];
  return validate.errors.map((e) => `schema: ${e.instancePath || '/'} ${e.message}${e.params ? ' ' + JSON.stringify(e.params) : ''}`);
}
