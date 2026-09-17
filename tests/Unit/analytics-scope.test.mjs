import assert from "node:assert/strict";
import test from "node:test";

import {
  analyticsLifecycleOperations,
  analyticsProviders,
  analyticsPublicationWriterCount,
  analyticsRuntime,
  analyticsTransformationCatalog,
} from "../../dist/Application/analytics-evidence-service.js";

test("WP-5 prototype entry guards preserve the approved narrow analytics surface", () => {
  assert.deepEqual(analyticsProviders, ["fixture"]);
  assert.deepEqual(analyticsTransformationCatalog, []);
  assert.deepEqual(analyticsLifecycleOperations, []);
  assert.equal(analyticsRuntime, "node-20");
  assert.equal(analyticsPublicationWriterCount, 1);

  for (const value of [
    analyticsProviders,
    analyticsTransformationCatalog,
    analyticsLifecycleOperations,
  ]) {
    assert.ok(Object.isFrozen(value));
  }
});
