# ADR 0011 — Match all URLs, with a global arm/disarm toggle

- **Status:** Accepted
- **Date:** 2026-08-06

## Context

The content script has to run wherever the presenter demos. The tidy approach is a host allowlist —
declare the applications a deck targets and inject only there.

This was tried and failed. Salesforce serves Setup from a *separate domain*
(`my.salesforce-setup.com`), so the HUD silently disappeared exactly when the presenter navigated
into Setup mid-demo. Any large application has equivalents: a separate console domain, a CDN-hosted
sub-app, a vendor-hosted checkout, a documentation site.

An allowlist fails silently and fails in front of an audience.

## Decision

Match `<all_urls>`, and give the user an off switch: a toolbar button that arms and disarms demoIt
globally, with an ON/OFF badge.

Disarmed, the content script stays loaded but draws nothing. This is a display concern, not a
lifecycle one — there is no injection to undo.

Armed is the default, so a freshly installed extension shows the HUD rather than appearing broken.

## Rationale

The presenter cannot enumerate in advance every domain a demo will touch, and discovering a gap
mid-presentation is the worst possible time. Matching everything and offering one explicit control
puts the decision where the user can see it.

The toolbar badge is also the natural home for the deck-diagnostics indicator (ADR 0008), since it is
a surface only the presenter sees.

## Consequences

- The extension requests broad host access, which is a real permissions ask and must be explained in
  the README rather than glossed over.
- Without the off switch the HUD would follow the user onto every site they visit, so the toggle is
  load-bearing, not a convenience.
- Arm state lives in `storage.local` alongside deck position, so it is shared across tabs.
