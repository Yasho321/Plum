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
  account: process.env.CDK_DEFAULT_ACCOUNT,
  region: REGION,
};

// Dependency order: Data -> Engine -> Gov -> Fleet -> Agent -> Api -> Web -> Observability.
const data = new DataStack(app, `PtData-${stage}`, { stage, env });
const engine = new EngineStack(app, `PtEngine-${stage}`, { stage, env, data });
const gov = new GovStack(app, `PtGov-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
const fleet = new FleetStack(app, `PtFleet-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
// AgentStack (Yasho2) provides guardrailId; wire it into ApiStack once it exists.
const api = new ApiStack(app, `PtApi-${stage}`, { stage, env, data, busName: engine.bus.eventBusName });
const web = new WebStack(app, `PtWeb-${stage}`, { stage, env });
const observability = new ObservabilityStack(app, `PtObs-${stage}`, { stage, env, engine });

void [gov, fleet, api, web, observability];

app.synth();
