# SDL Roadmap

Milestones are traced to the four use cases defined in [USE_CASES.md](USE_CASES.md):
- **UC1** — Bottom-Up: AI reads codebase → SDL → engineer audits → stays in sync
- **UC2** — Top-Down: Requirements → SDL → engineer reviews → AI implements
- **UC3** — Cross-Repo Synthesis: N service SDLs → platform view + service-flow view
- **UC4** — MCP / Skill: AI assistants use SDL natively in IDE

---

## Milestones

### v0.1 — Spec Foundation ✅

**What:** Formal SDL specification as JSON Schema + DL meta-spec (single-service layer only).

- SDL 5 primitives at layer_logic: ServiceManifest, EntryPoint, Operation, DataShape, Dependency
- DL meta-spec: abstract concepts (Unit, Container, Shape, Trigger, Connect, Flow, Perspective)
- Standard library of canonical kinds with `ai_hint` fields for AI tooling
- `order-service` reference example — all 5 files, fully populated

**Unblocks:** Everything. AI can already use this spec to generate layer_logic SDL with raw prompts today.

---

### v0.1.1 — Three-Layer Spec ✅

**What:** Redesigns SDL from a single-service format into a full three-layer language. Introduces the **Layer** concept as a first-class DL primitive and adds new SDL Layers and primitives for platform-level and cross-service descriptions.

**Scope:**
- **DL meta-schema update:** `Layer` added to DL concepts; `layer_ref` field on all primitives; Perspective Contract relaxed — `intent` always required, `implementation` optional; `DLLayer` type definition added
- **SDL Layer registry:** `spec/layers.sdl.json` — three Layers: `layer_platform`, `layer_service`, `layer_logic`
- **`layer_logic` schemas** (moved to `spec/layer_logic/`, all existing schemas updated with `layer_ref`):
  - `operation.schema.json`: **`routing` is now optional** — business perspective is the primary artifact
- **`layer_platform` schemas** (new):
  - `platform-manifest.schema.json` — platform Container with services[] as ServiceActors
  - `platform-connect.schema.json` — materialized inter-service Connect (synthesis output)
- **`layer_service` schemas** (new):
  - `service-flow.schema.json` — cross-service Flow with business (required) + sequence (optional) perspectives
- **New stdlib:** `service-flow-actor-kinds.json` — actor kinds for ServiceFlow steps
- **New examples:**
  - `examples/layer_logic/order-service/` — full 5-file layer_logic example, now with a business-only Operation demonstrating optional routing
  - `examples/layer_platform/ecommerce-platform/platform.sdl.json` — 5-service platform manifest
  - `examples/layer_service/ecommerce-platform/service-flows.sdl.json` — checkout and cancellation flows

---

### v0.1.2 — UI Actor Support

**What:** Formalizes frontend apps (web, mobile) as first-class actors in the platform and service-flow layers. No new zoom layer — a UI app is a ServiceActor like any other, described with `kind: "frontend"`.

**Design decision:** A UI app is not a separate SDL layer. It is a `ServiceActor` at `layer_platform` and an actor in `layer_service` flows, just like any backend service. The distinction is `kind: "frontend"` on the ServiceActor, which signals to renderers and AI tooling that this actor has no server-side entry points and interacts via browser/mobile APIs.

**Scope:**
- **Schema:** `kind` field added to ServiceActor in `platform-manifest.schema.json` — optional string (`"frontend"`, `"worker"`, `"external"`, or omitted for standard backend services)
- **Example update:** `web-storefront` added to `examples/layer_platform/ecommerce-platform/platform.sdl.json` — demonstrates `kind: "frontend"`, `consumes` listing the REST APIs it calls, empty `exposes`
- **Example update:** `examples/layer_service/ecommerce-platform/service-flows.sdl.json` — `from_service: "web-storefront"` replaces `from_service: "customer"` in flow steps where the frontend is the actual API caller; `trigger.actor` remains `"customer"` (the human)

**Key pattern illustrated:** `trigger.actor` = the human who initiated the action; `from_service` in steps = the system actor that makes the actual API call. The Web Storefront is the actor in the flow; the customer is the trigger.

---

### v0.2 — CLI Validator

**What:** Developer tool to validate SDL files against the spec, usable locally and in CI.

**Scope:**
- `sdl validate <dir>` — validates `*.sdl.json` files against their layer schemas
  - JSON Schema validation per primitive (reads `layer_ref` to determine which schema to use)
  - Cross-reference checks: `operation_ref` → must resolve to an Operation id; `dependency_ref` → must resolve to a Dependency id; ServiceFlow `service_id` references → must resolve to services in platform manifest
  - Missing-file warnings
- `sdl init <service-name>` — scaffolds layer_logic SDL stub files for a new service
- Exit codes suitable for CI gates

**Stack:** TypeScript / Node.js

**Enables:** UC1 (quality gate on AI-generated SDL), UC2 (quality gate after each SDL adjustment), UC4 (MCP calls `sdl validate` after writing files)

---

### v0.3 — MCP Server & Generation Skills

**What:** MCP server and prompt skills that give AI assistants the tools to generate, read, validate, and update SDL — covering UC1 generation, UC2 generation + iteration, and UC4 as a whole.

