import assert from "node:assert/strict";
import test from "node:test";

import {
  AnalyticsEvidenceAccessError,
  analyticsEvidenceOperations,
  createAnalyticsEvidenceService,
} from "../../dist/Application/analytics-evidence-service.js";

function fakePort({ failAudit = false } = {}) {
  const calls = { audit: [], commit: [], read: [], verify: [] };
  return {
    calls,
    port: {
      async commit(payload) {
        calls.commit.push(payload);
        return Object.freeze({ evidenceId: payload.evidenceId, publicationVersion: 1 });
      },
      async read(evidenceId) {
        calls.read.push(evidenceId);
        return Object.freeze({ evidenceId });
      },
      async recordDeniedAccess(record) {
        calls.audit.push(record);
        if (failAudit) throw new Error("sensitive database failure");
      },
      async verify(evidenceId) {
        calls.verify.push(evidenceId);
        return Object.freeze({ evidenceId, verified: true });
      },
    },
  };
}

function fakeAuthorization(authorized) {
  const calls = [];
  return {
    calls,
    port: {
      async authorize(request) {
        calls.push(request);
        return authorized;
      },
    },
  };
}

function fakeIdentity(actorId = "local-operator") {
  return { async actorId() { return actorId; } };
}

test("PT-ANA-SCOPE-OPERATIONS exposes the complete prototype evidence operation inventory", () => {
  assert.deepEqual(analyticsEvidenceOperations, ["commit", "read", "verify"]);
  assert.ok(Object.isFrozen(analyticsEvidenceOperations));
});

test("PT-ANA-013-DENY-FIRST audits every denial without protected access or value disclosure", async () => {
  const fixture = fakePort();
  const authorization = fakeAuthorization(false);
  const service = createAnalyticsEvidenceService(fixture.port, authorization.port, fakeIdentity());

  for (const operation of analyticsEvidenceOperations) {
    await assert.rejects(
      () => operation === "commit"
        ? service.commit("missing-evidence", JSON.stringify({
            evidenceId: "missing-evidence",
            prohibitedValue: "must-not-reach-port",
          }))
        : service[operation]("missing-evidence"),
      (error) => {
        assert.ok(error instanceof AnalyticsEvidenceAccessError);
        assert.deepEqual(error.codes, ["ANALYTICS_EVIDENCE_ACCESS_DENIED"]);
        assert.equal(error.message, "Analytics evidence access denied");
        assert.doesNotMatch(JSON.stringify(error), /prohibitedValue|must-not-reach-port|database/u);
        return true;
      },
    );
  }

  assert.deepEqual(fixture.calls.commit, []);
  assert.deepEqual(fixture.calls.read, []);
  assert.deepEqual(fixture.calls.verify, []);
  assert.deepEqual(fixture.calls.audit, analyticsEvidenceOperations.map((operation) => ({
    errorCode: "ANALYTICS_EVIDENCE_ACCESS_DENIED",
    evidenceId: "missing-evidence",
    operation,
    outcome: "PermissionDenied",
  })));
  assert.deepEqual(authorization.calls, analyticsEvidenceOperations.map((operation) => ({
    actorId: "local-operator",
    evidenceId: "missing-evidence",
    operation,
  })));
});

test("PT-ANA-019-DENIAL-AUDIT keeps access denied and degrades readiness when audit fails", async () => {
  const fixture = fakePort({ failAudit: true });
  const service = createAnalyticsEvidenceService(fixture.port, fakeAuthorization(false).port, fakeIdentity());

  await assert.rejects(
    () => service.read("evidence-1"),
    (error) => {
      assert.ok(error instanceof AnalyticsEvidenceAccessError);
      assert.deepEqual(error.codes, [
        "ANALYTICS_EVIDENCE_ACCESS_DENIED",
        "ANALYTICS_ACCESS_DENIAL_AUDIT_FAILED",
      ]);
      assert.equal(error.readinessDegraded, true);
      assert.doesNotMatch(error.message, /sensitive|database/u);
      return true;
    },
  );
  assert.deepEqual(fixture.calls.read, []);
});

test("authorized operations delegate without retaining publication state in Application", async () => {
  const fixture = fakePort();
  const service = createAnalyticsEvidenceService(fixture.port, fakeAuthorization(true).port, fakeIdentity());
  const payload = Object.freeze({ evidenceId: "evidence-1" });

  assert.deepEqual(await service.commit("evidence-1", JSON.stringify(payload)), {
    evidenceId: "evidence-1",
    publicationVersion: 1,
  });
  assert.deepEqual(await service.read("evidence-1"), {
    evidenceId: "evidence-1",
  });
  assert.deepEqual(await service.verify("evidence-1"), {
    evidenceId: "evidence-1",
    verified: true,
  });
  assert.ok(Object.isFrozen(service));
  assert.deepEqual(Object.keys(service).sort(), ["commit", "read", "verify"]);
});

