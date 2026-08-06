# ADR 0002 — Markdown, not YAML, as the authoring format

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The original implementation baked its deck into the extension as hand-authored HTML. To be a general
tool, decks must be authored by people who do not write code — sales engineers, product marketers,
solution consultants.

Two candidate formats were considered: a YAML file with known fields, or a Markdown file with
frontmatter.

## Decision

Markdown, with `---` separating horizontal slides and `--` separating vertical ones.

Deck-level configuration lives in optional frontmatter restricted to flat `key: value` pairs, using
dotted keys where nesting is needed (`kind.live.label: In the app`).

## Rationale

1. **reveal.js already treats `---` and `--` as slide separators.** Adopting that convention means
   inheriting a documented, widely known authoring model rather than inventing one.
2. **YAML is a configuration format wearing a content format's clothes.** The moment an author writes
   a multi-line bullet they are in block-scalar territory (`|`, `>`, significant indentation).
   Markdown's failure mode is a slide that looks wrong; YAML's is a parse error a non-technical
   author cannot diagnose.
3. **Restricting frontmatter to flat keys avoids a YAML dependency entirely.** Parsing is a
   split-on-first-colon loop. Dotted keys are marginally less elegant than nested YAML and entirely
   legible to someone who has never heard of YAML.

## Consequences

- A Markdown parser is needed. `marked` is vendored rather than hand-rolling a subset — CommonMark
  edge cases are where writing less code buys a worse algorithm, and non-technical authors will
  reach them.
- Slide splitting is done by demoIt, not by reveal's markdown plugin, because per-slide metadata
  blocks (ADR 0003) must be stripped before the body is parsed. Each body is then rendered to HTML
  and assembled into `<section>` elements, so reveal never learns Markdown exists.
- Because Markdown cannot express CSS classes, slide appearance has to be derived some other way.
  See ADR 0005.
