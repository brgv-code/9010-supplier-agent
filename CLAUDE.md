# CLAUDE.md - 9010 Supplier-Outreach Agent

Agent rules for this repo. Keep it accurate; update it when conventions change.

## What this is
The supplier-outreach agent: given a GAEB **X83** tender, collect material prices from suppliers
by email in the background (human-gated), until the bid is "ready to calculate". Design docs live
outside this repo (Bhargav's knowledge-base); this repo is the code.

## Stack
TypeScript (only) · TanStack/React · **Convex** (backend: data, durable workflows, scheduler, HTTP
actions, file storage, realtime) · **Mastra** (AI agents + evals). Node 22.

## Commands
```bash
npm test         # vitest
npm run typecheck
npm run lint      # biome (lint + format check)
npm run format    # biome, write
npm run parse -- <file.x83>   # eyeball a parse
```

## Conventions
- **Strict TypeScript.** No `any`; prefer `unknown` + narrowing. Export clear types/interfaces.
- **Small, pure modules** with a stated contract; side effects (I/O, LLM, email) live in Convex
  actions, not in pure logic like the parser.
- **Tests use real fixtures** (a real `.x83`), not hand-mocked XML. Add a fixture per edge case.
- **Biome** for format + lint (2-space, double quotes, width 100). Run before committing.
- Parsing/ingest code must **fail loudly on unexpected shapes**, never return empty-and-say-ok.

## The core design rule (from the 9010 JD)
Every step is one of: **model-driven** (LLM), **rule-based** (deterministic), or **human-confirmed**.
Bias to rules where structure exists (GAEB parsing = rules), model only for genuinely unstructured
text (material/quote extraction), human for expensive-if-wrong or low-confidence. State which one a
new step is and why.

## Git
- Commit directly; imperative subject, concise body explaining *why*.
- **Do not add AI co-author trailers** (house style).
- Strong Linear hygiene: reference the issue when there is one.
```

## Known gaps
Tracked in `docs/BUILDLOG.md`. Ingest currently assumes single-Award UTF-8 DA XML; comma-decimal
quantities, multi-Award files, and non-83 phases are not yet handled - see the build log.
