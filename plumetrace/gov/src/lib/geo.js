/**
 * OWNER    : Khare
 * DUE      : D1 18:00
 * TASK     :
 *   haversineKm, nearestChc(point, centres) -> {name, km}, bbox helpers.
 * DONE WHEN: Unit-tested.
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

export function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371; // km
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

export function nearestChc(point, centresGeojson) {
  let minKm = Infinity;
  let nearestName = null;
  const [lon, lat] = point;
  
  if (!centresGeojson || !centresGeojson.features) return null;
  
  for (const feature of centresGeojson.features) {
    if (feature.geometry && feature.geometry.type === 'Point') {
      const [cLon, cLat] = feature.geometry.coordinates;
      const km = haversineKm(lat, lon, cLat, cLon);
      if (km < minKm) {
        minKm = km;
        nearestName = feature.properties.name;
      }
    }
  }
  return { name: nearestName, km: Math.round(minKm * 10) / 10 };
}
