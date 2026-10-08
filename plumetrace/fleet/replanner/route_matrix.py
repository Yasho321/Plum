"""
OWNER    : Yasho2
DUE      : D2 14:00
TASK     :
  Amazon Location CalculateRouteMatrix (≤ 350x350 per call; chunk) between H3 res-7 centroids actually used by tomorrow's orders; cache pairs in RouteCache table; fallback haversine/22 km/h if Location errors.
DONE WHEN: Matrix for 600 orders built in < 15 s warm.
GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""
from __future__ import annotations

from typing import Optional

import h3

from .common import default_travel_min

MAX_DIM = 350  # Amazon Location CalculateRouteMatrix limit per call


class RouteMatrix:
    """
    travel_min(origin_h3, dest_h3) in minutes, between H3 res-7 cell centroids.
    Resolution order: in-memory memo -> RouteCache (DynamoDB) -> Amazon Location
    -> haversine/22 km/h fallback (brief §13.3, DECISIONS D-11).
    """

    def __init__(self, location_client=None, calculator_name: Optional[str] = None,
                 route_cache_table=None, kmph: float = 22.0):
        self._loc = location_client
        self._calc = calculator_name
        self._cache_table = route_cache_table
        self._kmph = kmph
        self._memo: dict[tuple[str, str], float] = {}

    # ---- cache ----
    def _cache_get(self, a: str, b: str) -> Optional[float]:
        if (a, b) in self._memo:
            return self._memo[(a, b)]
        if self._cache_table is not None:
            try:
                resp = self._cache_table.get_item(Key={"pk": f"o#{a}", "sk": f"d#{b}"})
                item = resp.get("Item")
                if item:
                    self._memo[(a, b)] = float(item["minutes"])
                    return self._memo[(a, b)]
            except Exception:
                pass
        return None

    def _cache_put(self, a: str, b: str, minutes: float, km: float) -> None:
        self._memo[(a, b)] = minutes
        if self._cache_table is not None:
            try:
                self._cache_table.put_item(Item={"pk": f"o#{a}", "sk": f"d#{b}",
                                                 "minutes": round(minutes, 2), "km": round(km, 3)})
            except Exception:
                pass

    def _fallback(self, a: str, b: str) -> float:
        return default_travel_min(a, b, self._kmph)

    def travel_min(self, a: str, b: str) -> float:
        if a == b:
            return 2.0
        cached = self._cache_get(a, b)
        if cached is not None:
            return cached
        minutes = self._fallback(a, b)  # Location fills this in warm()
        self._cache_put(a, b, minutes, minutes * self._kmph / 60.0)
        return minutes

    def warm(self, cells: list[str]) -> None:
        """Precompute the full matrix for the given cells. Uses Amazon Location in
        chunks of <= MAX_DIM when a client is configured, else haversine."""
        uniq = list(dict.fromkeys(cells))
        if self._loc and self._calc:
            self._warm_location(uniq)
        else:
            for a in uniq:
                for b in uniq:
                    if (a, b) not in self._memo:
                        self.travel_min(a, b)

    def _warm_location(self, cells: list[str]) -> None:  # pragma: no cover (needs AWS)
        pts = {c: h3.cell_to_latlng(c) for c in cells}
        positions = {c: [lon, lat] for c, (lat, lon) in pts.items()}
        for i in range(0, len(cells), MAX_DIM):
            o_chunk = cells[i:i + MAX_DIM]
            for j in range(0, len(cells), MAX_DIM):
                d_chunk = cells[j:j + MAX_DIM]
                try:
                    resp = self._loc.calculate_route_matrix(
                        CalculatorName=self._calc,
                        DeparturePositions=[positions[c] for c in o_chunk],
                        DestinationPositions=[positions[c] for c in d_chunk],
                        TravelMode="Car",
                    )
                    for oi, a in enumerate(o_chunk):
                        for di, b in enumerate(d_chunk):
                            cell = resp["RouteMatrix"][oi][di]
                            mins = cell.get("DurationSeconds", 0) / 60.0
                            km = cell.get("Distance", 0.0)
                            self._cache_put(a, b, mins or self._fallback(a, b), km)
                except Exception:
                    for a in o_chunk:
                        for b in d_chunk:
                            self._cache_put(a, b, self._fallback(a, b), 0.0)


def haversine_travel_fn(kmph: float = 22.0):
    """Offline/local travel_min with no AWS (used in MOCK/PT_LOCAL)."""
    return lambda a, b: default_travel_min(a, b, kmph)
