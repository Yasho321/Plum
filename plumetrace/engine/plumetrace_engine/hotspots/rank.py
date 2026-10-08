"""
OWNER    : Yasho1
DUE      : D2 17:00
TASK     :
  §12.1: priority = share_p50 * (1 + trend_7d) -> top 5 districts. DBSCAN (haversine, eps 2 km, min_samples 3) on last-48 h fires -> village clusters {cluster_id, district, centroid [lon,lat], h3_res7, fire_count, frp_sum}. Both go into summary.json (hotspot_districts, hotspot_villages).
DONE WHEN: Khare's farmerAlert reads hotspot_villages from summary.json.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : TODO   (update to WIP / DONE in this header when you work on it)
"""
