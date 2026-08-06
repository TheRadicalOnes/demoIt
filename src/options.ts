/*
 * Pick a deck folder, and show the pre-flight report.
 *
 * The report is where strictness lives. Parsing never refuses a deck (ADR 0008), so this page is
 * the place an author finds out that a screenshot is missing or a CTA points nowhere — while there
 * is still time to fix it, rather than on stage. It is deliberately not collapsible.
 */

import { clearDeck, loadDeck, saveDeck, type StoredDeck } from "./deck-store.ts";
import { THEMES, parseDeck, type Deck, type Diagnostic } from "./parse.ts";

const MARKDOWN = /\.(md|markdown)$/i;
const IMAGE = /\.(png|jpe?g|gif|webp|svg|avif)$/i;

const picker = document.querySelector("#folder") as HTMLInputElement;
const report = document.querySelector("#report") as HTMLElement;
const summary = document.querySelector("#summary") as HTMLElement;
const forget = document.querySelector("#forget") as HTMLButtonElement;

picker.addEventListener("change", () => void adopt(picker.files));
forget.addEventListener("click", () => {
  void clearDeck().then(show);
});

void show();

async function adopt(files: FileList | null): Promise<void> {
  if (files === null || files.length === 0) {
    return;
  }

  const chosen = [...files];
  const markdown = chosen.find((file) => MARKDOWN.test(file.name));
  if (markdown === undefined) {
    render(null, ["No .md file in that folder. A deck is one markdown file plus its images."]);
    return;
  }

  const images = chosen.filter((file) => IMAGE.test(file.name));
  const assets: Record<string, string> = {};
  for (const image of images) {
    assets[image.name] = await dataUrl(image);
  }

  const stored: StoredDeck = {
    name: folderOf(markdown) ?? markdown.name.replace(MARKDOWN, ""),
    source: await markdown.text(),
    assets,
    savedAt: new Date().toISOString(),
  };

  const deck = parseDeck(stored.source, new Map(Object.entries(stored.assets)), stored.name);
  await saveDeck(stored, deck.diagnostics.length);
  render(deck, []);
}

async function show(): Promise<void> {
  const stored = await loadDeck();
  if (stored === null) {
    render(null, []);
    return;
  }
  render(parseDeck(stored.source, new Map(Object.entries(stored.assets)), stored.name), []);
}

function render(deck: Deck | null, errors: readonly string[]): void {
  report.textContent = "";
  forget.hidden = deck === null;

  if (errors.length > 0) {
    summary.textContent = errors.join(" ");
    summary.className = "summary bad";
    return;
  }

  if (deck === null) {
    summary.textContent = "No deck loaded. Choose the folder holding your .md file and its images.";
    summary.className = "summary";
    return;
  }

  const issues = deck.diagnostics.length;
  summary.textContent =
    `${deck.title} — ${deck.slides.length} slide${deck.slides.length === 1 ? "" : "s"}, ` +
    (issues === 0 ? "nothing to fix." : `${issues} thing${issues === 1 ? "" : "s"} to look at.`);
  summary.className = issues === 0 ? "summary good" : "summary warn";

  /*
   * Settings a deck did not set are still listed, with their default and what else they accept.
   * A setting nothing mentions is a setting nobody knows exists — which is how the theme went
   * unnoticed until someone went looking for a control that was never going to be here.
   */
  const kinds = [...new Set(deck.slides.map((slide) => slide.kind.label))];
  section("Deck settings — change these in the frontmatter at the top of your .md file", [
    `theme: ${deck.theme}   (${THEMES.join(", ")})`,
    `baseUrl: ${deck.baseUrl ?? "not set — CTAs must be absolute URLs"}`,
    `kinds in use: ${kinds.join(", ")}   (rename or add with kind.<name>.label and .color)`,
  ]);

  section("Running order", deck.slides.map((slide) =>
    `${slide.at.label}  ·  ${slide.kind.label}  ·  ${slide.cue}`,
  ));

  const links = deck.slides
    .filter((slide) => slide.cta !== null)
    .map((slide) => `${slide.at.label}  ·  ${slide.cta?.label}  →  ${slide.cta?.href}`);
  section(
    deck.baseUrl === null ? "Links" : `Links (relative to ${deck.baseUrl})`,
    links.length > 0 ? links : ["No slide carries a link into the application."],
  );

  for (const [heading, kind] of GROUPS) {
    const found = deck.diagnostics.filter((diagnostic) => diagnostic.kind === kind);
    if (found.length > 0) {
      section(heading, found.map(describe), true);
    }
  }
}

/* Grouped by the diagnostic's own discriminant, so the report never has to read its own prose. */
const GROUPS: readonly (readonly [string, Diagnostic["kind"]])[] = [
  ["Missing images", "missing-image"],
  ["Unknown kinds", "unknown-kind"],
  ["Settings that did nothing", "bad-setting"],
  ["Links that were dropped", "bad-cta"],
  ["Settings demoIt does not recognize", "unrecognized-key"],
  ["Deck", "empty-deck"],
];

function describe(diagnostic: Diagnostic): string {
  return `${diagnostic.where}  ·  ${diagnostic.message}`;
}

function section(heading: string, lines: readonly string[], warn = false): void {
  const block = document.createElement("section");
  block.className = warn ? "block warn" : "block";

  const title = document.createElement("h2");
  title.textContent = heading;

  const list = document.createElement("ul");
  for (const line of lines) {
    const item = document.createElement("li");
    item.textContent = line;
    list.append(item);
  }

  block.append(title, list);
  report.append(block);
}

function dataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(reader.result as string));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsDataURL(file);
  });
}

/* webkitRelativePath is "deck-folder/file.md", which is the only place the folder name survives. */
function folderOf(file: File): string | null {
  return file.webkitRelativePath.split("/")[0] ?? null;
}
