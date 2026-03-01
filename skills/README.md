# SDL Skills — User Guide

## What are SDL skills?

Skills are prompt templates that instruct an AI assistant to perform SDL workflows. The AI reads the skill prompt, follows the steps, and produces structured SDL output.

**Available skills:**

| Skill | File | Purpose |
|-------|------|---------|
| generate-sdl-from-code | `generate-sdl-from-code.md` | Generate an SDL description from an existing codebase |

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

### 3. Have a target codebase ready

The AI needs to read source code from the service you want to describe. This can be any local directory — your own project, a cloned repo, etc.

---

## Usage by tool

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

Once the SDL files are generated:

1. **Validate:** `npx sdl validate <output-directory>`
2. **Review:** Read through the business rules, outcomes, and failure modes — these are the primary audit artifacts
3. **Iterate:** Ask the AI to refine specific operations or add routing blocks where needed
4. **Commit:** Check the `.sdl.json` files into your service repo
