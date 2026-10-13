import test from "node:test";
import assert from "node:assert/strict";
import { developmentFeatureEnabled } from "../lib/development-features.ts";
const features = ["prototype", "local-evm", "metamask-local"];
const flags = { CHAINPROOF_VERSION_PROTOTYPE: "1", CHAINPROOF_LOCAL_EVM: "1", CHAINPROOF_METAMASK_LOCAL: "1" };
test("development features default closed with missing environment variables", () => {
  for (const feature of features) for (const environment of [{}, { NODE_ENV: "development" }, { NODE_ENV: "production" }]) assert.equal(developmentFeatureEnabled(feature, environment), false);
});
test("production and preview builds reject every development flag", () => {
  for (const feature of features) for (const VERCEL_ENV of [undefined, "production", "preview", "development"]) assert.equal(developmentFeatureEnabled(feature, { ...flags, NODE_ENV: "production", VERCEL_ENV }), false);
});
test("only explicit per-feature opt-in can enable a development feature", () => {
  for (const feature of features) assert.equal(developmentFeatureEnabled(feature, { ...flags, NODE_ENV: "development" }), true);
  assert.equal(developmentFeatureEnabled("prototype", { NODE_ENV: "development", CHAINPROOF_LOCAL_EVM: "1" }), false);
  assert.equal(developmentFeatureEnabled("prototype", { NODE_ENV: "development", CHAINPROOF_VERSION_PROTOTYPE: "true" }), false);
});
