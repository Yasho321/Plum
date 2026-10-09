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
import { Wind, Sparkles } from 'lucide-react';
import DegradedBanner from '../DegradedBanner';
import { useLatestRun } from '../../hooks/queries';
import { formatIst } from '../../lib/format';

export default function AppShell({ children }) {
  const loc = useLocation();
  const { data: run } = useLatestRun();
  const tabs = [
    { name: 'Government', path: '/gov' },
    { name: 'Fleet', path: '/fleet' },
    { name: 'Forecast Skill', path: '/skill' },
    { name: 'Approvals', path: '/approvals' },
  ];

  return (
    <div className="flex flex-col h-screen text-foreground">
      <header className="pt-glass sticky top-0 z-20 flex items-center justify-between px-5 h-14 border-b border-border">
        <div className="flex items-center gap-7">
          <Link to="/gov" className="flex items-center gap-2.5 group">
            <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
              <Wind size={17} strokeWidth={2.5} />
            </span>
            <span className="text-[15px] font-extrabold tracking-tight">Plume<span className="text-primary">Trace</span></span>
          </Link>
          <nav className="flex items-center gap-1">
            {tabs.map(t => {
              const active = loc.pathname === t.path;
              return (
                <Link
                  key={t.path}
                  to={t.path}
                  className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    active ? 'bg-secondary text-foreground' : 'text-muted-foreground hover:text-foreground hover:bg-secondary/60'
                  }`}
                >
                  {t.name}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground px-2.5 py-1 rounded-full bg-secondary/60 border border-border">
            <span className={`w-1.5 h-1.5 rounded-full ${run?.run_id ? 'bg-success animate-pulse' : 'bg-muted-foreground'}`} />
            {run?.run_id ? (
              <span>run <span className="text-foreground font-medium">{run.run_id}</span>{run.issued_at ? ` · ${formatIst(run.issued_at)} IST` : ''}</span>
            ) : 'run: pending'}
          </div>
          <Link
            to="/copilot"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-semibold bg-primary text-primary-foreground hover:brightness-110 transition shadow-lg shadow-primary/20"
          >
            <Sparkles size={15} /> Copilot
          </Link>
        </div>
      </header>
      <DegradedBanner />
      <main className="flex-1 overflow-auto relative">
        {children}
      </main>
    </div>
  );
}
