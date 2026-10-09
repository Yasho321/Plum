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
import { AgentStack } from "../lib/agent-stack";
import { GovStack } from "../lib/gov-stack";
import { FleetStack } from "../lib/fleet-stack";
import { WebStack } from "../lib/web-stack";
import { ObservabilityStack } from "../lib/observability-stack";

const app = new cdk.App();
const stage = assertStage(app.node.tryGetContext("stage") ?? "dev");

const env: cdk.Environment = {
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: REGION,
};

// Dependency order: Data -> Engine -> Gov -> Fleet -> Agent -> Api -> Web -> Observability.
const data = new DataStack(app, `PtData-${stage}`, { stage, env });
const engine = new EngineStack(app, `PtEngine-${stage}`, { stage, env, data });
const gov = new GovStack(app, `PtGov-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
const fleet = new FleetStack(app, `PtFleet-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });

// AgentStack (Yasho2): Bedrock guardrail + IAM policy for the Copilot.
const bedrockModelId = app.node.tryGetContext("bedrockModelId") as string;
const agent = new AgentStack(app, `PtAgent-${stage}`, { stage, env, modelId: bedrockModelId });

const api = new ApiStack(app, `PtApi-${stage}`, {
  stage,
  env,
  data,
  busName: engine.bus.eventBusName,
  modelId: bedrockModelId,
  guardrailId: agent.guardrailId,
  guardrailVersion: agent.guardrailVersion,
  agentPolicy: agent.bedrockAccessPolicy,
});
const web = new WebStack(app, `PtWeb-${stage}`, { stage, env });
const observability = new ObservabilityStack(app, `PtObs-${stage}`, { stage, env, engine });

void [gov, fleet, agent, api, web, observability];

app.synth();
