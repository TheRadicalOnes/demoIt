# ADR 0003 — Per-slide metadata as a leading key/value block

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

A slide carries metadata beyond its content: which kind it is, a short cue label for the presenter
HUD, an optional call-to-action link into the application, whether it is a peek slide, and whether
its bullets should be revealed one at a time.

Markdown has no native way to attach attributes to a block.

## Decision

Metadata is the leading `key: value` lines of a slide, before any prose:

```markdown
---

kind: live
cta: [Billing Settings](/lightning/n/BillingSettings)

## Automated setup

Drive the wizard end to end.
```

Parsing takes leading lines matching `^\w+:` and stops at the first line that does not; everything
after is Markdown. To keep it unambiguous, the block must appear before any prose — a slide that
legitimately begins with `Note: something` is not misread, because the metadata block has already
been closed.

CTAs are written as Markdown links rather than with an invented operator, so authors reuse syntax
they already know from the rest of the deck.

## Alternatives considered

**reveal's native `<!-- .slide: data-x="y" -->` comments.** Zero parsing code, since reveal's
markdown plugin already understands them. Rejected: HTML comments carrying attributes is the least
approachable syntax available, and approachability is the point of the whole format decision.

**Pandoc-style inline braces** — `## Automated setup {live}` and `[Label](/path){.cta}`. Denser, and
metadata sits on the thing it describes. Rejected: two custom parsers instead of one, and `{live}`
means nothing to a reader until they consult documentation.

**Pure convention, no syntax** — infer that a slide whose only content is a link is a "live" slide,
that the first link is the CTA, that the cue is always the heading. Rejected: no escape hatch. A
live slide that also needs bullets, or a slide with an incidental link, becomes inexpressible.

## Consequences

- One concept to teach, and it is the same concept as the deck header — frontmatter, applied per
  slide.
- Every key is optional and defaulted, so a deck of plain Markdown with no metadata anywhere is
  valid.
- Unrecognized keys produce a diagnostic rather than an error, so a deck written against a later
  version of demoIt still presents (see ADR 0008).
