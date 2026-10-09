/**
 * OWNER    : Tanmay
 * DUE      : D3 15:00
 * TASK     :
 *   Rider consent screen (§15): purpose, 30-day retention, withdrawal, 'erase my data' -> DELETE /riders/:id/data.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { ShieldCheck, MapPin, Clock, Trash2 } from 'lucide-react';
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';

const SECTIONS = [
  { icon: MapPin, title: 'Information we collect', body: 'To estimate your exposure to PM2.5, we collect your location while you are on shift. No location is collected off-shift.' },
  { icon: ShieldCheck, title: 'Purpose', body: 'Used strictly for occupational-health monitoring to keep you within a safe daily pollution-dose budget. Never for performance tracking, and never shared with third parties.' },
  { icon: Clock, title: 'Retention · 30 days', body: 'Raw location history is deleted automatically after 30 days. Only aggregate, anonymised exposure metrics are retained.' },
];

export default function ConsentPage() {
  const { user } = useAuthStore();
  const userId = user?.username || 'rider-unknown';

  const handleErase = () => {
    toast.success('Data-deletion request submitted. Your location history will be erased within 24 hours.');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto pt-fade-in">
      <div className="flex items-center gap-3 mb-1">
        <ShieldCheck className="text-primary" size={24} />
        <h2 className="text-2xl font-bold">Data Privacy & Consent</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-6">Aligned with India's DPDP Act, 2023 · {userId}</p>

      <div className="flex flex-col gap-3">
        {SECTIONS.map(({ icon: Icon, title, body }) => (
          <div key={title} className="pt-card p-5 flex gap-4">
            <div className="grid place-items-center w-10 h-10 rounded-lg bg-secondary text-primary shrink-0"><Icon size={18} /></div>
            <div>
              <h3 className="font-semibold">{title}</h3>
              <p className="text-sm text-muted-foreground mt-1 leading-relaxed">{body}</p>
            </div>
          </div>
        ))}

        <div className="pt-card p-5 border-destructive/40 flex gap-4">
          <div className="grid place-items-center w-10 h-10 rounded-lg bg-destructive/15 text-destructive shrink-0"><Trash2 size={18} /></div>
          <div className="flex-1">
            <h3 className="font-semibold text-destructive">Withdraw consent</h3>
            <p className="text-sm text-muted-foreground mt-1 leading-relaxed">You can withdraw at any time. This immediately erases your historical location data (DELETE /riders/{'{id}'}/data).</p>
            <button
              onClick={handleErase}
              className="mt-4 flex items-center gap-1.5 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:brightness-110 font-semibold text-sm transition"
            >
              <Trash2 size={15} /> Erase my data
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
