# Skill: Generate SDL from Code (UC1)

You are generating an SDL (Software Description Language) description for an existing codebase. SDL describes what software does in a structured, machine-readable format that engineers can audit without reading every source file.

Your goal: read the source code and produce 5 SDL files that capture the service's business logic, entry points, data shapes, and dependencies.

## Input

The user will point you at a service codebase. This could be:
- A directory path (e.g., `./src/`, `./services/order-service/`)
- A repo root
- A specific set of files

If the user hasn't specified a path, ask them.

## Output

You will produce 5 files in a target directory (ask the user where, or default to `./.sdl/` at the service root):

| File | What it captures |
|------|-----------------|
| `manifest.sdl.json` | What this service is, what it owns, what interfaces it exposes |
| `entry-points.sdl.json` | How the outside world triggers activity (HTTP routes, event consumers, cron jobs, etc.) |
| `operations.sdl.json` | Business logic units — rules, outcomes, and optionally code routing |
| `data-shapes.sdl.json` | The structure and meaning of data flowing through the service |
| `dependencies.sdl.json` | External resources this service calls (other services, databases, caches, brokers, APIs) |

## Step-by-Step Workflow

### Step 1: Read the SDL spec

Read these files to understand the exact schema each SDL file must conform to:

- `spec/layer_logic/manifest.schema.json`
- `spec/layer_logic/entry-point.schema.json`
- `spec/layer_logic/operation.schema.json`
- `spec/layer_logic/data-shape.schema.json`
- `spec/layer_logic/dependency.schema.json`

Read the stdlib for classification guidance:

- `stdlib/entry-point-kinds.json` — canonical entry point kinds with `ai_hint` fields
- `stdlib/dependency-kinds.json` — canonical dependency kinds with `ai_hint` fields

Read the reference example to see a complete, valid SDL description:

- `examples/layer_logic/order-service/` — all 5 files

### Step 2: Scan the codebase

Read the source code systematically. Focus on:

1. **Project structure** — understand the directory layout, framework, and language
2. **Entry points** — find all routes, event handlers, scheduled jobs, CLI commands, gRPC methods. Look in:
   - Route definitions / controller files
   - Event consumer registrations
   - Cron/scheduler configurations
   - Main/startup files for registered handlers
3. **Operations / business logic** — for each entry point, trace the handler to understand:
   - What business rules govern this operation
   - What preconditions must be true
   - What outcomes occur on success
   - What failure modes exist and how they're handled
   - What domain events are emitted
4. **Data shapes** — identify request payloads, response formats, domain entities, and events:
   - Schema definitions (Zod, JSON Schema, Protobuf, TypeScript interfaces)
   - Database entity definitions
   - Event payload types
5. **Dependencies** — find all external resources:
   - HTTP/gRPC clients to other services
   - Database connections and repositories
   - Cache clients (Redis, Memcached)
   - Message broker producers (Kafka, SQS, RabbitMQ)
   - Third-party API clients (Stripe, Twilio, etc.)
   - Object storage clients (S3, GCS)

### Step 3: Generate the SDL files

Write the 5 SDL files. Follow these rules:

#### General rules

- **`dlVersion`** is `"0.1"` (in manifest only)
- **`id`** fields use kebab-case: `create-order`, `inventory-service`, `payment-completed-event`
- **`label`** fields are human-readable: `"Create Order"`, `"Inventory Service"`
- All arrays of primitives (entry-points, operations, data-shapes, dependencies) are JSON arrays at the top level: `[ { ... }, { ... } ]`
- The manifest is a single object (not an array)

#### manifest.sdl.json

- `id`: the service name in kebab-case
- `description`: one paragraph — write for a senior engineer reading cold
- `domain`: the business domain (DDD bounded context)
- `responsibilities`: plain-language list of what this service is responsible for
- `technology`: language, framework, runtime, platform
- `exposes`: interfaces exposed to the outside world using protocol-prefixed notation (`"rest:POST /orders"`, `"event:order.created"`, `"grpc:OrderService/CreateOrder"`)
- `consumes`: external interfaces this service depends on (same notation)
- `stats`: populate with actual counts of entry points, operations, data shapes, and dependencies

#### entry-points.sdl.json

- One entry per externally-reachable trigger
- `kind`: classify using stdlib/entry-point-kinds.json — read the `ai_hint` for each kind
- `operation_ref`: must reference a valid Operation `id` in operations.sdl.json
- For `http-route`: populate the `http` block (method, path, auth, middleware)
- For `event-consumer`: populate the `event` block (topic, broker, consumer_group, idempotency)
- For `scheduled-job`: populate the `schedule` block (cron, timezone, description)
- `input_shape_ref`: reference a DataShape id if there's a known input payload

