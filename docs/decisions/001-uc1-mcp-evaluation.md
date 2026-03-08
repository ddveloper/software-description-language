# ADR-001: MCP Evaluation for UC1 (Bottom-Up Audit)

**Status:** Accepted
**Date:** 2026-03-01
**Relates to:** [USE_CASES.md — UC1](../../USE_CASES.md), [ROADMAP.md — v0.3](../../ROADMAP.md)

---

## Context

The [v0.3 roadmap milestone](../../ROADMAP.md) proposes an MCP (Model Context Protocol) server as the delivery mechanism for UC1 generation, UC2 generation + iteration, and UC4 as a whole. The planned MCP tools are:

- `sdl_get_spec` — returns the SDL spec and stdlib as AI-readable context
- `sdl_validate` — runs the CLI validator and returns structured results
- `sdl_read` — reads an SDL directory and returns structured content
- `sdl_write` — writes AI-generated SDL content to disk

Plus skill definitions (prompt templates):
- `generate-sdl-from-code` (UC1)
- `generate-sdl-from-requirements` (UC2)
- `adjust-sdl-from-feedback` (UC2 iteration)

This ADR evaluates whether MCP is the right method to achieve UC1 specifically, before committing to the infrastructure investment.

---

## UC1 Workflow Analysis

UC1 (Bottom-Up: Audit Existing Code) follows this flow:

```
existing codebase
    → AI reads code, generates SDL files
    → engineer views interactive diagram
    → engineer audits business rules
    → SDL stays in sync as code evolves
```

Breaking this into concrete steps:

| Step | What happens | What enables it |
|------|-------------|----------------|
| 1. Read source code | AI scans all service files | AI's native file access (Claude Code Read, Cursor, etc.) |
| 2. Understand SDL spec | AI knows the schema, stdlib, and conventions | Spec files in `spec/` + `stdlib/` |
| 3. Generate SDL | AI reasons about code → produces 5 `.sdl.json` files | **Prompt quality** — the instruction that frames the task |
| 4. Validate | Check schema + cross-refs | `sdl validate` CLI (already built in v0.2) |
| 5. Write to disk | Save SDL files alongside source code | AI's native file writing |
| 6. Engineer reviews | View diagram, audit business rules | `sdl render` (already built in v0.4) |

**Key observation:** The hardest part of UC1 is **step 3 — AI reasoning**. The AI must read source code, extract business rules, identify entry points, map dependencies, and structure everything into valid SDL. This is entirely a prompt engineering challenge. No MCP tool helps with this.

---

## Approaches Considered

### Option A: MCP Server (as proposed in v0.3)

AI calls MCP tools: `sdl_get_spec` → reads code natively → `sdl_write` → `sdl_validate`.

| Pros | Cons |
|------|------|
| Standardized interface across AI tools | Infrastructure overhead (server process, transport layer) |
| Structured tool definitions aid discoverability | `sdl_read` and `sdl_write` duplicate native AI capabilities |
| Works across Claude, Cursor, Copilot | AI still reads source code natively — MCP can't expose entire codebases |
| | Most UC1 value comes from prompt quality, not tool interface |

### Option B: Skill / Prompt Template

A prompt template instructs the AI to: read spec files from disk, scan the codebase, generate SDL, run `sdl validate` via CLI.

| Pros | Cons |
|------|------|
| Zero infrastructure — uses existing AI capabilities | Less portable across AI platforms |
| Simpler to build and iterate on | No structured tool interface for discoverability |
| Prompt is the actual value driver for UC1 | Prompt can be fragile without structured constraints |
| Can be delivered as CLAUDE.md, custom slash command, or prompt file | |

### Option C: CLAUDE.md + CLI Only

Instructions in CLAUDE.md teach the AI about SDL. AI uses `sdl init` + `sdl validate` directly.

| Pros | Cons |
|------|------|
| Simplest — no new code needed, works today | No reusable prompt template |
| Leverages existing CLI tooling | Relies on per-repo configuration |
| | Less portable, less structured |

