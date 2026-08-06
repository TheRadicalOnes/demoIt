/*
 * The toolbar panel. This is demoIt's front door (ADR 0014): clicking the icon opens it, and
 * everything a presenter does between demos is here — load a deck, see where you are, present,
 * switch demoIt off.
 *
 * It states its own condition rather than expecting to be understood. With no deck loaded there is
 * no toggle to misread; there is a sentence saying what is missing and a button that fixes it.
 *
 * Present works by writing shared state, which every tab already follows, so the panel never needs
 * to talk to a content script or care which tab is in front.
 */

import { api } from "./api.ts";
import {
  clearDeck,
  deckIssues,
  isArmed,
  loadDeck,
  loadState,
  saveState,
  setArmed,
  type StoredDeck,
} from "./deck-store.ts";
import { parseDeck, type Deck } from "./parse.ts";

const empty = element("#empty");
const loaded = element("#loaded");
const name = element("#name");
const where = element("#where");
const present = element<HTMLButtonElement>("#present");
const issues = element("#issues");
const issuesCount = element("#issues-count");
const armedBox = element<HTMLInputElement>("#armed");

element("#choose").addEventListener("click", () => void openDeckPage());
element("#change").addEventListener("click", () => void openDeckPage());
element("#view-report").addEventListener("click", () => void openDeckPage());

armedBox.addEventListener("change", () => void setArmed(armedBox.checked));

present.addEventListener("click", () => void togglePresenting());

/* Two clicks, because losing the deck between demos is a worse accident than an extra click. */
let confirming = false;
const remove = element<HTMLButtonElement>("#remove");
remove.addEventListener("click", () => {
  if (!confirming) {
    confirming = true;
    remove.textContent = "Really remove?";
    return;
  }
  void clearDeck().then(show);
});

void show();

async function show(): Promise<void> {
  const stored = await loadDeck();
  if (stored === null) {
    empty.hidden = false;
    loaded.hidden = true;
    return;
  }

  empty.hidden = true;
  loaded.hidden = false;
  confirming = false;
  remove.textContent = "Remove deck";

  const [armed, state, count] = await Promise.all([isArmed(), loadState(), deckIssues()]);
  const deck = read(stored);

  name.textContent = deck.title;
  armedBox.checked = armed;

  const total = deck.slides.length;
  const at = state?.at ?? null;
  const cue = at === null ? undefined : deck.slides[at]?.cue;
  where.textContent =
    at === null || cue === undefined
      ? `${total} slide${total === 1 ? "" : "s"}`
      : `Slide ${at + 1} of ${total} · ${cue}`;

  present.textContent = state?.presenting ? "Close the deck" : "Present";

  issues.hidden = count === 0;
  issuesCount.textContent = `${count} thing${count === 1 ? "" : "s"} to look at`;
}

async function togglePresenting(): Promise<void> {
  const state = await loadState();
  await saveState({
    presenting: !state?.presenting,
    index: state?.index ?? null,
    at: state?.at ?? null,
  });
  window.close();
}

/*
 * The picker lives on the deck page, not here. A file dialog opened from a popup takes focus away
 * from it, Firefox closes the popup, and the change event dies with the document — so the panel
 * hands off to a real tab instead.
 */
async function openDeckPage(): Promise<void> {
  await api.runtime.openOptionsPage();
  window.close();
}

/*
 * Parsed without its images. The panel only needs titles, cues and a count, and resolving assets
 * would copy every screenshot into the slide HTML just to open a 300px popup. The diagnostic count
 * comes from storage, written when the deck was loaded against its real images.
 */
function read(stored: StoredDeck): Deck {
  return parseDeck(stored.source, new Map(), stored.name);
}

function element<T extends HTMLElement = HTMLElement>(selector: string): T {
  return document.querySelector(selector) as T;
}
