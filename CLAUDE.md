# Working in this repository

demoIt is a browser extension that draws a Markdown slide deck over a live web application, so a
product demo never leaves the tab. See `README.md` for what it does and `docs/adr/` for why it is
built the way it is.

## How we document

Four kinds of document, with strict responsibilities. Putting content in the wrong one is the main
way this structure degrades.

| Document | Holds | Does not hold |
| --- | --- | --- |
| `README.md` | Product overview: what it is, what it does for a user, how to write a deck, how to run it, the stack | Rationale, alternatives, history |
| `docs/adr/NNNN-*.md` | One decision each, with context, alternatives, and consequences | Product description, usage instructions |
| `docs/runtime-constraints.md` | Overlay invariants that must not be simplified away | Anything that is a choice rather than a constraint |
| `ROADMAP.md` | Trajectory and deliberately deferred work, each with its reasoning | Decisions already made — those are ADRs |

**Every document must read standalone.** Do not reference conversations, seed documents, planning
sessions, or anything not in the repository. If context came from elsewhere, restate it here.

## Architecture decision records

Decisions go in `docs/adr/` — one decision per file, `NNNN-kebab-case-title.md`, status **Accepted**.

**ADRs are immutable once accepted.** If we change our minds, write a *new* ADR that supersedes the
old one and set the old one's status to `Superseded by ADR NNNN`. Never edit a decision into
something it did not say. The value is the history: a future reader needs to see what we believed,
what we chose, and what changed.

Add the new record to the index table in `docs/adr/README.md`.

Sections: Context, Decision, Rationale where it is not self-evident, Consequences — **including the
ones we dislike** — and Alternatives considered when a real alternative was rejected. Record why it
lost; that is the part that is expensive to reconstruct later.

Write an ADR when a choice constrains future work, when a reasonable engineer would ask "why is it
done this way", or when we deliberately rejected the obvious option. Not for routine implementation
detail.

## Before changing runtime code

**Read `docs/runtime-constraints.md`.** demoIt renders inside a hostile document. Several of its
invariants look like unnecessary complication, and several fail *silently* — invisible in testing,
embarrassing in front of a prospect.

The worst one: the closed deck is moved off screen with a `transform`, never `display: none` or
`visibility`. reveal sets `visibility: visible` and `pointer-events: auto` on slide sections, both
inheritable and both re-declarable by a descendant, so hiding the ancestor hides nothing. A tall
closed slide silently swallows clicks meant for the application underneath.

Simplifying against that document requires evidence, not intuition. If you remove a constraint and
nothing appears to break, you have most likely reproduced the original bug without noticing.

## Code conventions

- **TypeScript, `strict`.** No `any`, no non-null assertions to silence the checker.
- **Parse, don't validate.** `parse.ts` is the sole constructor of the deck model and is total: every
  input produces a `Deck`, and problems become diagnostics. Resolve at parse time — kinds to `Kind`
  objects, CTAs to absolute URLs, images to present-or-missing variants — so render code has no
  lookup that can miss and no error path.
- **Never `browser.*` directly.** Use `const api = globalThis.browser ?? globalThis.chrome;`. This is
  what keeps the Chromium port to one manifest file.
- **The background script must survive being torn down.** No top-level DOM, no state between wakes —
  it has to work as both a Firefox event page and a Chrome service worker.
- **Slide roles are a closed discriminated union** with a `never`-typed exhaustiveness check. Adding
  a role should be a compile error everywhere it must be handled.
- **The HUD is on the shared screen.** Nothing private, diagnostic, or embarrassing renders there.
  The toolbar badge is the presenter-only surface.

## Commands

```
npm run build     # esbuild → extension/
npm run watch     # rebuild on change
npm test          # node runs test/parse.test.ts directly, no build
npx tsc --noEmit  # type check; esbuild does not check
```

Load the unpacked extension from `extension/` via `about:debugging`. Rebuild before reloading.

`extension/*.js` is build output and gitignored. `extension/vendor/`, the stylesheets, the manifest,
and `options.html` are sources and are committed.

## Testing

One test file, `test/parse.test.ts` — plain Node, `assert`, no framework, no fixtures. The parser is
the only non-trivial logic in the tool and the only thing that can silently mangle someone's deck.

The overlay runtime is not unit tested; it needs a real browser. `docs/runtime-constraints.md` is what
stands in for that, which is why it is written the way it is.
