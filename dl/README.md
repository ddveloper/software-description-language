# DL — Description Language

DL is the abstract meta-specification behind the Software Description Language (SDL) project. It defines the universal primitives that any domain-specific description language must implement.

**This document is for contributors** who want to understand why SDL is designed the way it is, or who want to define a new DL profile for a different domain (e.g., BDL — Business Description Language, IDL — Infrastructure Description Language).

Engineers using SDL do not need to read this. See the main [README](../README.md) instead.

---

## The Three DL Structural Layers

DL organizes every description into three structural layers. Each layer builds on the previous. These are **not** the same as zoom Layers — see "The Layer Concept" section below.

### 1. Schema Layer — What exists (static structure)

| Concept | Definition |
|---------|------------|
| **Unit** | The primary actor that performs work. The smallest describable thing in the domain. |
| **Container** | A bounded, recursive grouping of Units or other Containers. Containers can nest arbitrarily deep. |
| **Shape** | The structure of data — inputs and outputs of Units, payloads attached to Connects. |
| **Layer** | A named zoom scope — the scale at which descriptions are written. Layers are ordered and linked; the same DL concepts instantiate differently at each Layer. Defined per-profile in a Layer registry. |

Container is **recursive**: a system can contain service Containers; a service Container contains operation Units. The same model works at any zoom level.

### 2. Semantic Layer — What happens (dynamic behavior)

| Concept | Definition |
|---------|------------|
| **Trigger** | External initiation that crosses a Container boundary inward. Starts a Flow. |
| **Connect** | Unit-to-Unit propagation within or between Containers. Has: direction, protocol, and an optional Shape (data attached). |
| **Flow** | A named, ordered sequence: `Trigger → (Unit via Connect)*` with labeled Steps. |

**Connect scoping rule**: A Connect is always owned by the Container that contains both its source and target.
- **Intra-Container Connect**: both source and target are in the same Container (e.g., internal function call within a service)
- **Inter-Container Connect**: source and target are in different child Containers → owned by the **parent** Container, not either child

This means cross-service calls are not declared by either service directly. Instead, each service declares outbound **candidate Connects** (its dependency list). A synthesis tool at the parent level reads all children and materializes the inter-Container Connects.

### 3. Presentation Layer — How it's rendered

| Concept | Definition |
|---------|------------|
| **Perspective** | A named view rendering a specific subset of the semantic/schema data. |
| **Theme** | Visual styling — colors, fonts, icon sets. |
| **Template** | Structural rendering pattern — node-edge graph, sequence diagram, decision tree. |

**Perspective Contract** (governed per-Layer — see "The Layer Concept" below):
- Every Unit must be describable from all declared Perspectives
- At least one Perspective with role **`intent`** is always required — it is the primary artifact that humans audit. Written in plain language for domain experts.
- A Perspective with role **`implementation`** is optional. It may be omitted when the implementation is delegated to AI tooling. When present it is written in technical terms for engineers.
- Switching between Perspectives must not lose information (same underlying data, different render)
- The intent Perspective is always the primary artifact; implementation Perspectives are supplementary

---

## The Layer Concept

**Layer** is a first-class DL Schema concept. A Layer is a named zoom scope — the scale at which descriptions are written.

### What Layers do

- Define the zoom granularity of a set of primitives
- Link to adjacent Layers via `zooms_into` / `zooms_out_to` — forming a zoom chain
- Declare a `perspective_contract` specifying which Perspective roles are required at that zoom level
- Allow the renderer to implement generic zoom navigation without per-layer custom logic

### Layer definition structure

```json
{
  "id": "layer_logic",
  "label": "Service Logic",
  "order": 3,
  "description": "Internal business logic of a single service. Business rules audited by humans; code routing optional.",
  "zooms_into": null,
  "zooms_out_to": "layer_service",
  "perspective_contract": {
    "required_roles": ["intent"],
    "optional_roles": ["implementation"]
  }
}
```

### Where Layers are defined

Layers are **profile-specific**. DL defines the Layer concept; each profile declares its own Layer instances in a Layer registry file. For SDL: `spec/layers.sdl.json`.

