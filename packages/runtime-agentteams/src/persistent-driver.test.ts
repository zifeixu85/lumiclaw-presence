import { AGENTTEAMS_IMAGE_DIGESTS, GOAL_ROLE_IDS } from "@lumiclaw/domain";
import { describe, expect, it } from "vitest";
import {
  verifyAgentTeamsRuntimeIdentity,
  type RuntimeImageObservation,
} from "./persistent-driver.js";

const leader = "presence-mission-leader";
const repositories = {
  controller:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-embedded",
  manager:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-manager-copaw",
  worker:
    "higress-registry.cn-hangzhou.cr.aliyuncs.com/agentteams/agentteams-copaw-worker",
} as const;

describe("SDD-007 runtime identity probe", () => {
  it("requires observed exact topology plus controller, manager and six worker RepoDigests", () => {
    const verified = verifyAgentTeamsRuntimeIdentity(fixture());
    expect(verified).toMatchObject({
      verified: true,
      mismatches: [],
      method: "DOCKER_INSPECT_REPODIGEST_AND_EXACT_TOPOLOGY_V1",
    });
    expect(verified.actual.images).toHaveLength(8);
    expect(verified.actual.versionProbeDigest).toMatch(/^[a-f0-9]{64}$/u);
  });

  it("never reports verified for a wrong image digest or substituted team profile", () => {
    const wrongImage = fixture();
    wrongImage.images[2] = {
      ...wrongImage.images[2]!,
      repoDigests: [`${repositories.worker}@sha256:${"f".repeat(64)}`],
    };
    expect(verifyAgentTeamsRuntimeIdentity(wrongImage)).toMatchObject({
      verified: false,
      mismatches: expect.arrayContaining([
        expect.stringContaining("IMAGE_DIGEST_MISMATCH"),
      ]),
    });
    const invalidImageId = fixture();
    invalidImageId.images[2] = {
      ...invalidImageId.images[2]!,
      imageId: "sha256:not-an-image-id",
    };
    expect(verifyAgentTeamsRuntimeIdentity(invalidImageId)).toMatchObject({
      verified: false,
      mismatches: expect.arrayContaining([
        expect.stringContaining("IMAGE_ID_INVALID"),
      ]),
    });
    const wrongProfile = fixture();
    wrongProfile.team = {
      ...wrongProfile.team,
      name: "substituted-team-profile",
    };
    expect(verifyAgentTeamsRuntimeIdentity(wrongProfile)).toMatchObject({
      verified: false,
      mismatches: expect.arrayContaining([
        "TEAM_PROFILE_TOPOLOGY_MISMATCH",
        "TEAM_PROFILE_DIGEST_MISMATCH",
      ]),
    });
  });
});

function fixture() {
  const workers = GOAL_ROLE_IDS.map((name) => ({
    name,
    phase: "Running",
    runtime: "copaw",
    matrixUserID: `@${name}:matrix.local`,
  }));
  const workerMembers = GOAL_ROLE_IDS.map((name) => ({
    name,
    role: name === leader ? "team_leader" : "member",
  }));
  return {
    workersTotal: 6,
    workers,
    team: {
      name: "sdd002-governed-shadow",
      phase: "Active",
      leaderReady: true,
      readyWorkers: 5,
      totalWorkers: 5,
      workerMembers,
    },
    images: images(),
    versionProbe:
      "AgentTeams embedded controller dev; verified through frozen official OCI identities",
  };
}
function images(): RuntimeImageObservation[] {
  const one = (
    containerName: string,
    component: keyof typeof repositories,
  ): RuntimeImageObservation => ({
    containerName,
    component,
    imageId:
      `sha256:${component === "controller" ? "a" : component === "manager" ? "b" : "c"}`.padEnd(
        71,
        component === "worker" ? "c" : "0",
      ),
    configuredImage: `${repositories[component]}:v1.2.0`,
    repoDigests: [
      `${repositories[component]}@${AGENTTEAMS_IMAGE_DIGESTS[component]}`,
    ],
  });
  return [
    one("agentteams-controller", "controller"),
    one("agentteams-manager", "manager"),
    ...GOAL_ROLE_IDS.map((role) => one(`agentteams-worker-${role}`, "worker")),
  ];
}
