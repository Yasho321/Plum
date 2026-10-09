/**
 * OWNER    : Tanmay
 * DUE      : D1 20:00
 * TASK     :
 *   Layer factories: firesLayer (ScatterplotLayer size=FRP, colour=age), tripsLayer (TripsLayer animated by currentTime — the 'smoke flow' moment), h3Layer (H3HexagonLayer p50 colour, p10–p90 width as opacity toggle, null cells hatched/grey), districtsLayer (GeoJsonLayer by fire share).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { ScatterplotLayer, GeoJsonLayer } from '@deck.gl/layers';
import { TripsLayer } from '@deck.gl/geo-layers';
import { H3HexagonLayer } from '@deck.gl/geo-layers';
import { getAqiColor } from '../../lib/aqi';

export function createFiresLayer(data) {
  if (!data || !data.features) return null;
  return new ScatterplotLayer({
    id: 'fires-layer',
    data: data.features,
    getPosition: d => d.geometry.coordinates,
    getRadius: d => Math.sqrt(d.properties?.frp || 0) * 500,
    getFillColor: [255, 100, 0, 200],
    pickable: true
  });
}

export function createTripsLayer(data, currentTime) {
  if (!data || !data.features) return null;
  return new TripsLayer({
    id: 'trips-layer',
    data: data.features,
    getPath: d => d.geometry.coordinates,
    // deck.gl needs NUMERIC timestamps. The contract provides ISO strings
    // (TrajectoryFeature.properties.timestamps), so convert to hours relative to
    // the path's earliest point — same unit as currentTime (leadH, 0..72).
    getTimestamps: d => {
      const ts = d.properties?.timestamps;
      if (Array.isArray(ts) && ts.length) {
        const nums = ts.map(t => (typeof t === 'number' ? t : Date.parse(t) / 3600000));
        const base = Math.min(...nums);
        return nums.map(n => n - base);
      }
      return d.geometry.coordinates.map((_, i) => i);
    },
    getColor: [255, 200, 100],
    opacity: 0.8,
    widthMinPixels: 2,
    trailLength: 12,            // hours
    currentTime: currentTime
  });
}

export function createH3Layer(data, uncertaintyToggle = false) {
  if (!data || !data.features) return null;
  return new H3HexagonLayer({
    id: 'h3-layer',
    data: data.features,
    getHexagon: d => d.properties?.h3 || d.h3,
    getFillColor: d => {
      const pm25 = d.properties?.pm25 ?? d.pm25;
      if (pm25 == null) return [128, 128, 128, 100];
      
      const hex = getAqiColor(pm25);
      const r = parseInt(hex.slice(1, 3), 16);
      const g = parseInt(hex.slice(3, 5), 16);
      const b = parseInt(hex.slice(5, 7), 16);
      
      let alpha = 200;
      if (uncertaintyToggle) {
        const p10 = d.properties?.pm25_p10 ?? d.pm25_p10 ?? 0;
        const p90 = d.properties?.pm25_p90 ?? d.pm25_p90 ?? 0;
        const width = p90 - p10;
        alpha = Math.max(50, 255 - width * 2); 
      }
      return [r, g, b, alpha];
    },
    pickable: true,
    extruded: false
  });
}

export function createDistrictsLayer(data) {
  if (!data || !data.features) return null;
  return new GeoJsonLayer({
    id: 'districts-layer',
    data,
    getFillColor: d => {
      const share = d.properties?.share_p50 || 0;
      return [255, 0, 0, share * 255];
    },
    getLineColor: [100, 100, 100, 150],
    lineWidthMinPixels: 1,
    pickable: true
  });
}
