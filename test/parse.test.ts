/*
 * The parser is the only non-trivial logic in demoIt and the only thing that can silently mangle
 * someone's deck, so it is the one thing under test. Its contract is totality: every input produces
 * a Deck, and problems arrive as diagnostics rather than exceptions (ADR 0008).
 *
 * Diagnostics are asserted by their discriminant, not by their wording — the pre-flight report
 * groups on the discriminant, so that is the part other code depends on.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { parseDeck, type Deck, type Diagnostic, type Slide } from "../src/parse.ts";

const NO_ASSETS = new Map<string, string>();

function parse(source: string, assets: ReadonlyMap<string, string> = NO_ASSETS): Deck {
  return parseDeck(source, assets);
}

function first(deck: Deck): Slide {
  const slide = deck.slides[0];
  assert.ok(slide !== undefined, "expected at least one slide");
  return slide;
}

function only(source: string, assets?: ReadonlyMap<string, string>): Slide {
  const deck = parse(source, assets);
  assert.equal(deck.slides.length, 1, "expected exactly one slide");
  return first(deck);
}

function kindsOf(deck: Deck): Diagnostic["kind"][] {
  return deck.diagnostics.map((diagnostic) => diagnostic.kind);
}

test("a deck with no frontmatter is valid", () => {
  const deck = parse("# Hello");
  assert.equal(deck.title, "Untitled deck");
  assert.equal(deck.theme, "light");
  assert.equal(deck.baseUrl, null);
  assert.deepEqual(deck.diagnostics, []);
  assert.equal(deck.slides.length, 1);
});

test("--- separates slides, -- stacks them vertically", () => {
  const deck = parse("# One\n\n---\n\n# Two\n\n--\n\n# Two point one\n\n---\n\n# Three");
  assert.deepEqual(
    deck.columns.map((column) => column.map((slide) => slide.cue)),
    [["One"], ["Two", "Two point one"], ["Three"]],
  );
});

/* columns is for building reveal's DOM; slides is the running order the HUD counts in. Both hold
 * the same objects, so the renderer never has to map between them. */
test("slides is the flat running order and holds the same objects as columns", () => {
  const deck = parse("# One\n\n---\n\n# Two\n\n--\n\n# Two point one");
  assert.deepEqual(
    deck.slides.map((slide) => slide.cue),
    ["One", "Two", "Two point one"],
  );
  assert.equal(deck.slides[1], deck.columns[1]?.[0]);
  assert.deepEqual(
    deck.slides.map((slide) => slide.at.index),
    [0, 1, 2],
  );
});

test("a slide knows its column, row and label", () => {
  const deck = parse("# One\n\n---\n\n# Two\n\n--\n\n# Two point one");
  assert.deepEqual(deck.slides[0]?.at, { column: 0, row: 0, index: 0, label: "slide 1" });
  assert.deepEqual(deck.slides[2]?.at, { column: 1, row: 1, index: 2, label: "slide 2.2" });
});

/* A diagnostic has to name the slide an author should open, not just the problem. */
test("a slide-level diagnostic carries the slide's label", () => {
  const deck = parse("# One\n\n---\n\nkind: whoops\n\n# Two");
  assert.equal(deck.diagnostics[0]?.where, "slide 2");
});

test("blank blocks between separators are dropped", () => {
  const deck = parse("---\n\n# One\n\n---\n\n---\n\n# Two\n");
  assert.deepEqual(
    deck.slides.map((slide) => slide.cue),
    ["One", "Two"],
  );
});

test("an empty deck reports a diagnostic instead of throwing", () => {
  const deck = parse("");
  assert.deepEqual(deck.columns, []);
  assert.deepEqual(kindsOf(deck), ["empty-deck"]);
});

/* Roles are inferred from structure, never declared (ADR 0005). */
test("a lone h1 is a title slide, a lone h2 is a section divider", () => {
  assert.equal(only("# Acme Billing").role, "title");
  assert.equal(only("## What we'll cover").role, "section");
});

test("a heading with a body is a content slide", () => {
  assert.equal(only("## Setup\n\nSome prose.").role, "content");
});

test("peek wins over inferred role", () => {
  assert.equal(only("peek: true\n\n# Look here").role, "peek");
});

