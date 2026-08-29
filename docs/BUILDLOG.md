# Build log

Dated decisions as the feature is built. Newest first.

---

## 2026-08-29 - P0 auth: Convex Auth (email+password) + per-user isolation
- `@convex-dev/auth` Password provider (self-contained, no external service). `authTables` in the schema; `convex/auth.ts`, `http.ts`, `auth.config.ts`.
- Replaced the hardcoded `"dev"` tenant: every query/mutation/action derives the tenant from the signed-in user (`getAuthUserId` via `requireUserId`/`optionalUserId`). Read queries return `[]` when signed out; writes/actions throw; tender-scoped reads/writes verify ownership.
- Frontend: `ConvexAuthProvider`, a `SignIn` (sign in / sign up) form, `Authenticated`/`Unauthenticated`/`AuthLoading` gating, and sign-out.
- Verified lint/typecheck/test/build. **Runtime needs signing keys:** run `npx @convex-dev/auth` to set `JWT_PRIVATE_KEY`/`JWKS`/`SITE_URL` on the deployment(s), then deploy.
- Note: pre-auth tenders (tenantId `"dev"`) are now orphaned; new users start with an empty list.

## 2026-08-28 - P0: rate-limit gate on the public AI endpoints
The public `extractMaterialsForTender` and `ingestUploadedPdf` spend OpenAI on every call, so with no auth they need a cap.
- Mounted `@convex-dev/rate-limiter`; a global `aiRequest` budget (40/hour) via `consumeAiBudget`, enforced in both AI actions before any OpenAI call (throws when spent).
- Also: cap positions per extraction (60) and a 10MB PDF size guard.
- No auth yet, so the cap is a single "global" key; key it per user/tenant once auth lands. Makes the (rotated) key safe to run on the public site. Auth + per-tenant quotas remain the bigger P0 item.

## 2026-08-28 - PDF tender ingest (unstructured -> LLM)
GAEB XML is structured, so that parser stays a deterministic rule. A PDF bill of quantities is unstructured, so PDF ingest is a two-step model path: PDF -> text -> positions.
- `src/pdf/extractPdfText.ts` (unpdf) extracts text; tested against a generated PDF fixture (`test/fixtures/electrical-tender.pdf`).
- `src/ai/positionExtractor.ts`: a Mastra agent (OpenAI) turns the text into `{ projectName, currency, positions[] }` with a per-position confidence (Zod structured output).
- `convex/ingestPdfActions.ts` (`"use node"`) routes PDF: extract text -> LLM -> reuse `insertParsed`. The client sniffs `.pdf`/`application/pdf` and calls this instead of the X83 action.
- Schema: added `tenders.source` ("gaeb"|"pdf") and `positions.confidence`, both **optional** so pre-existing prod rows still validate.
- UI: accepts `.pdf`, shows the source, and a per-position confidence column (sub-60% highlighted) for AI-extracted positions.
- Verified: text extraction test + lint/typecheck/build all green. The LLM step needs `OPENAI_API_KEY` server-side; run pending key.
- Prod: requires `convex deploy` + a valid key + (recommended) the rate-limit gate before these public endpoints spend on OpenAI.

## 2026-08-26 - M1: Mastra material-extractor (the model-driven step) + eval + UI
- `src/ai/materialExtractor.ts`: a Mastra Agent (OpenAI `gpt-4o-mini`, swappable via `OPENAI_MODEL`) that turns one GAEB position into material needs via a Zod `structuredOutput` schema (description, qty, unit, category, confidence). No Convex imports, so it is unit/eval-testable and callable from a Convex action.
- Schema: added `materialReqs` table (`by_tender`, `by_position`).
- `convex/extract.ts`: `positionsForTender` (internalQuery), `replaceMaterialReqs` (internalMutation, idempotent clear+insert, sets tender status `extracted`), `listMaterialReqs` (query).
- `convex/extractActions.ts` (`"use node"`): `extractMaterialsForTender` runs the agent over each position and stores the results.
- Eval: `src/ai/materialExtractor.eval.test.ts`, gated on `OPENAI_API_KEY` (skipped in CI). Checks a cable position extracts a plausible material with valid confidence, and a labour position yields ~none.
- UI: an "Extract materials (AI)" button and a materials table with confidence; rows under 60% are highlighted as the human-review set (the model/rule/human split made visible).
- Verified: lint, typecheck, test (8 pass, 2 eval skipped), vite build. Confirmed the server-only Mastra code is not in the client bundle.
- Gotcha: Mastra 1.62 Agent config requires an `id` field (caught by typecheck).

