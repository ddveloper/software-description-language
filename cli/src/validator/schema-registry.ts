/**
 * Maps SDL filename conventions to JSON Schema files and describes how
 * each file should be validated (as a single object or as an array of items).
 *
 * Layer detection is done by directory structure and filename, matching
 * the conventions established in the spec and examples.
 */

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, resolve } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Spec root is three levels up from cli/src/validator
const SPEC_ROOT = resolve(__dirname, '../../../spec');

export interface SchemaEntry {
  /** Relative path inside spec/ to the schema file */
  schemaPath: string;
  /** Whether the SDL file is a JSON array (each item validated against the schema) */
  isArray: boolean;
  /** Human-readable layer name for error messages */
  layer: string;
}

export const FILE_SCHEMA_MAP: Record<string, SchemaEntry> = {
  'manifest.sdl.json': {
    schemaPath: 'layer_logic/manifest.schema.json',
    isArray: false,
    layer: 'layer_logic',
  },
  'entry-points.sdl.json': {
    schemaPath: 'layer_logic/entry-point.schema.json',
    isArray: true,
    layer: 'layer_logic',
  },
  'operations.sdl.json': {
    schemaPath: 'layer_logic/operation.schema.json',
    isArray: true,
    layer: 'layer_logic',
  },
  'data-shapes.sdl.json': {
    schemaPath: 'layer_logic/data-shape.schema.json',
    isArray: true,
    layer: 'layer_logic',
  },
  'dependencies.sdl.json': {
    schemaPath: 'layer_logic/dependency.schema.json',
    isArray: true,
    layer: 'layer_logic',
  },
  'platform.sdl.json': {
    schemaPath: 'layer_platform/platform-manifest.schema.json',
    isArray: false,
    layer: 'layer_platform',
  },
  'platform-connect.sdl.json': {
    schemaPath: 'layer_platform/platform-connect.schema.json',
    isArray: true,
    layer: 'layer_platform',
  },
  'service-flows.sdl.json': {
    schemaPath: 'layer_service/service-flow.schema.json',
    isArray: true,
    layer: 'layer_service',
  },
};

/** Expected files for a layer_logic service directory */
export const LAYER_LOGIC_EXPECTED_FILES = [
  'manifest.sdl.json',
  'entry-points.sdl.json',
  'operations.sdl.json',
  'data-shapes.sdl.json',
  'dependencies.sdl.json',
];

let _schemaCache: Map<string, unknown> | null = null;

function loadSchema(schemaPath: string): unknown {
  const fullPath = join(SPEC_ROOT, schemaPath);
  const raw = readFileSync(fullPath, 'utf-8');
  return JSON.parse(raw);
}

export function getSchema(schemaPath: string): unknown {
  if (!_schemaCache) _schemaCache = new Map();
  if (!_schemaCache.has(schemaPath)) {
    _schemaCache.set(schemaPath, loadSchema(schemaPath));
  }
  return _schemaCache.get(schemaPath);
}
