# Skill: Synthesize Platform from Services (UC2)

You are synthesizing a platform-level SDL description from multiple service-level SDL descriptions. Each service has already been described using the `generate-sdl-from-code` skill (UC1), producing 5 `layer_logic` files per service. Your job is to read those files across all services and produce the higher-layer SDL files that describe how the services fit together as a platform.

Your goal: read the layer_logic SDL files from N services and produce 3 SDL files that capture the platform topology, inter-service connections, and cross-service business flows.

## Input

The user will point you at service SDL directories. This could be:
- A list of service directory paths, each containing `layer_logic` SDL files (e.g., `./services/order-service/.sdl/`, `./services/payment-service/.sdl/`)
- A parent directory containing service subdirectories (e.g., `./services/` where each child has a `.sdl/` folder)
- A mix of both

Each service directory must contain at least `manifest.sdl.json`. The other 4 files (`entry-points.sdl.json`, `operations.sdl.json`, `data-shapes.sdl.json`, `dependencies.sdl.json`) improve the quality of synthesis but are not strictly required.

If the user hasn't specified paths, ask them.

The user should also provide (or you should ask for):
- **Platform name** — a human-readable name for the platform (e.g., "E-Commerce Platform")
- **Platform description** — one paragraph describing the business capability this platform delivers

## Output

You will produce 3 files in a target directory (ask the user where, or default to `./.sdl/platform/` at the workspace root):

| File | What it captures |
|------|-----------------|
| `platform.sdl.json` | All services as actors, business domains, shared infrastructure, platform-level stats |
| `platform-connect.sdl.json` | Materialized inter-service connections — every edge in the cross-service dependency graph, with resolution status |
| `service-flows.sdl.json` | Named cross-service business flows — end-to-end interaction sequences that deliver business outcomes |

## Step-by-Step Workflow

### Step 1: Read the SDL spec

Read these files to understand the exact schema each output file must conform to:

- `spec/layer_platform/platform-manifest.schema.json`
- `spec/layer_platform/platform-connect.schema.json`
- `spec/layer_service/service-flow.schema.json`

Read the stdlib for flow actor classification:

- `stdlib/service-flow-actor-kinds.json` — canonical actor kinds with `ai_hint` fields

Read the reference examples to see complete, valid platform-level SDL:

- `examples/layer_platform/ecommerce-platform/platform.sdl.json` — a platform manifest with 6 services
- `examples/layer_platform/ecommerce-platform/platform-connect.sdl.json` — materialized connections
- `examples/layer_service/ecommerce-platform/service-flows.sdl.json` — two cross-service flows

### Step 2: Inventory all services

Read the SDL files from each service directory systematically. For each service:

1. **manifest.sdl.json** (required) — extract: `id`, `label`, `description`, `domain`, `responsibilities`, `technology`, `exposes`, `consumes`, `stats`, `tags`
2. **dependencies.sdl.json** — extract all dependencies, especially:
   - `kind: "service"` — direct service-to-service calls
   - `kind: "message-broker"` — event publishing
   - Note the `interface.protocol` and `interface.calls[]` for each
3. **entry-points.sdl.json** — extract all entry points, especially:
   - `kind: "event-consumer"` — which events each service listens to, including `event.topic`, `event.broker`, `event.consumer_group`
   - `kind: "http-route"` — which REST endpoints are exposed, including `http.method`, `http.path`
   - Note each entry point's `operation_ref`
4. **operations.sdl.json** — extract:
   - `business.domain_events_emitted` — which events each operation publishes
   - `routing.steps[]` — which steps call external services (via `dependency_ref`)
   - `business.failure_modes` — cross-service failure scenarios
5. **data-shapes.sdl.json** — note event payloads (`kind: "event"`) and request/response shapes for cross-service calls

Build a **service registry** — a mental model mapping each service ID to its manifest, dependencies, entry points, operations, and data shapes. This registry is your primary working data for the remaining steps.

**Partial coverage:** If some services are missing SDL files (e.g., only manifest.sdl.json exists), flag them but continue. You can still create ServiceActor entries and unresolved connections for these services.

### Step 3: Generate platform.sdl.json

Build the PlatformManifest by aggregating data from all service manifests.

#### Platform metadata

- `dlVersion`: `"0.1"`
- `id`: ask the user, or derive from the platform name in kebab-case (e.g., `"ecommerce-platform"`)
- `label`: the user-provided platform name (e.g., `"E-Commerce Platform"`)
- `description`: the user-provided description, or write one that summarizes what business capability this platform delivers, what domains it covers, and who its primary users are

