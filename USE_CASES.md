# SDL Use Cases

SDL is designed around four primary use cases. Milestones in the [roadmap](ROADMAP.md) are traced back to these.

---

## UC1 — Bottom-Up: Audit Existing Code

**Who:** Engineers who need to understand or audit an AI-generated or inherited codebase.

**Goal:** Turn existing code into a structured, human-reviewable description — without reading every file.

```
existing codebase
    → AI reads code, generates SDL files
    → engineer views interactive diagram
    → engineer audits: flags mismatches, confirms business rules, suggests corrections
    → AI or engineer updates SDL to reflect corrections
    → when code changes in the future → SDL is updated to stay in sync
```

**What makes it complete:** The sync loop. SDL is not a one-time snapshot — it must stay current as code evolves. Drift between SDL and code makes the description untrustworthy.

---

## UC2 — Top-Down: Design Before Building

**Who:** Engineers and AI working together on a new feature or service before any code exists.

**Goal:** Agree on design at the description level — business rules, routing, data shapes, dependencies — before committing to code. Reduce back-and-forth in code review.

```
requirements / PRD
    → AI generates SDL files
    → engineer views interactive diagram
    → engineer reviews, gives structured feedback
    → AI adjusts SDL based on feedback  ← (iterate until approved)
    → engineer approves SDL
    → AI implements code from the finalized SDL
```

**What makes it complete:** The full loop from requirements to approved SDL to implemented code, with an iteration mechanism that doesn't require editing raw JSON manually.

---

## UC3 — Cross-Repo Synthesis: Architecture View

**Who:** Tech leads and architects responsible for how multiple services fit together.

**Goal:** See cross-service dependencies, data flows, and potential issues — derived from the SDL files each team already maintains, not from a separate manual diagram.

```
SDL paths from N services (input)
    → AI synthesizes: resolves cross-service Connects from Dependency declarations
    → produces a system-level SDL (higher-layer Container)
    → engineer views architecture diagram (service graph with protocols, data shapes)
    → engineer audits: flags coupling issues, missing providers, protocol mismatches
    → AI proposes modification suggestions per service
```

**What makes it complete:** The synthesis step that materializes inter-service connections. Individual services only declare outbound dependencies — the synthesis tool is what connects them.

---

## UC4 — MCP / Skill: AI Uses SDL Natively

**Who:** Any AI assistant (Claude, Cursor, Copilot) working on a codebase that has SDL files, or on a codebase that should have them.

**Goal:** AI understands when SDL applies, knows how to generate it, validate it, read it for context, and update it — without the engineer needing to explain SDL in every prompt.

```
engineer asks AI to do something (code, review, architecture question)
    → AI recognizes the context calls for SDL (UC1, UC2, or UC3)
    → AI uses MCP tools: read spec, generate SDL, validate, write files
    → AI communicates in SDL terms — "the create-order Operation has 3 business rules..."
    → engineer sees SDL-grounded output, not AI hallucination
```

**What makes it complete:** An MCP server that exposes SDL operations as tools, plus skill definitions (prompt templates) that give AI assistants the right framing for each use case. UC4 is the delivery mechanism for UC1, UC2, and UC3 inside an IDE.
