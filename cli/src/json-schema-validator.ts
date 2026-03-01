/**
 * JSON Schema validation for SDL files using Ajv (draft-07).
 *
 * Validates each SDL file against the appropriate schema from spec/.
 * Array SDL files (operations, entry-points, etc.) validate each item
 * individually to produce per-item error messages.
 */

import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { FILE_SCHEMA_MAP, getSchema } from './schema-registry.js';
import type { ValidationIssue } from './types.js';

const ajv = new Ajv({ allErrors: true, strict: false });
addFormats(ajv);

// Pre-compile all schemas eagerly so errors surface at startup, not validation time.
const _compiledValidators = new Map<string, ReturnType<typeof ajv.compile>>();

function getValidator(schemaPath: string) {
  if (!_compiledValidators.has(schemaPath)) {
    const schema = getSchema(schemaPath) as object;
    // Ajv draft-07: remove the `$schema` keyword to avoid keyword conflicts
    const { $schema: _ignored, dl: _dl, ...stripped } = schema as Record<string, unknown>;
    _compiledValidators.set(schemaPath, ajv.compile(stripped));
  }
  return _compiledValidators.get(schemaPath)!;
}

/**
 * Validates the parsed content of a single SDL file.
 *
 * @param filename  The base filename (e.g. "operations.sdl.json") used to look up the schema.
 * @param content   The parsed JSON content of the file.
 * @returns         Array of validation issues (empty = valid).
 */
export function validateSdlFile(
  filename: string,
  content: unknown,
): ValidationIssue[] {
  const entry = FILE_SCHEMA_MAP[filename];
  if (!entry) return []; // unknown file — skip, don't error

  const validate = getValidator(entry.schemaPath);
  const issues: ValidationIssue[] = [];

  if (entry.isArray) {
    if (!Array.isArray(content)) {
      issues.push({
        severity: 'error',
        file: filename,
        message: `Expected a JSON array but got ${typeof content}`,
      });
      return issues;
    }
    for (let i = 0; i < content.length; i++) {
      const item = content[i];
      const valid = validate(item);
      if (!valid && validate.errors) {
        for (const err of validate.errors) {
          const id = (item as Record<string, unknown>)?.id ?? `[${i}]`;
          issues.push({
            severity: 'error',
            file: filename,
            path: `[${i}] (id: ${id})${err.instancePath}`,
            message: `${err.message ?? 'validation error'}${err.params ? ' — ' + JSON.stringify(err.params) : ''}`,
          });
        }
      }
    }
  } else {
    const valid = validate(content);
    if (!valid && validate.errors) {
      for (const err of validate.errors) {
        issues.push({
          severity: 'error',
          file: filename,
          path: err.instancePath || '(root)',
          message: `${err.message ?? 'validation error'}${err.params ? ' — ' + JSON.stringify(err.params) : ''}`,
        });
      }
    }
  }

  return issues;
}
