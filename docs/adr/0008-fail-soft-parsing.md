# ADR 0008 — Fail-soft parsing, with strictness in a pre-flight report

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

demoIt is used in front of clients and prospects. Looking unprofessional is the failure mode that
matters, which argues for catching problems aggressively.

Decks come from users: a mistyped kind, a malformed metadata block, an image referenced but not
present in the folder, a key from a future version.

The intuitive reading of the professionalism bar is fail-closed — refuse to load a broken deck so
nothing bad reaches the screen.

## Decision

**Fail-soft.** The parser is total: every input produces a `Deck`. Problems become diagnostics,
never a load-time refusal and never an exception during presentation.

Strictness moves to a **pre-flight report** on the options page, shown whenever a deck is loaded:
slide count, every CTA URL, every missing image, every unrecognized key, every kind used.

The HUD shows no diagnostic indicator. The toolbar badge carries it instead.

## Rationale

Fail-closed inverts the risk it appears to manage. A typo would leave a presenter with no deck at all
four minutes before a client call. Fail-soft's worst case is one slide that looks slightly off — in a
tool where roughly a third of slides are cues nobody ever displays.

The pre-flight report is where strictness belongs because it is read while there is still time to
act. It also catches what actually causes embarrassment: missing screenshots and CTAs pointing at a
dead environment. Neither is a type error; both are invisible until you are standing on that slide.

The HUD is rendered on the shared screen. A warning badge there tells the audience something is
wrong with your deck, which is the exact impression this ADR exists to prevent. The toolbar badge is
private to the presenter and already exists for arm/disarm state, so it carries the dot.

## Consequences

- Unrecognized keys warn rather than fail, so a deck authored against a later version still presents.
- Fail-soft can hide a problem the author would rather have been forced to see. The mitigation is
  that the pre-flight report must be prominent, not a collapsed panel people learn to skip past.
- Totality is a real constraint on the parser, not a description of it. See ADR 0009.
