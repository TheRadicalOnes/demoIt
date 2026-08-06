# ADR 0013 — Chromium readiness is a discipline, not a directory layout

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

v1 targets Firefox. Chromium support (Chrome, Edge) is wanted later, and the codebase should have
room for it without a restructure.

Firefox MV3 and Chrome MV3 differ in a small, known set of ways:
`browser_specific_settings.gecko.id` is required by Firefox; `web_accessible_resources` takes
`{resources, matches}`; background is `{"scripts": [...]}` rather than a service worker; and the
promise-based `browser` namespace does not exist in Chrome.

The tempting response is a `platforms/` layout with shared code and per-browser directories.

## Decision

No platform directory structure. Two rules instead:

1. **`const api = globalThis.browser ?? globalThis.chrome;`** at the top of each script. No bare
   `browser.*` anywhere. This covers everything demoIt uses: `storage`, `action`, `runtime`.
2. **The background script must work as both an event page and a service worker.** No top-level DOM
   access, no state held between wakes — anything it displays is recomputed on wake.

`manifest.json` stays the only Firefox-specific file. Shipping Chromium later means a sibling
`manifest.chrome.json` and a copy script.

## Rationale

A directory layout for one platform is scaffolding for a port that has not happened, and it imposes
indirection on every file today to serve a change that touches almost none of them. The actual
divergence is one manifest and one namespace.

The two rules cost approximately two lines and constrain nothing, so there is no reason to defer
them.

## Consequences

- The port stays cheap as long as both rules hold. Reviewing for a bare `browser.` reference is
  cheap; discovering the namespace assumption spread through the codebase later is not.
- Rule 2 also keeps the background script honest under Firefox, where event pages are torn down and
  revived — the original implementation already repainted its badge on every wake for that reason.
- Cross-browser testing is not free, and shipping Chromium means committing to testing both.