Every primitive schema carries a `layer_ref` field in its `dl` block pointing to a Layer id from the registry. This makes the zoom membership of every primitive machine-readable.

### Layer vs DL Structural Layer

These are orthogonal concepts:

| | DL Structural Layer | DL Layer (zoom) |
|---|---|---|
| **What it is** | Schema / Semantic / Presentation | A named zoom scope (e.g., layer_platform) |
| **How many** | Always 3 | Defined per profile (SDL has 3, another profile may have more or fewer) |
| **Purpose** | Classifies the kind of concept (structural, behavioral, presentational) | Classifies the zoom granularity of a primitive |
| **Where declared** | In DL itself | In the profile's Layer registry |

---

## DL → SDL Binding

SDL (Software Description Language) is the reference DL profile for software services. SDL declares three Layers.

### SDL Layer Registry (`spec/layers.sdl.json`)

| Layer id | Label | Zoom level | Primary audience |
|---|---|---|---|
| `layer_platform` | Platform | 1 (outermost) | Architects, tech leads, new team members |
| `layer_service` | Service Interaction | 2 | Engineers designing cross-service features |
| `layer_logic` | Service Logic | 3 (innermost) | Engineers auditing AI logic; AI implementing from spec |

### DL Concept → SDL Primitive Mapping (all Layers)

| DL Structural Layer | DL Concept | `layer_platform` | `layer_service` | `layer_logic` |
|---|---|---|---|---|
| Schema | **Layer** | `layer_platform` | `layer_service` | `layer_logic` |
| Schema | Container | PlatformManifest | *(platform Container owns cross-service flows)* | ServiceManifest |
| Schema | Unit | ServiceActor | *(services as actors in flow steps)* | Operation |
| Schema | Shape | *(shared event catalog — future)* | cross-service payload refs | DataShape |
| Semantic | Trigger | external actor in ServiceFlow | ServiceFlow.trigger | EntryPoint |
| Semantic | Connect | PlatformConnect (synthesized) | ServiceFlow.steps[] | Dependency + routing.steps[].calls |
| Semantic | Flow | *(platform-level user journey — future)* | ServiceFlow | routing.steps[] |
| Presentation | Perspective | business (req) + topology (opt) | business (req) + sequence (opt) | business (req) + routing (opt) |

### SDL Primitive → File Mapping

| Layer | SDL Primitive | File |
|---|---|---|
| `layer_platform` | PlatformManifest | `platform.sdl.json` |
| `layer_platform` | ServiceActor | inline in `platform.sdl.json` |
| `layer_platform` | PlatformConnect | generated by synthesis tool |
| `layer_service` | ServiceFlow | `service-flows.sdl.json` |
| `layer_logic` | ServiceManifest | `manifest.sdl.json` |
| `layer_logic` | EntryPoint | `entry-points.sdl.json` |
| `layer_logic` | Operation | `operations.sdl.json` |
| `layer_logic` | DataShape | `data-shapes.sdl.json` |
| `layer_logic` | Dependency | `dependencies.sdl.json` |

---

## Defining a New DL Profile

To define a new profile (e.g., BDL — Business Description Language):

1. **Define your Layer registry** — declare a `layers.bdl.json` with your zoom Layer chain
2. **Map each DL concept** to a domain-specific primitive (fill in the binding table above for your domain)
3. **Name your Perspectives** — declare which one is "intent" and which is "implementation" for each Layer
4. **Define your file format** — JSON Schema for each primitive, with `dl.layer_ref` pointing to your Layer ids
5. **Validate against `dl/meta-schema.json`** — your profile schemas must conform to the DL meta-schema
6. **Write a working example** — at least one Container with 2+ Units, all required Perspectives populated

**Profile naming convention**: `[Domain] Description Language` → `[D]DL`
- BDL — Business Description Language
- IDL — Infrastructure Description Language
- DDL — Data Pipeline Description Language

---

## DL Meta-Schema

`dl/meta-schema.json` defines what a valid DL profile specification must look like. Run:

```bash
ajv validate --schema dl/meta-schema.json spec/**/*.schema.json
```

to verify that your profile's JSON Schema files conform to DL's structural requirements.
