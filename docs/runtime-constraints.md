# Runtime constraints

**Read this before changing anything in the overlay runtime.**

demoIt draws a deck inside a hostile document (ADR 0001). The constraints below are what make that
work. Each one was forced by a specific failure during rehearsal of the implementation demoIt is
derived from, and each looks like an unnecessary complication until you have seen it fail.

Several fail *silently* — invisible in testing, embarrassing in front of a prospect. No type system
prevents any of them.

Simplifying against this document requires evidence, not intuition. If you remove one and nothing
appears to break, you have most likely reproduced the original bug without noticing.

---

### 1. Shadow DOM is mandatory

Everything renders inside a shadow root on a single host element. Without it, the host application's
CSS and the deck's CSS destroy each other — and the host application is whatever the presenter
happens to be demoing, so this cannot be handled case by case.

### 2. `:root` must be rewritten to `:host` when injecting stylesheets

reveal declares its custom properties on `:root`, which matches nothing inside a shadow root. The
injection step rewrites the selector as it goes. Without it every reveal variable is undefined and
the deck renders unstyled.

### 3. The closed deck moves off screen with a `transform`, never `display: none` or `visibility`

reveal sets `visibility: visible` **and** `pointer-events: auto` on slide sections. Both are
inheritable properties that a descendant can re-declare, so hiding the ancestor hides nothing.

Symptoms: the slide lingers visibly after closing, and — far worse — a tall closed slide silently
swallows clicks meant for the application underneath. The presenter clicks a button in the live app
and nothing happens, in front of the audience, with no visible cause.

Nothing can escape an ancestor's transform. That is why the transform is used.

**This is the single most damaging failure in the tool and the one most likely to be "cleaned up" by
someone who does not know why it is there.**

### 4. reveal initialises at page load, closed rather than absent

The HUD reads slide titles and positions before the deck is ever opened, and cue-only slides are
advanced without being shown at all. So reveal must be live from the start.

The stage keeps real dimensions while parked off screen, so reveal has something to lay out against.
Call `layout()` when opening, since a window resize while closed would otherwise have been missed.

### 5. Take the keyboard away from reveal

Configure `keyboard: false` and use one capture-phase listener that calls `deck.next()` /
`deck.prev()` and stops propagation.

Two reasons. The host application acts on the same keystrokes otherwise — arrow keys scroll a list
underneath the slide. And `right()` / `left()` do not promise to step through a slide's fragments the
way `next()` / `prev()` do.

### 6. Size against reveal's 960×700 canvas, not the viewport

reveal scales the whole canvas, so a `vh` value is multiplied by the scale factor. The symptom is
content that overflows at some window sizes and not others, which reads as an intermittent bug.

### 7. No host allowlist

Covered by ADR 0011. Salesforce serves Setup from a separate domain and the HUD vanished there.
Match everything; give the user an off switch.

### 8. Cross-tab sync needs a re-entrancy guard

`storage.onChanged` fires in every tab **including the one that wrote the change**. Without an
`applying` flag suppressing the write-back, two open tabs ping-pong indefinitely.

### 9. The storage listener is registered before the first build, and independently of it

A tab that loaded before any deck existed still has to notice when one arrives. If the listener is
registered as part of building the overlay — the natural place for it — then a tab with no deck
never listens, and loading a deck appears to do nothing until the page is refreshed.

The same applies in reverse: removing the deck has to tear the overlay down in tabs that already
have one.

Builds are queued rather than run on arrival, including the first one. Two decks loaded in quick
succession would otherwise interleave through the `await`s and leave two overlays on the page.

### 10. Firefox MV3 specifics

`browser_specific_settings.gecko.id` is required. `web_accessible_resources` takes
`{resources, matches}`. Background is `{"scripts": [...]}`, not a service worker. See ADR 0013 for
how this stays portable.
