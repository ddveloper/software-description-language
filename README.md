# Software Description Language (SDL)

SDL is a structured, machine-readable language for describing software at every zoom level — from a full platform topology down to the internal business logic of a single service. It sits between high-level architecture diagrams and raw code, describing *what software does* in a format that both humans and AI can read and navigate.

**AI generates the description. Engineers audit it.**

---

## The Problem

When AI generates code for a service, engineers must read the code to understand what decisions were made. And when multiple services interact, there is no shared artifact that describes *how they fit together* — only individual READMEs, scattered wikis, and undocumented Kafka topics.

SDL fills these gaps with a three-layer description that lets engineers zoom in from platform topology to individual business rules — and back out again.

---

## Three Layers, One Language

SDL describes software at three zoom levels. Each layer uses the same abstract concepts (Container, Unit, Flow, Connect, Shape, Perspective) at a different scale, so the renderer uses the same logic at every level.

```
layer_platform  — Platform
  All services visible as actors. Cross-service topology and ownership.
  Primitives: PlatformManifest, ServiceActor, PlatformConnect (synthesized)

        ↓ zoom in

layer_service  — Service Interaction
  How services talk to each other. Cross-service business flows.
  Primitives: ServiceFlow  (business required, sequence optional)

        ↓ zoom in

layer_logic  — Service Logic
  Internal business logic units inside one service.
  Primitives: ServiceManifest, EntryPoint, Operation, DataShape, Dependency
  business = REQUIRED,  routing = OPTIONAL

        ↓
  Code  — AI territory. Engineers stop auditing here.
```

The three SDL Layers are defined as first-class DL Layer concepts in `spec/layers.sdl.json`. Future profiles (BDL, IDL) declare their own Layer stacks.

---

## The Three Use Cases

### Use Case 1: Describe existing code (bottom-up)
An AI reads a codebase and generates an SDL description. Engineers review the description — not the code — to audit what the AI understood and flag mismatches.

```
existing code → AI reads → SDL description → engineer reviews
```

### Use Case 2: Plan before coding (top-down)
An AI or engineer writes an SDL description before any code exists. The description is reviewed and approved. Then the AI implements the code against it.

```
SDL description → engineer approves → AI implements code
```

### Use Case 3: Cross-service synthesis (layer_platform + layer_service)
An AI reads SDL descriptions from multiple services and synthesizes a cross-service architecture view, showing how business logic flows across service boundaries.

```
SDL descriptions (N services) → AI synthesizes → platform.sdl.json + service-flows.sdl.json
```

---

## Perspectives — Business Always Primary

Every SDL primitive has a required **business** perspective (the intent view, always the primary artifact) and an optional **implementation** perspective. The same principle applies at every layer:

| Layer | Required perspective | Optional perspective |
|---|---|---|
| `layer_platform` | `business` — what the platform does | `topology` — how it's deployed |
| `layer_service` | `business` — what the cross-service flow achieves | `sequence` — technical call order |
| `layer_logic` | `business` — what the operation does | `routing` — code handler and steps |

The business perspective is what engineers audit. The implementation perspective is what AI uses to understand and generate code. An interactive renderer lets engineers toggle between them.

**Why routing is optional at `layer_logic`:** Below the business description is code — AI handles code routing perfectly. Engineers review business rules; AI generates the implementation. Populate `routing` when you want full traceability from business rule to function call, omit it when AI handles code generation.

---

## Primitives by Layer

### `layer_platform` — Platform

| File | Primitive | DL Concept | Describes |
|---|---|---|---|
| `platform.sdl.json` | PlatformManifest | Container | The platform — all services as actors, domains, shared infrastructure |
| *(inline in platform.sdl.json)* | ServiceActor | Container (child) | A service as seen from the platform level |
| *(synthesis output)* | PlatformConnect | Connect | A materialized inter-service connection edge |

### `layer_service` — Service Interaction

| File | Primitive | DL Concept | Describes |
|---|---|---|---|
| `service-flows.sdl.json` | ServiceFlow | Flow + Connect | A cross-service business flow — who talks to whom, and why |

### `layer_logic` — Service Logic

| File | Primitive | DL Concept | Describes |
|---|---|---|---|
| `manifest.sdl.json` | ServiceManifest | Container | What this service is, what it owns, what interfaces it exposes |
| `entry-points.sdl.json` | EntryPoint | Trigger | How the outside world initiates activity (HTTP routes, events, cron jobs) |
| `operations.sdl.json` | Operation | Unit + Flow + Perspective | Business logic units — rules, outcomes, and optionally code routing |
| `data-shapes.sdl.json` | DataShape | Shape | The structure and meaning of data flowing through the service |
| `dependencies.sdl.json` | Dependency | Connect (candidate) | External resources this service calls (services, databases, queues) |

All files use the `.sdl.json` extension to distinguish them from regular JSON in a codebase.

---

## Example: Operation with and without routing

**Business-only Operation** (routing omitted — AI handles code):