**Scope:**
- **MCP server** (`mcp/`) — tools exposed to AI assistants:
  - `sdl_get_spec` — returns the SDL spec and stdlib as AI-readable context
  - `sdl_validate` — runs the CLI validator and returns structured results
  - `sdl_read` — reads an SDL directory and returns structured content for AI reasoning
  - `sdl_write` — writes AI-generated SDL content to disk
- **Skill definitions** (prompt templates for IDE plugins):
  - `generate-sdl-from-code` (UC1): reads a codebase, outputs layer_logic SDL files
  - `generate-sdl-from-requirements` (UC2): reads a PRD or requirement list, outputs layer_logic SDL files
  - `adjust-sdl-from-feedback` (UC2 iteration): given existing SDL + engineer feedback, outputs revised SDL

**Enables:** UC1 (AI-driven generation), UC2 (AI-driven generation and iteration), UC4 (**core milestone**)

---

### v0.4 — Interactive Renderer

**What:** Browser-based diagram viewer that navigates all three SDL Layers using the Layer zoom chain.

**Scope:**
- Input: an SDL directory (any layer)
- **Layer navigation:** reads `spec/layers.sdl.json` zoom chain to implement zoom in/out generically — same renderer logic at every layer
- **layer_platform view:** service graph with dependency edges; click a service to zoom into layer_logic
- **layer_service view:** flow diagram showing cross-service interactions; click a step to zoom into the referenced EntryPoint
- **layer_logic view:**
  - Service overview: entry points → operations; outbound dependencies shown
  - Operation detail: **perspective toggle** — business ↔ routing
  - Data shape panel: click any shape reference to see fields inline
- Static HTML export for sharing or committing alongside SDL files

**Enables:** UC1 (engineer audits AI-generated SDL as a diagram), UC2 (engineer reviews design before approving), UC3 (platform view rendered from synthesized SDL)

---

### v0.5 — Sync & Feedback Loop

**What:** Closes the full loop for UC1 (code changes → SDL stays current) and UC2 (feedback → SDL adjustment → code generation).

**UC1 — Code sync:**
- `sdl diff <dir>` — human-readable diff between two SDL states expressed in business terms
- Git hook / CI check: warns when source files change but SDL files don't
- `sdl_sync` MCP tool: given a code diff + existing SDL, AI patches only the affected Operations

**UC2 — Feedback loop:**
- Structured feedback format: lightweight annotations engineers add to SDL (`_feedback` fields)
- `adjust-sdl-from-feedback` skill reads structured feedback and proposes SDL revisions
- `sdl approve` command: strips feedback annotations, stamps `approvedAt` — signals SDL is implementation-ready
- Code generation prompt: uses approved SDL as a structured spec for AI to implement from

**Enables:** UC1 (**complete**), UC2 (**complete**)

---

### v1.0 — Cross-Repo Synthesis

**What:** Synthesizes `layer_platform` and `layer_service` SDL from multiple `layer_logic` service directories (UC3).

**`sdl synthesize` tool:**
- Input: a list of SDL directory paths (N services at layer_logic)
- Reads `dependencies.sdl.json` across all services; matches outbound declarations to provider ServiceManifests
- Materializes PlatformConnect objects (inter-Container Connects owned by the platform Container)
- Outputs:
  - `platform.sdl.json` — PlatformManifest with all services as ServiceActors and all resolved PlatformConnect edges
  - `service-flows.sdl.json` — AI-inferred ServiceFlow objects from the synthesized Connect graph

**Architecture renderer:**
- Input: `platform.sdl.json` + `service-flows.sdl.json`
- Directed service graph with protocol labels and resolution status on edges
- Click-through to single-service renderer (v0.4) per service
- Flags: circular dependencies, missing providers, protocol mismatches

**`sdl_synthesize` MCP tool + `analyze-architecture` skill:**
- AI takes N SDL paths, synthesizes, and reasons about the architecture
- Identifies risks: tight coupling, single points of failure, missing circuit breakers

**Enables:** UC3 (**complete**)

---

## Milestone × Use Case

| Milestone | UC1 Bottom-Up | UC2 Top-Down | UC3 Cross-Repo | UC4 MCP/Skill |
|-----------|:---:|:---:|:---:|:---:|
| v0.1 Spec ✅ | foundation | foundation | foundation | foundation |
| v0.1.1 Three-Layer Spec ✅ | layer model | layer model | layer model | layer model |
| v0.1.2 UI Actor Support ✅ | example | example | example | — |
| v0.2 Validator | quality gate | quality gate | — | tool |
| v0.3 MCP + Skills | generation | generation + iterate | — | **core** |
| v0.4 Renderer | audit view | design review | platform view | — |
| v0.5 Sync + Loop | **complete** | **complete** | — | sync tool |
| v1.0 Synthesis | — | — | **complete** | synthesis tool |

---

## Out of Scope

- Real-time collaborative SDL editing
- Non-software DL profiles (BDL, IDL, DDL) — meta-spec is ready but no profiles planned
- SDL as a runtime format — SDL is a *description*, not config or schema consumed at runtime
- Code generation templates — v0.5 uses AI to generate code from SDL, not a template engine
