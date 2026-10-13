// Server-side release gate. No environment flag can enable these in production.
export type DevelopmentFeature = "prototype" | "local-evm" | "metamask-local";
const flags: Record<DevelopmentFeature, string> = {
  prototype: "CHAINPROOF_VERSION_PROTOTYPE",
  "local-evm": "CHAINPROOF_LOCAL_EVM",
  "metamask-local": "CHAINPROOF_METAMASK_LOCAL",
};
export function developmentFeatureEnabled(
  feature: DevelopmentFeature,
  environment: Readonly<Record<string, string | undefined>> = process.env,
): boolean {
  return environment.NODE_ENV === "development" && environment[flags[feature]] === "1";
}
