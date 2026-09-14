import assert from "node:assert/strict";
import test from "node:test";

import { canonicalizeJson } from "../../dist/Infrastructure/CanonicalJson/canonical-json.js";

test("canonical JSON recursively sorts object keys and preserves array order", () => {
  assert.equal(
    canonicalizeJson({ z: 1, a: { y: true, x: null }, list: [3, "two"] }),
    '{"a":{"x":null,"y":true},"list":[3,"two"],"z":1}',
  );
});

test("canonical JSON uses ECMAScript number serialization", () => {
  assert.equal(
    canonicalizeJson([333333333.33333329, 1e30, 4.5, 2e-3, 1e-27, -0]),
    "[333333333.3333333,1e+30,4.5,0.002,1e-27,0]",
  );
});

test("canonical JSON preserves exact JSON string escaping", () => {
  assert.equal(
    canonicalizeJson({ text: "€$\u000f\nA'B\"\\" }),
    "{\"text\":\"€$\\u000f\\nA'B\\\"\\\\\"}",
  );
});

test("canonical JSON rejects unsupported or non-finite values", () => {
  for (const value of [undefined, Number.NaN, Number.POSITIVE_INFINITY, 1n]) {
    assert.throws(() => canonicalizeJson(value), /canonical JSON value/);
  }
  assert.throws(
    () => canonicalizeJson({ missing: undefined }),
    /canonical JSON value/,
  );
});
