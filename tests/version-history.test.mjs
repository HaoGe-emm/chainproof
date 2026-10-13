import assert from "node:assert/strict";
import test from "node:test";
import { File } from "node:buffer";
import { createHash } from "node:crypto";
import { appendDemoVersion, createDemoWork, decodeDemoWorks, encodeDemoWorks, DEMO_PROOFS, DEMO_WALLETS, findDemoFileVersion, MAINNET_COMPATIBILITY_HASH } from "../lib/version-history.ts";
import { certificatePath, loadCertificate } from "../lib/certificate.ts";
import { fingerprintFile } from "../lib/proof.ts";

const workId = "demo-00000000-0000-4000-8000-000000000001";
const now = 1791760000;
function work(controller = DEMO_WALLETS[0], id = workId) { return createDemoWork({ workId: id, controller, title: "Novel / local example", description: "Self-described", now }); }
function append(current, proof = DEMO_PROOFS[0], extra = {}) {
  return appendDemoVersion(current, { actor: current.controller, fileHash: proof.fileHash, versionLabel: "Second draft", expectedPreviousVersionId: current.versions.at(-1)?.versionId ?? null, now: now + 10, ...extra });
}

test("prototype hashes commit reproducible fixture bytes, never the known mainnet case", async () => {
  for (const proof of DEMO_PROOFS) {
    assert.equal(proof.source, "demo");
    assert.notEqual(proof.fileHash, MAINNET_COMPATIBILITY_HASH);
    assert.equal(proof.fileHash, `0x${createHash("sha256").update(proof.content).digest("hex")}`);
    assert.equal(`0x${(await fingerprintFile(new File([proof.content], "demo.txt"))).hash}`, proof.fileHash);
  }
});

test("work creation binds its simulated controller, marks source and rejects invalid inputs", () => {
  assert.equal(work().source, "demo");
  assert.equal(work().creator, DEMO_WALLETS[0]);
  for (const input of [{ title: " " }, { title: "x".repeat(121) }, { description: "x".repeat(601) }, { controller: "0x89f415bb42e356e8b892c10b05522e0a8ef151f3" }, { workId: "javascript:alert(1)" }, { now: -1 }]) {
    assert.throws(() => createDemoWork({ ...work(), now, ...input }));
  }
});

test("versions link to one work in append order, preserving registration versus association time", () => {
  const initial = work();
  const one = append(initial);
  const two = append(one, DEMO_PROOFS[1]);
  assert.equal(initial.versions.length, 0, "append does not mutate existing data");
  assert.equal(two.versions.length, 2);
  assert.equal(two.versions[0].previousVersionId, null);
  assert.equal(two.versions[1].previousVersionId, two.versions[0].versionId);
  assert.equal(two.versions[1].workId, workId);
  assert.equal(two.versions[1].versionNumber, 2);
  assert.ok(two.versions[1].registeredTimestamp < two.versions[0].registeredTimestamp, "Registration time does not determine version order");
  assert.equal(two.versions[1].associationTimestamp, now + 10);
  assert.notEqual(two.versions[1].associationTimestamp, two.versions[1].registeredTimestamp);
  assert.throws(() => appendDemoVersion(two, { actor: two.controller, fileHash: DEMO_PROOFS[2].fileHash, versionLabel: "", expectedPreviousVersionId: null, now }), /previous version changed/);
  const backwardsClock = append(two, DEMO_PROOFS[2], { now: now - 100 });
  assert.equal(backwardsClock.versions[2].associationTimestamp, two.versions[1].associationTimestamp, "Local clock rollback must not reorder appends");
});

test("duplicate hash is rejected within a work but authorized reuse in another work is allowed", () => {
  const one = append(work());
  assert.throws(() => append(one), /already linked/);
  const another = append(work(DEMO_WALLETS[0], "demo-00000000-0000-4000-8000-000000000002"));
  assert.equal(another.versions[0].fileHash, one.versions[0].fileHash);
  assert.notEqual(another.versions[0].versionId, one.versions[0].versionId);
});

