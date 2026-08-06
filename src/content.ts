/*
 * Draws the deck on top of whatever page you are on, rather than trying to pull the page into the
 * deck. Serious web applications refuse to be framed, so this is the only arrangement that works
 * everywhere (ADR 0001).
 *
 * The HUD is a presenter aid: it names the slide you are on and the one coming next, and it
 * advances the deck without opening it. Cue-only slides never need the deck shown at all.
 *
 * BEFORE CHANGING ANYTHING HERE, READ docs/runtime-constraints.md. Several of the arrangements
 * below look like unnecessary complication and fail silently when simplified — most of all the
 * off-screen transform used to close the stage.
 */

import { api } from "./api.ts";
import { ARMED_KEY, DECK_KEY, STATE_KEY, loadDeck, type DeckState, type StoredDeck } from "./deck-store.ts";
import { parseDeck, type Deck, type Slide } from "./parse.ts";

interface RevealApi {
  initialize(): Promise<void>;
  slide(h: number, v?: number): void;
  next(): void;
  prev(): void;
  layout(): void;
  getIndices(): { h: number; v: number };
  getSlides(): readonly HTMLElement[];
  getCurrentSlide(): HTMLElement | undefined;
  on(event: string, listener: () => void): void;
  destroy?(): void;
}

/* Supplied by vendor/reveal.js, loaded as a content script ahead of this one. */
declare const Reveal: new (container: Element, config: Record<string, unknown>) => RevealApi;

const SHEETS = [
  "vendor/reset.css",
  "vendor/reveal.css",
  "vendor/theme/white.css",
  "themes.css",
  "deck.css",
  "overlay.css",
];

let model: Deck;
let reveal: RevealApi;
let built = false;
let ready = false;
let applying = false;
let current: Slide | undefined;
let blobUrls: string[] = [];
let sheets: string | null = null;

let host: HTMLElement;
let root: ShadowRoot;
let stage: HTMLElement;
let hud: HTMLElement;

void boot();

async function boot(): Promise<void> {
  // Storage is shared by every tab, so a change here is a deck arriving or leaving, the deck moving
  // somewhere else, or demoIt being switched on or off.
  //
  // Registered before the first build, and never torn down, because a tab that loaded with no deck
  // still has to notice when one is loaded — otherwise the HUD only appears after a refresh.
  api.storage.onChanged.addListener((changes, area) => {
    if (area !== "local") {
      return;
    }
    if (changes[DECK_KEY]) {
      rebuild(changes[DECK_KEY].newValue as StoredDeck | undefined);
      return;
    }
    if (!built) {
      return;
    }
    if (changes[ARMED_KEY]) {
      arm(changes[ARMED_KEY].newValue !== false);
    }
    if (changes[STATE_KEY]) {
      follow(changes[STATE_KEY].newValue as DeckState | undefined);
    }
  });

  const stored = await loadDeck();
  if (stored !== null) {
    // Through the same queue as any later change, so a deck loaded while this one is still
    // building cannot interleave with it.
    rebuild(stored);
  }
}

/*
 * Builds are serialised. Picking a folder twice in quick succession would otherwise interleave two
 * builds through the awaits below and leave two overlays on the page.
 */
let pending: Promise<void> = Promise.resolve();

function rebuild(stored: StoredDeck | undefined): void {
  const next = async (): Promise<void> => {
    teardown();
    if (stored) {
      await build(stored);
    }
  };
  pending = pending.then(next, next);
}

async function build(stored: StoredDeck): Promise<void> {
  const assets = blobAssets(stored.assets);
  blobUrls = [...assets.values()];

  model = parseDeck(stored.source, assets, stored.name);
  if (model.slides.length === 0) {
    releaseAssets();
    return;
  }

  host = document.createElement("div");
  host.id = "demoit";
  host.classList.add(`theme-${model.theme}`);
  root = host.attachShadow({ mode: "open" });
  document.documentElement.append(host);

  if (sheets === null) {
    const files = await Promise.all(SHEETS.map(fetchText));
    // Custom properties are declared on :root, which matches nothing inside a shadow root.
    sheets = files.join("\n").replace(/:root\b/g, ":host");
  }
  const style = document.createElement("style");
  style.textContent = sheets;
  root.append(style, buildHud(), buildStage());
  built = true;

  const settings = await api.storage.local.get([STATE_KEY, ARMED_KEY]);
  arm(settings[ARMED_KEY] !== false);

  // The deck is live from the start, closed rather than absent, so the HUD can read positions and
  // advance slides while the application has the screen.
  reveal = new Reveal(root.querySelector(".reveal") as Element, {
    embedded: true,
    keyboard: false,
    controls: true,
    progress: true,
    overview: false,
  });
  await reveal.initialize();
  ready = true;
  reveal.on("slidechanged", onSlideChanged);

  const state = settings[STATE_KEY] as DeckState | undefined;
  if (state?.index) {
    reveal.slide(state.index.h, state.index.v);
  }
  if (state?.presenting) {
    open();
  }
  onSlideChanged();
}

