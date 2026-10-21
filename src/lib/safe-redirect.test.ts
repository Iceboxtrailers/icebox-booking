import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { safeRedirectPath } from "@/lib/safe-redirect";

const FALLBACK = "/dashboard";

describe("where to go after signing in", () => {
  it("keeps a page of this site, with its query and anchor", () => {
    assert.equal(safeRedirectPath("/dashboard", FALLBACK), "/dashboard");
    assert.equal(safeRedirectPath("/", FALLBACK), "/");
    assert.equal(safeRedirectPath("/reservation/abc/contrat?a=1#fin", FALLBACK), "/reservation/abc/contrat?a=1#fin");
  });

  it("uses the fallback when there is nothing to follow", () => {
    assert.equal(safeRedirectPath(null, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath(undefined, FALLBACK), FALLBACK);
    assert.equal(safeRedirectPath("", FALLBACK), FALLBACK);
  });

  it("never sends the person to another site", () => {
    const attacks = [
      "https://evil.example",
      "http://evil.example/login",
      "//evil.example",
      "///evil.example",
      "/\\evil.example",
      "/\\/evil.example",
      "/\t/evil.example",
      "/\n/evil.example",
      "javascript:alert(1)",
      "data:text/html,<script>alert(1)</script>",
      "evil.example",
    ];
    for (const attack of attacks) assert.equal(safeRedirectPath(attack, FALLBACK), FALLBACK, JSON.stringify(attack));
  });

  it("stays on the site when odd characters are only inside the path", () => {
    assert.equal(safeRedirectPath("/ok\n//evil", FALLBACK), "/ok//evil");
  });
});
