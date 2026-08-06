/*
 * The toolbar button arms and disarms the deck. Disarmed, the content script stays loaded but
 * draws nothing, so the extension can match every site without following you around off stage
 * (ADR 0011).
 *
 * Armed is the default: a freshly installed add-on should show the HUD rather than look broken.
 *
 * The badge is also the presenter-only surface for deck problems. Nothing about them goes on the
 * HUD, which is on the shared screen (ADR 0008).
 *
 * No state is held between wakes — the event page is torn down and revived, and the same code has
 * to work as a Chrome service worker later (ADR 0013).
 */

import { api } from "./api.ts";
import { ARMED_KEY, deckIssues, isArmed, loadDeck } from "./deck-store.ts";

const ON = "#2e844a";
const NEEDS_ATTENTION = "#a86403";
const OFF = "#706e6b";

async function paintBadge(): Promise<void> {
  const [armed, deck, issues] = await Promise.all([isArmed(), loadDeck(), deckIssues()]);

  if (deck === null) {
    api.action.setBadgeText({ text: "" });
    api.action.setTitle({ title: "demoIt: no deck loaded. Open the options page to pick one." });
    return;
  }

  api.action.setBadgeText({ text: armed ? "ON" : "OFF" });
  api.action.setBadgeBackgroundColor({
    color: armed ? (issues > 0 ? NEEDS_ATTENTION : ON) : OFF,
  });

  const state = armed ? "on. Click to stop." : "off. Click to start.";
  const trouble = issues > 0 ? ` ${issues} thing${issues === 1 ? "" : "s"} to look at.` : "";
  api.action.setTitle({ title: `demoIt: ${state}${trouble}` });
}

api.action.onClicked.addListener(() => {
  void (async () => {
    await api.storage.local.set({ [ARMED_KEY]: !(await isArmed()) });
    await paintBadge();
  })();
});

api.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    void paintBadge();
  }
});

void paintBadge();
