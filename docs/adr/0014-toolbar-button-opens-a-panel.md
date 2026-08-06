# ADR 0014 — The toolbar button opens a panel, not a toggle

- **Status:** Accepted
- **Date:** 2026-08-06
- **Amends:** [ADR 0011](0011-match-all-urls-with-arm-toggle.md), which put the off switch on the
  button itself. Matching all URLs and having an off switch are unchanged; where the switch lives
  is not.

## Context

The first version made the toolbar button a toggle: clicking it armed or disarmed demoIt, with an
ON/OFF badge. Loading a deck lived on the extension's options page, reachable only through Firefox's
add-ons menu.

Used in anger, that arrangement fails twice:

- **You have to already know how it works.** A button that toggles an unlabelled boolean cannot tell
  you what it does, and the badge cannot tell you *why* it is in the state it is in. With no deck
  loaded, ON meant nothing and there was no way to discover that.
- **The one thing a new user must do is the hardest to find.** Loading a deck required digging
  through a browser menu into a page nothing pointed at.

Every extension people actually use — uBlock Origin, Bitwarden, Video DownloadHelper — answers the
click with its own interface.

## Decision

The toolbar button opens a panel, which is demoIt's front door. It holds everything a presenter does
between demos:

- **With no deck**: a sentence saying a deck is missing and what one is, and a button that opens the
  deck page. There is no toggle to misread, because there is nothing to toggle.
- **With a deck**: its name, where you are in it ("Slide 3 of 7 · Handing over to the page"),
  Present / Close the deck, the on/off switch *with a written explanation of what off does*, a line
  for outstanding diagnostics, and Change deck / Remove deck.

The badge stays as the at-a-glance version of what the panel says in words.

**The folder picker stays on the deck page**, and the panel's buttons open that page rather than
picking inline. A file dialog opened from a popup takes focus away from it, Firefox closes the
popup, and the `change` event dies with the document. The complaint was having to hunt through a
browser menu, and one click from the panel answers it without betting the load flow on a popup that
closes.

**Present writes shared state** rather than messaging a content script. Every tab already follows
`storage.onChanged` for cross-tab sync, so the panel gets the behaviour for free and never has to
know which tab is in front.

## Consequences

- `action.onClicked` no longer fires once `default_popup` is set, so the background script keeps
  only the badge.
- Two windows of ours now exist, so they share `ui.css`. They are the same product seen at two
  sizes; separate palettes would drift.
- The panel parses the deck **without its images** — it needs titles, cues and a count, and
  resolving assets would copy every screenshot into slide HTML to open a 300px popup. The diagnostic
  count comes from storage, written when the deck was loaded against its real images.
- Two surfaces is more to keep consistent than one. The split is by tempo: the panel is what you
  touch during a demo, the deck page is what you read before one.
