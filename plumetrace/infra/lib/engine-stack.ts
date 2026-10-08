/**
 * OWNER    : Tejas
 * DUE      : D2 14:00
 * TASK     :
 *   ECR image from engine/Dockerfile (DockerImageFunction, one function per handler in engine/plumetrace_engine/handlers.py, 3–10 GB memory, 15 min timeout).
 *   Step Functions `EngineRun` exactly as §9 (Parallel ingest, Map over f000..f072 with MaxConcurrency 20, retries 2x exponential, FIRMS Catch -> add "firms" to degraded[]).
 *   EventBridge Scheduler 04/10/16/22 UTC, custom bus, hourly Verify schedule, rules for forecast.published -> gov autoDraft + fleet dose handler.
 * DONE WHEN: AC1: a manual execution with {} finishes green on real data.
 * GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
 */
