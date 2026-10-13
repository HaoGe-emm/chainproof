import assert from "node:assert/strict";
import { File } from "node:buffer";
import { createHash } from "node:crypto";
import test from "node:test";
import { certificatePath, certificateUrl, isLocalCertificateUrl, loadCertificate, normalizeCertificateHash, verifyFileCopy } from "../lib/certificate.ts";
import { fingerprintFile } from "../lib/proof.ts";

const hash = "0x8ed3e3e1dc015bd4fe18a80b93adccbd93ea9f7ee7a577600ae6d2e07642f625";
const owner = "0x89f415bb42e356e8b892c10b05522e0a8ef151f3";
const registered = { status: "registered", hash, owner, timestamp: BigInt(1791426243) };
const testOwner = "0x0000000000000000000000000000000000000002";

test("accepts exactly bytes32 with lowercase 0x and normalizes hex digits", () => {
  assert.equal(normalizeCertificateHash(hash), hash);
  assert.equal(normalizeCertificateHash(`0x${hash.slice(2).toUpperCase()}`), hash);
  for (const invalid of ["", hash.slice(2), `0X${hash.slice(2)}`, `${hash}0`, hash.slice(0, -1), ` ${hash}`, `${hash}/`, `0x${"g".repeat(64)}`]) {
    assert.equal(normalizeCertificateHash(invalid), null);
  }
});

test("reads a real registration fixture using only the public reader, without any wallet", async () => {
  let argument;
  const proof = await loadCertificate(hash, async (sha256) => {
    argument = sha256;
    return [owner, BigInt(1791426243), true];
  });
  assert.equal(argument, hash.slice(2));
  assert.deepEqual(proof, registered);
});

test("distinguishes absent proofs, invalid URLs, RPC failure, and malformed records", async () => {
  const absent = await loadCertificate(hash, async () => ["0x0000000000000000000000000000000000000000", BigInt(0), false]);
  assert.equal(absent.status, "not-found");
  assert.equal((await loadCertificate(hash, async () => { throw new Error("RPC timeout"); })).status, "error");
  assert.equal((await loadCertificate(hash, async () => [owner, BigInt(0), true])).status, "error");
  assert.equal((await loadCertificate("invalid", async () => assert.fail("must not query invalid hash"))).status, "invalid");
});

test("local byte matching ignores filenames, supports repeated selections, and detects one changed character", async () => {
  const original = new File(["alpha"], "original.txt");
  const renamed = new File(["alpha"], "renamed.pdf");
  const modified = new File(["alphb"], "original.txt");
  const expectedHash = createHash("sha256").update("alpha").digest("hex");
  // Synthetic registration used only in this offline test; it is not a mainnet record.
  const localRegistration = { status: "registered", owner: testOwner, timestamp: BigInt(1700000000), hash: `0x${expectedHash}` };
  const computed = await fingerprintFile(original);
  assert.match(computed.hash, /^[0-9a-f]{64}$/);
  assert.equal(computed.hash, expectedHash, "Web Crypto output must equal the independently computed SHA-256");
  assert.notEqual((await fingerprintFile(modified)).hash, expectedHash, "Changing one character must change the fingerprint");
  assert.equal(await verifyFileCopy(original, localRegistration, fingerprintFile), "match");
  assert.equal(await verifyFileCopy(original, localRegistration, fingerprintFile), "match");
  assert.equal(await verifyFileCopy(renamed, localRegistration, fingerprintFile), "match");
  assert.equal(await verifyFileCopy(modified, localRegistration, fingerprintFile), "mismatch");
});

test("absent or failed chain lookups cannot authorize MATCH even when the local file hash equals the URL", async () => {
  const file = new File(["alpha"], "matching-local-file.txt");
  const expected = await fingerprintFile(file);
  const urlHash = `0x${expected.hash}`;
  const readers = [
    async () => ["0x0000000000000000000000000000000000000000", BigInt(0), false],
    async () => { throw new Error("Simulated RPC failure"); },
  ];
  for (const [index, read] of readers.entries()) {
    const state = await loadCertificate(urlHash, read);
    assert.equal(state.status, index === 0 ? "not-found" : "error");
    let hashCalls = 0;
    const result = await verifyFileCopy(file, state, async (selected) => {
      hashCalls += 1;
      return fingerprintFile(selected);
    });
    assert.equal(result, "unavailable");
    assert.notEqual(result, "match");
    assert.equal(hashCalls, 0, "An unconfirmed registration must block trusted file verification");
  }
});

test("hashes empty files correctly and reports file read failures as ERROR", async () => {
  const empty = new File([], "empty.txt");
  const fingerprint = await fingerprintFile(empty);
  assert.equal(fingerprint.hash, "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
  assert.equal(await verifyFileCopy(empty, { ...registered, hash: `0x${fingerprint.hash}` }, fingerprintFile), "match");
  const unreadable = { name: "bad.txt", size: 5, arrayBuffer: async () => { throw new Error("File could not be read"); } };
  assert.equal(await verifyFileCopy(unreadable, registered, fingerprintFile), "error");
});

test("never computes a trusted match before chain registration is confirmed", async () => {
  const file = new File(["alpha"], "file.txt");
  for (const state of [{ status: "invalid" }, { status: "loading", hash }, { status: "error", hash }, { status: "not-found", hash }]) {
    assert.equal(await verifyFileCopy(file, state, async () => assert.fail("unconfirmed file must not be compared")), "unavailable");
  }
});

test("builds certificate links from the actual localhost, Preview, Production, or custom origin", () => {
  assert.equal(certificatePath(hash), `/proof/${hash}`);
  assert.equal(certificateUrl("http://localhost:3000", hash), `http://localhost:3000/proof/${hash}`);
  for (const origin of ["https://chainproof-git-feature-chainproof-v2-example.vercel.app", "https://chainproof-two.vercel.app", "https://chainproof.example.com"]) {
    assert.equal(certificateUrl(`${origin}/other`, hash), `${origin}/proof/${hash}`);
  }
  assert.throws(() => certificateUrl("javascript:alert(1)", hash));
  assert.throws(() => certificatePath("invalid"));
});

test("flags loopback certificate links without labeling deployed domains as local", () => {
  for (const origin of ["http://localhost:3000", "http://127.0.0.1:3001", "http://[::1]:3000", "http://demo.localhost:3000"]) {
    assert.equal(isLocalCertificateUrl(certificateUrl(origin, hash)), true);
  }
  for (const value of ["", "invalid", "https://chainproof-two.vercel.app", "https://chainproof-git-feature-chainproof-v2-example.vercel.app", "https://localhost.example.com"]) {
    assert.equal(isLocalCertificateUrl(value), false);
  }
});
