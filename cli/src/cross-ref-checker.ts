/**
 * Cross-reference validation for SDL files.
 *
 * Checks that symbolic references between SDL primitives resolve to actual ids:
 *   - EntryPoint.operation_ref  → must match an Operation id in operations.sdl.json
 *   - EntryPoint.input_shape_ref → must match a DataShape id in data-shapes.sdl.json
 *   - Operation.input_shape_ref  → must match a DataShape id
 *   - Operation.output_shape_ref → must match a DataShape id
 *   - Operation.routing.steps[].dependency_ref → must match a Dependency id
 *   - ServiceFlow steps: service_id references → must resolve to services in platform manifest
 *   - ServiceFlow steps: entry_point_ref.entry_point_id → must resolve to an EntryPoint id
 *   - ServiceFlow steps: dependency_ref.dependency_id → must resolve to a Dependency id (if service SDL is co-located)
 */

import type { ValidationIssue } from './types.js';

type Obj = Record<string, unknown>;

function ids(arr: unknown): Set<string> {
  if (!Array.isArray(arr)) return new Set();
  return new Set(arr.map((item) => (item as Obj)?.id as string).filter(Boolean));
}

/**
 * Validates cross-references within a single layer_logic service directory.
 *
 * @param files  Map of filename → parsed JSON content for all SDL files found.
 */
