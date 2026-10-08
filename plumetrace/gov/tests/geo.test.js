import assert from 'assert';
import test from 'node:test';
import { haversineKm, nearestChc } from '../src/lib/geo.js';

test('haversineKm calculates distance correctly', () => {
  const lat1 = 28.7041, lon1 = 77.1025; // Rohini
  const lat2 = 28.5823, lon2 = 77.0500; // Dwarka
  const dist = haversineKm(lat1, lon1, lat2, lon2);
  assert.ok(dist > 10 && dist < 20, 'Distance should be ~14km');
});

test('nearestChc finds the nearest CHC', () => {
  const geojson = {
    features: [
      { geometry: { type: 'Point', coordinates: [77.1025, 28.7041] }, properties: { name: 'Rohini CHC' } },
      { geometry: { type: 'Point', coordinates: [77.0500, 28.5823] }, properties: { name: 'Dwarka CHC' } }
    ]
  };
  const nearest = nearestChc([77.1000, 28.7000], geojson);
  assert.strictEqual(nearest.name, 'Rohini CHC');
});
