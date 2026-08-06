# ADR 0012 — Port the reference implementation rather than rewrite

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

demoIt derives from a working, rehearsal-tested Firefox extension built for one company's Salesforce
org and one product demo: roughly 300 lines of content script, a 27-line background toggle, and two
stylesheets.

That implementation is hardcoded — baked-in slide HTML, one scratch org's URLs, `data-org` as domain
vocabulary, a Salesforce palette. But its non-obvious decisions were each forced by a specific
failure during rehearsal, and they are the parts a rewrite would most plausibly get wrong, because
each looks like an unnecessary complication until you have seen it fail.

## Decision

Port `content.js` and the stylesheets. Do not rewrite from scratch.

The generalization is a comparatively small diff: replace baked-in slide HTML with the parser
(ADR 0002, 0003), replace the `data-org` ternary with kind lookup (ADR 0007), replace the fixed
palette with theme variables (ADR 0006), replace `getURL()` image rewriting with parse-time
resolution (ADR 0009), and add the options page (ADR 0004).

The invariants that must survive the port are recorded in `docs/runtime-constraints.md`.

## Rationale

The runtime behaviours that make the overlay work — shadow DOM isolation, moving the closed deck off
screen with a transform, initialising reveal at load, taking the keyboard away from reveal — are
non-obvious and expensive to rediscover. Several fail in ways that are invisible in testing and
embarrassing in front of a prospect.

Rewriting would trade all of that for a cleaner starting file.

## Consequences

- Some ported code will look over-complicated. That is expected; `docs/runtime-constraints.md`
  explains each case, and simplifying against it needs evidence, not intuition.
- The port is to TypeScript, so it is a translation, not a copy. Type annotations should not be
  taken as licence to restructure the runtime logic at the same time.
- The original deck itself is not ported. It is one company's product content pointed at a named
  scratch org, its value here was as a source of constraints, and those are now captured
  standalone. The shipped example is a fresh minimal deck.
