# Build log

Dated decisions as the feature is built. Newest first.

---

## 2026-08-26 - repo hygiene (production scaffolding)
Turned the module into a real repo: `CLAUDE.md` (agent rules + the model/rule/human convention),
**Biome** (lint + format), **GitHub Actions CI** (lint → typecheck → test), `.editorconfig`,
`.nvmrc`, `LICENSE`, `engines`. Refactored tests off `!` non-null assertions into a `byOz()` helper
to satisfy Biome's `noNonNullAssertion`. lint / test / typecheck all green.

Deliberately kept lean (no husky/commitlint yet) - this is still an early feature, not a platform.
The review-flagged parser bugs (multi-Award, comma decimals, phase check) are **not** fixed yet;
they remain open in the M0 notes below and are the next code change.

## 2026-08-26 - M0 slice 1: GAEB X83 parser

**Goal:** de-risk spike #1 (can I reliably turn a real `.x83` into structured positions?) with runnable, tested code - no Convex/LLM account required yet.

**What I built**
- `src/gaeb/parseX83.ts` - parses GAEB DA XML 3.x into a flat `Position[]` (oz, shortText, longText, qty, unit, kind, sourceId).
- CLI (`npm run parse`) + 8 unit tests against a **real DA83/3.2 sample** (Dangl GAEB tool export).
- Result: 8/8 tests pass, typecheck clean.

**Decisions & why**
- **`fast-xml-parser`** over a hand-rolled/regex parser - GAEB text is nested (`<p><span>…`), regex would be fragile. One small, well-worn dependency.
- **OZ built from the RNoPart chain.** The file nests `BoQCtgy` inside `BoQCtgy`; the Ordnungszahl is the join of ancestor `RNoPart`s + the item's, e.g. `01.02.002`. Kept attributes as strings so leading zeros survive.
- **`QtyTBD="Yes"` → `qty: null`, `kind: "qtyTBD"`.** Real files have quantity-to-be-determined positions; treating a missing qty as `0` is the classic import bug (noted in the plan's edge cases), so it's explicit.
- **Skip `<Remark>` blocks** - they sit alongside `<Item>` but aren't positions.
- **`collectText()` recursively unwraps `<p>`/`<span>`** and ignores attributes, so short/long text come out clean.
- **Flat output, not a tree.** Downstream (material extraction, supplier matching) only needs the positions; the hierarchy is captured in the OZ string. Simpler contract.

**Assumptions / known gaps (deferred, tracked in the RFC & plan)**
- UTF-8 only for now; DA2000 CP1252 files would mojibake - handle at ingest later.
- Single `<Award>` block assumed; multi-Award splitting not done.
- Position types beyond normal/QtyTBD (Bedarf, Wahl, Zuschlag) not classified yet.
- No unit normalisation (m vs lfm, m² vs qm) - that's a material-extraction concern.
- Decimal parsing assumes `.` (DA XML convention); revisit if a real file uses `,`.

**Verify**
```
npm test        # 8 passed
npm run parse -- test/fixtures/sample.x83
```

**Next:** stand up a Convex project - `schema.ts` (tenders, positions) + a file-upload action that stores the `.x83` and calls `parseX83`. Blocked on a Convex deployment (interactive `npx convex dev` login).
