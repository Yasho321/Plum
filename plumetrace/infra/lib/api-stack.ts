/**
 * OWNER    : Tejas
 * DUE      : D1 18:00
 * TASK     :
 *   Cognito user pool + Hosted UI domain + groups gov/fleet/admin + app client (callback = Amplify URL + localhost:5173). DockerImageFunction from api/Dockerfile (Bun + AWS Lambda Web Adapter, response streaming enabled for /agent/chat). HTTP API with JWT authorizer -> Lambda proxy. Pass env: table names, bucket, bus, guardrail id, lambda ARNs of Khare/Yasho2 tool Lambdas.
 * DONE WHEN: Tanmay can hit https://<api>/runs/latest with a Cognito token (MOCK_MODE=1 on D1).
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
 */