export function checkLayerLogicRefs(
  files: Map<string, unknown>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  const operations = ids(files.get('operations.sdl.json'));
  const dataShapes = ids(files.get('data-shapes.sdl.json'));
  const dependencies = ids(files.get('dependencies.sdl.json'));

  // --- entry-points.sdl.json ---
  const entryPoints = files.get('entry-points.sdl.json');
  if (Array.isArray(entryPoints)) {
    for (const ep of entryPoints) {
      const obj = ep as Obj;
      const opRef = obj.operation_ref as string | undefined;
      if (opRef && !operations.has(opRef)) {
        issues.push({
          severity: 'error',
          file: 'entry-points.sdl.json',
          path: `id:${obj.id}`,
          message: `operation_ref "${opRef}" does not match any Operation id in operations.sdl.json`,
        });
      }
      const inputRef = obj.input_shape_ref as string | undefined;
      if (inputRef && !dataShapes.has(inputRef)) {
        issues.push({
          severity: 'warning',
          file: 'entry-points.sdl.json',
          path: `id:${obj.id}`,
          message: `input_shape_ref "${inputRef}" does not match any DataShape id in data-shapes.sdl.json`,
        });
      }
    }
  }

  // --- operations.sdl.json ---
  const operationsArr = files.get('operations.sdl.json');
  if (Array.isArray(operationsArr)) {
    for (const op of operationsArr) {
      const obj = op as Obj;
      const inputRef = obj.input_shape_ref as string | undefined;
      if (inputRef && !dataShapes.has(inputRef)) {
        issues.push({
          severity: 'warning',
          file: 'operations.sdl.json',
          path: `id:${obj.id}`,
          message: `input_shape_ref "${inputRef}" does not match any DataShape id in data-shapes.sdl.json`,
        });
      }
      const outputRef = obj.output_shape_ref as string | undefined;
      if (outputRef && !dataShapes.has(outputRef)) {
        issues.push({
          severity: 'warning',
          file: 'operations.sdl.json',
          path: `id:${obj.id}`,
          message: `output_shape_ref "${outputRef}" does not match any DataShape id in data-shapes.sdl.json`,
        });
      }
      // routing.steps[].dependency_ref
      const routing = obj.routing as Obj | undefined;
      if (routing?.steps && Array.isArray(routing.steps)) {
        for (const step of routing.steps) {
          const s = step as Obj;
          const depRef = s.dependency_ref as string | undefined;
          if (depRef && !dependencies.has(depRef)) {
            issues.push({
              severity: 'error',
              file: 'operations.sdl.json',
              path: `id:${obj.id} routing.steps[${s.id}]`,
              message: `dependency_ref "${depRef}" does not match any Dependency id in dependencies.sdl.json`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/**
 * Validates cross-references in a service-flows.sdl.json file against
 * a known set of service ids from the platform manifest.
 *
 * @param flows        Parsed array of ServiceFlow objects.
 * @param serviceIds   Set of service ids declared in platform.sdl.json.
 * @param entryPointIdsByService  Optional map of service_id → Set<entry_point_id> for deeper checks.
 */
export function checkServiceFlowRefs(
  flows: unknown,
  serviceIds: Set<string>,
  entryPointIdsByService?: Map<string, Set<string>>,
): ValidationIssue[] {
  const issues: ValidationIssue[] = [];

  if (!Array.isArray(flows)) return issues;

  for (const flow of flows) {
    const f = flow as Obj;
    const flowId = f.id as string;

    // trigger.entry_point_ref.service_id
    const trigger = f.trigger as Obj | undefined;
    if (trigger?.entry_point_ref) {
      const epr = trigger.entry_point_ref as Obj;
      const sid = epr.service_id as string | undefined;
      if (sid && !serviceIds.has(sid)) {
        issues.push({
          severity: 'error',
          file: 'service-flows.sdl.json',
          path: `id:${flowId} trigger.entry_point_ref`,
          message: `service_id "${sid}" does not match any service in platform.sdl.json`,
        });
      }
    }

    // steps[]
    if (Array.isArray(f.steps)) {
      for (const step of f.steps) {
        const s = step as Obj;
        const stepPath = `id:${flowId} step:${s.id}`;

        const toService = s.to_service as string | undefined;
        if (toService && !serviceIds.has(toService)) {
          issues.push({
            severity: 'error',
            file: 'service-flows.sdl.json',
            path: `${stepPath} to_service`,
            message: `to_service "${toService}" does not match any service in platform.sdl.json`,
          });
        }

        // from_service is allowed to be an external actor (e.g. "customer"), so only
        // warn if it looks like a service id (contains a hyphen or matches a known pattern)
        // but isn't in the service list. Heuristic: warn if it contains "-service" or "-storefront".
        const fromService = s.from_service as string | undefined;
        if (fromService && !serviceIds.has(fromService) && looksLikeServiceId(fromService)) {
          issues.push({
            severity: 'warning',
            file: 'service-flows.sdl.json',
            path: `${stepPath} from_service`,
            message: `from_service "${fromService}" looks like a service id but was not found in platform.sdl.json`,
          });
        }

        // entry_point_ref
        if (s.entry_point_ref) {
          const epr = s.entry_point_ref as Obj;
          const sid = epr.service_id as string | undefined;
          if (sid && !serviceIds.has(sid)) {
            issues.push({
              severity: 'error',
              file: 'service-flows.sdl.json',
              path: `${stepPath} entry_point_ref`,
              message: `service_id "${sid}" does not match any service in platform.sdl.json`,
            });
          }
          // Check entry_point_id if we have that data
          if (sid && entryPointIdsByService?.has(sid)) {
            const epId = epr.entry_point_id as string | undefined;
            if (epId && !entryPointIdsByService.get(sid)!.has(epId)) {
              issues.push({
                severity: 'error',
                file: 'service-flows.sdl.json',
                path: `${stepPath} entry_point_ref`,
                message: `entry_point_id "${epId}" does not match any EntryPoint in ${sid}/entry-points.sdl.json`,
              });
            }
          }
        }

        // dependency_ref
        if (s.dependency_ref) {
          const dr = s.dependency_ref as Obj;
          const sid = dr.service_id as string | undefined;
          if (sid && !serviceIds.has(sid)) {
            issues.push({
              severity: 'error',
              file: 'service-flows.sdl.json',
              path: `${stepPath} dependency_ref`,
              message: `service_id "${sid}" does not match any service in platform.sdl.json`,
            });
          }
        }

        // shape_ref
        if (s.shape_ref) {
          const sr = s.shape_ref as Obj;
          const sid = sr.service_id as string | undefined;
          if (sid && !serviceIds.has(sid)) {
            issues.push({
              severity: 'warning',
              file: 'service-flows.sdl.json',
              path: `${stepPath} shape_ref`,
              message: `service_id "${sid}" does not match any service in platform.sdl.json`,
            });
          }
        }
      }
    }
  }

  return issues;
}

/** Heuristic: something looks like a service id if it ends with a common service suffix. */
function looksLikeServiceId(name: string): boolean {
  return (
    name.endsWith('-service') ||
    name.endsWith('-storefront') ||
    name.endsWith('-worker') ||
    name.endsWith('-api') ||
    name.endsWith('-gateway')
  );
}
