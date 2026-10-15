import { describe, it } from "node:test";
import assert from "node:assert/strict";

import {
  filterPage,
  filterSearchResult,
  filterSpace,
  filterWorkspace,
} from "../src/lib/filters.js";

describe("filters", () => {
  it("keeps an empty-string content field on a page", () => {
    const result = filterPage({ id: "p1", title: "T" }, "");
    assert.equal(result.content, "");
    assert.ok("content" in result);
  });

  it("omits the content field when none was supplied", () => {
    const result = filterPage({ id: "p1", title: "T" });
    assert.ok(!("content" in result));
  });

  it("reduces subpages to id and title", () => {
    const result = filterPage({ id: "p1" }, "body", [
      { id: "c1", title: "Child", extra: "dropped" },
    ]);
    assert.deepEqual(result.subpages, [{ id: "c1", title: "Child" }]);
  });

  it("omits subpages when the list is empty", () => {
    const result = filterPage({ id: "p1" }, "body", []);
    assert.ok(!("subpages" in result));
  });

  it("drops fields that are not agent-relevant", () => {
    const result = filterSpace({
      id: "s1",
      name: "Space",
      slug: "space",
      internalNotes: "secret sauce",
    });
    assert.ok(!("internalNotes" in result));
    assert.equal(result.slug, "space");
  });

  it("flattens the nested space on a search result", () => {
    const result = filterSearchResult({
      id: "p1",
      title: "T",
      space: { id: "s1", name: "Space" },
    });
    assert.equal(result.spaceId, "s1");
    assert.equal(result.spaceName, "Space");
  });

  it("tolerates a search result without a space", () => {
    const result = filterSearchResult({ id: "p1", title: "T" });
    assert.equal(result.spaceId, undefined);
    assert.equal(result.spaceName, undefined);
  });

  it("keeps the workspace identity fields", () => {
    const result = filterWorkspace({
      id: "w1",
      name: "WS",
      defaultSpaceId: "s1",
      passwordHash: "nope",
    });
    assert.equal(result.defaultSpaceId, "s1");
    assert.ok(!("passwordHash" in result));
  });
});