test("authorized commit denies a payload for a different evidence identity", async () => {
  const fixture = fakePort();
  const service = createAnalyticsEvidenceService(fixture.port, fakeAuthorization(true).port, fakeIdentity());

  await assert.rejects(
    () => service.commit("evidence-1", JSON.stringify({ evidenceId: "evidence-2" })),
    (error) => error instanceof AnalyticsEvidenceAccessError &&
      error.codes.includes("ANALYTICS_EVIDENCE_ACCESS_DENIED"),
  );
  assert.deepEqual(fixture.calls.commit, []);
  assert.deepEqual(fixture.calls.audit, [{
    errorCode: "ANALYTICS_EVIDENCE_ACCESS_DENIED",
    evidenceId: "evidence-1",
    operation: "commit",
    outcome: "PermissionDenied",
  }]);
});

test("denial audit redacts unbounded or unsafe evidence identifiers", async () => {
  const fixture = fakePort();
  const service = createAnalyticsEvidenceService(fixture.port, fakeAuthorization(false).port, fakeIdentity());
  await assert.rejects(
    () => service.read("secret\n".repeat(100)),
    AnalyticsEvidenceAccessError,
  );
  assert.equal(fixture.calls.audit[0].evidenceId, "[REDACTED]");
});

test("primitive request values cannot change during authorization", async () => {
  const fixture = fakePort();
  let releaseAuthorization;
  let markAuthorizationStarted;
  const authorizationStarted = new Promise((resolve) => { markAuthorizationStarted = resolve; });
  const authorization = {
    authorize() {
      markAuthorizationStarted();
      return new Promise((resolve) => { releaseAuthorization = resolve; });
    },
  };
  const service = createAnalyticsEvidenceService(fixture.port, authorization, fakeIdentity());
  let evidenceId = "evidence-1";
  let payloadJson = JSON.stringify({ evidenceId, value: "original" });
  const pending = service.commit(evidenceId, payloadJson);
  await authorizationStarted;
  evidenceId = "evidence-2";
  payloadJson = JSON.stringify({ evidenceId, value: "mutated" });
  releaseAuthorization(true);

  await pending;
  assert.deepEqual(fixture.calls.commit, [{ evidenceId: "evidence-1", value: "original" }]);
});

test("authorization failures are audited, redacted, and degrade readiness", async () => {
  const fixture = fakePort();
  const service = createAnalyticsEvidenceService(fixture.port, {
    async authorize() { throw new Error("sensitive policy adapter failure"); },
  }, fakeIdentity());

  await assert.rejects(
    () => service.read("evidence-1"),
    (error) => {
      assert.ok(error instanceof AnalyticsEvidenceAccessError);
      assert.equal(error.readinessDegraded, true);
      assert.doesNotMatch(error.message, /sensitive|policy|adapter/u);
      return true;
    },
  );
  assert.deepEqual(fixture.calls.read, []);
  assert.equal(fixture.calls.audit.length, 1);
});

test("malformed commit JSON fails through the audited denial path", async () => {
  const fixture = fakePort();
  const service = createAnalyticsEvidenceService(
    fixture.port,
    fakeAuthorization(true).port,
    fakeIdentity(),
  );

  await assert.rejects(
    () => service.commit("evidence-1", "{"),
    AnalyticsEvidenceAccessError,
  );
  assert.deepEqual(fixture.calls.commit, []);
  assert.equal(fixture.calls.audit.length, 1);
});

test("non-string evidence and trusted identity values fail before authorization", async () => {
  const fixture = fakePort();
  const authorization = fakeAuthorization(true);
  const service = createAnalyticsEvidenceService(fixture.port, authorization.port, {
    async actorId() { return { toString: () => "local-operator" }; },
  });

  await assert.rejects(
    () => service.read({ toString: () => "evidence-1" }),
    AnalyticsEvidenceAccessError,
  );
  await assert.rejects(
    () => service.read("evidence-1"),
    AnalyticsEvidenceAccessError,
  );
  assert.deepEqual(authorization.calls, []);
  assert.deepEqual(fixture.calls.read, []);
});

test("oversized commit JSON is denied before parse or authorization", async () => {
  const fixture = fakePort();
  const authorization = fakeAuthorization(true);
  const service = createAnalyticsEvidenceService(fixture.port, authorization.port, fakeIdentity());
  await assert.rejects(
    () => service.commit("evidence-1", JSON.stringify({
      evidenceId: "evidence-1",
      value: "x".repeat(1_048_576),
    })),
    AnalyticsEvidenceAccessError,
  );
  assert.deepEqual(authorization.calls, []);
  assert.deepEqual(fixture.calls.commit, []);
});

test("commit rejects non-string payloads before authorization", async () => {
  const fixture = fakePort();
  const authorization = fakeAuthorization(true);
  const service = createAnalyticsEvidenceService(fixture.port, authorization.port, fakeIdentity());
  await assert.rejects(
    () => service.commit("evidence-1", new Proxy({}, {})),
    AnalyticsEvidenceAccessError,
  );
  assert.deepEqual(authorization.calls, []);
  assert.deepEqual(fixture.calls.commit, []);
});
