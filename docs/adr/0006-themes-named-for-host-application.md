# ADR 0006 — Three built-in themes, named for the host application

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The original deck used Salesforce navy `#16325c` and blue `#0176d3` on a white background. The white
was not an aesthetic preference — it matched Lightning, and that match is what made the overlay feel
like part of the application rather than a slide sitting on top of one.

That principle generalizes even though the specific colour does not. Users need themes without
needing to write CSS.

## Decision

Three built-in themes, selected with `theme:` in frontmatter, each named for the kind of application
it sits on rather than for its own appearance:

- **`light`** (default) — white background, blue accent. Salesforce Lightning, most enterprise SaaS,
  anything Material-influenced.
- **`dark`** — for demoing over an IDE, a terminal, or a dark-mode dashboard.
- **`contrast`** — near-black on white, heavier weight, for a projector in a bright room.

A theme is roughly fifteen custom-property declarations (background, text, accent, heading font,
badge colours). `deck.css` remains a single file; themes only supply variables.

## Rationale

Naming themes for host-application fit is a small act of documentation. It teaches the underlying
principle at the moment of choosing — matching the host background is what makes the overlay read as
one surface.

Three rather than two because `contrast` addresses a failure people do not anticipate until a room
defeats them, and because at fifteen declarations the marginal cost of a theme is negligible.

## Consequences

- Themes depend on the closed role vocabulary from ADR 0005. Each theme is obliged to style exactly
  `title`, `section`, `content`, and `peek`, plus the HUD chrome.
- Author-supplied themes are deferred. When added, a custom theme is a CSS file targeting those same
  four roles — tractable precisely because the vocabulary cannot grow behind its back.
- The set is a starting point to be revised once real users have presented with it, not a considered
  final palette.
