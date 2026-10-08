/**
 * OWNER    : Tanmay
 * DUE      : D2 12:00
 * TASK     :
 *   % of budget bar; >100 % red, before/after variant.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
export default function DoseBar({ current = 0, proposed, limit = 100 }) {
  const currentPct = Math.min((current / limit) * 100, 100);
  const proposedPct = proposed !== undefined ? Math.min((proposed / limit) * 100, 100) : null;
  const currentOver = current > limit;
  const proposedOver = proposed > limit;

  return (
    <div className="w-full h-2 bg-secondary rounded-full overflow-hidden flex relative">
      <div 
        className={`h-full ${currentOver ? 'bg-destructive' : 'bg-primary'}`} 
        style={{ width: `${currentPct}%` }}
      />
      {proposedPct !== null && proposedPct !== currentPct && (
        <div 
          className={`h-full absolute top-0 left-0 border-r-2 border-primary-foreground ${proposedOver ? 'bg-destructive/50' : 'bg-primary/50'}`}
          style={{ width: `${proposedPct}%` }}
        />
      )}
    </div>
  );
}