#### services[] — ServiceActor entries

For each service in the registry, create a ServiceActor:

- `id`: copy from the service's `manifest.sdl.json` `id` field
- `label`: copy from the service's `manifest.sdl.json` `label` field
- `kind`: infer from the service's characteristics:
  - `"frontend"` — if `technology.platform` contains "browser", "react", "angular", "vue", "next", "mobile", "ios", "android"
  - `"worker"` — if the service has no `http-route` entry points and only has `event-consumer` or `scheduled-job` entry points
  - `"external"` — if the service represents a third-party system modelled as a platform actor
  - Omit `kind` for standard backend services (the default)
- `domain`: copy from the service's `manifest.sdl.json` `domain` field
- `sdl_ref`: the relative path from the platform output directory to the service's `manifest.sdl.json`
- `exposes`: copy from the service's `manifest.sdl.json` `exposes` array
- `consumes`: copy from the service's `manifest.sdl.json` `consumes` array
- `team`: if the service manifest has a `team` field or `tags` that indicate team ownership, use that. Otherwise, ask the user or omit
- `tags`: copy from the service's `manifest.sdl.json` `tags` array

#### domains[]

Collect all unique `domain` values from all service manifests. These should be DDD bounded contexts (e.g., `"order-management"`, `"payments"`), not technical categories.

#### shared_infrastructure

Infer from service dependencies where possible:

- `message_broker`: if any service has a dependency with `kind: "message-broker"`, extract the broker type from `interface.protocol` (kafka, rabbitmq, sqs, etc.)
- `cache`: if any service has a dependency with `kind: "cache"`, extract the cache type from `interface.protocol` (redis, memcached, etc.)
- `service_mesh`: ask the user (not inferable from SDL files alone)
- `deployment_target`: ask the user (not inferable from SDL files alone)

If infrastructure cannot be inferred and the user doesn't provide it, omit the field rather than guessing.

#### stats

Populate with actual counts:
- `services`: number of ServiceActor entries
- `domains`: number of unique domains
- `service_flows`: number of flows generated in Step 5 (fill this in after Step 5)

### Step 4: Generate platform-connect.sdl.json

Build the array of PlatformConnect objects by materializing inter-service connections from two sources.

#### Source A: Synchronous service-to-service calls

For each service's `dependencies.sdl.json`, find entries with `kind: "service"`:

- `id`: `"{source_service_id}->{target_service_id}"` (e.g., `"order-service->inventory-service"`)
- `source_service_id`: the service that declares the dependency
- `target_service_id`: the dependency's `id` (should match another service's manifest `id`)
- `protocol`: from `dependency.interface.protocol` (rest, grpc, graphql, etc.)
- `style`: `"sync"` (service-to-service dependencies are typically synchronous unless the protocol indicates otherwise)
- `dependency_ref`: `{ "service_id": "<source>", "dependency_id": "<dependency_id>" }`
- `status`: determine using resolution logic (see below)

#### Source B: Asynchronous event connections

Build an event map by reading all service manifests:

1. **Producer map**: for each service, extract `event:*` entries from `manifest.exposes[]`. Map each topic to its producer service ID.
2. **Consumer map**: for each service, extract `event:*` entries from `manifest.consumes[]`. Map each topic to its consumer service ID(s).

For each `(topic, producer_service, consumer_service)` triple:

- `id`: `"{producer}->{consumer}:{topic}"` (e.g., `"order-service->payment-service:order.created"`)
- `source_service_id`: the producer service
- `target_service_id`: the consumer service
- `protocol`: infer from service entry-points — if the consumer has an `event-consumer` entry point with `event.broker: "kafka"`, use `"kafka"`. Fall back to the producer's `message-broker` dependency protocol
- `style`: `"async"`
- `status`: `"resolved"` (both sides have SDL and the event topic matches)
- `tags`: include the topic name

#### Status resolution logic

For each PlatformConnect, determine the status:

