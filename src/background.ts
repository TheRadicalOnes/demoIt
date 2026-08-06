/*
 * Keeps the toolbar badge honest. The button itself opens the panel (ADR 0014), so there is no
 * click handler here — the badge is the at-a-glance version of what the panel says in words.
 *
 * It is also the presenter-only channel for deck problems. Nothing about them goes on the HUD,
 * which is on the shared screen (ADR 0008).
 *
 * No state is held between wakes — the event page is torn down and revived, and the same code has
 * to work as a Chrome service worker later (ADR 0013).
 */

import { api } from "./api.ts";
import { deckIssues, isArmed, loadDeck } from "./deck-store.ts";

const ON = "#2e844a";
const NEEDS_ATTENTION = "#a86403";
const OFF = "#706e6b";

async function paintBadge(): Promise<void> {
  const [armed, deck, issues] = await Promise.all([isArmed(), loadDeck(), deckIssues()]);

  if (deck === null) {
    api.action.setBadgeText({ text: "" });
    api.action.setTitle({ title: "demoIt — no deck loaded" });
    return;
  }

  api.action.setBadgeText({ text: armed ? "ON" : "OFF" });
  api.action.setBadgeBackgroundColor({
    color: armed ? (issues > 0 ? NEEDS_ATTENTION : ON) : OFF,
  });

  const state = armed ? "on" : "off";
  const trouble = issues > 0 ? `, ${issues} thing${issues === 1 ? "" : "s"} to look at` : "";
  api.action.setTitle({ title: `demoIt — ${state}${trouble}` });
}

api.storage.onChanged.addListener((_changes, area) => {
  if (area === "local") {
    void paintBadge();
  }
});

void paintBadge();
