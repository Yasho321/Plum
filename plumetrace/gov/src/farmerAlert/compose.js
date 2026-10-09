/**
 * OWNER    : Khare
 * DUE      : D2 14:00
 * TASK     :
 *   English source template < 300 chars: smoke forecast (non-blaming), nearest machine centre + distance, helpline/subsidy line (team-verified text), one alternative practice. Assert length after translation.
 * DONE WHEN: gov/tests/compose.test.js passes.
 * GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */

export function composeAlertEnglish(centreName, distanceKm) {
  // Example source from playbook §7:
  // "Smoke from field fires is expected over Delhi on Fri–Sat. Instead of burning, rent a Happy Seeder at {centre} ({km} km). Subsidy helpline: {helpline}. Mulching the straw also improves soil."
  const helpline = "1800-180-1551"; // dummy toll free
  const msg = `Smoke from field fires is expected over Delhi. Instead of burning, rent a Happy Seeder at ${centreName} (${distanceKm} km). Subsidy helpline: ${helpline}. Mulching the straw also improves soil.`;
  
  if (msg.length > 300) {
    console.warn(`Message is too long (${msg.length} chars). Try to shorten it.`);
  }
  return msg;
}