**To run:** set the key in the Convex deployment env: `npx convex env set OPENAI_API_KEY sk-...`, then click Extract. Local eval: `OPENAI_API_KEY=sk-... pnpm test`.

**Left for later:** parallelise per-position calls, wire the confidence threshold to a real review queue, and move to Mastra eval scorers instead of the ad-hoc test.

## 2026-08-26 - fix: VITE_CONVEX_URL for the browser
The UI threw "Set VITE_CONVEX_URL". `convex dev` writes `CONVEX_URL` to `.env.local`, but Vite only exposes `VITE_`-prefixed vars to browser code, so the client could not read it. Fix: copy the value into `VITE_CONVEX_URL` in `.env.local` (per-machine, gitignored). Note the deployment is in the EU region (`eu-west-1`), so the URL cannot be derived from the deployment name alone; read it from `CONVEX_URL`. `convex dev` should also add `VITE_CONVEX_URL` on future runs now that Vite is present.

## 2026-08-26 - M0 slice 3: React UI (Vite)
- Vite + React 19 app: upload an `.x83`, a reactive tenders list, and a reactive positions table. Uses Convex hooks (`useQuery` / `useMutation` / `useAction`) under `ConvexProvider`, so the tables update live as data lands.
- Chose Vite + React over TanStack Start for now (simpler, and React skills transfer); can move to TanStack Start later.
- Committed `convex/_generated/` (previously ignored): the frontend imports its types, so it must be present for typecheck, CI, and fresh clones. It regenerates on `convex dev`.
- Verified: `pnpm lint`, `pnpm typecheck`, and `pnpm build` (vite) all pass.
- Run: `npx convex dev` (it adds `VITE_CONVEX_URL` to `.env.local` when it sees Vite), then `pnpm dev` in another shell.

## 2026-08-26 - switch to pnpm; drop stray build artifacts
- Repo now uses **pnpm**, not npm (my earlier npm default was a wrong assumption; pnpm is the preference). Removed `package-lock.json`, committed `pnpm-lock.yaml`, CI runs pnpm, README/CLAUDE updated.
- A bare `tsc` run had emitted `.js` next to the `.ts` sources (Biome then linted them, 86 false errors). Deleted them and set `"noEmit": true` in `tsconfig.json` so it cannot recur; typecheck still runs via the `--noEmit` flag.
- lint / test / typecheck green under pnpm.

## 2026-08-26 - M0 slice 2: Convex ingest (schema + upload + parse)
Wired the parser into Convex.
- `convex/schema.ts`: `tenders` + `positions` tables (positions in their own table, not an array field; `tenantId` from day one). Indexes `by_tenant` and `by_tenant_and_sha256`.
- `convex/ingest.ts`: `generateUploadUrl` (mutation), `insertParsed` (internalMutation, dedupes on the stored file's sha256), `listTenders` / `listPositions` (queries).
- `convex/ingestActions.ts`: `ingestUploadedX83` (action) reads the uploaded blob, runs `parseX83`, commits via the internal mutation.
- `scripts/ingest.ts`: end-to-end smoke test (upload, ingest, list) against the dev deployment.

Followed `convex/_generated/ai/guidelines.md`: dedupe on the built-in `_storage` sha256 (not a hand-rolled hash), action in its own file (no `use node` needed for the pure-JS parser), child table instead of an array field, bounded `.take()` queries.

Decisions: `convex/_generated/` is gitignored (regenerated by `convex dev`); `pnpm-lock.yaml` from the AI-files install is ignored (repo uses npm).

Not yet: auth / real tenant (M6), the React UI, the three known parser bugs. Run: `npx convex dev` to deploy, then `CONVEX_URL=... npx tsx scripts/ingest.ts test/fixtures/sample.x83`.

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
