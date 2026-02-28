# Software Description Language (SDL)

SDL is a structured, machine-readable language for describing the behavior of software services. It sits between high-level architecture diagrams and raw code — describing *what a service does*, from both a business and a technical perspective, in a format that both humans and AI can read.

**AI generates the description. Engineers audit it.**

---

## The Problem

When AI generates code for a service, engineers must read the code to understand what decisions were made. There's no intermediate artifact that says "here's the business logic, here's how the code routes internally, and here are the key decisions at each step."

SDL fills that gap. Instead of reviewing code line-by-line, engineers review a structured description that separates *what* the service does from *how* it does it — and can zoom in from the business rules to the function-level routing.

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

### Use Case 3: Cross-service synthesis (future)
An AI reads SDL descriptions from multiple services and synthesizes a cross-service architecture view, showing how business logic flows across service boundaries.

```
SDL descriptions (N services) → AI synthesizes → architecture view
```

---

## The "Zoom In" Model

SDL is designed around a zoom-in workflow:

```
Architecture view          (cross-service flows — future)
        ↓ zoom in
Service description        (what this service does — SDL)
        ↓ zoom in
Operation detail           (business rules + code routing — SDL)
        ↓ zoom in
Step detail                (specific function call, condition, error handling — SDL)
```

Engineers can navigate from high-level intent down to the specific function call responsible for a business decision.

---

## Two Perspectives, One Description

The heart of SDL is the **Operation** — the unit of work inside a service. Every Operation has two required, switchable perspectives:

| Perspective | Audience | Content |
|-------------|----------|---------|
| `business` | Domain experts, engineers auditing AI logic | Summary, business rules, preconditions, outcomes, failure modes in plain language |
| `routing` | Engineers implementing or reviewing code | Handler function, middleware chain, ordered steps, function calls, error handling |

Same data. Different views. An interactive renderer lets engineers toggle between them.

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
    ],
    "failure_modes": [
      { "condition": "Item out of stock", "response": "Reject with 409 — show which items are unavailable" }
    ]
  },
  "routing": {
    "handler": "OrderController.createOrder",
    "middleware_chain": [
      { "name": "authenticate",      "on_failure": "Return 401" },
      { "name": "validateOrderBody", "on_failure": "Return 422 with field errors" },
      { "name": "rateLimitByUser",   "on_failure": "Return 429 with Retry-After" }
    ],
    "steps": [
      { "id": "1.0", "action": "validate order business rules in-memory", "calls": "OrderValidator.validate" },
      { "id": "2.a", "action": "check stock for all line items",           "calls": "inventoryClient.checkStock", "parallel": true },
      { "id": "2.b", "action": "create Stripe PaymentIntent",              "calls": "paymentClient.createIntent", "parallel": true },
      { "id": "3.0", "action": "persist order with AWAITING_PAYMENT status","calls": "ordersRepository.insert" },
      { "id": "4.0", "action": "publish order.created to Kafka",           "calls": "kafkaProducer.publish" }
    ]
  }
}
```

---

## Five Primitives

SDL describes a service using five JSON files:

| File | Primitive | Describes |
|------|-----------|-----------|
| `manifest.sdl.json` | ServiceManifest | What this service is, what it owns, what interfaces it exposes |
| `entry-points.sdl.json` | EntryPoint | How the outside world initiates activity (HTTP routes, event consumers, cron jobs) |
| `operations.sdl.json` | Operation | What the service does — business perspective + code routing |
| `data-shapes.sdl.json` | DataShape | The structure and meaning of data flowing through the service |
| `dependencies.sdl.json` | Dependency | External resources this service calls (services, databases, queues) |

All files use the `.sdl.json` extension to distinguish them from regular JSON in a codebase.

---

## Quick Start

1. **Describe an existing service**: point an AI at your codebase with the SDL spec as context

   ```
   Read this service and generate an SDL description following the spec at:
   https://github.com/software-description-language/spec/
   ```

2. **Validate the output** against the SDL schemas:

   ```bash
   # coming in v0.2 — SDL CLI validator
   sdl validate ./my-service/
   ```

3. **Review** the generated description, toggle between business and routing views

4. **Commit** the `.sdl.json` files alongside your service code

---

## Example

See `examples/order-service/` for a complete SDL description of an e-commerce order service, including:
- 5 entry points (HTTP routes + Kafka consumers)
- 3 operations with both perspectives fully populated
- 6 data shapes (requests, events, domain entities)
- 5 dependencies (services, database, cache, message broker)

---

## Spec

The SDL specification lives in `spec/`. Each primitive has a JSON Schema:

- [`spec/manifest.schema.json`](spec/manifest.schema.json)
- [`spec/entry-point.schema.json`](spec/entry-point.schema.json)
- [`spec/operation.schema.json`](spec/operation.schema.json)
- [`spec/data-shape.schema.json`](spec/data-shape.schema.json)
- [`spec/dependency.schema.json`](spec/dependency.schema.json)

The standard library of canonical kinds (with `ai_hint` fields for AI tooling):

- [`stdlib/entry-point-kinds.json`](stdlib/entry-point-kinds.json)
- [`stdlib/dependency-kinds.json`](stdlib/dependency-kinds.json)

---

## For Contributors

SDL is implemented as a profile of an abstract meta-spec called **DL — Description Language**, which defines the universal concepts (Unit, Container, Shape, Trigger, Connect, Flow, Perspective) that any domain-specific description language must implement.

If you want to understand the architectural reasoning behind SDL, or define a new DL profile for a different domain (BDL — Business, IDL — Infrastructure), see [`dl/README.md`](dl/README.md).

---

## License

Apache 2.0
