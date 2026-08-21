import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import path from "node:path";

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const researchRoot = path.join(repositoryRoot, "docs", "research", "platform-skills");
const fixtureRoot = path.join(researchRoot, "fixtures");
const schemaRoot = path.join(researchRoot, "schemas");

const failures = [];
let checks = 0;

function check(condition, message) {
  checks += 1;
  if (!condition) failures.push(message);
}

async function loadJson(absolutePath) {
  return JSON.parse(await readFile(absolutePath, "utf8"));
}

function assertUnique(values, label) {
  check(new Set(values).size === values.length, `${label} must be unique`);
}

function prototypeAsciiWeightedLength(text) {
  const urls = [...text.matchAll(/https?:\/\/\S+/gu)];
  const withoutUrls = urls.reduce((current, match) => current.replace(match[0], ""), text);
  check([...withoutUrls].every((character) => character.codePointAt(0) <= 0x7f), "Research verifier only computes ASCII X fixtures; production must use pinned twitter-text");
  return [...withoutUrls].length + urls.length * 23;
}

function verifyRulePack(pack) {
  check(pack.schemaVersion === "platform-rule-pack.v1alpha1", `${pack.packId}: schemaVersion`);
  check(pack.status === "RESEARCH_PROTOTYPE", `${pack.packId}: research status`);
  check(new Date(pack.provenance.expiresAt) > new Date(pack.provenance.retrievedAt), `${pack.packId}: pack expiry after retrieval`);

  const sourceIds = pack.sources.map((source) => source.sourceId);
  const sourceById = new Map(pack.sources.map((source) => [source.sourceId, source]));
  assertUnique(sourceIds, `${pack.packId}: source IDs`);
  for (const source of pack.sources) {
    check(new Date(source.expiresAt) > new Date(source.retrievedAt), `${pack.packId}/${source.sourceId}: source expiry after retrieval`);
    check(/^https:\/\//u.test(source.url), `${pack.packId}/${source.sourceId}: HTTPS source URL`);
  }

  const ruleCodes = pack.rules.map((rule) => rule.ruleCode);
  assertUnique(ruleCodes, `${pack.packId}: rule codes`);
  for (const rule of pack.rules) {
    check(rule.sourceIds.length > 0, `${pack.packId}/${rule.ruleCode}: source required`);
    for (const sourceId of rule.sourceIds) {
      check(sourceById.has(sourceId), `${pack.packId}/${rule.ruleCode}: unknown source ${sourceId}`);
    }
    if (rule.classification === "HARD_CONSTRAINT") {
      check(rule.severity === "BLOCK", `${pack.packId}/${rule.ruleCode}: hard rule must block`);
      check(rule.sourceIds.some((sourceId) => sourceById.get(sourceId)?.authority !== "EMPIRICAL"), `${pack.packId}/${rule.ruleCode}: hard rule cannot rely only on empirical evidence`);
    }
    if (rule.classification === "NEEDS_ACCOUNT_PROBE") {
      check(rule.severity === "PROBE", `${pack.packId}/${rule.ruleCode}: probe rule severity`);
      check(rule.validation.mode === "CAPABILITY_PROBE", `${pack.packId}/${rule.ruleCode}: probe validation mode`);
    }
    if (rule.classification.endsWith("RECOMMENDATION")) {
      check(rule.severity === "WARN", `${pack.packId}/${rule.ruleCode}: recommendation must warn`);
    }
    check(Boolean(rule.fallback?.action && rule.fallback?.reason), `${pack.packId}/${rule.ruleCode}: fallback required`);
  }

  for (const conflict of pack.sourceConflicts ?? []) {
    check(conflict.sourceIds.length >= 2, `${pack.packId}/${conflict.conflictCode}: conflict needs two sources`);
    for (const sourceId of conflict.sourceIds) {
      check(sourceById.has(sourceId), `${pack.packId}/${conflict.conflictCode}: unknown conflict source ${sourceId}`);
    }
  }
}

function verifyArtifactProfile(profile, packsById) {
  check(profile.schemaVersion === "artifact-profile.v1alpha1", `${profile.profileCode}: schemaVersion`);
  check(profile.target.uiLocaleIndependent === true, `${profile.profileCode}: UI locale must remain independent`);
  check(profile.delivery.exactRevisionDigestRequired === true, `${profile.profileCode}: exact revision digest required`);
  check(profile.validation.expiredRulePackBehavior === "BLOCK", `${profile.profileCode}: expired pack must block`);
  assertUnique(profile.reviewChecklist.map((item) => item.checkCode), `${profile.profileCode}: checklist codes`);
  for (const rulePackRef of profile.rulePackRefs) {
    const pack = packsById.get(rulePackRef.packId);
    check(Boolean(pack), `${profile.profileCode}: rule pack ${rulePackRef.packId} exists`);
    check(pack?.packVersion === rulePackRef.packVersion, `${profile.profileCode}: rule pack version matches`);
    check(pack?.platformCode === profile.platformCode, `${profile.profileCode}: platform matches rule pack`);
  }
}

function verifySinglePost(fixture) {
  check(fixture.fixtureId === "FIXTURE_X_SINGLE_POST_001", "X single fixture ID");
  const measured = prototypeAsciiWeightedLength(fixture.content.text);
  check(measured === fixture.content.expectedWeightedLength, `X single weighted length expected ${fixture.content.expectedWeightedLength}, got ${measured}`);
  check(measured <= 280, "X single <= 280");
  check(fixture.content.media.length >= 1 && fixture.content.media.length <= 4, "X single image count 1-4");
  for (const media of fixture.content.media) {
    check(media.fileSizeBytes <= 5 * 1024 * 1024, `${media.mediaId}: <= 5 MB`);
    check([...media.altText].length <= 1000, `${media.mediaId}: ALT <= 1000`);
  }
}

function verifyThread(fixture) {
  check(fixture.fixtureId === "FIXTURE_X_THREAD_001", "X thread fixture ID");
  check(fixture.content.items.length >= 3 && fixture.content.items.length <= 7, "X thread fixture uses project-recommended 3-7 range");
  const seen = new Set();
  for (const [index, item] of fixture.content.items.entries()) {
    check(!seen.has(item.itemCode), `X thread item ${item.itemCode}: unique`);
    const measured = prototypeAsciiWeightedLength(item.text);
    check(measured === item.expectedWeightedLength, `X thread item ${item.itemCode}: expected ${item.expectedWeightedLength}, got ${measured}`);
    check(measured <= 280, `X thread item ${item.itemCode}: <= 280`);
    check(item.media.length <= 4, `X thread item ${item.itemCode}: <= 4 images`);
    if (index === 0) {
      check(item.replyToItemCode === null, "X thread root has no parent");
    } else {
      check(seen.has(item.replyToItemCode), `X thread item ${item.itemCode}: parent must be an earlier item`);
    }
    seen.add(item.itemCode);
  }
}

function verifyXhsImageNote(fixture) {
  check(fixture.fixtureId === "FIXTURE_XHS_IMAGE_NOTE_001", "XHS fixture ID");
  check(fixture.content.images.length >= 1, "XHS image note has at least one image");
  check(!Object.hasOwn(fixture.content, "video"), "XHS image fixture does not mix video");
  check(fixture.accountProbe.status === "REQUIRED_BEFORE_APPROVAL", "XHS account probe remains required");
  check(fixture.expectedResult.hardConstraintStatus === "PENDING_CAPABILITY_PROBE", "XHS fixture does not claim account validation");
  const requiredProbeCodes = new Set(fixture.accountProbe.requiredCodes);
  for (const code of ["XHS_TITLE_COUNTER", "XHS_BODY_COUNTER", "XHS_IMAGE_COUNT", "XHS_NATIVE_CROP", "XHS_TOPIC_SELECTOR"]) {
    check(requiredProbeCodes.has(code), `XHS fixture requires ${code}`);
  }
  for (const [index, image] of fixture.content.images.entries()) {
    check(image.order === index + 1, `${image.mediaId}: stable order`);
    check(image.width === 1080 && image.height === 1440, `${image.mediaId}: empirical 1080x1440 export`);
    check(image.essentialTextRepeatedInBody === true, `${image.mediaId}: essential text repeated in body`);
  }
}

const schemaFiles = [
  "platform-rule-pack.schema.json",
  "artifact-profile.schema.json",
  "platform-skill-manifest.schema.json"
];
for (const filename of schemaFiles) {
  const schema = await loadJson(path.join(schemaRoot, filename));
  check(schema.$schema === "https://json-schema.org/draft/2020-12/schema", `${filename}: JSON Schema draft`);
  check(schema.type === "object", `${filename}: object schema`);
  check(Array.isArray(schema.required) && schema.required.length > 0, `${filename}: required fields`);
}

const xPack = await loadJson(path.join(fixtureRoot, "x-platform-rule-pack.v1alpha1.json"));
const xhsPack = await loadJson(path.join(fixtureRoot, "xiaohongshu-platform-rule-pack.v1alpha1.json"));
verifyRulePack(xPack);
verifyRulePack(xhsPack);
const packsById = new Map([xPack, xhsPack].map((pack) => [pack.packId, pack]));

const profiles = await Promise.all([
  "x-single-post.artifact-profile.json",
  "x-thread.artifact-profile.json",
  "xiaohongshu-image-note.artifact-profile.json"
].map((filename) => loadJson(path.join(fixtureRoot, filename))));
for (const profile of profiles) verifyArtifactProfile(profile, packsById);
assertUnique(profiles.map((profile) => profile.profileCode), "Artifact profile codes");

const manifest = await loadJson(path.join(fixtureRoot, "platform-content-contract.skill-manifest.json"));
check(manifest.schemaVersion === "platform-skill-manifest.v1alpha1", "Skill manifest schemaVersion");
check(Object.values(manifest.permissions).every((value) => value === false), "Content-contract Skill has no network/browser/cookie/secret/public-write permission");
check(manifest.externalActions.classification === "NONE", "Content-contract Skill has no external action");
for (const profileCode of manifest.contractBindings.artifactProfileCodes) {
  check(profiles.some((profile) => profile.profileCode === profileCode), `Skill manifest profile ${profileCode} exists`);
}

verifySinglePost(await loadJson(path.join(fixtureRoot, "x-single-post.fixture.json")));
verifyThread(await loadJson(path.join(fixtureRoot, "x-thread.fixture.json")));
verifyXhsImageNote(await loadJson(path.join(fixtureRoot, "xiaohongshu-image-note.fixture.json")));

const sourceRegister = await loadJson(path.join(researchRoot, "SOURCE-REGISTER.json"));
assertUnique(sourceRegister.sources.map((source) => source.sourceId), "Source register IDs");
check(sourceRegister.sources.some((source) => source.sourceId === "XHS.OPEN.QA"), "Source register includes XHS official Q&A");
check(sourceRegister.sources.some((source) => source.sourceId === "X.SPEC.TWITTER_TEXT_V3"), "Source register includes official twitter-text");

const candidateRegister = await loadJson(path.join(researchRoot, "GITHUB-SKILL-CANDIDATES.json"));
assertUnique(candidateRegister.candidates.map((candidate) => candidate.candidateId), "GitHub candidate IDs");
for (const candidate of candidateRegister.candidates) {
  if (/AGPL/u.test(candidate.license.spdx)) {
    check(!candidate.decision.includes("ADOPT"), `${candidate.candidateId}: AGPL cannot be adopted into Apache source tree`);
  }
  if (candidate.license.spdx === "NOASSERTION") {
    check(candidate.copyPolicy.toLowerCase().includes("no") || candidate.copyPolicy.includes("不"), `${candidate.candidateId}: unknown license must prohibit copy`);
  }
}

if (failures.length > 0) {
  console.error(`Platform-rule research verification failed (${failures.length}/${checks} checks):`);
  for (const failure of failures) console.error(`- ${failure}`);
  process.exitCode = 1;
} else {
  console.log(`Platform-rule research verification passed (${checks} checks).`);
  console.log("Validated: 3 schemas, 2 rule packs, 3 artifact profiles, 1 Skill manifest, 3 content fixtures, source and candidate registers.");
  console.log("Note: production weighted-text conformance still requires pinned twitter-text and Ajv strict validation in the implementation SDD.");
}