/* Removing the host removes the shadow root and everything in it, but the keyboard listener is on
 * the window and the blob URLs are held by the browser, so both are released by hand. */
function teardown(): void {
  if (!built) {
    return;
  }
  window.removeEventListener("keydown", onKeyDown, true);
  reveal.destroy?.();
  host.remove();
  releaseAssets();
  built = false;
  ready = false;
  current = undefined;
}

function releaseAssets(): void {
  for (const url of blobUrls) {
    URL.revokeObjectURL(url);
  }
  blobUrls = [];
}

/*
 * Data URLs are what survive being written to storage; blob URLs are what should end up in the
 * slide HTML, so a screenshot is held once rather than once per slide that shows it. Decoded by
 * hand rather than with fetch(), which would put the page's own CSP between us and our images.
 */
function blobAssets(assets: Readonly<Record<string, string>>): Map<string, string> {
  const urls = new Map<string, string>();

  for (const [name, dataUrl] of Object.entries(assets)) {
    const comma = dataUrl.indexOf(",");
    if (comma === -1) {
      continue;
    }
    const type = dataUrl.slice(5, comma).replace(";base64", "");
    const binary = atob(dataUrl.slice(comma + 1));
    const bytes = new Uint8Array(binary.length);
    for (let at = 0; at < binary.length; at += 1) {
      bytes[at] = binary.charCodeAt(at);
    }
    urls.set(name, URL.createObjectURL(new Blob([bytes], { type })));
  }

  return urls;
}

function fetchText(path: string): Promise<string> {
  return fetch(api.runtime.getURL(path)).then((response) => response.text());
}

/* Disarmed, the script stays loaded but draws nothing, so it can match every site harmlessly. */
function arm(armed: boolean): void {
  host.style.display = armed ? "" : "none";
  if (!armed && !stage.classList.contains("closed")) {
    close();
  }
}

/* Match a move made in another tab, without echoing it back and starting a loop. */
function follow(state: DeckState | undefined): void {
  if (!ready || !state) {
    return;
  }

  applying = true;
  const here = reveal.getIndices();
  if (state.index && (state.index.h !== here.h || state.index.v !== here.v)) {
    reveal.slide(state.index.h, state.index.v);
  }
  if (state.presenting) {
    open();
  } else {
    close();
  }
  applying = false;
}

/* The HUD. Body opens the deck; the arrows move it without opening anything. */
function buildHud(): HTMLElement {
  hud = document.createElement("div");
  hud.className = "hud";
  hud.innerHTML = `
    <div class="hud-body">
      <div class="hud-row">
        <span class="hud-label">Now</span>
        <span class="hud-count"></span>
      </div>
      <div class="hud-now"></div>
      <div class="hud-cta"></div>
      <div class="hud-row hud-next-row">
        <span class="hud-label">Next</span>
      </div>
      <div class="hud-next"></div>
    </div>
    <div class="hud-controls">
      <button class="hud-btn" data-move="prev" title="Previous slide">&lsaquo;</button>
      <button class="hud-btn" data-move="next" title="Next slide">&rsaquo;</button>
    </div>
  `;

  hud.querySelector(".hud-body")?.addEventListener("click", open);
  for (const button of hud.querySelectorAll<HTMLElement>("[data-move]")) {
    button.addEventListener("click", () => {
      if (button.dataset["move"] === "next") {
        reveal.next();
      } else {
        reveal.prev();
      }
    });
  }
  return hud;
}

function buildStage(): HTMLElement {
  stage = document.createElement("div");
  stage.className = "stage closed";

  const exit = document.createElement("button");
  exit.className = "exit";
  exit.textContent = "Back to the app";
  exit.addEventListener("click", () => void close());

  const container = document.createElement("div");
  container.className = "reveal";
  const slides = document.createElement("div");
  slides.className = "slides";

  for (const column of model.columns) {
    if (column.length === 1 && column[0]) {
      slides.append(buildSlide(column[0]));
      continue;
    }
    // A vertical stack is a section of sections, which is reveal's own arrangement.
    const stack = document.createElement("section");
    for (const slide of column) {
      stack.append(buildSlide(slide));
    }
    slides.append(stack);
  }

  container.append(slides);
  stage.append(exit, container);
  return stage;
}

