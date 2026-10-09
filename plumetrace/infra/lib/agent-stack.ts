/**
 * OWNER    : Yasho2
 * DUE      : D1 18:00
 * TASK     :
 *   RETIRED for Option A (direct Anthropic API instead of Bedrock) — see
 *   docs/DECISIONS.md D-ANTHROPIC. The Bedrock Guardrail + bedrock:InvokeModel
 *   IAM that used to live here are gone:
 *     - the guardrail's deny topics (individual-farmer PII, certainty-beyond-model,
 *       blaming language) are now a keyword filter in api/src/agent/guard.js;
 *     - the Copilot no longer calls Bedrock, so no bedrock IAM is needed. The API
 *       Lambda instead reads the Anthropic key from Secrets Manager (grant wired
 *       in api-stack.ts).
 *   This stack is no longer instantiated in bin/plumetrace.ts. The no-op class is
 *   kept so any stale import type-checks; delete once nothing references it.
 * DONE WHEN: Copilot runs without any Bedrock resource.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export interface AgentStackProps extends StackProps {
  stage: string;
}

/** Intentionally empty: Option A needs no Bedrock guardrail or IAM. */
export class AgentStack extends Stack {
  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);
    void props.stage;
  }
}

export default AgentStack;
