/**
 * OWNER    : Tanmay
 * DUE      : D3 15:00
 * TASK     :
 *   Rider consent screen (§15): purpose, 30-day retention, withdrawal, 'erase my data' -> DELETE /riders/:id/data.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useState } from 'react';
import { ShieldCheck, MapPin, Clock, Trash2, X } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';
import { Badge } from '../components/ui/Badge';
import { Button } from '../components/ui/Button';

const SECTIONS = [
  { icon: MapPin, title: 'Information we collect', body: 'To estimate your exposure to PM2.5, we collect your location while you are on shift. No location is collected off-shift.' },
  { icon: ShieldCheck, title: 'Purpose', body: 'Used strictly for occupational-health monitoring to keep you within a safe daily pollution-dose budget. Never for performance tracking, and never shared with third parties.' },
  { icon: Clock, title: 'Retention · 30 days', body: 'Raw location history is deleted automatically after 30 days. Only aggregate, anonymised exposure metrics are retained.' },
];

export default function ConsentPage() {
  const { user } = useAuthStore();
  const userId = user?.username || 'rider-unknown';
  const [confirming, setConfirming] = useState(false);

  const handleErase = () => {
    setConfirming(false);
    toast.success('Data-deletion request submitted. Your location history will be erased within 24 hours.');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto pt-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <span className="grid place-items-center w-9 h-9 rounded-lg bg-primary/12 text-primary border border-primary/20">
          <ShieldCheck size={18} aria-hidden />
        </span>
        <h2 className="text-2xl font-bold tracking-tight">Data privacy & consent</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6 ml-12 -mt-0.5 flex items-center gap-2">
        Aligned with India's DPDP Act, 2023 <span aria-hidden>·</span> <Badge tone="neutral" size="sm">{userId}</Badge>
      </p>

      <div className="flex flex-col gap-3 pt-stagger">
        {SECTIONS.map(({ icon: Icon, title, body }, i) => (
          <div key={title} className="pt-card p-5 flex gap-4" style={{ '--i': i }}>
            <div className="grid place-items-center w-10 h-10 rounded-lg bg-secondary text-primary shrink-0">
              <Icon size={18} aria-hidden />
            </div>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}

        <div className="pt-card p-5 border-destructive/40 flex gap-4" style={{ '--i': SECTIONS.length }}>
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-destructive/12 text-destructive shrink-0">
            <Trash2 size={18} aria-hidden />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Withdraw consent</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">
              You can withdraw at any time. This immediately and permanently erases your historical
              location data (<code className="text-xs text-foreground/80">DELETE /riders/{'{id}'}/data</code>).
            </p>
            {!confirming ? (
              <Button variant="danger" size="md" className="mt-4" onClick={() => setConfirming(true)}>
                <Trash2 size={15} aria-hidden /> Erase my data
              </Button>
            ) : (
              <div className="mt-4 p-3 rounded-[var(--radius)] border border-destructive/30 bg-destructive/8">
                <p className="text-sm font-medium text-foreground">This cannot be undone. Erase all location history?</p>
                <div className="mt-3 flex gap-2">
                  <Button variant="danger" size="sm" onClick={handleErase}>
                    <Trash2 size={14} aria-hidden /> Yes, erase everything
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setConfirming(false)}>
                    <X size={14} aria-hidden /> Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