- **`"resolved"`**: both source and target services have SDL descriptions, AND the target's `exposes` includes an interface that matches what the source calls
- **`"unresolved"`**: the dependency is declared but no SDL description was found for the target service (it wasn't in the input directories)
- **`"mismatch"`**: both services have SDL, but the interfaces don't align — e.g., the source calls `rest:POST /payments` but the target doesn't expose that endpoint, or the event topic names differ

#### Deduplication

If the same connection appears in both Source A (sync dependency) and Source B (async event), keep both — they may represent different interaction patterns between the same services. Use the `id` convention to distinguish them.

### Step 5: Generate service-flows.sdl.json

This is the creative synthesis step. You must identify end-to-end business flows that span multiple services and describe them from a business perspective.

#### Flow discovery heuristics

Use these heuristics to find candidate flows, in priority order:

1. **Trace from externally-triggered entry points.** Find HTTP routes or other external entry points in any service. Read the associated operation. If the operation's `routing.steps[]` calls other services (via `dependency_ref` to a `kind: "service"` dependency), this is a flow starting point. Follow the chain:
   - Each cross-service call is a flow step
   - If an operation emits a domain event (`business.domain_events_emitted`), find which services consume that event (via `entry-points` with `kind: "event-consumer"` matching the topic)
   - Read the consumer's operation to see if it emits further events
   - Continue until no more cross-service hops

2. **Map the domain event graph.** Across all services, collect every `domain_events_emitted` from operations and every `event-consumer` entry point. Draw the graph: producer → event → consumer → (consumer's events) → next consumer. Each connected subgraph is a candidate flow or part of one.

3. **Look for naming patterns.** Operations named `create-*`, `handle-*-completed`, `handle-*-failed`, `process-*`, `initiate-*` often participate in flows. Group them by business domain.

4. **Identify business outcomes.** Each flow should deliver a complete business outcome (e.g., "order is confirmed and fulfilment initiated", "user is registered and welcome email sent"). If a chain of interactions doesn't produce a meaningful business outcome, it may be an implementation detail rather than a flow.

#### Writing each flow

For each discovered flow, create a ServiceFlow object:

- `id`: kebab-case flow name describing the business outcome (e.g., `"checkout-flow"`, `"user-signup-flow"`, `"order-cancellation-flow"`)
- `label`: human-readable (e.g., `"Customer Checkout Flow"`)
- `description`: one paragraph describing the full flow — who initiates it, what happens, what the outcome is

**trigger** (required):
- `actor`: who or what initiates this flow. Use stdlib/service-flow-actor-kinds.json for classification:
  - `"customer"`, `"admin"`, `"operator"` — for human-initiated flows
  - A service id — for service-initiated flows
  - `"scheduled-process"` — for time-triggered flows
  - An external system name — for webhook-initiated flows
- `description`: what the actor does to start the flow (plain language)
- `entry_point_ref`: if the trigger maps to a specific entry point, include `{ "service_id": "...", "entry_point_id": "..." }`

**business** (required — this is the primary audit artifact):
- `summary`: 1-2 sentences describing the business goal of this cross-service flow
- `actors`: all participants — external actors and service names. Use display names (e.g., `"Order Service"`, not `"order-service"`)
- `outcome`: the observable business state after the flow completes successfully
- `failure_modes`: meaningful cross-service failure scenarios. Focus on failures that span boundaries:
  - What happens when a downstream service is unavailable?
  - What happens when an event is lost or delayed?
  - What happens when a business rule rejects the request partway through the flow?
  - Each failure mode has `condition` and `response`

**steps[]** (the ordered sequence of cross-service interactions):
- `id`: sequential numbering. Use `"1"`, `"2"`, `"3"` for sequential steps. Use `"2.a"`, `"2.b"` for parallel steps at the same level
- `from_service`: the service (or external actor) initiating this interaction. Use service ids or actor names
- `to_service`: the service receiving this interaction. Must reference a service id
- `label`: what this interaction does, in plain language
- `protocol`: rest, grpc, kafka, etc.
- `style`: `"sync"` or `"async"`
- `topic`: for async interactions, the event topic name
- `parallel`: `true` if this step runs concurrently with other steps at the same id level
- `entry_point_ref`: link to the target service's entry point, if known
- `dependency_ref`: link to the source service's dependency, if known
- `shape_ref`: the data shape passed in this interaction, if known
- `notes`: design rationale or non-obvious integration notes

**sequence** (optional — the implementation perspective):
- `notes`: technical notes on ordering constraints, retry behaviour, idempotency across services, timing
- `diagram_ref`: path to a sequence diagram if one exists

**tags**: relevant flow-level tags (e.g., `"critical-path"`, `"revenue"`, `"async-leg"`, `"pci-scope"`)

#### Flow grouping guidance

- **One flow per business outcome.** Don't create separate flows for sub-steps. "Checkout" is one flow even if it involves 6 services.
- **Separate flows for separate outcomes.** "Checkout" and "Order Cancellation" are separate flows because they have different triggers and different outcomes.
- **Event fan-outs are steps within a flow, not separate flows.** If `order.confirmed` is consumed by both Fulfilment Service and Notification Service, those are two steps in the same flow.
- **Failure/compensation paths may be separate flows.** If a failure triggers a complex compensation saga (e.g., refund flow), it can be its own flow.

### Step 6: Validate

Run the SDL validator against each output directory:

```bash
npx sdl validate <platform-output-directory>
```

If there are validation errors:
1. Read the error messages
2. Fix the issues in the SDL files
3. Re-validate until clean

Also update the `stats.service_flows` count in `platform.sdl.json` to match the actual number of flows generated.

### Step 7: Present summary

After generating and validating, present a summary to the engineer:

1. **Platform overview** — name, description, number of services, number of domains
2. **Service inventory** — table of services with columns: id, domain, kind, key exposes, key consumes
3. **Connection summary** — total connections, breakdown by status (resolved / unresolved / mismatch), breakdown by style (sync / async)
4. **Flows discovered** — table with columns: flow name, trigger, outcome, number of steps
5. **Coverage gaps** — services with missing or incomplete SDL files, unresolved dependencies, potential mismatches
6. **Recommendations** — what the engineer should verify, what to add manually (e.g., shared_infrastructure details, team ownership, additional flows the AI couldn't infer)

## Quality Criteria

### Platform manifest quality

- Every service in the input has a ServiceActor entry — no services are silently dropped
- Domains are correct DDD bounded contexts (e.g., `"order-management"`), not technical categories (e.g., `"backend"`)
- `sdl_ref` paths are correct relative paths that actually resolve to the service's manifest
- `exposes` and `consumes` arrays are copied accurately from service manifests — don't add or remove entries
- `kind` is inferred correctly: only use `"frontend"`, `"worker"`, `"external"` when the evidence is clear. When in doubt, omit `kind`

### Connection resolution quality

- Every `kind: "service"` dependency produces a PlatformConnect — no connections are silently dropped
- Every `event:*` in `exposes`/`consumes` produces matching async PlatformConnect objects
- Status is honest: mark `"unresolved"` for missing services, `"mismatch"` for interface disagreements. Don't mark everything as `"resolved"` to look clean
- Don't fabricate connections — only materialize what the SDL files actually declare
- Connection `id` values are unique and follow the naming convention consistently

### Service flow quality

- **Business perspective is the primary artifact** — same standard as UC1. Flows must be understandable by someone who has never seen the code
- **Flows represent real end-to-end business outcomes**, not individual API calls. A single REST call to one service is not a flow — it's a connection
- **Steps trace accurately** through the dependency and entry-point chain. Every `from_service` → `to_service` step should correspond to an actual connection found in the platform-connect data
- **Failure modes describe cross-service scenarios**, not single-service errors. "Database query times out" is a single-service error. "Payment Service is unavailable, causing order creation to fail with no payment intent" is a cross-service failure mode
- **Don't invent flows** that the data doesn't support. Fewer accurate flows is better than many speculative ones
- Use `[VERIFY]` annotations for uncertain flow paths: `"[VERIFY] This flow may also trigger a notification to the admin — unclear from the SDL data"`

### Accuracy over completeness

- Only describe connections and flows you can verify from the SDL files. Don't invent business flows that aren't supported by the dependency and event data
- If you're uncertain about a flow path, include it with a note: `"[VERIFY] The inventory release may happen before or after the refund — ordering unclear from event data"`
- Partial platform descriptions are valuable — a platform manifest with 3 of 10 services is still useful as a starting point

### Cross-references

All `*_ref` fields must be internally consistent:
- Every `dependency_ref` in a PlatformConnect must reference an actual dependency id in the source service's `dependencies.sdl.json`
- Every `entry_point_ref` in a ServiceFlow step must reference an actual entry point id in the target service's `entry-points.sdl.json`
- Every `shape_ref` in a ServiceFlow step must reference an actual data shape id in the referenced service's `data-shapes.sdl.json`
- Every `service_id` must match a service id in the platform manifest's `services[]` array

The validator will catch some inconsistencies, but getting cross-references right on first pass avoids iteration.
