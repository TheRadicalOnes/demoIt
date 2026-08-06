/*
 * Where a deck lives. Today that is extension storage, holding the markdown and its images as
 * data URLs, written once by the options page when the author picks a folder (ADR 0004).
 *
 * `loadDeck` is the seam. When decks move to a hosted backend it is the only function that
 * changes — which is why it is a function and not an interface with one implementation.
 */

import { api } from "./api.ts";

export const ARMED_KEY = "armed";
export const STATE_KEY = "deckState";
const DECK_KEY = "deck";
const ISSUES_KEY = "deckIssues";

export interface StoredDeck {
  /* Folder name, used as the deck title when the markdown has no `title:`. */
  readonly name: string;
  readonly source: string;
  /* Filename to data URL. The content script turns these into blob: URLs before parsing, so the
   * rendered HTML holds a short reference rather than megabytes of base64 per usage. */
  readonly assets: Readonly<Record<string, string>>;
  readonly savedAt: string;
}

export async function loadDeck(): Promise<StoredDeck | null> {
  const stored = await api.storage.local.get(DECK_KEY);
  return (stored[DECK_KEY] as StoredDeck | undefined) ?? null;
}

/* `issues` is the diagnostic count, kept beside the deck so the toolbar badge can show that
 * something needs looking at without the background script having to parse anything. */
export async function saveDeck(deck: StoredDeck, issues: number): Promise<void> {
  await api.storage.local.set({ [DECK_KEY]: deck, [ISSUES_KEY]: issues });
}

export async function clearDeck(): Promise<void> {
  await api.storage.local.remove([DECK_KEY, ISSUES_KEY, STATE_KEY]);
}

export async function deckIssues(): Promise<number> {
  const stored = await api.storage.local.get(ISSUES_KEY);
  return (stored[ISSUES_KEY] as number | undefined) ?? 0;
}

export async function isArmed(): Promise<boolean> {
  const stored = await api.storage.local.get(ARMED_KEY);
  return stored[ARMED_KEY] !== false;
}