#### operations.sdl.json

- One entry per distinct unit of business logic
- **`business` block is required** — this is the primary audit artifact:
  - `summary`: 1-2 sentences describing the business goal
  - `rules`: plain-language business rules a domain expert would articulate. Be specific — include thresholds, limits, and conditions
  - `preconditions`: what must be true before this operation runs
  - `outcomes`: observable state changes after success (plain language, not HTTP codes)
  - `failure_modes`: each with `condition` and `response`
  - `domain_events_emitted`: events produced on success (past-tense: `"order.created"`)
- **`routing` block is optional** — include it when the code has interesting routing logic (middleware chains, multi-step orchestration, parallel calls, saga patterns). Omit it for simple CRUD operations where the routing is obvious
  - When included: `handler`, `steps[]` with `id`, `action`, `calls`, `dependency_ref`
  - Step IDs are hierarchical: `"1.0"`, `"2.a"`, `"2.b"` (sequential and parallel)
- `input_shape_ref` / `output_shape_ref`: reference DataShape ids

#### data-shapes.sdl.json

- One entry per distinct data structure flowing through the service
- `kind`: classify as `"request"`, `"response"`, `"domain-entity"`, `"event"`, `"command"`, `"value-object"`, `"error"`, `"internal"`, or `"custom"`
- `fields`: describe each field with `name`, `type`, `description`, and optionally `required`, `constraints`, `pii`, `sensitive`
- `schema_ref`: if a formal schema exists (Zod, Protobuf, etc.), reference it with `type` and `ref`
- Mark PII fields (`pii: true`) and sensitive fields (`sensitive: true`)

#### dependencies.sdl.json

- One entry per external resource this service calls
- `kind`: classify using stdlib/dependency-kinds.json — read the `ai_hint` for each kind
- `interface.protocol`: how the service talks to this dependency
- `interface.calls[]`: list each distinct operation/endpoint called, with `label`, `method_ref`, `style`, `purpose`
- `reliability`: include `timeout_ms`, `retry`, `circuit_breaker`, `fallback` when the code has this information
- `client_ref`: the client class/module and file path if identifiable

### Step 4: Validate

Run the SDL validator against the generated files:

```bash
npx sdl validate <output-directory>
```

If there are validation errors:
1. Read the error messages
2. Fix the issues in the SDL files
3. Re-validate until clean

### Step 5: Present summary

After generating and validating, present a summary to the engineer:

1. **Service overview** — what the service does (from the manifest)
2. **Entry points found** — list with kind and label
3. **Operations** — list with summary of business rules
4. **Dependencies** — list with kind and label
5. **Coverage notes** — anything you couldn't describe or were uncertain about
6. **Routing decisions** — which operations got a routing block and why; which were left business-only

## Quality Criteria

### Business perspective quality

The business perspective is the primary artifact — it's what engineers audit. Ensure:

- **Rules are specific**, not vague. "Orders over $10,000 are flagged for manual review" is good. "Orders are validated" is too vague.
- **Failure modes are concrete**. Include what the user sees, not just internal error types.
- **Outcomes describe state changes**, not HTTP responses. "Order is persisted with AWAITING_PAYMENT status" is good. "Returns 201 Created" is not a business outcome.
- **Domain events are past-tense**: `"order.created"`, not `"create-order"`.

### Accuracy over completeness

- Only describe what you can verify from the code. Don't invent business rules that aren't there.
- If you're uncertain about a rule, include it with a note: `"[VERIFY] Orders over $10,000 may be flagged — threshold seen in config but rule path is unclear"`
- It's better to have fewer, accurate operations than many speculative ones.

### Routing decisions

- Include routing for operations with non-trivial orchestration: multi-step workflows, parallel calls, saga patterns, complex middleware chains
- Skip routing for simple CRUD: a handler that reads from a DB and returns — the business block tells the full story
- When in doubt, omit routing. Engineers can always ask for it later.

### Cross-references

All `*_ref` fields must be internally consistent:
- Every `operation_ref` in entry-points must match an Operation `id`
- Every `dependency_ref` in routing steps must match a Dependency `id`
- Every `input_shape_ref` / `output_shape_ref` must match a DataShape `id`

The validator will catch inconsistencies, but getting them right on first pass avoids iteration.
