# Agent Instructions

## Coding Guidelines (Karpathy)

These behavioral guidelines reduce common LLM coding mistakes. **Tradeoff:** they bias toward caution over speed. For trivial tasks, use judgment.

### 1. Think Before Coding

**Don't assume. Don't hide confusion. Surface tradeoffs.**

Before implementing:
- State your assumptions explicitly. If uncertain, ask.
- If multiple interpretations exist, present them — don't pick silently.
- If a simpler approach exists, say so. Push back when warranted.
- If something is unclear, stop. Name what's confusing. Ask.

### 2. Simplicity First

**Minimum code that solves the problem. Nothing speculative.**

- No features beyond what was asked.
- No abstractions for single-use code.
- No "flexibility" or "configurability" that wasn't requested.
- No error handling for impossible scenarios.
- If you write 200 lines and it could be 50, rewrite it.

Ask yourself: "Would a senior engineer say this is overcomplicated?" If yes, simplify.

### 3. Surgical Changes

**Touch only what you must. Clean up only your own mess.**

When editing existing code:
- Don't "improve" adjacent code, comments, or formatting.
- Don't refactor things that aren't broken.
- Match existing style, even if you'd do it differently.
- If you notice unrelated dead code, mention it — don't delete it.

When your changes create orphans:
- Remove imports/variables/functions that YOUR changes made unused.
- Don't remove pre-existing dead code unless asked.

The test: Every changed line should trace directly to the user's request.

### 4. Goal-Driven Execution

**Define success criteria. Loop until verified.**

Transform tasks into verifiable goals:
- "Add validation" → "Write tests for invalid inputs, then make them pass"
- "Fix the bug" → "Write a test that reproduces it, then make it pass"
- "Refactor X" → "Ensure tests pass before and after"

For multi-step tasks, state a brief plan:
```
1. [Step] → verify: [check]
2. [Step] → verify: [check]
3. [Step] → verify: [check]
```

Strong success criteria let you loop independently. Weak criteria ("make it work") require constant clarification.

---

## Codebase Discovery

This project uses **codebase-memory-mcp** to maintain a knowledge graph of the codebase. Prefer MCP graph tools over grep/glob/file-search for code discovery.

Priority order:
1. `search_graph` — find functions, classes, routes, variables by name or natural-language query.
2. `trace_path` — trace who calls a function or what it calls (call chains, data flow).
3. `get_code_snippet` — read specific function/class source code.
4. `query_graph` — run Cypher queries for complex multi-hop patterns.
5. `get_architecture` — high-level project structure overview.

Fall back to grep/glob for: string literals, error messages, config values, non-code files, or when MCP results are insufficient.

If the project is not yet indexed, run `index_repository` first.

---

## Implementation Planning

When preparing a multi-phase implementation plan, follow these conventions. A well-structured plan is as important as the code it describes.

### Document Structure

1. **Title with version** — e.g. `# Feature Name (v2)`. Include a one-sentence scope summary directly under the title.
2. **Status preamble** — Use `> [!NOTE]` / `> [!IMPORTANT]` callouts to state:
   - What changed since the previous version of the plan.
   - Any work already completed that is now baseline behavior (out of scope for new phases).
3. **User Review Required** — Call out structural or risky changes that need human sign-off before execution. Include file-deletion safety checks, API breakage, or platform-specific caveats here.
4. **Phase Ordering** — A compact, ordered checklist (`[ ]` or `[x]`) showing every phase by name and one-line description. Order by dependency logic (foundations first, highest-risk changes after stable baselines).
5. **Proposed Changes** — Break down by phase:
   - Give each phase a descriptive name.
   - Annotate every affected file with `[NEW]`, `[MODIFY]`, or `[DELETE]`.
   - Hyperlink file paths using `(file:///absolute/path)` so they are clickable in review.
   - Describe **Current** behavior/state before listing changes.
   - Enumerate changes with numbered lists; include inline code snippets exactly as they should appear.
   - Use ASCII diagrams for layout changes when they clarify spatial relationships.
6. **File Summary Table** — A concise `| Phase | Action | Path | Description |` table for quick scanning.
7. **Verification Plan** — Separate sections for:
   - **Automated Tests** — Commands and expected outcomes.
   - **Regression Testing** — Checklists for high-risk phases. Mark critical phases with `> [!CAUTION]`.
   - **Manual Verification** — Platform-specific or manual checks.
8. **Completion Reports** — After execution, append per-phase completion notes. Include specific fixes, typing status, and verification results.

### Conventions

- **Admonitions**: Use GitHub-flavored alert syntax (`> [!NOTE]`, `> [!WARNING]`, `> [!CAUTION]`, `> [!IMPORTANT]`) to surface risk, constraints, or scope boundaries. Do not bury warnings inside paragraphs.
- **Line references**: When describing existing code, cite line ranges (`L418-438`) so reviewers can locate the anchor quickly.
- **Risk assessment**: Flag the highest regression-risk phase explicitly. Embed a per-phase regression checklist before implementation begins, not after.
- **No hidden dependencies**: If a phase depends on a prior phase's artifacts, state the dependency explicitly in the phase description.
- **Code snippets**: Provide copy-paste-ready code blocks. If a value is dynamic, write `undefined, // set dynamically from config` rather than omitting the key.
- **Completion style**: When logging completed work, use commit-message style prefixes (`fix: ...`, `feat: ...`, `refactor: ...`) for traceability.

### Anti-patterns to Avoid

- Do not write a plan as a single undifferentiated wall of text. Phases and file annotations must be scannable.
- Do not omit the "Current" state description. Every change must be anchored to what exists now.
- Do not defer regression testing to the end of the project. Embed it phase-by-phase.
- Do not assume platform behavior is identical. Call out environment-specific divergences explicitly.

---

## Verification

Use focused verification proportional to risk. Common checks include:

- Type checking / static analysis (e.g., `npx tsc --noEmit` for TypeScript projects)
- Relevant unit or integration tests
- Manual spot checks for UX/platform-specific changes

Verification should be embedded phase-by-phase in implementation plans, not deferred to the end.
