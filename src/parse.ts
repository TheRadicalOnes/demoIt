/*
 * Turns a deck folder into a Deck.
 *
 * This is the only place a Deck is constructed, and it is total: every input produces a Deck.
 * Problems become diagnostics rather than exceptions, because a deck that refuses to load four
 * minutes before a client call is worse than one slide that looks wrong (ADR 0008).
 *
 * Everything that could fail is resolved here, so nothing downstream has a lookup that can miss:
 * kinds become Kind objects, CTAs become absolute URLs, images and bullet fragments are resolved
 * into the rendered HTML, and every slide knows its own position (ADR 0009). Render code has no
 * error path.
 *
 * `assets` values are opaque strings that become an <img src>. Callers should prefer short-lived
 * blob: URLs over data: URLs — the rendered HTML holds one copy of each value per usage, so
 * inlining megabytes of base64 keeps them alive for the lifetime of the Deck.
 */

import { Lexer, Marked, Renderer, type Token, type Tokens } from "marked";

/* An href that has already been resolved. Only this module can make one. */
export type AbsoluteUrl = string & { readonly __absolute: unique symbol };

const THEMES = ["light", "dark", "contrast"] as const;
export type ThemeName = (typeof THEMES)[number];

export interface Kind {
  readonly name: string;
  readonly label: string;
  readonly color: string;
}

export interface Cta {
  readonly label: string;
  readonly href: AbsoluteUrl;
}

/* Inferred from the shape of the slide, never declared. The set is closed so themes can promise
 * to cover it (ADR 0005). */
export type SlideRole = "title" | "section" | "content" | "peek";

export interface Position {
  readonly column: number;
  readonly row: number;
  /* Running order across the whole deck, which is what the HUD counts in. */
  readonly index: number;
  readonly label: string;
}

export interface Slide {
  readonly at: Position;
  readonly role: SlideRole;
  readonly html: string;
  readonly cue: string;
  readonly kind: Kind;
  readonly cta: Cta | null;
}

/*
 * Discriminated so the pre-flight report can group by construction rather than by matching English
 * against itself (ADR 0008). `message` is the human sentence; the payload is what the report needs
 * to build a section.
 */
export type Diagnostic =
  | { readonly kind: "missing-image"; readonly where: string; readonly message: string; readonly name: string }
  | { readonly kind: "unknown-kind"; readonly where: string; readonly message: string; readonly name: string }
  | { readonly kind: "unrecognized-key"; readonly where: string; readonly message: string; readonly key: string }
  | { readonly kind: "bad-setting"; readonly where: string; readonly message: string; readonly key: string; readonly value: string }
  | { readonly kind: "bad-cta"; readonly where: string; readonly message: string; readonly value: string }
  | { readonly kind: "empty-deck"; readonly where: string; readonly message: string };

export interface Deck {
  readonly title: string;
  readonly theme: ThemeName;
  /* Shown in the pre-flight report so an author can see what CTAs resolve against. */
  readonly baseUrl: AbsoluteUrl | null;
  /* Columns of slides, mirroring reveal's own nesting so rendering is a direct translation. Most
   * columns hold one slide; a column with several is a vertical stack. */
  readonly columns: readonly (readonly Slide[])[];
  /* The same Slide objects in running order, so Now/Next is an index step rather than a walk
   * across the nesting. */
  readonly slides: readonly Slide[];
  readonly diagnostics: readonly Diagnostic[];
}

const BUILT_IN_KINDS: Readonly<Record<string, Kind>> = {
  slide: { name: "slide", label: "Slide", color: "#0176d3" },
  live: { name: "live", label: "Live", color: "#f59e0b" },
};

const DEFAULT_KIND = "slide";
const UNKNOWN_KIND_COLOR = "#706e6b";

const DECK_KEYS = new Set(["title", "baseurl", "theme"]);
const SLIDE_KEYS = new Set(["kind", "cue", "cta", "peek", "reveal"]);

