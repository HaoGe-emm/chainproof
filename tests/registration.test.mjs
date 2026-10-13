import assert from "node:assert/strict";
import test from "node:test";
import { encodeAbiParameters, encodeEventTopics } from "viem";
import { CHAIN_PROOF_ADDRESS, chainProofAbi, receiptRegistersProof } from "../lib/chainproof.ts";
import { parsePendingRegistration } from "../lib/registration.ts";

const hash = `0x${"a".repeat(64)}`;
const owner = "0x0000000000000000000000000000000000000002";
const transaction = `0x${"b".repeat(64)}`;
const event = {
  address: CHAIN_PROOF_ADDRESS,
  topics: encodeEventTopics({ abi: chainProofAbi, eventName: "ProofRegistered", args: { fileHash: hash, owner } }),
  data: encodeAbiParameters([{ type: "uint256" }], [BigInt(1700000000)]),
};
test("registration succeeds only with a successful receipt and the exact contract, hash, and captured wallet event", () => {
  assert.equal(receiptRegistersProof({ status: "success", logs: [event] }, hash, owner), true);
  assert.equal(receiptRegistersProof({ status: "reverted", logs: [event] }, hash, owner), false);
  assert.equal(receiptRegistersProof({ status: "success", logs: [] }, hash, owner), false);
  assert.equal(receiptRegistersProof({ status: "success", logs: [event] }, `0x${"c".repeat(64)}`, owner), false);
  assert.equal(receiptRegistersProof({ status: "success", logs: [event] }, hash, "0x0000000000000000000000000000000000000003"), false);
  assert.equal(receiptRegistersProof({ status: "success", logs: [{ ...event, address: owner }] }, hash, owner), false);
});
test("refresh recovery accepts only valid public metadata for this mainnet contract", () => {
  const pending = { hash: hash.slice(2), owner, transaction, chainId: 677, contract: CHAIN_PROOF_ADDRESS };
  assert.deepEqual(parsePendingRegistration(pending, 677, CHAIN_PROOF_ADDRESS), pending);
  assert.deepEqual(parsePendingRegistration({ ...pending, fileContents: "must not persist" }, 677, CHAIN_PROOF_ADDRESS), pending);
  for (const invalid of [null, {}, { ...pending, chainId: 968 }, { ...pending, hash: "invalid" }, { ...pending, transaction: "invalid" }, { ...pending, contract: owner }]) {
    assert.equal(parsePendingRegistration(invalid, 677, CHAIN_PROOF_ADDRESS), null);
  }
});
