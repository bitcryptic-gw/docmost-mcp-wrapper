import { describe, it } from "node:test";
import assert from "node:assert/strict";

import { convertProseMirrorToMarkdown } from "../src/lib/markdown-converter.js";

/** Build a ProseMirror doc around a list of block nodes. */
const doc = (...content: unknown[]) => ({ type: "doc", content });
const text = (t: string, marks?: unknown[]) => ({
  type: "text",
  text: t,
  ...(marks ? { marks } : {}),
});
const paragraph = (...content: unknown[]) => ({ type: "paragraph", content });

describe("convertProseMirrorToMarkdown", () => {
  it("returns an empty string for missing or empty content", () => {
    assert.equal(convertProseMirrorToMarkdown(null), "");
    assert.equal(convertProseMirrorToMarkdown(undefined), "");
    assert.equal(convertProseMirrorToMarkdown({}), "");
    assert.equal(convertProseMirrorToMarkdown({ type: "doc" }), "");
  });

  it("renders headings by level", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({ type: "heading", attrs: { level: 3 }, content: [text("Hi")] }),
      ),
      "### Hi",
    );
    // level defaults to 1 when the attribute is absent
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({ type: "heading", content: [text("Hi")] }),
      ),
      "# Hi",
    );
  });

  it("applies inline marks", () => {
    const content = doc(
      paragraph(
        text("b", [{ type: "bold" }]),
        text("i", [{ type: "italic" }]),
        text("s", [{ type: "strike" }]),
        text("c", [{ type: "code" }]),
        text("l", [{ type: "link", attrs: { href: "https://x.test" } }]),
      ),
    );
    assert.equal(
      convertProseMirrorToMarkdown(content),
      "**b***i*~~s~~`c`[l](https://x.test)",
    );
  });

  it("renders fenced code blocks with their language", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({
          type: "codeBlock",
          attrs: { language: "ts" },
          content: [text("const x = 1;")],
        }),
      ),
      "```ts\nconst x = 1;\n```",
    );
  });

  it("numbers ordered lists and dashes bullet lists", () => {
    const items = [
      { type: "listItem", content: [paragraph(text("one"))] },
      { type: "listItem", content: [paragraph(text("two"))] },
    ];
    assert.equal(
      convertProseMirrorToMarkdown(doc({ type: "bulletList", content: items })),
      "- one\n- two",
    );
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({ type: "orderedList", content: items }),
      ),
      "1. one\n2. two",
    );
  });

  it("renders task lists with checkboxes", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({
          type: "taskList",
          content: [
            { type: "taskItem", attrs: { checked: true }, content: [text("done")] },
            { type: "taskItem", attrs: { checked: false }, content: [text("todo")] },
          ],
        }),
      ),
      "- [x] done\n- [ ] todo",
    );
  });

  it("prefixes every line of a blockquote, not just the first", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({
          type: "blockquote",
          content: [paragraph(text("first")), paragraph(text("second"))],
        }),
      ),
      "> first\n> second",
    );
  });

  it("emits a delimiter row so tables are valid markdown", () => {
    const content = doc({
      type: "table",
      content: [
        {
          type: "tableRow",
          content: [
            { type: "tableHeader", content: [text("H1")] },
            { type: "tableHeader", content: [text("H2")] },
          ],
        },
        {
          type: "tableRow",
          content: [
            { type: "tableCell", content: [text("a")] },
            { type: "tableCell", content: [text("b")] },
          ],
        },
      ],
    });
    assert.equal(
      convertProseMirrorToMarkdown(content),
      "| H1 | H2 |\n| --- | --- |\n| a | b |",
    );
  });

  it("emits a delimiter row for a single-row table", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({
          type: "table",
          content: [
            {
              type: "tableRow",
              content: [
                { type: "tableHeader", content: [text("only")] },
                { type: "tableHeader", content: [text("cols")] },
              ],
            },
          ],
        }),
      ),
      "| only | cols |\n| --- | --- |",
    );
  });

  it("keeps the {{SUBPAGES}} placeholder for the caller to resolve", () => {
    assert.equal(
      convertProseMirrorToMarkdown(doc({ type: "subpages" })),
      "{{SUBPAGES}}",
    );
  });

  it("renders callouts as fenced admonitions", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({
          type: "callout",
          attrs: { type: "WARNING" },
          content: [paragraph(text("careful"))],
        }),
      ),
      ":::warning\ncareful\n:::",
    );
  });

  it("renders math blocks and inline math", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({ type: "mathBlock", attrs: { text: "x^2" } }),
      ),
      "$$\nx^2\n$$",
    );
    assert.equal(
      convertProseMirrorToMarkdown(
        doc(paragraph({ type: "mathInline", attrs: { text: "y" } })),
      ),
      "$y$",
    );
  });

  it("falls back to children for unknown node types", () => {
    assert.equal(
      convertProseMirrorToMarkdown(
        doc({ type: "someFutureBlock", content: [paragraph(text("kept"))] }),
      ),
      "kept",
    );
  });
});