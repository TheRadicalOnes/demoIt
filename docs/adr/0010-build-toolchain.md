# ADR 0010 — esbuild to build, tsc to check, Node to test, dependencies vendored

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

Recent Node versions run TypeScript directly by stripping types, which suggests a build-free
TypeScript project. That does not apply to the extension: type stripping only helps code Node itself
runs, and browsers do not accept `.ts`. A build step is unavoidable.

It does apply to the tests, which do run under Node.

The original implementation had no build step at all, listed as a rough edge rather than a virtue.

## Decision

```
src/        parse.ts, content.ts, background.ts, options.ts
extension/  manifest.json, *.css, options.html, vendor/   ← compiled *.js land here, gitignored
test/       parse.test.ts
examples/   quickstart deck
```

- **esbuild** bundles each entry point into `extension/`. Static files live there and are never
  generated, so there is no copy step.
- **typescript** for `tsc --noEmit`. esbuild strips types without checking them, so without this
  TypeScript would buy editor hints and nothing more.
- **Node** runs `test/parse.test.ts` directly, importing `src/parse.ts` with no build, no ts-node,
  and no test config.
- `npm run build`, `npm run watch`, `npm test`.

Load the unpacked extension from `extension/`, and rebuild before reloading it.

### Why esbuild rather than tsc alone

One fewer dependency would be nice, but content scripts cannot be ESM under Firefox MV3. Plain `tsc`
output would force every file into shared global scope with no imports, which makes the parser
awkward to export — and the parser is precisely what the Node test must import.

### Vendored dependencies

`reveal.js` 5.1.0 and `marked` are vendored, not loaded from a CDN. A presentation must not depend on
conference wifi to render its own slides. This holds regardless of the hosted backend on the roadmap.

`marked` is used rather than a hand-rolled Markdown subset: CommonMark edge cases are where writing
less code buys a worse algorithm, and non-technical authors will reach them.

## Consequences

- The load-unpacked loop gains a build step. `npm run watch` keeps it to one action.
- Two dev dependencies and one `tsconfig.json`. No bundler config, no test framework, no fixtures.
- Vendored files are committed, so the repository is larger and updating reveal is a manual act.
