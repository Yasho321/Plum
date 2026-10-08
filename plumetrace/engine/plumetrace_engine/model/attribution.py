"""
OWNER    : Yasho1
DUE      : D2 15:00
TASK     :
  §10.5 counterfactual: re-predict with fire_load=fire_load_p90=0 for each quantile model; fire_share=clip((y_full-y_nofire)/y_full,0,1); district share_d = fire_share * FL_d / ΣFL_d. Aggregate to Attribution table per date (share p10/p50/p90, fire_count, frp_sum_mw, receptor_stations).
DONE WHEN: tests/engine/test_fire_share.py passes; shares within [0,1].
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