function buildSlide(slide: Slide): HTMLElement {
  const section = document.createElement("section");
  section.dataset["role"] = slide.role;

  if (slide.role === "peek") {
    // A card floating over the live page, rather than a slide covering it.
    const card = document.createElement("div");
    card.className = "peek-card";
    card.innerHTML = slide.html;
    section.append(card);
  } else {
    section.innerHTML = slide.html;
  }

  if (slide.cta) {
    const link = document.createElement("a");
    link.className = "cta";
    link.href = slide.cta.href;
    link.textContent = slide.cta.label;
    link.addEventListener("click", (event) => {
      event.preventDefault();
      void handoff(slide.cta?.href ?? "");
    });
    section.append(link);
  }

  return section;
}

function open(): void {
  stage.classList.remove("closed");
  hud.classList.add("presenting");
  window.addEventListener("keydown", onKeyDown, true);
  // The stage keeps its size while closed, but a window resize in between would have been missed.
  reveal.layout();
  void save(true);
}

function close(): Promise<void> {
  stage.classList.add("closed");
  hud.classList.remove("presenting");
  window.removeEventListener("keydown", onKeyDown, true);
  // Returned so a caller that is about to navigate can let the write land first.
  return save(false);
}

function onSlideChanged(): void {
  const section = reveal.getCurrentSlide();
  const at = section ? reveal.getSlides().indexOf(section) : -1;
  // Held for save(), so the panel can say "slide 3 of 7" without re-deriving it from h/v.
  current = model.slides[at];

  stage.classList.toggle("peek", current?.role === "peek");
  setText(".hud-count", `${at + 1} / ${model.slides.length}`);
  label(".hud-now", current);
  label(".hud-next", model.slides[at + 1]);
  mirrorCta(current);
  void save(!stage.classList.contains("closed"));
}

/*
 * The current slide's CTA is repeated on the HUD. Slides carrying one are the slides you never
 * open, so a link that only exists on the slide is a link you never find.
 */
function mirrorCta(slide: Slide | undefined): void {
  const holder = hud.querySelector(".hud-cta") as HTMLElement;
  holder.textContent = "";

  if (!slide?.cta) {
    return;
  }

  const link = document.createElement("a");
  link.className = "hud-cta-link";
  link.href = slide.cta.href;
  link.textContent = slide.cta.label;
  link.addEventListener("click", (event) => {
    event.preventDefault();
    // The body behind this opens the deck, which is the opposite of what a CTA is for.
    event.stopPropagation();
    void handoff(slide.cta?.href ?? "");
  });
  holder.append(link);
}

/* Hands the screen over to the application in this same tab, closing the deck on the way out. */
async function handoff(url: string): Promise<void> {
  await close();
  window.location.href = url;
}

/* Badge plus cue, so a glance says where to be as well as what is coming. */
function label(selector: string, slide: Slide | undefined): void {
  const element = hud.querySelector(selector) as HTMLElement;
  element.textContent = "";

  if (!slide) {
    element.textContent = "End";
    return;
  }

  const badge = document.createElement("span");
  badge.className = "badge";
  badge.style.setProperty("--badge", slide.kind.color);
  badge.textContent = slide.kind.label;
  element.append(badge, slide.cue);
}

function setText(selector: string, text: string): void {
  (hud.querySelector(selector) as HTMLElement).textContent = text;
}

function save(presenting: boolean): Promise<void> {
  if (applying) {
    return Promise.resolve();
  }
  const state: DeckState = {
    presenting,
    index: ready ? reveal.getIndices() : null,
    at: current?.at.index ?? null,
  };
  return api.storage.local.set({ [STATE_KEY]: state });
}

// Capture phase, so the application never sees the keys the deck is using.
function onKeyDown(event: KeyboardEvent): void {
  // next/prev rather than right/left: they step through a slide's fragments before moving on,
  // which right/left do not promise.
  const actions: Record<string, () => void> = {
    ArrowRight: () => reveal.next(),
    ArrowLeft: () => reveal.prev(),
    ArrowDown: () => reveal.next(),
    ArrowUp: () => reveal.prev(),
    PageDown: () => reveal.next(),
    PageUp: () => reveal.prev(),
    " ": () => reveal.next(),
    Escape: () => void close(),
  };

  const action = actions[event.key];
  if (action) {
    event.preventDefault();
    event.stopPropagation();
    action();
  }
}
