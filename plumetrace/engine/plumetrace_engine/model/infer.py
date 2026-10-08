"""
OWNER    : Yasho1
DUE      : D2 14:00
TASK     :
  Load models/lightgbm/<version>/{q10,q50,q90}.txt + metadata.json once per cold start (module-level cache). predict(df) -> p10/p50/p90 (expm1, sort to fix crossing). Fallback model 'persistence-v0' if no artefact exists so the pipeline never blocks on training.
DONE WHEN: StationForecast items written for every station x lead.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
