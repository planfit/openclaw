export { discoverBedrockMantleModels } from "./discovery.js";

export const BEDROCK_MANTLE_REGIONS = [
  "us-east-1",
  "us-east-2",
  "us-west-2",
  "ap-northeast-1",
  "ap-south-1",
  "ap-southeast-3",
  "eu-central-1",
  "eu-west-1",
  "eu-west-2",
  "eu-south-1",
  "eu-north-1",
  "sa-east-1",
] as const;

export type BedrockMantleRegion = (typeof BEDROCK_MANTLE_REGIONS)[number];
