# demoIt

**Present slides on top of the live application you are demoing, in the same browser tab.**

A product demo alternates between slides and driving a real application. Normally that means
alt-tabbing between a deck and a browser, which breaks the thread for the audience and for the
presenter. demoIt removes the switch: the deck is a browser extension that draws over whatever page
you are on. Dismiss it and you are in the real application — same tab, same scroll position, same
session.

Decks are written in Markdown, by people who do not write code.

## Why not just embed the app in a deck?

Because serious web applications refuse to be embedded. Salesforce sends
`X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, and clickjack protection on Setup pages
cannot be turned off at all. So demoIt inverts the arrangement — the deck goes on top of the app
rather than the app inside the deck. There is no iframe, no framing policy to negotiate, and it works
on any page the browser can load. See [ADR 0001](docs/adr/0001-overlay-not-iframe.md).

## What you get

**A presenter HUD.** A floating card, bottom-right, visible the whole time. It names the slide you
are on, the slide coming next, and your position in the running order — so you can work inside the
application for long stretches and still know exactly where you are.

**Now and Next.** Next is the one that matters. It tells you what is coming, so you know where to
navigate before you arrive there.

**Advance without opening the deck.** Prev/next buttons on the HUD move the deck while the
application keeps the screen. Many slides exist only as cues and are never displayed at all.

**Badges that say where you should be.** Each slide is tagged with a kind — `slide`, `live`, or
anything you define — so Now and Next tell you whether to be in the deck or driving the app, not just
what is on screen.

**Calls to action.** A slide can carry a link into a specific page of your application. Clicking it
closes the deck and navigates the tab, so the handover reads as one continuous surface. The link is
mirrored onto the HUD, because cue slides are never opened and a link only on the slide is a link you
never find.

**Peek slides.** A floating card over the still-visible page, for talking about what is already on
screen.

**It keeps your place.** Position and open/closed state survive navigating the application, and a
second tab follows along live.

**Screenshot placeholders.** A slide referencing an image you have not captured yet renders a dashed
box naming the missing file, so a deck can be rehearsed before its screenshots exist.

## Writing a deck

A deck is a folder: one Markdown file plus its images.

````markdown
---
title: Acme Billing
baseUrl: https://acme.lightning.force.com
theme: light
---

# Acme Billing

---

## What we'll cover

reveal: bullets

- Setup
- Daily use
- Reporting

---

kind: live
cta: [Billing Settings](/lightning/n/BillingSettings)

## Automated setup

---

peek: true
cue: Point at the totals column

The number you want is already on screen.
````

`---` separates slides, `--` stacks them vertically. Everything else is ordinary Markdown.

**Frontmatter is optional and every field has a default** — a deck with no frontmatter at all is a
valid deck.

| Deck setting | Default | Meaning |
| --- | --- | --- |
| `title` | filename | Deck name in the options page |
| `baseUrl` | none | CTAs starting with `/` resolve against it, so a deck can be repointed at another environment without editing every slide |
| `theme` | `light` | `light`, `dark`, or `contrast` |
| `kind.<name>.label` / `.color` | — | Define your own slide kinds |

| Slide setting | Meaning |
| --- | --- |
| `kind` | Which badge the HUD shows. Defaults to `slide`. |
| `cue` | Short HUD label. Defaults to the slide's heading. |
| `cta` | A Markdown link. Closes the deck and navigates the tab. |
| `peek` | `true` floats a card over the live page. |
| `reveal` | `bullets` reveals list items one at a time. |

Slide settings go at the top of a slide, before any prose.

**Appearance is inferred from structure.** A slide with only an `h1` is a title slide; only an `h2`
is a section divider; everything else is a content slide. Two or more `###` sub-headings on a slide
become side-by-side columns, each holding its heading and everything under it. Write normal
Markdown and the deck looks intentional.

**Themes are named for the application they sit on** — `light` for Lightning and most enterprise
SaaS, `dark` for an IDE or a terminal, `contrast` for a bright room and a weak projector. Matching
the host application's background is what makes the overlay read as one surface rather than a slide
sitting on top of an app.

## Installing and using

1. `npm install && npm run build`
2. Firefox → `about:debugging` → This Firefox → Load Temporary Add-on → pick `extension/manifest.json`
3. Click the demoIt toolbar button. With no deck loaded it says so and offers to load one — choose
   the folder holding your `.md` file and its images.
4. Read the pre-flight report: slide count, every CTA URL, every missing image, anything
   unrecognized. This is the five-minutes-before-the-call check.
5. Go to the application you are demoing. The HUD is bottom-right. Click it to open the deck, arrows
   to move, `Esc` to close.

**The toolbar panel is the front door.** It shows which deck is loaded and where you are in it, and
carries Present, the on/off switch, and deck loading. demoIt matches every URL by design — a demo
crosses domains you cannot predict, and an allowlist fails silently at the worst moment — so the off
switch is how you stop it following you around between demos. See
[ADR 0011](docs/adr/0011-match-all-urls-with-arm-toggle.md) and
[ADR 0014](docs/adr/0014-toolbar-button-opens-a-panel.md).

A deck never fails to load. Problems become diagnostics in the pre-flight report, never a refusal
four minutes before a client call. See [ADR 0008](docs/adr/0008-fail-soft-parsing.md).

## Stack

- **TypeScript**, strict, with parse-don't-validate — the parser is the only constructor of the deck
  model and is total, so render code has no branch that can fail.
- **reveal.js 5.1.0**, vendored. A presentation must not depend on conference wifi to render its own
  slides.
- **marked** for Markdown, bundled into the build rather than fetched at runtime. Every dependency
  is pinned exactly and the lockfile is committed — this extension has broad host access.
- **esbuild** to build, `tsc --noEmit` to check, Node to run the tests directly as TypeScript.
- **Firefox MV3** today; Chromium is a manifest and a copy script away by construction.

No framework, no bundler config, no test framework.

```
src/        parse.ts, content.ts, background.ts, options.ts
extension/  manifest.json, *.css, options.html, vendor/   ← build output lands here
test/       parse.test.ts
examples/   a small deck that presents over Wikipedia
docs/       adr/ and runtime-constraints.md
```

## Documentation

- **[docs/adr/](docs/adr/)** — every design decision, one file each, with the alternatives that lost
  and why.
- **[docs/runtime-constraints.md](docs/runtime-constraints.md)** — the overlay invariants. Read
  before touching the runtime; several of them fail silently.
- **[ROADMAP.md](ROADMAP.md)** — where this is going and what was deliberately deferred.
