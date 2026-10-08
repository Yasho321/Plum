/**
 * OWNER    : Yasho2
 * DUE      : D1 18:00
 * TASK     :
 *   Tiny shared helper used by api/ and gov/: createDraft(type, payload, runId) -> ActionItem, getAction(id), transition(id, from, to, extra) using a DynamoDB ConditionExpression on status (prevents double-approve / double-execute).
 * DONE WHEN: Unit test: approving an already-approved action throws ConditionalCheckFailed -> 409.
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
 */
