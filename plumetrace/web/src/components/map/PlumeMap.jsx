/**
 * OWNER    : Tanmay
 * DUE      : D1 18:00
 * TASK     :
 *   MapLibre GL (Amazon Location style URL) + deck.gl MapboxOverlay; composes the layers below; hover tooltips with ranges.
 * DONE WHEN: Mock map renders by D1 evening.
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useEffect, useRef, useState } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { MapboxOverlay } from '@deck.gl/mapbox';
import { useTimeStore } from '../../stores/timeStore';
import { useLatestRun, useForecast, useTrajectories, useFires } from '../../hooks/queries';
import { createFiresLayer, createTripsLayer, createH3Layer, createDistrictsLayer } from './layers';

// A self-contained dark raster style (CARTO dark basemap, no API key) so the map
// always renders locally. In prod, VITE_LOCATION_STYLE_URL points at Amazon Location.
const DEFAULT_STYLE = {
  version: 8,
  glyphs: 'https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf',
  sources: {
    carto: {
      type: 'raster',
      tiles: [
        'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
        'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png',
      ],
      tileSize: 256,
      attribution: '© OpenStreetMap, © CARTO',
    },
  },
  layers: [
    { id: 'bg', type: 'background', paint: { 'background-color': '#0a0c11' } },
    { id: 'carto', type: 'raster', source: 'carto', paint: { 'raster-opacity': 0.85 } },
  ],
};

const DEBUG = import.meta.env.DEV;

export default function PlumeMap({ districtData, fireData }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const { runId, getValidHour } = useTimeStore();
  const validHour = getValidHour();

  const [currentTime, setCurrentTime] = useState(0);
  const [status, setStatus] = useState('init');

  const { data: latestRun } = useLatestRun();
  const currentRunId = runId || latestRun?.run_id;
  const { data: forecastData } = useForecast(currentRunId, validHour);
  const { data: trajectoriesData } = useTrajectories(currentRunId, 'all');
  const { data: firesData } = useFires(currentRunId);

  // --- init map once ---
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    const style = import.meta.env.VITE_LOCATION_STYLE_URL || DEFAULT_STYLE;

    let map;
    try {
      map = new maplibregl.Map({ container: mapContainer.current, style, center: [76.9, 28.6], zoom: 6.4, attributionControl: false });
    } catch (e) {
      console.error('[PlumeMap] map construct failed', e);
      setStatus('map-construct-error: ' + (e?.message || e));
      return;
    }
    mapRef.current = map;

    const overlay = new MapboxOverlay({
      interleaved: false,
      layers: [],
      onError: (err) => { console.error('[PlumeMap] deck error', err); setStatus('deck-error: ' + (err?.message || err)); },
    });
    overlayRef.current = overlay;
    map.addControl(overlay);

    map.on('load', () => { map.resize(); setStatus('ready'); console.log('[PlumeMap] map loaded', mapContainer.current?.clientWidth, '×', mapContainer.current?.clientHeight); });
    map.on('error', (e) => { console.error('[PlumeMap] map error', e?.error || e); setStatus('map-error: ' + (e?.error?.message || 'see console')); });

    const ro = new ResizeObserver(() => map.resize());
    ro.observe(mapContainer.current);

    return () => { ro.disconnect(); map.remove(); mapRef.current = null; overlayRef.current = null; };
  }, []);

  // --- animate the trips "smoke flow" ---
  useEffect(() => {
    let raf;
    const tick = () => { setCurrentTime((t) => (t + 0.15) % 72); raf = requestAnimationFrame(tick); };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  // --- push layers whenever data (or the animation clock) changes ---
  useEffect(() => {
    if (!overlayRef.current) return;
    const layers = [
      createH3Layer(forecastData),
      createDistrictsLayer(districtData),
      createFiresLayer(fireData || firesData),
      createTripsLayer(trajectoriesData, currentTime),
    ].filter(Boolean);
    overlayRef.current.setProps({ layers });
  }, [forecastData, districtData, fireData, firesData, trajectoriesData, currentTime]);

  const cells = forecastData?.features?.length ?? 0;
  const traj = trajectoriesData?.features?.length ?? 0;
  const fires = (fireData || firesData)?.features?.length ?? 0;

  return (
    <div className="relative w-full h-full min-h-[420px]">
      <div ref={mapContainer} className="absolute inset-0" style={{ background: '#0a0c11' }} />
      {DEBUG && (
        <div className="absolute top-4 left-4 z-10 pt-glass rounded-lg px-3 py-2 text-[11px] font-mono leading-relaxed pointer-events-none">
          <div>map: <span className={status === 'ready' ? 'text-success' : 'text-destructive'}>{status}</span></div>
          <div>run: {currentRunId || '—'} · vh: {validHour ? validHour.slice(11) : '—'}</div>
          <div>cells: {cells} · traj: {traj} · fires: {fires}</div>
        </div>
      )}
    </div>
  );
}
