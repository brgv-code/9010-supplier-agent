# 9010 Supplier-Outreach Agent

Given a construction tender (GAEB **X83** or PDF), the app extracts the materials to buy,
matches them to suppliers, and — after a human approves — sends RFQ emails and parses the
replies into quotes, until the bid is **ready to calculate**.

> Interview build for the 9010 Founding Engineer role. Not 9010's real code. Stack targets
> theirs: **TypeScript · TanStack (Router) / React · Convex · Mastra**. Design docs +
> decision log: `docs/BUILDLOG.md` (and the author's knowledge-base).

## The pipeline (and the model / rule / human split)
9010's JD asks to "decide what should be model-driven, rule-based, or confirmed by a human."
Every step is deliberately one of those:

```
upload → parse → extract → match → approve → send → reply → parse quotes → ready to calculate
         rule     model     rule    human    rule   (ext)    model          rule
```

- **rule** (deterministic): GAEB XML parsing, supplier matching, RFQ rendering, completeness.
- **model** (LLM via Mastra): material extraction from free text, PDF→positions, quote parsing.
  Every model output carries a **confidence**; anything low is flagged for human review.
- **human**: curating the supplier list and approving before anything sends.

## Live
- **App:** https://9010-supplier-agent.pages.dev (Cloudflare Pages)
- **Backend:** Convex prod `https://dapper-snake-560.convex.cloud` · [dashboard](https://dashboard.convex.dev/t/trash-67c31/9010-supplier-agent/dapper-snake-560)

## Done
| Area | State |
|------|-------|
| **Auth + per-user isolation** (Convex Auth, email/password) | ✅ |
| **M0 ingest** — GAEB X83 parser (rule) + PDF tender (model), dedupe on file hash | ✅ tested |
| **M1 extract** — Mastra material-extractor, structured output + confidence + eval | ✅ |
| **M2 match** — supplier catalog, rule-based matching, per-supplier curated approval gate | ✅ tested |
| **M3 send** — RFQ rendering + tracking + durable scheduled reminders (simulated send) | ✅ tested |
| **M4 replies** — quote parsing from supplier replies → "ready to calculate" | ✅ |
| **Parser hardening** — multi-Award, comma decimals, phase check, fail-loud | ✅ tested |
| **Rate-limit gate** on the public AI endpoints (`@convex-dev/rate-limiter`) | ✅ |
| **Production UI** — TanStack Router pages, app shell, animated upload, loading states | ✅ |
| **Deployed** — Cloudflare Pages + Convex prod, CI (lint/typecheck/test) | ✅ |

## Deliberately left (scoping decisions, not oversights)
- **Real email delivery** — sending is *simulated* (records + tracks the rendered RFQ). Swapping in
  the Convex Resend component needs a Resend API key + a verified domain, and the seeded suppliers
  are `.example` addresses that would bounce. The durable send/track/remind logic is real; only the
  delivery call is stubbed.
- **Inbound email webhook** — supplier replies are triggered via a "Simulate reply" box. In
  production the same `ingestReply` action is the email provider's inbound webhook (a Convex HTTP action).
- **M5 calc-engine handoff** — "ready to calculate" is a status; the actual export/contract to a
  pricing engine is out of scope for this exercise.
- **CP1252 (DA2000) encoding** — the parser assumes UTF-8. Legacy files need byte-level encoding
  detection at the ingest layer.
- **Finer curation + scale** — approval is per-supplier (not per-material); extraction is sequential
  and queries are bounded with `.take()` rather than paginated. Fine for the demo; noted for scale.
- **Deeper hardening** — observability + LLM cost caps, and Convex-function tests (`convex-test`),
  are listed but not built.

A fuller analysis is in `docs/` (production-readiness assessment) and the knowledge-base.

## Run it
```bash
pnpm install
pnpm test                 # unit + rule tests (LLM evals are skipped without OPENAI_API_KEY)
pnpm typecheck
pnpm lint
pnpm parse test/fixtures/electrical-tender.x83   # eyeball the parser
```
Local full stack: `npx convex dev` (one terminal) + `pnpm dev` (another). The AI steps and Convex
Auth need env keys on the deployment — see `docs/BUILDLOG.md`.

## Layout
```
convex/                 # backend: schema, auth, ingest, extract, suppliers, outreach, quotes, rateLimit
src/gaeb/               # X83 parser (deterministic) + types
src/pdf/                # PDF text extraction (unpdf)
src/ai/                 # Mastra agents: material-extractor, position-extractor, quote-parser (+ evals)
src/match/              # rule-based supplier matching (pure, tested)
src/email/              # RFQ template (pure, tested)
src/routes/             # Dashboard, TenderDetail, Suppliers pages
src/components/         # app shell, dropzone, ui primitives
docs/BUILDLOG.md        # dated decisions
```
