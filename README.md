# 9010 Supplier-Outreach Agent

Feature build for the 9010 Founding Engineer exercise. Design docs live in the knowledge-base
(`job-search/assets/9010-founding-engineer/build/`); this repo is the code.

> Interview exercise, not 9010's real code. Stack targets theirs: TypeScript · TanStack/React · Convex · Mastra.

## Status
| Slice | State |
|-------|-------|
| **GAEB X83 parser** (M0, spike risk #1) | ✅ done, tested (8/8), typechecked |
| Convex schema + upload/store | ⏳ next (needs a Convex deployment) |
| Mastra material-extractor + evals (M1) | ⏳ |
| Supplier match + approval + send (M2/M3) | ⏳ |
| Inbound webhook + quote parse (M4) | ⏳ |

## Run it
```bash
npm install
npm test                                # parser unit tests
npm run typecheck
npm run parse -- test/fixtures/sample.x83   # eyeball a parse
```
Example output:
```
Phase X83 · GAEB 3.2 · € · Example Project
6 positions:
  01.01.001         1 Flat   Site Preparation
  01.02.001      (TBD) m³     Excavation
  01.02.002       600 m³     Filling
  ...
```

## Layout
```
src/gaeb/parseX83.ts   # X83 (Angebotsaufforderung) → flat positions
src/gaeb/types.ts      # Position, ParsedX83
src/cli.ts             # npm run parse -- <file.x83>
test/parseX83.test.ts  # against a real DA83/3.2 sample
test/fixtures/sample.x83
docs/BUILDLOG.md       # decisions, dated
```

## Next
See `docs/BUILDLOG.md` and the build plan in the knowledge-base. The next slice (Convex schema
+ file upload) needs a Convex deployment (`npx convex dev`, interactive login) and is intentionally
not scaffolded until that account exists.
