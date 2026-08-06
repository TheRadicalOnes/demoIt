# ADR 0004 — Decks are local folders, picked once

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

A deck is a Markdown file plus its screenshots. Something has to get both into the extension, and
this was identified as the decision everything else depends on.

Options considered were a directory picker storing the deck in extension storage, a URL the extension
fetches (typically a local HTTP server), and a textarea for pasted Markdown.

A hosted backend is the intended long-term answer (see `ROADMAP.md`) but is not needed to learn
whether the tool is good.

## Decision

An options page with `<input type="file" webkitdirectory>`. One click selects the deck folder;
demoIt reads the Markdown as text and every image as a data URL, and stores both in
`storage.local`.

All deck reads go through a single `loadDeck()` function.

## Rationale

- One action captures the Markdown and its screenshots together. A multi-select file picker would
  require the author to remember every image.
- No server, so nothing has to be running at presentation time.
- No cross-origin fetching, so no host permissions and no CORS plumbing. A URL-based deck would have
  to be fetched from the background script and messaged over, because Firefox MV3 content scripts do
  not get cross-origin privileges.
- Once picked, the deck is inert bytes. It survives a browser restart, a closed terminal, and a
  reboot.

`loadDeck()` is one function, not an interface or a provider registry. Swapping local storage for a
hosted backend later is a change to one file; abstracting for that today would be building a seam
for a decision not yet made.

## Consequences

- **The authoring loop is the cost.** Editing a deck requires re-picking the folder. Firefox reopens
  the last directory, so it is a few clicks, but it is friction and it is the main thing the hosted
  backend will fix.
- `unlimitedStorage` is requested in the manifest. Data URLs inflate screenshots by roughly a third,
  and a permission string is cheaper than a quota failure discovered mid-demo.
- Only one deck is held at a time. Multiple decks travel with the hosted backend, since sharing is
  what makes switching matter.
- The offline resilience this buys is a genuine benefit but was not the deciding factor. A slide that
  drives a live web application already requires internet, so offline-proofing the deck protects only
  the half of the presentation that needs it least.
