# ADR 0001 — Draw the deck as an overlay, not an iframe

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

demoIt exists so a product demo can alternate between slides and driving a live web application
without alt-tabbing. The obvious implementation is to embed the application inside the deck with an
iframe.

This does not work. Salesforce sends `X-Frame-Options: SAMEORIGIN` and `frame-ancestors 'self'`, and
clickjack protection on Setup pages cannot be disabled even with vendor involvement. Most serious web
applications behave the same way. Any design that depends on framing the application is limited to
the applications that permit framing, which excludes most of the ones worth demoing.

## Decision

Invert the arrangement. A content script draws the deck **over** the live page, inside a shadow root
on a single host element appended to the host document.

There is no iframe and no framing policy to negotiate. The overlay works on any page the browser can
load. Dismissing it leaves the presenter in the real application — same tab, same scroll position,
same session.

## Consequences

- The tool works on every application, including ones that actively refuse embedding.
- The handover between slide and application is seamless, because there was never a second surface.
- The deck now lives inside a hostile document, which forces a set of runtime invariants around
  style isolation, hiding, and keyboard handling. These are documented in
  `docs/runtime-constraints.md` and are not optional.
- The extension must match all URLs to be useful, since it cannot know which page a presenter will
  demo. That in turn requires an explicit off switch (see ADR 0011).
