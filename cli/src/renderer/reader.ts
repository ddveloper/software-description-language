/**
 * Reads SDL files from a root directory into a structured RenderData object
 * suitable for passing to the HTML renderer.
 *
 * Discovery rules:
 *   - platform.sdl.json      → PlatformManifest (layer_platform)
 *   - service-flows.sdl.json → ServiceFlow[] (layer_service)
 *   - manifest.sdl.json      → ServiceLogic (layer_logic service directory)
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';

// ── Lightweight SDL type aliases (no schema enforcement here) ─────────────────

export type JsonObj = Record<string, unknown>;

export interface ServiceActor {
  id: string;
  label: string;
  kind?: string;
  domain?: string;
  exposes?: string[];
  consumes?: string[];
  team?: string;
  tags?: string[];
  sdl_ref?: string;
}

export interface PlatformManifest {
  id: string;
  label: string;
  description?: string;
  domains?: string[];
  services?: ServiceActor[];
  shared_infrastructure?: JsonObj;
  tags?: string[];
  /** Directory this file was read from */
  _dir: string;
}

export interface ServiceFlow {
  id: string;
  label: string;
  description?: string;
  trigger?: JsonObj;
  business?: JsonObj;
  steps?: JsonObj[];
  sequence?: JsonObj;
  tags?: string[];
}

export interface ServiceFlowBundle {
  /** Directory name (e.g. "ecommerce-platform") */
  groupId: string;
  /** Full directory path */
  dir: string;
  flows: ServiceFlow[];
}

export interface ServiceLogic {
  manifest: JsonObj;
  entryPoints: JsonObj[];
  operations: JsonObj[];
  dataShapes: JsonObj[];
  dependencies: JsonObj[];
  /** Directory path */
  dir: string;
  /** Derived from manifest.id */
  serviceId: string;
}

export interface RenderData {
  platforms: PlatformManifest[];
  serviceFlowBundles: ServiceFlowBundle[];
  services: ServiceLogic[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function readJson(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf-8'));
  } catch {
    return null;
  }
}

function readJsonArray(path: string): JsonObj[] {
  if (!existsSync(path)) return [];
  const raw = readJson(path);
  return Array.isArray(raw) ? (raw as JsonObj[]) : [];
}

// ── Main reader ───────────────────────────────────────────────────────────────

/**
 * Walks rootDir recursively, collecting all SDL data into a RenderData object.
 */
export function readAll(rootDir: string): RenderData {
  const data: RenderData = {
    platforms: [],
    serviceFlowBundles: [],
    services: [],
  };

  function walk(dir: string) {
    let entries: import('fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const names = new Set(entries.filter((e) => e.isFile()).map((e) => e.name));

    if (names.has('platform.sdl.json')) {
      const raw = readJson(join(dir, 'platform.sdl.json')) as JsonObj | null;
      if (raw) {
        data.platforms.push({ ...(raw as unknown as PlatformManifest), _dir: dir });
      }
    }

    if (names.has('service-flows.sdl.json')) {
      const flows = readJsonArray(join(dir, 'service-flows.sdl.json'));
      data.serviceFlowBundles.push({
        groupId: basename(dir),
        dir,
        flows: flows as unknown as ServiceFlow[],
      });
    }

    if (names.has('manifest.sdl.json')) {
      const manifest = readJson(join(dir, 'manifest.sdl.json')) as JsonObj | null;
      if (manifest) {
        data.services.push({
          manifest,
          entryPoints: readJsonArray(join(dir, 'entry-points.sdl.json')),
          operations: readJsonArray(join(dir, 'operations.sdl.json')),
          dataShapes: readJsonArray(join(dir, 'data-shapes.sdl.json')),
          dependencies: readJsonArray(join(dir, 'dependencies.sdl.json')),
          dir,
          serviceId: manifest.id as string,
        });
      }
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(join(dir, entry.name));
      }
    }
  }

  walk(rootDir);
  return data;
}
