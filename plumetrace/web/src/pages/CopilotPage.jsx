/**
 * OWNER    : Tanmay
 * DUE      : D2 14:00
 * TASK     :
 *   Full-screen CopilotPanel.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import CopilotPanel from '../components/copilot/CopilotPanel';

export default function CopilotPage() {
  return (
    <div className="h-full w-full max-w-4xl mx-auto flex flex-col py-6">
      <h2 className="text-2xl font-bold mb-4 px-4">Copilot</h2>
      <div className="flex-1 border border-border rounded-lg overflow-hidden shadow-sm">
        <CopilotPanel />
      </div>
    </div>
  );
}