const SETTING_LINE = /^([A-Za-z][\w.-]*)[ \t]*:[ \t]*(.*)$/;
/* Slide metadata keys are lowercase so a slide opening with prose like "Note: ..." stays prose
 * (ADR 0003). Frontmatter has no prose to protect, so it accepts any case. */
const LOWERCASE_KEY = /^[a-z][a-z0-9-]*$/;

const COLUMN_SEPARATOR = /^[ \t]*---[ \t]*\r?$/gm;
const STACK_SEPARATOR = /^[ \t]*--[ \t]*\r?$/gm;

/* The colour lands in an inline custom property inside the shadow root, so anything that could
 * close the declaration and start another one is refused. */
const UNSAFE_COLOR = /[;{}<>]/;

export function parseDeck(
  source: string,
  assets: ReadonlyMap<string, string>,
  fallbackTitle = "Untitled deck",
): Deck {
  const diagnostics: Diagnostic[] = [];
  const { header, body } = splitFrontmatter(source);

  const settings = readSettings(header);
  const kinds = buildKinds(settings, diagnostics);
  const theme = readTheme(settings.get("theme"), diagnostics);
  const baseUrl = readBaseUrl(settings.get("baseurl"), diagnostics);

  const columns: Slide[][] = [];
  const slides: Slide[] = [];

  const blocks = body
    .split(COLUMN_SEPARATOR)
    .map((column) => column.split(STACK_SEPARATOR).filter(hasContent))
    .filter((column) => column.length > 0);

  for (const [column, sources] of blocks.entries()) {
    const built = sources.map((slide, row) =>
      parseSlide(slide, positionOf(column, row, sources.length, slides.length + row), {
        kinds,
        baseUrl,
        assets,
        diagnostics,
      }),
    );
    columns.push(built);
    slides.push(...built);
  }

  if (slides.length === 0) {
    diagnostics.push({ kind: "empty-deck", where: "deck", message: "No slides found." });
  }

  return { title: settings.get("title") ?? fallbackTitle, theme, baseUrl, columns, slides, diagnostics };
}

interface DeckContext {
  readonly kinds: ReadonlyMap<string, Kind>;
  readonly baseUrl: AbsoluteUrl | null;
  readonly assets: ReadonlyMap<string, string>;
  readonly diagnostics: Diagnostic[];
}

function parseSlide(source: string, at: Position, context: DeckContext): Slide {
  const { meta, body } = splitSlideMetadata(source, at.label, context.diagnostics);
  const peek = readPeek(meta.get("peek"), at.label, context.diagnostics);
  const bullets = readReveal(meta.get("reveal"), at.label, context.diagnostics);

  const markdown = markdownFor(at.label, bullets, context);
  const tokens = markdown.lexer(body);

  return {
    at,
    role: peek ? "peek" : roleOf(tokens),
    html: render(markdown, tokens),
    cue: meta.get("cue") ?? headingText(tokens) ?? "Untitled",
    kind: resolveKind(meta.get("kind"), context.kinds, at.label, context.diagnostics),
    cta: resolveCta(meta.get("cta"), context.baseUrl, at.label, context.diagnostics),
  };
}

/*
 * Two or more sub-headings on a slide are side-by-side columns (ADR 0015). Grouping has to happen
 * here rather than in CSS, which cannot gather a heading and the siblings that follow it — so the
 * parser wraps each group, and the renderer receives html that already describes the layout.
 *
 * One sub-heading is a sub-heading. Columns start at two, because that is when an author is
 * comparing things.
 */
function render(markdown: Marked, tokens: readonly Token[]): string {
  const heads = tokens.filter(isColumnHead);
  if (heads.length < 2) {
    return markdown.parser([...tokens]);
  }

  const lead = tokens.slice(0, tokens.indexOf(heads[0] as Token));
  const columns = heads.map((head, at) => {
    const from = tokens.indexOf(head);
    const next = heads[at + 1];
    const to = next === undefined ? tokens.length : tokens.indexOf(next);
    return `<div class="col">${markdown.parser(tokens.slice(from, to))}</div>`;
  });

  return `${markdown.parser([...lead])}<div class="cols">${columns.join("")}</div>`;
}