### Option D: Hybrid (Skill for orchestration + MCP for spec/validation only)

Skill template drives the UC1 workflow. MCP exposes only `sdl_get_spec` and `sdl_validate` — the two tools that add value over native capabilities.

| Pros | Cons |
|------|------|
| Best of both — structured where it matters, simple where it doesn't | Two mechanisms to maintain |
| Avoids duplicating native file read/write | MCP server still needed (lighter scope) |
| Prompt template captures the real UC1 value | |

---

## Decision

**Start with a skill/prompt approach (Option B) for UC1. Defer MCP to UC4.**

The `generate-sdl-from-code` skill is the primary deliverable for UC1. It can be built and tested without any MCP infrastructure. When UC4 (AI Uses SDL Natively) is built, extract `sdl_get_spec` and `sdl_validate` into a minimal MCP server — those are the two tools that genuinely benefit from the MCP interface.

Skip `sdl_read` and `sdl_write` as MCP tools entirely — they duplicate what every AI assistant already does natively.

---

## Rationale

1. **The core UC1 challenge is AI reasoning, not tooling.** The quality of SDL generation depends on how well the prompt instructs the AI to analyze code and structure its output. MCP tools don't help with this.

2. **AI already has native file access.** Every AI platform that would use MCP (Claude Code, Cursor, Copilot) already reads and writes files natively. Wrapping this in `sdl_read` / `sdl_write` adds a layer that provides no additional capability.

3. **Step 1 (read source code) can't go through MCP anyway.** MCP would need to expose the entire codebase for the AI to analyze, which is impractical. The AI uses its own file reading to scan source code. So the most important UC1 step bypasses MCP entirely.

4. **CLI validation already exists.** `sdl validate` (v0.2) works as a shell command. An MCP `sdl_validate` wrapper provides slightly more structured output, but the AI can parse CLI output effectively.

5. **Spec delivery has simpler alternatives.** `sdl_get_spec` via MCP is one option, but the AI can also read `spec/` files directly, reference them from a CLAUDE.md, or receive them inline in a skill prompt.

6. **MCP's real value is discoverability and portability — which matter for UC4, not UC1.** UC4 is about AI assistants *automatically recognizing* when SDL applies and using the right tools without prompt engineering. That's where MCP's structured tool interface shines. UC1 is a deliberate, user-initiated workflow where the prompt/skill template is the right abstraction.

---

## Consequences

### Roadmap impact

- **v0.3 scope narrows for UC1**: Build `generate-sdl-from-code` as a skill/prompt template, not as an MCP-dependent workflow. The MCP server becomes a UC4-focused deliverable.
- **v0.3 MCP scope reduces**: When MCP is built (for UC4), it only needs `sdl_get_spec` and `sdl_validate`. No `sdl_read` or `sdl_write`.
- **UC1 can ship sooner**: A skill template has no infrastructure dependencies — it can be built, tested, and iterated immediately.

### What to build for UC1

1. **`generate-sdl-from-code` skill** — a prompt template that instructs the AI to:
   - Scan the target codebase using native file access
   - Reference the SDL spec (`spec/layer_logic/*.schema.json`) and stdlib
   - Use `examples/layer_logic/order-service/` as a reference
   - Generate the 5 `layer_logic` SDL files
   - Run `sdl validate` and fix any issues
   - Present a summary of what was generated for engineer review

2. **Delivery mechanism** — one or more of:
   - A prompt file in the repo (e.g., `skills/generate-sdl-from-code.md`)
   - A CLAUDE.md section for Claude Code users
   - A custom slash command for IDE integration

### What changes for MCP (when built for UC4)

- Expose only `sdl_get_spec` and `sdl_validate` as MCP tools
- Skills (`generate-sdl-from-code`, `generate-sdl-from-requirements`, `adjust-sdl-from-feedback`) remain prompt templates — they orchestrate the workflow, MCP provides the utility tools they call