test("frontmatter sets title, theme and baseUrl", () => {
  const deck = parse("---\ntitle: Acme\ntheme: dark\nbaseUrl: https://acme.test\n---\n\n# Hi");
  assert.equal(deck.title, "Acme");
  assert.equal(deck.theme, "dark");
  assert.equal(deck.baseUrl, "https://acme.test/");
  assert.deepEqual(deck.diagnostics, []);
});

test("an unknown theme falls back to light and says so", () => {
  const deck = parse("---\ntheme: neon\n---\n\n# Hi");
  assert.equal(deck.theme, "light");
  assert.deepEqual(kindsOf(deck), ["bad-setting"]);
});

test("quoted frontmatter values are unquoted", () => {
  assert.equal(parse('---\ntitle: "Acme Billing"\n---\n\n# Hi').title, "Acme Billing");
});

test("built-in kinds exist without configuration", () => {
  assert.equal(only("# Hi").kind.label, "Slide");
  assert.equal(only("kind: live\n\n# Hi").kind.label, "Live");
});

/* The bug this guards: a top-level merge would drop the default colour. */
test("overriding only a kind's label keeps its default colour", () => {
  const deck = parse("---\nkind.live.label: In the app\n---\n\nkind: live\n\n# Hi");
  assert.equal(first(deck).kind.label, "In the app");
  assert.equal(first(deck).kind.color, "#f59e0b");
  assert.deepEqual(deck.diagnostics, []);
});

test("a deck can define its own kinds", () => {
  const deck = parse(
    '---\nkind.video.label: Video\nkind.video.color: "#8b5cf6"\n---\n\nkind: video\n\n# Hi',
  );
  assert.deepEqual(first(deck).kind, { name: "video", label: "Video", color: "#8b5cf6" });
});

test("an undefined kind renders as-is and reports", () => {
  const deck = parse("kind: whoops\n\n# Hi");
  assert.equal(first(deck).kind.label, "whoops");
  assert.deepEqual(kindsOf(deck), ["unknown-kind"]);
});

/* The colour is written into an inline custom property inside the shadow root. */
test("a colour that could break out of its declaration is refused", () => {
  const deck = parse("---\nkind.live.color: red; --deck-bg: black\n---\n\nkind: live\n\n# Hi");
  assert.equal(first(deck).kind.color, "#f59e0b");
  assert.deepEqual(kindsOf(deck), ["bad-setting"]);
});

test("an absolute CTA passes through", () => {
  assert.deepEqual(only("cta: [Settings](https://acme.test/setup)\n\n# Hi").cta, {
    label: "Settings",
    href: "https://acme.test/setup",
  });
});

test("a relative CTA resolves against baseUrl", () => {
  const deck = parse(
    "---\nbaseUrl: https://acme.test\n---\n\ncta: [Settings](/lightning/n/Billing)\n\n# Hi",
  );
  assert.equal(first(deck).cta?.href, "https://acme.test/lightning/n/Billing");
});

/* Using marked's own inline lexer means a CTA accepts every link the rest of the deck accepts. */
test("a CTA accepts link titles and brackets, as markdown does", () => {
  const cta = only('cta: [Read the docs](https://acme.test/docs "Docs")\n\n# Hi').cta;
  assert.deepEqual(cta, { label: "Read the docs", href: "https://acme.test/docs" });
});

/* Better to drop the link than to navigate the presenter somewhere surprising mid-demo. */
test("a relative CTA without a baseUrl is dropped and reported", () => {
  const deck = parse("cta: [Settings](/setup)\n\n# Hi");
  assert.equal(first(deck).cta, null);
  assert.deepEqual(kindsOf(deck), ["bad-cta"]);
});

test("a CTA that is not a markdown link is dropped and reported", () => {
  const deck = parse("cta: Settings -> /setup\n\n# Hi");
  assert.equal(first(deck).cta, null);
  assert.deepEqual(kindsOf(deck), ["bad-cta"]);
});

/*
 * A broken baseUrl must be reported as itself. Reporting it once per CTA, as "this CTA is
 * relative", would send the author looking at the wrong line on every slide.
 */
test("an unparseable baseUrl is reported once, not once per CTA", () => {
  const deck = parse(
    "---\nbaseUrl: acme.test\n---\n\ncta: [A](/a)\n\n# One\n\n---\n\ncta: [B](/b)\n\n# Two",
  );
  assert.equal(deck.baseUrl, null);
  assert.deepEqual(kindsOf(deck), ["bad-setting", "bad-cta", "bad-cta"]);
  assert.match(deck.diagnostics[0]?.message ?? "", /not an absolute URL/);
});

