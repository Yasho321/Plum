/**
 * OWNER    : Yasho2
 * DUE      : D1 18:00
 * TASK     :
 *   Bedrock Guardrail (deny topics: personal data of individual farmers; contextual grounding / 'no certainty beyond tool output'), guardrail version output, IAM policy bedrock:InvokeModel* + bedrock:ApplyGuardrail for the API role. Model id passed as context (VERIFY the Claude model/inference-profile id enabled in us-east-1).
 * DONE WHEN: API Lambda can call ConverseStream with guardrailConfig.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 *
 * Standalone by design: it does not import Tejas's config.ts (still a stub).
 * It exposes `bedrockAccessPolicy`, `guardrailId` and `guardrailVersion` so the
 * ApiStack can attach the policy to the API Lambda role and pass the guardrail
 * id/version as env (GUARDRAIL_ID / GUARDRAIL_VERSION). See HANDOFFS #7.
 */
import { Stack, StackProps, CfnOutput } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { CfnGuardrail, CfnGuardrailVersion } from 'aws-cdk-lib/aws-bedrock';
import { ManagedPolicy, PolicyStatement, Effect } from 'aws-cdk-lib/aws-iam';

export interface AgentStackProps extends StackProps {
  /** dev | demo */
  stage: string;
  /** The Claude model/inference-profile id enabled in us-east-1 (VERIFY in console). */
  modelId: string;
}

export class AgentStack extends Stack {
  public readonly guardrailId: string;
  public readonly guardrailVersion: string;
  public readonly bedrockAccessPolicy: ManagedPolicy;

  constructor(scope: Construct, id: string, props: AgentStackProps) {
    super(scope, id, props);
    const { stage } = props;
    const prefix = `pt-${stage}`;

    // --- Bedrock Guardrail (brief §11 / §15) ---
    const guardrail = new CfnGuardrail(this, 'Guardrail', {
      name: `${prefix}-plumetrace-copilot`,
      description: 'PlumeTrace Copilot: protect individual farmers; no certainty beyond tool output; supportive tone.',
      blockedInputMessaging: 'I can only help with PlumeTrace air-quality decisions and drafts for approval.',
      blockedOutputsMessaging:
        'I can only report model estimates with their uncertainty range, and I never share personal data about individuals.',
      // Deny topics
      topicPolicyConfig: {
        topicsConfig: [
          {
            name: 'IndividualFarmerData',
            definition:
              'Personal, identifying or contact information about specific, individual farmers or landowners (names, phone numbers, plot/khasra ids, addresses).',
            type: 'DENY',
            examples: [
              'Who owns the field that is burning in Sangrur?',
              'Give me the phone number of the farmer at this location.',
              'Name the farmers responsible for these fires.',
            ],
          },
          {
            name: 'CertaintyBeyondModel',
            definition:
              'Claims of certainty about pollution source attribution that go beyond the model output and its p10-p90 uncertainty range.',
            type: 'DENY',
            examples: [
              'Prove that stubble burning definitely caused today\'s smog.',
              'Tell me the exact, certain percentage with no uncertainty.',
            ],
          },
        ],
      },
      // Block overtly blaming / abusive language toward farmers (supportive tone, §2.4)
      wordPolicyConfig: {
        wordsConfig: [{ text: 'criminal farmers' }, { text: 'culprit farmers' }, { text: 'arrest the farmers' }],
      },
      // Contextual grounding: answers must be grounded in tool results and relevant.
      contextualGroundingPolicyConfig: {
        filtersConfig: [
          { type: 'GROUNDING', threshold: 0.6 },
          { type: 'RELEVANCE', threshold: 0.5 },
        ],
      },
    });

    // A pinned, immutable version to reference at runtime.
    const version = new CfnGuardrailVersion(this, 'GuardrailVersion', {
      guardrailIdentifier: guardrail.attrGuardrailId,
      description: 'Initial PlumeTrace guardrail version',
    });

    this.guardrailId = guardrail.attrGuardrailId;
    this.guardrailVersion = version.attrVersion;

    // --- IAM: let the API role call Bedrock + apply the guardrail ---
    this.bedrockAccessPolicy = new ManagedPolicy(this, 'BedrockAccessPolicy', {
      managedPolicyName: `${prefix}-bedrock-access`,
      statements: [
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: [
            'bedrock:InvokeModel',
            'bedrock:InvokeModelWithResponseStream',
            'bedrock:Converse',
            'bedrock:ConverseStream',
          ],
          // Foundation models + inference profiles (model id is often us.anthropic...).
          resources: [
            `arn:aws:bedrock:${this.region}::foundation-model/*`,
            `arn:aws:bedrock:${this.region}:${this.account}:inference-profile/*`,
            `arn:aws:bedrock:*::foundation-model/*`,
          ],
        }),
        new PolicyStatement({
          effect: Effect.ALLOW,
          actions: ['bedrock:ApplyGuardrail'],
          resources: [`arn:aws:bedrock:${this.region}:${this.account}:guardrail/*`],
        }),
      ],
    });

    // --- Outputs for the ApiStack / api env ---
    new CfnOutput(this, 'GuardrailId', { value: this.guardrailId, exportName: `${prefix}-guardrail-id` });
    new CfnOutput(this, 'GuardrailVersion', { value: this.guardrailVersion, exportName: `${prefix}-guardrail-version` });
    new CfnOutput(this, 'BedrockModelId', { value: props.modelId, exportName: `${prefix}-bedrock-model-id` });
    new CfnOutput(this, 'BedrockAccessPolicyArn', {
      value: this.bedrockAccessPolicy.managedPolicyArn,
      exportName: `${prefix}-bedrock-access-policy-arn`,
    });
  }
}

export default AgentStack;
