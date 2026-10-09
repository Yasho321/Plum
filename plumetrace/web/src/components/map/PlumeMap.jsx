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
import { useLatestRun, useForecast, useTrajectories } from '../../hooks/queries';
import { createFiresLayer, createTripsLayer, createH3Layer, createDistrictsLayer } from './layers';

const DEFAULT_STYLE = 'https://demotiles.maplibre.org/style.json';

export default function PlumeMap({ districtData, fireData }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const overlayRef = useRef(null);
  const { runId, getValidHour } = useTimeStore();
  const validHour = getValidHour();
  
  const [currentTime, setCurrentTime] = useState(0);
  
  const { data: latestRun } = useLatestRun();
  const currentRunId = runId || latestRun?.run_id;
  const { data: forecastData } = useForecast(currentRunId, validHour);
  const { data: trajectoriesData } = useTrajectories(currentRunId, 'all');

  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;
    
    const styleUrl = import.meta.env.VITE_LOCATION_STYLE_URL || DEFAULT_STYLE;
    
    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: styleUrl,
      center: [76.9, 28.6],
      zoom: 7
    });

    overlayRef.current = new MapboxOverlay({
      interleaved: true,
      layers: []
    });
    
    mapRef.current.addControl(overlayRef.current);

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    let animation;
    const animate = () => {
      // currentTime is in HOURS to match createTripsLayer's getTimestamps (0..72).
      setCurrentTime(t => (t + 0.1) % 72);
      animation = requestAnimationFrame(animate);
    };
    animate();
    return () => cancelAnimationFrame(animation);
  }, []);

  useEffect(() => {
    if (!overlayRef.current) return;
    
    const layers = [
      createH3Layer(forecastData),
      createDistrictsLayer(districtData),
      createFiresLayer(fireData),
      createTripsLayer(trajectoriesData, currentTime)
    ].filter(Boolean);

    overlayRef.current.setProps({ layers });
  }, [forecastData, districtData, fireData, trajectoriesData, currentTime]);

  return (
    <div className="relative w-full h-full min-h-[400px]">
      <div ref={mapContainer} className="absolute inset-0" />
    </div>
  );
}