test("foreign acting wallets and foreign registrations cannot join a controller's work", () => {
  assert.throws(() => append(work(), DEMO_PROOFS[0], { actor: DEMO_WALLETS[1] }), /only the work controller/);
  assert.throws(() => append(work(), DEMO_PROOFS[3]), /original registered wallet/);
  assert.throws(() => append(work(DEMO_WALLETS[1]), DEMO_PROOFS[0]), /original registered wallet/);
  assert.equal(append(work(DEMO_WALLETS[1]), DEMO_PROOFS[3]).versions[0].registeredWallet, DEMO_WALLETS[1]);
});

test("unknown hashes and real mainnet hash are never imported into the demo registry", () => {
  for (const hash of [`0x${"0".repeat(64)}`, MAINNET_COMPATIBILITY_HASH, "not a hash"]) {
    assert.throws(() => append(work(), { fileHash: hash }), /No demo proof exists/);
  }
});

test("storage round trip strips unrecognized data and rejects ownership, source and sequence tampering", () => {
  const original = append(append(work()), DEMO_PROOFS[1]);
  assert.deepEqual(decodeDemoWorks(encodeDemoWorks([original])), [original]);
  const withRaw = { ...original, fileContents: "private uploaded bytes", versions: original.versions.map((item) => ({ ...item, titleOnChain: "not real" })) };
  const clean = encodeDemoWorks([withRaw]);
  assert.ok(!clean.includes("fileContents") && !clean.includes("titleOnChain") && !clean.includes("private uploaded bytes"));
  for (const mutate of [
    (item) => { item.source = "mainnet"; },
    (item) => { item.creator = DEMO_WALLETS[1]; },
    (item) => { item.versions[0].registeredWallet = DEMO_WALLETS[1]; },
    (item) => { item.versions[0].registeredTimestamp += 1; },
    (item) => { item.versions[1].previousVersionId = null; },
    (item) => { item.versions[1].workId = "other"; },
    (item) => { item.versions[1].versionNumber = 8; },
    (item) => { item.versions[0].fileHash = MAINNET_COMPATIBILITY_HASH; },
    (item) => { item.versions[1].associationTimestamp = now - 1; },
  ]) {
    const altered = structuredClone(original); mutate(altered);
    assert.throws(() => decodeDemoWorks(JSON.stringify({ schema: 1, source: "demo", works: [altered] })));
  }
  assert.throws(() => decodeDemoWorks("bad json"));
  assert.throws(() => decodeDemoWorks("x".repeat(128001)));
  assert.throws(() => decodeDemoWorks(JSON.stringify({ schema: 1, source: "demo", works: [original, original] })));
  assert.throws(() => decodeDemoWorks(JSON.stringify({ schema: 2, source: "demo", works: [] })));
  assert.deepEqual(decodeDemoWorks(null), []);
});

test("local byte matching finds a demo version, a one-character edit does not match", async () => {
  const linked = append(work());
  const file = new File([DEMO_PROOFS[0].content], "renamed.txt");
  const bytes = await fingerprintFile(file);
  assert.equal(findDemoFileVersion(linked, bytes.hash)?.versionNumber, 1);
  const edited = await fingerprintFile(new File([DEMO_PROOFS[0].content.replace("draft 1", "draft 2")], "same.txt"));
  assert.equal(findDemoFileVersion(linked, edited.hash), null);
  assert.equal(findDemoFileVersion(linked, "bad"), null);
});

test("old certificate compatibility uses original path and distinguishes absent/error from registration", async () => {
  assert.equal(certificatePath(MAINNET_COMPATIBILITY_HASH), `/proof/${MAINNET_COMPATIBILITY_HASH}`);
  const owner = "0x89f415bb42e356e8b892c10b05522e0a8ef151f3";
  const record = await loadCertificate(MAINNET_COMPATIBILITY_HASH, async () => [owner, BigInt(1791426243), true]);
  assert.equal(record.status, "registered");
  assert.equal(record.owner, owner);
  assert.equal((await loadCertificate(MAINNET_COMPATIBILITY_HASH, async () => [DEMO_WALLETS[0], BigInt(0), false])).status, "not-found");
  assert.equal((await loadCertificate(MAINNET_COMPATIBILITY_HASH, async () => { throw new Error("Test RPC failure"); })).status, "error");
  assert.equal(work().versions.length, 0, "Read-only lookup never establishes a relationship");
});