function isColumnHead(token: Token): token is Tokens.Heading {
  return token.type === "heading" && token.depth === 3;
}

/*
 * A slide holding nothing but a heading is a title or a section divider. Anything else is content.
 * Inferring this means an author writing plain markdown gets a deck that looks intentional without
 * learning any syntax — at the cost of being implicit, which ADR 0005 records.
 */
function roleOf(tokens: readonly Token[]): SlideRole {
  const content = tokens.filter((token) => token.type !== "space");
  const only = content.length === 1 ? content[0] : undefined;
  if (only?.type !== "heading") {
    return "content";
  }
  return only.depth === 1 ? "title" : only.depth === 2 ? "section" : "content";
}

function headingText(tokens: readonly Token[]): string | undefined {
  const heading = tokens.find((token): token is Tokens.Heading => token.type === "heading");
  return heading?.text.trim() || undefined;
}

/*
 * One markdown instance per slide, because both hooks need slide-level context: a missing image
 * has to name the slide it is on, and bullet fragments apply only where the author asked for them.
 * Resolving both here is what keeps `html` a complete description of the slide, so the renderer
 * never re-reads what the parser already produced.
 */
function markdownFor(where: string, bullets: boolean, context: DeckContext): Marked {
  return new Marked({
    renderer: {
      image(token) {
        const name = basename(token.href);
        const asset = context.assets.get(name);
        if (asset === undefined) {
          context.diagnostics.push({
            kind: "missing-image",
            where,
            name,
            message: `Missing image: ${name}`,
          });
          return `<div class="shot-missing">waiting for <code>${escapeHtml(name)}</code></div>`;
        }
        // Only the source changes; marked builds the tag, alt text and escaping.
        token.href = asset;
        return false;
      },
      listitem(token) {
        const html = Renderer.prototype.listitem.call(this, token);
        return bullets ? html.replace("<li", '<li class="fragment"') : html;
      },
    },
  });
}

function resolveKind(
  name = DEFAULT_KIND,
  kinds: ReadonlyMap<string, Kind>,
  where: string,
  diagnostics: Diagnostic[],
): Kind {
  const kind = kinds.get(name);
  if (kind !== undefined) {
    return kind;
  }
  diagnostics.push({
    kind: "unknown-kind",
    where,
    name,
    message: `Unknown kind "${name}". Showing it as-is.`,
  });
  return { name, label: name, color: UNKNOWN_KIND_COLOR };
}

/*
 * Resolved here so the render path holds an href it cannot fail to use. A CTA with nowhere to point
 * is dropped rather than navigating the presenter somewhere surprising mid-demo.
 */
function resolveCta(
  raw: string | undefined,
  baseUrl: AbsoluteUrl | null,
  where: string,
  diagnostics: Diagnostic[],
): Cta | null {
  if (raw === undefined) {
    return null;
  }

  const bad = (message: string): null => {
    diagnostics.push({ kind: "bad-cta", where, value: raw, message });
    return null;
  };

  // marked's own inline lexer, so a CTA accepts every link the rest of the deck accepts.
  const tokens = Lexer.lexInline(raw.trim());
  const link = tokens.length === 1 && tokens[0]?.type === "link" ? tokens[0] : undefined;
  if (link === undefined) {
    return bad(`CTA is not a markdown link: ${raw}`);
  }

  const href = absolute(link.href, baseUrl);
  if (href === null) {
    return bad(
      baseUrl === null
        ? `CTA "${link.href}" is relative and the deck has no baseUrl.`
        : `CTA "${link.href}" could not be resolved against baseUrl ${baseUrl}.`,
    );
  }
  return { label: link.text.trim(), href };
}

function absolute(href: string, baseUrl: AbsoluteUrl | null): AbsoluteUrl | null {
  if (URL.canParse(href)) {
    return new URL(href).href as AbsoluteUrl;
  }
  if (baseUrl !== null && URL.canParse(href, baseUrl)) {
    return new URL(href, baseUrl).href as AbsoluteUrl;
  }
  return null;
}