test("a present image becomes an img with the asset as its source", () => {
  const assets = new Map([["gain.png", "blob:demoit/1"]]);
  const slide = only("## Result\n\n![the gain](assets/gain.png)", assets);
  assert.match(slide.html, /<img src="blob:demoit\/1" alt="the gain">/);
});

test("a missing image becomes a placeholder naming the file", () => {
  const deck = parse("## Result\n\n![](gain.png)");
  assert.match(first(deck).html, /shot-missing/);
  assert.match(first(deck).html, /gain\.png/);
  assert.deepEqual(kindsOf(deck), ["missing-image"]);
  assert.equal(deck.diagnostics[0]?.where, "slide 1");
});

test("cue defaults to the heading and can be overridden", () => {
  assert.equal(only("## Automated setup\n\nprose").cue, "Automated setup");
  assert.equal(only("cue: Point at totals\n\n## Automated setup").cue, "Point at totals");
});

test("a slide with no heading and no cue is Untitled", () => {
  assert.equal(only("Just some prose.").cue, "Untitled");
});

/* Resolved into the html, so the renderer never re-reads what the parser produced. */
test("reveal: bullets marks list items as fragments", () => {
  const slide = only("reveal: bullets\n\n- one\n- two");
  assert.equal(slide.html.match(/<li class="fragment"/g)?.length, 2);
});

test("bullets are ordinary list items without reveal: bullets", () => {
  assert.doesNotMatch(only("- one\n- two").html, /fragment/);
});

test("anything other than bullets is reported", () => {
  const deck = parse("reveal: sideways\n\n- a");
  assert.doesNotMatch(first(deck).html, /fragment/);
  assert.deepEqual(kindsOf(deck), ["bad-setting"]);
});

/*
 * The ambiguity ADR 0003 names: metadata keys are lowercase so ordinary prose opening with a
 * capitalised word and a colon is content, not settings.
 */
test("prose beginning with a capitalised word and a colon is not metadata", () => {
  const slide = only("Note: the totals column is what matters.");
  assert.match(slide.html, /Note: the totals column/);
  assert.equal(slide.cue, "Untitled");
});

test("metadata stops at the first line that is not a key/value pair", () => {
  const slide = only("kind: live\n\n## Setup\n\ncue: this is prose, not a setting");
  assert.equal(slide.kind.name, "live");
  assert.equal(slide.cue, "Setup");
  assert.match(slide.html, /cue: this is prose/);
});

/* A typo must not silently become a paragraph — the pre-flight report is where it gets caught. */
test("an unrecognized slide setting is reported with its key", () => {
  const deck = parse("kynd: live\n\n# Hi");
  assert.deepEqual(kindsOf(deck), ["unrecognized-key"]);
  assert.equal(deck.diagnostics[0]?.kind === "unrecognized-key" && deck.diagnostics[0].key, "kynd");
});

test("an unrecognized deck setting is reported with its key", () => {
  const deck = parse("---\nthene: dark\n---\n\n# Hi");
  assert.deepEqual(kindsOf(deck), ["unrecognized-key"]);
  assert.equal(deck.diagnostics[0]?.kind === "unrecognized-key" && deck.diagnostics[0].key, "thene");
});

/* A deck written against a later version of demoIt must still present. */
test("unrecognized settings never prevent a deck from parsing", () => {
  const deck = parse("---\nfuture: yes\n---\n\nalsofuture: yes\n\n# Hi\n\n---\n\n# There");
  assert.equal(deck.slides.length, 2);
  assert.deepEqual(kindsOf(deck), ["unrecognized-key", "unrecognized-key"]);
});

/* Totality is the parser's contract, not a description of it. */
test("malformed input still produces a deck", () => {
  for (const source of [
    "---\nno frontmatter terminator\n\n# Hi",
    "---\n---\n",
    ":\n\n# Hi",
    "kind:\n\n# Hi",
    "cta: [](\n\n# Hi",
    "cta: []()\n\n# Hi",
    "\n\n\n",
    "---",
    "--",
  ]) {
    const deck = parse(source);
    assert.ok(Array.isArray(deck.slides), `slides missing for: ${JSON.stringify(source)}`);
    assert.equal(deck.slides.length, deck.columns.flat().length);
    assert.equal(typeof deck.title, "string");
  }
});
