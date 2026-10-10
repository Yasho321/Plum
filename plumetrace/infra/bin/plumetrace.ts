#!/usr/bin/env node
/**
 * OWNER    : Tejas
 * DUE      : D1 13:00
 * TASK     :
 *   CDK app entry. Read context `stage` (dev | demo). Instantiate stacks in dependency order: Data -> Engine -> Gov -> Fleet -> Agent -> Api -> Web -> Observability. Prefix every resource name with `pt-${stage}`. Region us-east-1.
 * DONE WHEN: `npx cdk synth -c stage=dev` succeeds with all stacks.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : WIP
 *   DataStack is wired and synths. The remaining stacks are added here as each lib/*
 *   file starts exporting its class (Engine/Gov/Fleet/Web/Observability are mine;
 *   Agent is Yasho2's) — then this flips to DONE when the full app synths.
 */
import * as cdk from "aws-cdk-lib";
import { assertStage, REGION } from "../lib/config";
import { DataStack } from "../lib/data-stack";
import { EngineStack } from "../lib/engine-stack";
import { ApiStack } from "../lib/api-stack";
import { GovStack } from "../lib/gov-stack";
import { FleetStack } from "../lib/fleet-stack";
import { WebStack } from "../lib/web-stack";
import { ObservabilityStack } from "../lib/observability-stack";

const app = new cdk.App();
const stage = assertStage(app.node.tryGetContext("stage") ?? "dev");

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT || "171403826703",
  region: REGION,
};

// Copilot runs on the Anthropic API directly (Option A) — no Bedrock/AgentStack.
const anthropicModel = (app.node.tryGetContext("anthropicModel") as string) ?? "claude-sonnet-4-6";
// Live Claude over mock data (demo): -c agentLive=1.
const agentLive = ["1", "true", "yes"].includes(String(app.node.tryGetContext("agentLive") ?? "").toLowerCase());
// Web origin (CloudFront URL) for CORS + Cognito callback/logout URLs: -c webOrigin=https://xxxx.cloudfront.net
const webOrigin = app.node.tryGetContext("webOrigin") as string | undefined;
const webOrigins = [webOrigin, "http://localhost:5173"].filter(Boolean) as string[];
const coreOnly = ["1", "true", "yes"].includes(String(app.node.tryGetContext("coreOnly") ?? "").toLowerCase());
const webOnly = ["1", "true", "yes"].includes(String(app.node.tryGetContext("webOnly") ?? "").toLowerCase());

// Data -> (Engine -> Gov -> Fleet -> Obs, full app only) -> Api -> Web.
let data: DataStack | undefined;
if (!webOnly) {
  data = new DataStack(app, `PtData-${stage}`, { stage, env });
}

let apiBusName: string | undefined;
if (!coreOnly && !webOnly && data) {
  const engine = new EngineStack(app, `PtEngine-${stage}`, { stage, env, data });
  const gov = new GovStack(app, `PtGov-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
  const fleet = new FleetStack(app, `PtFleet-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
  const observability = new ObservabilityStack(app, `PtObs-${stage}`, { stage, env, engine });
  apiBusName = engine.bus.eventBusName;
  void [gov, fleet, observability];
}

if (!webOnly && data) {
  const api = new ApiStack(app, `PtApi-${stage}`, {
    stage,
    env,
    data,
    // In coreOnly there is no EngineStack, so use the computed bus name (MOCK_MODE
    // never emits events, so the bus is not needed at runtime for the demo).
    busName: apiBusName,
    modelId: anthropicModel,
    agentLive,
    webOrigins,
  });
  void api;
}
const web = new WebStack(app, `PtWeb-${stage}`, { stage, env });
void web;

app.synth();
