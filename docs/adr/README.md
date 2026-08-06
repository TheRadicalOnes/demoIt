# Architecture decision records

One decision per file. Records are immutable once accepted — if we change our minds we add a new ADR
that supersedes the old one, and update the old one's status to point at its replacement. The history
stays readable as a sequence of files rather than a document that quietly rewrites itself.

## Status values

- **Accepted** — in force.
- **Accepted, amended by ADR NNNN** — still in force, but a later record changed part of it. Say
  which part in the status line, so a reader knows what still stands.
- **Superseded by ADR NNNN** — no longer in force, kept for the reasoning.

## Writing a new one

Next number, kebab-case title. Sections: Context, Decision, Rationale where it is not obvious,
Consequences including the ones we dislike. Alternatives considered when a real alternative was
rejected — record *why* it lost, since that is what a future reader needs.

An ADR should read standalone. Restate context rather than pointing at a conversation or an external
document.

## Index

| ADR | Decision | Status |
| --- | --- | --- |
| [0001](0001-overlay-not-iframe.md) | Draw the deck as an overlay, not an iframe | Accepted |
| [0002](0002-markdown-over-yaml.md) | Markdown, not YAML, as the authoring format | Accepted |
| [0003](0003-per-slide-metadata-block.md) | Per-slide metadata as a leading key/value block | Accepted |
| [0004](0004-local-folder-deck-delivery.md) | Decks are local folders, picked once | Accepted |
| [0005](0005-slide-roles-inferred-from-structure.md) | Slide appearance inferred into four closed roles | Accepted |
| [0006](0006-themes-named-for-host-application.md) | Three built-in themes, named for the host application | Accepted |
| [0007](0007-slide-kinds-label-only.md) | Slide kinds are labels that never drive behaviour | Accepted |
| [0008](0008-fail-soft-parsing.md) | Fail-soft parsing, with strictness in a pre-flight report | Accepted |
| [0009](0009-typescript-parse-dont-validate.md) | TypeScript, strict, with parse-don't-validate | Accepted |
| [0010](0010-build-toolchain.md) | esbuild to build, tsc to check, Node to test, deps vendored | Accepted |
| [0011](0011-match-all-urls-with-arm-toggle.md) | Match all URLs, with a global arm/disarm toggle | Accepted, amended by 0014 |
| [0012](0012-port-the-reference-implementation.md) | Port the reference implementation rather than rewrite | Accepted |
| [0013](0013-chromium-readiness-as-discipline.md) | Chromium readiness is a discipline, not a directory layout | Accepted |
| [0014](0014-toolbar-button-opens-a-panel.md) | The toolbar button opens a panel, not a toggle | Accepted |
| [0015](0015-columns-from-sub-headings.md) | Two or more sub-headings on a slide are columns | Accepted |