```json
{
  "id": "get-order",
  "label": "Get Order",
  "business": {
    "summary": "Returns the current state of an order to the authenticated requester.",
    "rules": [
      "A customer may only view their own orders.",
      "Admins may view any order regardless of ownership.",
      "A request for a non-existent order ID returns 404 — no other order information is revealed."
    ],
    "failure_modes": [
      { "condition": "Order not found or belongs to another user", "response": "404 Not Found" }
    ]
  }
}
```

**Operation with routing** (full traceability):

```json
{
  "id": "create-order",
  "label": "Create Order",
  "business": {
    "summary": "Accepts a customer's order and initiates the checkout process.",
    "rules": [
      "An order must contain at least one line item with a positive quantity.",
      "Orders over $10,000 are flagged for manual review.",
      "A customer may not place more than 5 orders per 24-hour window."
    ]
  },
  "routing": {
    "handler": "OrderController.createOrder",
    "steps": [
      { "id": "1.0", "action": "validate order business rules in-memory",    "calls": "OrderValidator.validate" },
      { "id": "2.a", "action": "check stock for all line items",              "calls": "inventoryClient.checkStock",  "parallel": true },
      { "id": "2.b", "action": "create Stripe PaymentIntent",                 "calls": "paymentClient.createIntent",  "parallel": true },
      { "id": "3.0", "action": "persist order with AWAITING_PAYMENT status",  "calls": "ordersRepository.insert" },
      { "id": "4.0", "action": "publish order.created to Kafka via outbox",   "calls": "kafkaProducer.publish" }
    ]
  }
}
```

---

## Quick Start

1. **Describe an existing service** (`layer_logic`): point an AI at your codebase with the SDL spec as context

   ```
   Read this service and generate an SDL description following the spec at:
   https://github.com/software-description-language/spec/layer_logic/
   ```

2. **Validate the output** against the SDL schemas:

   ```bash
   # coming in v0.2 — SDL CLI validator
   sdl validate ./my-service/
   ```

3. **Review** the generated description, toggle between business and routing views

4. **Commit** the `.sdl.json` files alongside your service code

5. **Synthesize platform view** (`layer_platform`): point an AI at multiple service SDL directories to generate `platform.sdl.json` + `service-flows.sdl.json`

---

## Examples

See `examples/` for complete SDL descriptions organized by layer:

- [`examples/layer_logic/order-service/`](examples/layer_logic/order-service/) — a complete `layer_logic` description of an e-commerce order service (5 files, 4 operations including one business-only)
- [`examples/layer_platform/ecommerce-platform/`](examples/layer_platform/ecommerce-platform/) — a `layer_platform` description of the full e-commerce platform (5 services, 5 domains)
- [`examples/layer_service/ecommerce-platform/`](examples/layer_service/ecommerce-platform/) — two `layer_service` ServiceFlows: checkout and order cancellation

---

## Spec

The SDL specification lives in `spec/`. The Layer registry:

- [`spec/layers.sdl.json`](spec/layers.sdl.json) — the three SDL Layers (layer_platform, layer_service, layer_logic)

Schemas by layer:

**`layer_platform`**
- [`spec/layer_platform/platform-manifest.schema.json`](spec/layer_platform/platform-manifest.schema.json)
- [`spec/layer_platform/platform-connect.schema.json`](spec/layer_platform/platform-connect.schema.json)

**`layer_service`**
- [`spec/layer_service/service-flow.schema.json`](spec/layer_service/service-flow.schema.json)

**`layer_logic`**
- [`spec/layer_logic/manifest.schema.json`](spec/layer_logic/manifest.schema.json)
- [`spec/layer_logic/entry-point.schema.json`](spec/layer_logic/entry-point.schema.json)
- [`spec/layer_logic/operation.schema.json`](spec/layer_logic/operation.schema.json)
- [`spec/layer_logic/data-shape.schema.json`](spec/layer_logic/data-shape.schema.json)
- [`spec/layer_logic/dependency.schema.json`](spec/layer_logic/dependency.schema.json)

Standard library of canonical kinds (with `ai_hint` fields for AI tooling):

- [`stdlib/entry-point-kinds.json`](stdlib/entry-point-kinds.json)
- [`stdlib/dependency-kinds.json`](stdlib/dependency-kinds.json)
- [`stdlib/service-flow-actor-kinds.json`](stdlib/service-flow-actor-kinds.json)

---

## For Contributors

SDL is implemented as a profile of an abstract meta-spec called **DL — Description Language**, which defines universal concepts (Layer, Unit, Container, Shape, Trigger, Connect, Flow, Perspective) that any domain-specific description language must implement.

The **Layer** concept is key: SDL declares three Layers in `spec/layers.sdl.json`. Every primitive carries a `layer_ref` pointing to its Layer. The renderer reads the Layer zoom chain (`zooms_into` / `zooms_out_to`) to implement navigation without per-layer custom logic.

If you want to understand the architectural reasoning behind SDL, or define a new DL profile for a different domain (BDL — Business, IDL — Infrastructure), see [`dl/README.md`](dl/README.md).

---

## License

Apache 2.0
