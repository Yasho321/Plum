/**
 * OWNER    : Yasho2
 * DUE      : D1 12:00 (FREEZE)
 * TASK     :
 *   Zod schemas for every DynamoDB item in brief §8.1: ForecastItem, StationForecastItem, AttributionItem,
 *   ActionItem (type/status enums + status transition map draft→approved→executed|rejected|failed),
 *   RiderItem, RiderHealthItem, ShiftItem, RouteCacheItem (added, see DECISIONS D-11).
 *   Also export key builders: forecastPk(cell), forecastSk(runId, validHour), stationPk(id), actionPk(uuid) ... so nobody hand-writes keys.
 * DONE WHEN: All mocks in contracts/mocks validate against these schemas (scripts/validate-mocks.js passes).
 * GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
 */