/*
 * Resolved once, so a broken baseUrl is reported as itself rather than as a misleading "this CTA is
 * relative" on every slide that uses one.
 */
function readBaseUrl(raw: string | undefined, diagnostics: Diagnostic[]): AbsoluteUrl | null {
  if (raw === undefined || raw === "") {
    return null;
  }
  if (URL.canParse(raw)) {
    return new URL(raw).href as AbsoluteUrl;
  }
  diagnostics.push({
    kind: "bad-setting",
    where: "frontmatter",
    key: "baseUrl",
    value: raw,
    message: `baseUrl "${raw}" is not an absolute URL. Relative CTAs will be dropped.`,
  });
  return null;
}

/* Frontmatter kinds extend or override the built-ins. The merge is per kind: setting only a label
 * must not silently drop the default colour. */
function buildKinds(
  settings: ReadonlyMap<string, string>,
  diagnostics: Diagnostic[],
): ReadonlyMap<string, Kind> {
  const kinds = new Map<string, Kind>(Object.entries(BUILT_IN_KINDS));

  for (const [key, value] of settings) {
    if (DECK_KEYS.has(key)) {
      continue;
    }

    const parts = key.split(".");
    const [prefix, name, field] = parts;
    if (parts.length !== 3 || prefix !== "kind" || name === undefined || field === undefined) {
      diagnostics.push({
        kind: "unrecognized-key",
        where: "frontmatter",
        key,
        message: `Unrecognized setting: ${key}`,
      });
      continue;
    }

    const current = kinds.get(name) ?? { name, label: name, color: UNKNOWN_KIND_COLOR };
    if (field === "label") {
      kinds.set(name, { ...current, label: value });
    } else if (field === "color") {
      kinds.set(name, { ...current, color: readColor(value, key, diagnostics) ?? current.color });
    } else {
      diagnostics.push({
        kind: "unrecognized-key",
        where: "frontmatter",
        key,
        message: `Unrecognized kind setting: ${key}`,
      });
    }
  }

  return kinds;
}

function readColor(value: string, key: string, diagnostics: Diagnostic[]): string | null {
  if (!UNSAFE_COLOR.test(value)) {
    return value;
  }
  diagnostics.push({
    kind: "bad-setting",
    where: "frontmatter",
    key,
    value,
    message: `"${value}" is not a colour. Keeping the default.`,
  });
  return null;
}

function readTheme(value: string | undefined, diagnostics: Diagnostic[]): ThemeName {
  if (value === undefined) {
    return "light";
  }
  const theme = THEMES.find((name) => name === value);
  if (theme !== undefined) {
    return theme;
  }
  diagnostics.push({
    kind: "bad-setting",
    where: "frontmatter",
    key: "theme",
    value,
    message: `Unknown theme "${value}". Using light. Available: ${THEMES.join(", ")}.`,
  });
  return "light";
}

