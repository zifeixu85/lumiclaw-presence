import { describe, expect, it } from "vitest";
import { parseRuntimeOutput } from "./runtime-output-schemas.js";
import type { RuntimeTaskContract } from "./persistent-runtime.js";

const contract: RuntimeTaskContract = {
  schemaVersion: 1,
  runId: "run-audit",
  bundleId: "bundle-audit",
  bundleDigest: "a".repeat(64),
  generation: 2,
  taskId: "task-audit",
  roleId: "independent-auditor",
  kind: "AUDIT_CONTENT",
  mandate: "Audit independently.",
  dependencyIds: [],
  inputDigest: "b".repeat(64),
  skillLockDigest: "c".repeat(64),
  outputSchema: "lumiclaw.audit-decision.sdd010",
  substantive: true,
  externalActionAllowed: false,
};
const codes = [
  "SCHEMA_AND_ORDER",
  "SOURCE_GROUNDING",
  "CLAIM_EVIDENCE",
  "GOAL_AND_PLAN_FIT",
  "ACCOUNT_VOICE",
  "PLATFORM_CONSTRAINTS",
  "SENSITIVE_RISK",
] as const;
const audit = {
  artifactRevisionId: "artifact-1",
  auditorIdentityId: "@auditor:matrix.local",
  evidenceBindings: ["d".repeat(64)],
  findings: codes.map((checkCode) => ({
    checkCode,
    result: "PASS",
    path: "/",
    message: `${checkCode} passed.`,
    evidenceBindings: ["e".repeat(64)],
    recoveryAction: null,
  })),
  result: "PASS",
};

describe("persistent runtime closed output schemas", () => {
  it("accepts an audit without a model-controlled authority timestamp", () => {
    expect(parseRuntimeOutput(contract, { audits: [audit] })).toEqual({
      audits: [audit],
    });
  });

  it("rejects a model attempt to backdate an audit", () => {
    expect(() =>
      parseRuntimeOutput(contract, {
        audits: [{ ...audit, createdAt: "2000-01-01T00:00:00.000Z" }],
      }),
    ).toThrowError(expect.objectContaining({ code: "SUBMISSION_SCHEMA_INVALID" }));
  });
});
