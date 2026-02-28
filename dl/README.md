# DL — Description Language

DL is the abstract meta-specification behind the Software Description Language (SDL) project. It defines the universal primitives that any domain-specific description language must implement.

**This document is for contributors** who want to understand why SDL is designed the way it is, or who want to define a new DL profile for a different domain (e.g., BDL — Business Description Language, IDL — Infrastructure Description Language).

Engineers using SDL do not need to read this. See the main [README](../README.md) instead.

---

## The Three Layers

DL organizes every description into three layers. Each layer builds on the previous.

### 1. Schema Layer — What exists (static structure)

| Concept | Definition |
|---------|------------|
| **Unit** | The primary actor that performs work. The smallest describable thing in the domain. |
| **Container** | A bounded, recursive grouping of Units or other Containers. Containers can nest arbitrarily deep. |
| **Shape** | The structure of data — inputs and outputs of Units, payloads attached to Connects. |

Container is **recursive**: a system can contain service Containers; a service Container contains operation Units. The same model works at any zoom level.

### 2. Semantic Layer — What happens (dynamic behavior)

| Concept | Definition |
|---------|------------|
| **Trigger** | External initiation that crosses a Container boundary inward. Starts a Flow. |
| **Connect** | Unit-to-Unit propagation within a Container. Has: direction, protocol, and an optional Shape (data attached). |
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

**Perspective Contract** (required by all DL profiles):
- Every Unit must be describable from all declared Perspectives
- At least two Perspectives must be declared
- One Perspective must be designated as the **"intent"** view (plain language, domain terms — for business/domain experts)
- One Perspective must be designated as the **"implementation"** view (technical terms — for engineers)
- Switching between Perspectives must not lose information (same underlying data, different render)

---

## DL → SDL Binding

SDL (Software Description Language) is the reference DL profile for software services.

| DL Layer | DL Concept | SDL Primitive | SDL File |
|----------|------------|---------------|----------|
| Schema | Container | ServiceManifest | `manifest.sdl.json` |
| Schema | Unit | Operation | `operations.sdl.json` |
| Schema | Shape | DataShape | `data-shapes.sdl.json` |
| Semantic | Trigger | EntryPoint | `entry-points.sdl.json` |
| Semantic | Connect (intra-Container) | `routing.steps[].calls` | inline on Operation |
| Semantic | Connect (inter-Container candidate) | Dependency | `dependencies.sdl.json` |
| Semantic | Flow | `routing.steps[]` | inline on Operation |
| Presentation | Perspective | `business{}` + `routing{}` on Operation | inline on Operation |

SDL Perspectives:
- `business` = **intent** perspective (plain language, domain rules)
- `routing` = **implementation** perspective (technical terms, real function names)

---

## Defining a New DL Profile

To define a new profile (e.g., BDL — Business Description Language):

1. **Map each DL concept** to a domain-specific primitive (fill in the binding table above for your domain)
2. **Name your Perspectives** — declare which one is "intent" and which is "implementation"
3. **Define your file format** — JSON Schema for each primitive, with `dlVersion` and `profile` fields on the manifest
4. **Validate against `dl/meta-schema.json`** — your profile schemas must conform to the DL meta-schema
5. **Write a working example** — at least one Container with 2+ Units, all Perspectives populated

**Profile naming convention**: `[Domain] Description Language` → `[D]DL`
- BDL — Business Description Language
- IDL — Infrastructure Description Language
- DDL — Data Pipeline Description Language

---

## DL Meta-Schema

`dl/meta-schema.json` defines what a valid DL profile specification must look like. Run:

```bash
ajv validate --schema dl/meta-schema.json spec/*.schema.json
```

to verify that your profile's JSON Schema files conform to DL's structural requirements.
