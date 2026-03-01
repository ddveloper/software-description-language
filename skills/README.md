# SDL Skills — User Guide

## What are SDL skills?

Skills are prompt templates that instruct an AI assistant to perform SDL workflows. The AI reads the skill prompt, follows the steps, and produces structured SDL output.

**Available skills:**

| Skill | File | Purpose |
|-------|------|---------|
| generate-sdl-from-code | `generate-sdl-from-code.md` | Generate layer_logic SDL for a single service from its source code |
| synthesize-platform-from-services | `synthesize-platform-from-services.md` | Synthesize layer_platform and layer_service SDL from multiple service SDL descriptions |

## Prerequisites

### 1. Clone this repo (or have it locally)

The skill references SDL spec files, stdlib, and examples from this repo. The AI needs access to these files for best results.

```bash
git clone https://github.com/ddveloper/software-description-language.git
```

### 2. Install the SDL CLI

The skill uses `sdl validate` to check the generated output. Install it from the `cli/` directory:

```bash
cd software-description-language/cli
npm install
npm run build
```

After building, you can run it via `npx`:

```bash
npx sdl validate <directory>
```

### 3. Have your input ready

- **For UC1 (generate-sdl-from-code):** A service codebase — any local directory with source code.
- **For UC2 (synthesize-platform-from-services):** Multiple service directories, each containing `layer_logic` SDL files (the output of UC1). Run UC1 on each service first, then run UC2 to synthesize the platform view.

---

## Usage by tool

### Typical workflow: UC1 then UC2

For a platform with multiple microservices, the end-to-end workflow is:

```
1. Run UC1 on each service → produces layer_logic SDL per service
2. Run UC2 across all services → produces layer_platform + layer_service SDL
3. Validate everything with: npx sdl validate <platform-dir>
```

---

### Claude Code (recommended)

Claude Code has full file access and can run CLI commands, making it the best fit.

**Option A — Reference the skill file:**

```
> Read skills/generate-sdl-from-code.md and follow those instructions
  against the codebase at ../my-service/
```

**Option B — Just ask (CLAUDE.md auto-loads):**

Since `CLAUDE.md` at the repo root documents the skill, Claude Code picks it up automatically:

```
> Generate SDL for ../my-service/ using the generate-sdl-from-code skill
```

**For a remote repo:**

```
> git clone https://github.com/acme/payments-service ../payments-service
> Generate SDL for ../payments-service using the generate-sdl-from-code skill
```

**What works:** Everything — file reads, spec/stdlib lookup, SDL generation, `sdl validate`, iterative fixes.

**For UC2 — Synthesize platform from multiple services:**

```
> Read skills/synthesize-platform-from-services.md and follow those instructions
  against the service SDL directories under ./services/
```

Or with explicit paths:

```
> Synthesize a platform SDL from these service SDL directories:
  ./services/order-service/.sdl/
  ./services/payment-service/.sdl/
  ./services/inventory-service/.sdl/
  Use the synthesize-platform-from-services skill.
```

---

### IDE AI plugins (IntelliJ AI, Copilot Chat, Cursor, Windsurf, etc.)

IDE plugins can typically read files in the currently open project, but not files from other directories.

**Steps:**

1. Open `skills/generate-sdl-from-code.md` from this repo
2. Copy the full contents
3. Open the AI chat panel in your IDE
4. Paste the skill prompt into the chat
5. Add: *"Apply these instructions to the currently open project"*

**What works:**
- Reading the target codebase (the open project)
- Generating the 5 SDL files
- Running `sdl validate` (if the CLI is installed and available on PATH)

**What doesn't work automatically:**
- Reading `spec/`, `stdlib/`, and `examples/` from the SDL repo (they're in a different project). The skill prompt contains enough inline guidance that the AI can still produce valid output, but quality improves if you paste key schema files into the chat.

**Tip:** If your IDE supports multi-root workspaces, open both the SDL repo and your target codebase. This gives the AI access to the spec files.

**Model selection:** The skill prompt is model-agnostic. It works with Claude, GPT-4, Gemini, or any capable model available through your IDE plugin.

---

### Web AI chats (ChatGPT, Gemini, Claude.ai, etc.)

For AI tools with no local file access, you'll need to provide everything in the chat.

**Steps:**

1. Paste the full contents of `skills/generate-sdl-from-code.md`
2. Paste or upload the source files from your target codebase (focus on: routes, handlers, models, config)
3. Optionally paste SDL schemas from `spec/layer_logic/` for strict validation
4. Optionally paste the reference example from `examples/layer_logic/order-service/`
5. Ask: *"Generate SDL for this codebase following the skill instructions"*

**What works:**
- Generating SDL from pasted/uploaded source code
- Following the business-perspective quality criteria

**What doesn't work:**
- Automatic file reading (you must paste/upload)
- Running `sdl validate` (you'll need to validate locally afterward)

**Tip for large codebases:** Don't paste everything. Focus on entry points (routes, event handlers), business logic (service classes, domain models), and dependency setup (database connections, API clients). The AI can infer the rest.

---

## Quick reference

| Tool | File access | Spec access | Can validate | Best for |
|------|------------|-------------|-------------|----------|
| Claude Code | Full | Full | Yes | Full automated workflow |
| IDE plugin (same project) | Current project | No (paste manually) | If CLI on PATH | Interactive generation with code context |
| IDE plugin (multi-root) | Both projects | Yes | If CLI on PATH | Best IDE experience |
| Web chat | Paste/upload only | Paste manually | No (validate locally) | Quick one-off generation |

---

## After generation

### UC1 — Service-level SDL

1. **Validate:** `npx sdl validate <service-sdl-directory>`
2. **Review:** Read through the business rules, outcomes, and failure modes — these are the primary audit artifacts
3. **Iterate:** Ask the AI to refine specific operations or add routing blocks where needed
4. **Commit:** Check the `.sdl.json` files into your service repo

### UC2 — Platform-level SDL

1. **Validate:** `npx sdl validate <platform-sdl-directory>`
2. **Review connections:** Check that all inter-service connections are resolved — unresolved or mismatched connections indicate missing SDL or interface disagreements
3. **Review flows:** Read through the cross-service business flows — check that trigger, steps, and outcome accurately describe how services collaborate
4. **Fill gaps:** Add shared_infrastructure details, team ownership, or additional flows the AI couldn't infer
5. **Commit:** Check the platform `.sdl.json` files into your platform repo
