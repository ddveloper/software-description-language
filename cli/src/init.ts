/**
 * sdl init <service-name>
 *
 * Scaffolds a new layer_logic SDL service directory with stub files for all
 * five primitives: manifest, entry-points, operations, data-shapes, dependencies.
 *
 * The stubs are pre-populated with the minimum required fields and
 * illustrative placeholder content so engineers can edit rather than write from scratch.
 */

import { mkdirSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';

function toLabel(id: string): string {
  return id
    .split(/[-_]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function stub(content: unknown): string {
  return JSON.stringify(content, null, 2) + '\n';
}

export function initService(serviceName: string, targetDir: string): void {
  const serviceDir = join(targetDir, serviceName);

  if (existsSync(serviceDir)) {
    throw new Error(`Directory already exists: ${serviceDir}`);
  }

  mkdirSync(serviceDir, { recursive: true });

  const label = toLabel(serviceName);

  // manifest.sdl.json
  writeFileSync(
    join(serviceDir, 'manifest.sdl.json'),
    stub({
      dlVersion: '0.1',
      id: serviceName,
      label,
      description: `TODO: Describe what ${label} owns and why it exists.`,
      domain: 'TODO: e.g. order-management',
      responsibilities: [
        'TODO: List what this service is responsible for',
      ],
      technology: {
        language: 'TypeScript',
        framework: 'Express',
        runtime: 'Node 20',
        platform: 'Kubernetes',
      },
      exposes: [
        'TODO: e.g. rest:POST /your-resource',
        'TODO: e.g. event:your-event.created',
      ],
      consumes: [
        'TODO: e.g. event:other.event',
      ],
      tags: [],
    }),
  );

  // operations.sdl.json
  writeFileSync(
    join(serviceDir, 'operations.sdl.json'),
    stub([
      {
        id: 'create-resource',
        label: 'Create Resource',
        description: 'TODO: Describe what this operation does.',
        business: {
          summary: 'TODO: One or two sentences describing the business goal.',
          rules: [
            'TODO: Add business rules — e.g. "An order cannot be created if any line item is out of stock."',
          ],
          preconditions: ['TODO: What must be true before this operation runs.'],
          outcomes: ['TODO: Observable state changes when this succeeds.'],
          failure_modes: [
            {
              condition: 'TODO: What goes wrong',
              response: 'TODO: How the system responds',
            },
          ],
        },
        input_shape_ref: 'create-resource-request',
        output_shape_ref: 'create-resource-response',
        tags: [],
      },
    ]),
  );

  // entry-points.sdl.json
  writeFileSync(
    join(serviceDir, 'entry-points.sdl.json'),
    stub([
      {
        id: 'create-resource-route',
        kind: 'http-route',
        label: 'POST /your-resource',
        description: 'TODO: Describe what arrives here.',
        operation_ref: 'create-resource',
        http: {
          method: 'POST',
          path: '/your-resource',
          auth: 'jwt',
          middleware: ['authenticate'],
        },
        input_shape_ref: 'create-resource-request',
        tags: [],
      },
    ]),
  );

  // data-shapes.sdl.json
  writeFileSync(
    join(serviceDir, 'data-shapes.sdl.json'),
    stub([
      {
        id: 'create-resource-request',
        label: 'Create Resource Request',
        kind: 'request',
        description: 'TODO: Describe the inbound payload.',
        fields: [
          {
            name: 'exampleField',
            type: 'string',
            required: true,
            description: 'TODO: Describe this field.',
          },
        ],
        tags: [],
      },
      {
        id: 'create-resource-response',
        label: 'Create Resource Response',
        kind: 'response',
        description: 'TODO: Describe what this operation returns.',
        fields: [
          {
            name: 'id',
            type: 'string',
            required: true,
            description: 'The id of the created resource.',
          },
        ],
        tags: [],
      },
    ]),
  );

  // dependencies.sdl.json
  writeFileSync(
    join(serviceDir, 'dependencies.sdl.json'),
    stub([
      {
        id: `${serviceName}-db`,
        kind: 'database',
        label: `${label} PostgreSQL`,
        description: `Primary datastore for ${label}. Owns all persistent state.`,
        interface: {
          protocol: 'database',
          calls: [
            {
              label: 'INSERT into resources table',
              style: 'sync',
              purpose: 'Persist new resource records.',
            },
          ],
        },
        reliability: {
          timeout_ms: 3000,
          retry: false,
          circuit_breaker: false,
          fallback: 'Fail fast — no cached fallback for writes.',
        },
        tags: [],
      },
    ]),
  );
}
