# SDL — Software Description Language

This repo contains the SDL specification, CLI tooling, and reference examples.

SDL is a structured, machine-readable language for describing software at multiple zoom levels. AI generates the description; engineers audit it.

## Project structure

- `spec/` — JSON Schema definitions for all SDL primitives, organized by layer
- `stdlib/` — Canonical kinds with `ai_hint` fields for AI tooling
- `examples/` — Reference SDL descriptions (order-service, ecommerce-platform)
- `cli/` — TypeScript CLI tool (`sdl validate`, `sdl init`, `sdl render`)
- `dl/` — DL meta-specification (the abstract framework SDL is built on)
- `skills/` — Prompt templates for AI-driven SDL workflows
- `docs/decisions/` — Architecture Decision Records

## CLI commands

```bash
cd cli && npm install && npm run build

# Validate SDL files against spec + cross-refs
npx sdl validate <dir>                    # recursive by default
npx sdl validate <dir> --no-recursive     # single directory only
npx sdl validate <dir> --json             # JSON output for CI

# Scaffold a new service
npx sdl init <service-name> --out <dir>

# Generate interactive HTML diagram
npx sdl render <dir> --out <file.html>
```

## Skills

### generate-sdl-from-code (UC1)

Generate layer_logic SDL for a single service from its source code. See `skills/generate-sdl-from-code.md` for the full prompt.

Usage: point an AI assistant at a service codebase and ask it to generate SDL using the skill prompt as instructions.

### synthesize-platform-from-services (UC2)

Synthesize layer_platform and layer_service SDL from multiple service SDL descriptions. See `skills/synthesize-platform-from-services.md` for the full prompt.

Usage: point an AI assistant at a directory containing multiple service SDL outputs (the result of running UC1 on each service) and ask it to synthesize the platform view. Produces `platform.sdl.json`, `platform-connect.sdl.json`, and `service-flows.sdl.json`.

## Key conventions

- All SDL files use the `.sdl.json` extension
- IDs are kebab-case: `order-service`, `create-order`, `payment-completed-event`
- Business perspective is always required; implementation perspective is optional
- The 5 layer_logic files: `manifest.sdl.json`, `entry-points.sdl.json`, `operations.sdl.json`, `data-shapes.sdl.json`, `dependencies.sdl.json`
- The 3 platform-layer files: `platform.sdl.json`, `platform-connect.sdl.json`, `service-flows.sdl.json`
- Run `sdl validate` after any SDL changes
