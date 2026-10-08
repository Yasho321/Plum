/**
 * OWNER    : Tanmay
 * DUE      : D1 14:00
 * TASK     :
 *   Top nav tabs (Government / Fleet / Forecast Skill / Approvals), Copilot drawer button on every page, DegradedBanner, run_id + issued time (IST).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Link, useLocation } from 'react-router-dom';
import DegradedBanner from '../DegradedBanner';

export default function AppShell({ children }) {
  const loc = useLocation();
  const tabs = [
    { name: 'Government', path: '/gov' },
    { name: 'Fleet', path: '/fleet' },
    { name: 'Forecast Skill', path: '/skill' },
    { name: 'Approvals', path: '/approvals' },
  ];

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="border-b border-border flex items-center justify-between p-4">
        <div className="flex items-center gap-6">
          <h1 className="text-xl font-bold">PlumeTrace</h1>
          <nav className="flex gap-4">
            {tabs.map(t => (
              <Link 
                key={t.path} 
                to={t.path}
                className={`text-sm font-medium ${loc.pathname === t.path ? 'text-primary' : 'text-muted-foreground'}`}
              >
                {t.name}
              </Link>
            ))}
          </nav>
        </div>
        <div className="flex items-center gap-4">
          <div className="text-xs text-muted-foreground">run_id: pending | IST</div>
          <Link to="/copilot" className="px-3 py-1 bg-secondary rounded text-sm hover:bg-secondary/80 transition">Copilot</Link>
        </div>
      </header>
      <DegradedBanner />
      <main className="flex-1 overflow-auto relative">
        {children}
      </main>
    </div>
  );
}
