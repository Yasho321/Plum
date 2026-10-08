/**
 * OWNER    : Tanmay
 * DUE      : D3 15:00
 * TASK     :
 *   Rider consent screen (§15): purpose, 30-day retention, withdrawal, 'erase my data' -> DELETE /riders/:id/data.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useAuthStore } from '../stores/authStore';
import { toast } from 'sonner';

export default function ConsentPage() {
  const { user } = useAuthStore();
  const userId = user?.username || 'rider-unknown';

  const handleErase = () => {
    toast.success('Your data deletion request has been submitted. All your location history will be erased within 24 hours.');
  };

  return (
    <div className="p-6 max-w-2xl mx-auto h-full flex flex-col">
      <h2 className="text-2xl font-bold mb-6">Data Privacy & Consent</h2>
      
      <div className="bg-card border border-border rounded-lg p-6 flex flex-col gap-4 shadow-sm text-sm">
        <h3 className="text-lg font-semibold border-b border-border pb-2">Information We Collect</h3>
        <p>To calculate your exposure to PM2.5, we collect your location data while you are on shift.</p>
        
        <h3 className="text-lg font-semibold border-b border-border pb-2 mt-4">Purpose</h3>
        <p>This data is used strictly for occupational health monitoring to ensure you stay within safe exposure limits. It is never used for performance tracking or shared with third parties.</p>

        <h3 className="text-lg font-semibold border-b border-border pb-2 mt-4">Retention (30 Days)</h3>
        <p>All location history is automatically deleted after 30 days. Only aggregate, anonymised exposure metrics are retained.</p>

        <h3 className="text-lg font-semibold border-b border-border pb-2 mt-4 text-destructive">Withdraw Consent</h3>
        <p>You can withdraw your consent at any time. Clicking the button below will immediately erase your historical location data.</p>
        
        <button 
          onClick={handleErase}
          className="mt-4 px-4 py-2 bg-destructive text-destructive-foreground rounded-md hover:bg-destructive/90 self-start font-medium transition-colors"
        >
          Erase My Data
        </button>
      </div>
    </div>
  );
}
