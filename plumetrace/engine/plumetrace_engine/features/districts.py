"""
OWNER    : Yasho1
DUE      : D1 17:00
TASK     :
  Load static/districts.geojson (from Khare), shapely STRtree point-in-polygon -> district name for each fire (+ 'Other'). Cache per process.
DONE WHEN: Every Punjab fire gets a district.
GUIDE    : docs/team/YASHO1.md  |  brief: docs/PROJECT_BRIEF.md
STATUS   : DONE
"""

from __future__ import annotations

import json
from functools import lru_cache
from pathlib import Path
from typing import Union

import numpy as np
from shapely.geometry import shape
from shapely.strtree import STRtree

OTHER = "Other"  # label for fires outside every district polygon


class DistrictLookup:
    """Point-in-polygon lookup from (lat, lon) to district name.

    Built from a GeoJSON FeatureCollection whose features each carry a district
    name in one of ``name_keys`` (geoBoundaries uses ``shapeName``; DataMeet uses
    ``DISTRICT``/``district``). Uses a shapely STRtree for O(log n) candidate
    lookup, then a precise ``contains`` check.
    """

    NAME_KEYS = ("district", "DISTRICT", "shapeName", "NAME_2", "dtname", "name")

    def __init__(self, geojson: dict):
        feats = geojson.get("features", [])
        self.geoms = []
        self.names = []
        for f in feats:
            geom = f.get("geometry")
            if not geom:
                continue
            self.geoms.append(shape(geom))
            self.names.append(self._name_of(f.get("properties", {})))
        if not self.geoms:
            raise ValueError("districts GeoJSON has no usable polygon features")
        self.names = np.array(self.names, dtype=object)
        self.tree = STRtree(self.geoms)

    @classmethod
    def _name_of(cls, props: dict) -> str:
        for k in cls.NAME_KEYS:
            if props.get(k):
                return str(props[k])
        return OTHER

    def classify(self, lat, lon) -> np.ndarray:
        """Return an array of district names for points (lat[i], lon[i]).

        shapely geometry is (x=lon, y=lat); we build points in that order while
        the public API stays (lat, lon) per the repo convention."""
        from shapely import points as _points  # shapely>=2 vectorised constructor

        lat = np.atleast_1d(np.asarray(lat, dtype="float64"))
        lon = np.atleast_1d(np.asarray(lon, dtype="float64"))
        pts = _points(lon, lat)
        out = np.full(lat.shape, OTHER, dtype=object)
        # shapely 2.x STRtree.query applies the predicate as input.predicate(tree),
        # so point-in-polygon is 'intersects' (point intersects the polygon). The
        # return is two rows: (input_point_idx, tree_geom_idx).
        input_idx, tree_idx = self.tree.query(pts, predicate="intersects")
        # If a point falls in multiple polygons (shared borders), first wins.
        seen = np.zeros(lat.shape, dtype=bool)
        for ii, ti in zip(input_idx, tree_idx):
            if not seen[ii]:
                out[ii] = self.names[ti]
                seen[ii] = True
        return out


def load_districts(source: Union[dict, str, Path]) -> DistrictLookup:
    """Build a DistrictLookup from a GeoJSON dict, a path, or a JSON string."""
    if isinstance(source, DistrictLookup):
        return source
    if isinstance(source, dict):
        return DistrictLookup(source)
    text = None
    p = Path(source) if not isinstance(source, Path) else source
    if isinstance(source, str) and source.lstrip().startswith("{"):
        text = source
    elif p.exists():
        text = p.read_text(encoding="utf-8")
    else:
        raise FileNotFoundError(f"districts GeoJSON not found: {source}")
    return DistrictLookup(json.loads(text))


@lru_cache(maxsize=4)
def cached_districts(path: str) -> DistrictLookup:
    """Process-cached loader keyed by path (the handler passes the S3-fetched
    local path). Kept separate so tests can pass dicts without caching."""
    return load_districts(path)
