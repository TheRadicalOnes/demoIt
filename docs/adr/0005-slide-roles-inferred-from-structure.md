# ADR 0005 — Slide appearance is inferred from structure into four closed roles

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

Decks need visual variety: a title slide, section dividers, ordinary content slides. The original
implementation expressed this with CSS classes in hand-written HTML (`.act`, `.lede`, `.agenda`).

Markdown cannot express a class, and the syntaxes that could carry one were rejected in ADR 0003 for
being too technical. So appearance has to come from somewhere else.

## Decision

Four roles, inferred from the shape of the slide:

| Role | Inferred when |
| --- | --- |
| `title` | The slide contains only an `h1` |
| `section` | The slide contains only an `h2` |
| `peek` | The slide sets `peek: true` |
| `content` | Everything else |

This vocabulary is **closed**. Authors cannot add a fifth role.

In the type model the roles are a discriminated union with a `never`-typed exhaustiveness check, so
introducing a role becomes a compile error at every render and theme site rather than a silently
unstyled slide.

## Rationale

The rules match how people already write slides, so an author who has never read this document still
gets a deck that looks intentional. That is the entire bar for "non-technical people can use this."

The closed vocabulary is also what makes themes possible (ADR 0006). A theme can only style a
vocabulary known in advance. If authors could invent roles, no theme could promise to cover them, and
theming would degrade into per-deck CSS.

## Consequences

- Zero authoring syntax for appearance.
- **The inference is implicit, and that has a real failure mode**: adding a second paragraph to a
  divider slide silently turns it into a content slide, with no error and no obvious cause.
- An explicit `layout:` key is the escape hatch if authors fight the inference. It is deliberately
  not built pre-emptively — it is a key nobody wants to learn, and adding it later costs nothing.
