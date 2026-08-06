# ADR 0007 — Slide kinds are author-defined labels that never drive behaviour

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The presenter HUD names the current and next slide. Its real value is telling the presenter *where
they should be* — in the deck, or driving the application — not merely what is on screen. Many slides
exist only as cues and are never displayed at all.

The original implementation encoded this as a boolean `data-org` attribute rendering as an amber
"Org" or blue "Slide" pill. Both the attribute and the labels are domain language from one company's
Salesforce demo.

## Decision

Kinds are author-defined, declared in frontmatter and referenced per slide:

```
kind.video.label: Video
kind.video.color: "#8b5cf6"
```

Two built-ins ship: `slide` and `live`. `live` is the generic form of `org` and reads correctly
whether the application is Salesforce, a hospital EHR, or your own product. Frontmatter merges over
the built-ins **per kind**, so setting only a label keeps the default colour — a top-level merge
would silently drop it.

A slide with no `kind:` gets `slide`. A slide naming an undefined kind renders its raw name in
neutral grey plus a diagnostic, so a typo is visible rather than silent.

**A kind labels the badge and nothing else.** It never affects behaviour.

## Rationale

Binary is the natural shape of "deck or application", but real demos have other modes: a recorded
video, a Q&A pause, a handoff to a colleague, a whiteboard. Supporting n kinds costs about five lines
over a hardcoded pair — a lookup instead of a ternary, and a colour set as an inline custom property
instead of a CSS class.

The behavioural prohibition matters more than it looks. In the original deck, `data-org` slides
happened to be the ones never opened and the ones carrying CTAs, but that is correlation. The moment
`kind: live` implies "skip this slide when presenting", there is a second invisible control flow for
an author to reverse-engineer when a slide behaves oddly. `peek` is already a separate key precisely
because it is a behaviour, not a label.

## Consequences

- Zero-config decks still get the core value proposition, since the built-ins cover the common case.
- A third mode costs the author four lines.
- Anything that should change behaviour needs its own key, deliberately.
