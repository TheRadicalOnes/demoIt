# ADR 0015 — Two or more sub-headings on a slide are columns

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

Porting a real deck to the demoIt format lost its side-by-side layouts. The original expressed them
with a `.cols` wrapper in hand-written HTML — "Updated" and "Not in scope" beside each other,
"New" and "Gained a currency input" beside each other, three columns of documentation links.

Flattening them into a vertical run of sub-headings changed what the slides said. Two lists side by
side are a comparison; the same two lists stacked are a sequence.

Markdown cannot express a wrapper, and the syntaxes that could were rejected in ADR 0003 for being
too technical. The rest of the format infers presentation from structure (ADR 0005), so the question
was whether columns could be inferred too.

## Decision

**A slide with two or more `###` sub-headings lays them out as columns.** Each column is a
sub-heading and everything under it up to the next one. Content above the first sub-heading — a
heading, a lede — stays full width above the columns.

One sub-heading stays an ordinary sub-heading. Columns begin at two, because two is when an author
is comparing things.

The grouping is done by the parser, not by CSS. **CSS cannot gather a heading and the siblings that
follow it**, so there is no selector that could wrap these after the fact. The parser splits the
token stream and emits the wrappers, which also keeps `html` a complete description of the slide —
the renderer receives columns, it does not build them (ADR 0009).

The theme styles the sub-heading as the column's label: small, uppercase, carrying the accent, so
the content under it can stay plain.

## Rationale

It reuses the principle the format already runs on. An author writing two sub-headings on a slide
almost always means "these two things, together" — the layout follows from what they wrote rather
than from a setting they had to learn.

It also cost nothing at the deck level: the ported deck's flattened slides became correct by
deleting the workaround, not by adding markup.

## Consequences

- Side-by-side is now unreachable *without* sub-headings, and stacked sub-headings are unreachable
  entirely. An author who wants two `###` sections one under the other cannot have them.
- The inference is implicit, with the same failure mode ADR 0005 accepts: adding a second `###` to a
  slide silently changes its layout.
- Column width is even and automatic. Uneven splits, and column counts high enough to need a
  different gap, are not expressible.
- If any of the above bites, the escape hatch is the `layout:` key already contemplated in ADR 0005
  — not a new syntax for columns specifically.
