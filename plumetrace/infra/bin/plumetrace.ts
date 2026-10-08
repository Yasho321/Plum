/**
 * OWNER    : Tejas
 * DUE      : D1 13:00
 * TASK     :
 *   CDK app entry. Read context `stage` (dev | demo). Instantiate stacks in dependency order: Data -> Engine -> Gov -> Fleet -> Agent -> Api -> Web -> Observability. Prefix every resource name with `pt-${stage}`. Region us-east-1.
 * DONE WHEN: `npx cdk synth -c stage=dev` succeeds with all stacks.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
 */
