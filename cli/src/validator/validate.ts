/**
 * Core validation orchestrator.
 *
 * Given a directory path, discovers SDL files, validates each against the
 * appropriate JSON Schema, runs cross-reference checks, and reports missing
 * expected files.
 *
 * Supports three modes based on what it finds in the directory:
 *   - layer_logic: directory contains manifest.sdl.json (single-service SDL)
 *   - layer_platform: directory contains platform.sdl.json
 *   - layer_service: directory contains service-flows.sdl.json
 *   - mixed/unknown: validates whatever SDL files it finds
 */

import { readdirSync, readFileSync, existsSync } from 'fs';
import { join, basename } from 'path';
import {
  FILE_SCHEMA_MAP,
  LAYER_LOGIC_EXPECTED_FILES,
} from './schema-registry.js';
import { validateSdlFile } from './json-schema-validator.js';
import { checkLayerLogicRefs, checkServiceFlowRefs } from './cross-ref-checker.js';
import type { ValidationResult, ValidationIssue } from './types.js';

function readJson(filePath: string): unknown {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8'));
  } catch (err) {
    return null;
  }
}

/**
 * Validates all SDL files in a directory.
 *
 * If `platformManifestPath` is provided (path to a platform.sdl.json outside
 * the target dir), it will be used to resolve service ids for cross-ref checks
 * in service-flow files.
 */
export function validateDir(
  dir: string,
  platformManifestPath?: string,
): ValidationResult {
  const issues: ValidationIssue[] = [];
  const foundFiles: string[] = [];
  const missingFiles: string[] = [];

  if (!existsSync(dir)) {
    return {
      dir,
      issues: [{ severity: 'error', file: '.', message: `Directory not found: ${dir}` }],
      foundFiles: [],
      missingFiles: [],
    };
  }

  // Discover SDL files
  let entries: string[];
  try {
    entries = readdirSync(dir).filter((f) => f.endsWith('.sdl.json'));
  } catch {
    return {
      dir,
      issues: [{ severity: 'error', file: '.', message: `Cannot read directory: ${dir}` }],
      foundFiles: [],
      missingFiles: [],
    };
  }

  // Load all content first
  const fileContents = new Map<string, unknown>();
  for (const filename of entries) {
    const fullPath = join(dir, filename);
    const content = readJson(fullPath);
    if (content === null) {
      issues.push({
        severity: 'error',
        file: filename,
        message: 'Failed to parse JSON — check for syntax errors',
      });
      continue;
    }
    fileContents.set(filename, content);
    if (FILE_SCHEMA_MAP[filename]) {
      foundFiles.push(filename);
    }
  }

  // JSON Schema validation for each known file
  for (const [filename, content] of fileContents) {
    if (!FILE_SCHEMA_MAP[filename]) continue;
    const schemaIssues = validateSdlFile(filename, content);
    issues.push(...schemaIssues);
  }

  // Determine directory mode
  const hasManifest = fileContents.has('manifest.sdl.json');
  const hasPlatform = fileContents.has('platform.sdl.json');
  const hasServiceFlows = fileContents.has('service-flows.sdl.json');

  // layer_logic: check for expected files and run cross-ref checks
  if (hasManifest) {
    for (const expected of LAYER_LOGIC_EXPECTED_FILES) {
      if (!fileContents.has(expected)) {
        missingFiles.push(expected);
        issues.push({
          severity: 'warning',
          file: expected,
          message: `Expected file not found in layer_logic service directory`,
        });
      }
    }
    const crossRefIssues = checkLayerLogicRefs(fileContents);
    issues.push(...crossRefIssues);
  }

  // layer_service: check service-flow references against platform manifest
  if (hasServiceFlows) {
    const serviceIds = new Set<string>();

    // Try to load platform manifest — from same dir, explicit arg, or sibling layer_platform dir.
    // Convention: layer_service/<name>/service-flows.sdl.json pairs with
    //             layer_platform/<name>/platform.sdl.json two levels up.
    let platformContent: unknown = null;
    const dirName = basename(dir);
    const parentDir = join(dir, '..');
    const grandParentDir = join(dir, '../..');
    const candidatePaths = [
      join(dir, 'platform.sdl.json'),
      ...(platformManifestPath ? [platformManifestPath] : []),
      join(parentDir, 'layer_platform', dirName, 'platform.sdl.json'),
      join(grandParentDir, 'layer_platform', dirName, 'platform.sdl.json'),
    ];
    for (const p of candidatePaths) {
      if (existsSync(p)) {
        platformContent = readJson(p);
        if (platformContent) break;
      }
    }

    if (platformContent) {
      const manifest = platformContent as Record<string, unknown>;
      if (Array.isArray(manifest.services)) {
        for (const svc of manifest.services) {
          const id = (svc as Record<string, unknown>).id as string;
          if (id) serviceIds.add(id);
        }
      }
    } else {
      issues.push({
        severity: 'warning',
        file: 'service-flows.sdl.json',
        message: 'No platform.sdl.json found — cannot validate service_id cross-references in flow steps',
      });
    }

    if (serviceIds.size > 0) {
      const flowIssues = checkServiceFlowRefs(
        fileContents.get('service-flows.sdl.json'),
        serviceIds,
      );
      issues.push(...flowIssues);
    }
  }

  return { dir, issues, foundFiles, missingFiles };
}

/**
 * Recursively discovers and validates SDL directories.
 *
 * A directory is considered an SDL directory if it contains at least one
 * `*.sdl.json` file that is in the known schema map.
 */
export function validateDirRecursive(
  rootDir: string,
  platformManifestPath?: string,
): ValidationResult[] {
  const results: ValidationResult[] = [];

  function walk(dir: string) {
    let entries: import('fs').Dirent[];
    try {
      entries = readdirSync(dir, { withFileTypes: true });
    } catch {
      return;
    }

    const sdlFiles = entries
      .filter((e) => e.isFile() && e.name.endsWith('.sdl.json'))
      .map((e) => e.name);

    const hasKnownSdl = sdlFiles.some((f) => FILE_SCHEMA_MAP[f]);
    if (hasKnownSdl) {
      results.push(validateDir(dir, platformManifestPath));
    }

    for (const entry of entries) {
      if (entry.isDirectory() && entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
        walk(join(dir, entry.name));
      }
    }
  }

  walk(rootDir);
  return results;
}
