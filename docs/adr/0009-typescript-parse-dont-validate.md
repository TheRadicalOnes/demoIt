# ADR 0009 — TypeScript, strict, with parse-don't-validate

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The original implementation is plain JavaScript. demoIt is used in client-facing presentations, so
bugs carry unusual cost, and type safety was an explicit requirement.

The limitation worth stating plainly: **TypeScript types are erased at runtime.** A discriminated
union rejects nothing on its own. Types alone would not have prevented any of the failures the
original implementation actually hit.

## Decision

TypeScript with `"strict": true` from the first commit, and the parse-don't-validate discipline:
**the parser is the sole constructor of the deck types and is total.** Anything that can fail, fails
during parse, never during render.

Concretely, parsing resolves rather than defers:

- **Kinds** resolve to a `Kind` object at parse time, not a string looked up later. An unknown name
  resolves to a fallback kind plus a diagnostic. The render path has no lookup and therefore no miss
  branch.
- **CTAs** resolve `baseUrl` at parse time. The type is `{ label: string; href: AbsoluteUrl }`, so a
  relative href is unrepresentable once parsing is done.
- **Images** resolve to `{ kind: "image"; dataUrl } | { kind: "missing"; name }`. The dashed
  placeholder is an ordinary variant the renderer handles like any other, not an error path — which
  is why that feature costs nothing to support.
- **Roles** are a discriminated union with a `never`-typed exhaustiveness check (ADR 0005).

Everything else — theme fields, cues, titles — is data, not variants. Modelling it as variants would
be types for their own sake.

`strict` is set at the first commit because retrofitting it is the expensive version.

## Consequences

- Illegal states are unrepresentable downstream of the parser, so render code has no defensive
  branches and no error handling.
- The parser carries all the complexity, which is why it is the one thing under test
  (`test/parse.test.ts`). It is also the only logic that can silently mangle someone's deck.
- **Types protect the parser, not the demo.** The failures that make a presenter look unprofessional
  are runtime overlay behaviours — a closed deck that lingers on screen, or one that silently
  swallows clicks meant for the application. Those are governed by
  `docs/runtime-constraints.md`, and no type system prevents them. Reviewing changes against that
  document matters more than the type model does.
