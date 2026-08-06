# Roadmap

Where demoIt is going, and what was deliberately left out — each with the reasoning attached, so a
decision revisited later is revisited on its merits.

Decisions already made live in [`docs/adr/`](docs/adr/), one file each. This document is only about
what has *not* been built.

## Trajectory

1. **Personal tool** — v1. Local deck folder, unpacked Firefox add-on.
2. **Team tool** — peers at the same company use it. Packaging, distribution, and shared decks start
   to matter.
3. **Product** — hosting is ours to provide.

v1 is built for stage 1, but chosen so stages 2 and 3 do not require a rewrite.

## Deferred

### Hosted backend — the intended direction

A server holding decks and accepting image uploads. The extension fetches a deck instead of reading
one from local storage; authors upload screenshots instead of re-picking a folder.

**Why not now:** unnecessary to learn whether the tool is good.

**Why it is coming anyway:** the offline argument against it is weaker than it first appears. A slide
that drives a live web application already requires internet, so a presenter without connectivity has
lost the demo regardless — offline-proofing the deck protects only the half of the presentation that
needs it least. The real cost of the local folder is the authoring loop, not resilience.

All deck reads already go through one `loadDeck()` function, so the swap is a change to one file. See
[ADR 0004](docs/adr/0004-local-folder-deck-delivery.md).

**Revisit when:** re-picking the folder becomes the thing that annoys, or a second person wants to
present a deck someone else wrote.

### Hot-reload authoring loop

Editing a deck today means re-picking its folder. A deck served over HTTP would reload on a tab
refresh.

Deliberately *not* built as a second delivery mechanism alongside the directory picker — two ways to
load a deck is two things to maintain, debug, and document. The hosted backend subsumes this.

### Multiple decks

v1 holds one deck at a time. Switching between saved decks matters once decks are shared rather than
authored by the presenter, so it travels with the hosted backend.

### Chromium support (Chrome, Edge)

The two disciplines in [ADR 0013](docs/adr/0013-chromium-readiness-as-discipline.md) keep this cheap:
a sibling `manifest.chrome.json` and a copy script, not a restructure. It costs a commitment to
testing both browsers, which is the actual reason it is not in v1.

### Author-supplied themes

v1 ships `light`, `dark`, and `contrast`. A custom theme is a CSS file targeting the four known slide
roles plus the HUD chrome — tractable precisely because the role vocabulary is closed
([ADR 0005](docs/adr/0005-slide-roles-inferred-from-structure.md)). The open question is delivery; a
fourth file in the deck folder is the obvious answer and lands naturally with the hosted backend.

The three built-ins are a starting point to revise once real users have presented with them, not a
considered final palette.

### Explicit `layout:` key

Slide appearance is inferred from structure, and implicit inference has a failure mode: adding a
second paragraph to a divider slide silently turns it into a content slide, with no error and no
obvious cause.

`layout:` is the escape hatch if authors fight the inference. Deliberately not added pre-emptively —
it is a key nobody wants to learn, and adding it later costs nothing.

### Speaker notes

Notes were kept out of the original deliberately: the HUD is on the shared screen, so anything
rendered there is public. The presenter kept their script in a separate window.

A private channel — a second window, or a phone — is the obvious feature and the obvious next thing a
real presenter asks for.

### Draggable or collapsible HUD

Fixed bottom-right today. A collapse toggle existed in the original implementation and was removed
for being unreliable. If it comes back it has to be robust: a HUD that half-collapses mid-demo is
worse than one that never moves.

### `.swap`

A fixed-height slot where several images take turns via fragments. It solves a real problem — a
hidden fragment still occupies layout space, so stacked images overflow the slide — but before/after
is expressible as two consecutive slides at no cost. Revisit if image-heavy decks make the extra
slides tedious.

### Deferring the deck runtime off the every-page path

The content script is injected into every page the user visits, armed or not, deck or not
([ADR 0011](docs/adr/0011-match-all-urls-with-arm-toggle.md)), so everything it bundles is paid on
every page load. `marked` is ~41 KB of that and only ever runs when a deck is actually loaded.

Not addressed in v1 because reveal.js is an order of magnitude larger and must be live at page load
anyway (`docs/runtime-constraints.md` #4), so deferring the parser alone trims maybe a tenth of an
unconditional cost. Firefox MV3 content scripts cannot be ESM, so it also cannot be a plain dynamic
`import()` — it needs a second build entry in `web_accessible_resources`.

**Revisit when:** the extension is measurably slowing down page loads, or reveal itself gets deferred
— at which point doing both together is the change worth making.

### Packaging and signing

v1 loads via `about:debugging` as a temporary add-on. Stage 2, peers installing it themselves, is
what forces signing and a real distribution story.

reveal.js and marked stay vendored regardless. A presentation must not depend on conference wifi to
render its own slides.