function readPeek(value: string | undefined, where: string, diagnostics: Diagnostic[]): boolean {
  if (value === undefined || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  diagnostics.push({
    kind: "bad-setting",
    where,
    key: "peek",
    value,
    message: `peek expects true or false, got "${value}".`,
  });
  return false;
}

function readReveal(value: string | undefined, where: string, diagnostics: Diagnostic[]): boolean {
  if (value === undefined) {
    return false;
  }
  if (value === "bullets") {
    return true;
  }
  diagnostics.push({
    kind: "bad-setting",
    where,
    key: "reveal",
    value,
    message: `reveal expects "bullets", got "${value}".`,
  });
  return false;
}

/*
 * `---` opens frontmatter and also separates slides, so a deck may legitimately begin with a
 * separator before its first slide. The block is only frontmatter if it reads like settings: the
 * line straight after the opening marker must be a `key: value` pair, and so must every other
 * non-blank line in the block. Otherwise the marker is a slide separator and the deck has no
 * frontmatter.
 */
function splitFrontmatter(source: string): { header: readonly string[]; body: string } {
  const lines = source.split("\n");
  if (lines[0]?.trim() !== "---") {
    return { header: [], body: source };
  }

  const end = lines.findIndex((line, index) => index > 0 && line.trim() === "---");
  if (end === -1) {
    return { header: [], body: source };
  }

  const header = lines.slice(1, end);
  const settingish = (line: string): boolean => {
    const text = line.trim();
    return text === "" || text.startsWith("#") || settingOf(text) !== null;
  };

  if (!header.every(settingish) || (header.length > 0 && settingOf(header[0].trim()) === null)) {
    return { header: [], body: source };
  }
  return { header, body: lines.slice(end + 1).join("\n") };
}

/* The leading key/value lines of a slide, up to the first line that is not one (ADR 0003). */
function splitSlideMetadata(
  source: string,
  where: string,
  diagnostics: Diagnostic[],
): { meta: ReadonlyMap<string, string>; body: string } {
  const lines = source.split("\n");
  let at = 0;
  while (lines[at]?.trim() === "") {
    at += 1;
  }

  const header: string[] = [];
  while (at < lines.length) {
    const setting = settingOf(lines[at].trim());
    if (setting === null || !LOWERCASE_KEY.test(setting.key)) {
      break;
    }
    header.push(lines[at]);
    at += 1;
  }

  const meta = readSettings(header);
  for (const key of meta.keys()) {
    if (!SLIDE_KEYS.has(key)) {
      diagnostics.push({
        kind: "unrecognized-key",
        where,
        key,
        message: `Unrecognized slide setting: ${key}`,
      });
    }
  }

  const body = lines.slice(at);
  reportMisplacedSettings(body, meta, where, diagnostics);
  return { meta, body: body.join("\n") };
}

/*
 * A setting written below the heading instead of above it is not metadata — it is a line of prose
 * that will appear on the slide, in front of the audience, saying "reveal: bullets". Silently
 * correct, silently wrong, and invisible until you are standing on that slide, so it is called out.
 */
function reportMisplacedSettings(
  body: readonly string[],
  meta: ReadonlyMap<string, string>,
  where: string,
  diagnostics: Diagnostic[],
): void {
  for (const line of body) {
    const setting = settingOf(line.trim());
    const key = setting?.key.toLowerCase();
    if (key !== undefined && SLIDE_KEYS.has(key) && !meta.has(key)) {
      diagnostics.push({
        kind: "bad-setting",
        where,
        key,
        value: setting?.value ?? "",
        message: `"${key}" comes after the slide's content, so it is being shown as text. Settings go at the top of the slide.`,
      });
    }
  }
}

/*
 * Flat `key: value` lines, keyed lowercase. Deliberately not YAML — restricting the shape is what
 * lets deck config stay dependency-free (ADR 0002). Callers decide which keys they recognise, since
 * frontmatter also carries the dotted `kind.*` settings.
 */
function readSettings(lines: readonly string[]): ReadonlyMap<string, string> {
  const settings = new Map<string, string>();

  for (const line of lines) {
    const text = line.trim();
    if (text === "" || text.startsWith("#")) {
      continue;
    }
    const setting = settingOf(text);
    if (setting !== null) {
      settings.set(setting.key.toLowerCase(), unquote(setting.value));
    }
  }

  return settings;
}

function settingOf(text: string): { key: string; value: string } | null {
  const match = SETTING_LINE.exec(text);
  return match === null ? null : { key: match[1], value: match[2] };
}

function unquote(value: string): string {
  const quote = value[0];
  const quoted = value.length >= 2 && (quote === '"' || quote === "'");
  return quoted && value.endsWith(quote) ? value.slice(1, -1) : value;
}

function hasContent(block: string): boolean {
  return block.trim() !== "";
}

function positionOf(column: number, row: number, height: number, index: number): Position {
  return {
    column,
    row,
    index,
    label: height === 1 ? `slide ${column + 1}` : `slide ${column + 1}.${row + 1}`,
  };
}

function basename(path: string): string {
  return path.split("/").pop() ?? path;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
