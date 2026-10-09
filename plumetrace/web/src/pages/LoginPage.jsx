/**
 * OWNER    : Tanmay
 * DUE      : D3 11:00
 * TASK     :
 *   Cognito Hosted UI redirect + callback handling.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { Wind, ArrowLeft, ShieldCheck, Lock } from 'lucide-react';
import { handleLogin, checkAuthSession } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';
import { Button } from '../components/ui/Button';

export default function LoginPage() {
  const navigate = useNavigate();
  const { tokens } = useAuthStore();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    checkAuthSession().then((loggedIn) => {
      if (loggedIn) navigate('/gov', { replace: true });
      else setChecking(false);
    });
  }, [navigate]);

  if (tokens) return null;

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* brand panel */}
      <div className="relative hidden lg:flex flex-col justify-between p-10 overflow-hidden border-r border-border">
        <div
          className="absolute inset-0 -z-10"
          style={{
            backgroundImage:
              'radial-gradient(40rem 30rem at 20% 10%, rgba(74,168,255,0.14), transparent 60%), radial-gradient(34rem 30rem at 90% 90%, rgba(129,140,248,0.12), transparent 55%)',
          }}
          aria-hidden
        />
        <Link to="/" className="flex items-center gap-2.5 w-fit">
          <span className="grid place-items-center w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/20">
            <Wind size={17} strokeWidth={2.5} aria-hidden />
          </span>
          <span className="text-[15px] font-extrabold tracking-tight">Plume<span className="text-primary">Trace</span></span>
        </Link>
        <div className="max-w-md">
          <h1 className="text-3xl font-extrabold tracking-tight leading-tight">
            Know where Delhi's smoke comes from, <span className="text-primary">72 hours ahead.</span>
          </h1>
          <p className="mt-4 text-sm text-muted-foreground leading-relaxed">
            Source-attributed PM2.5 forecasting for Delhi-NCR — estimates with ranges, never verdicts.
          </p>
        </div>
        <div className="flex items-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><ShieldCheck size={13} className="text-success" aria-hidden /> DPDP-aligned</span>
          <span className="flex items-center gap-1.5"><Lock size={13} className="text-primary" aria-hidden /> Cognito SSO</span>
        </div>
      </div>

      {/* form panel */}
      <div className="flex flex-col items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <Link to="/" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mb-8 lg:hidden">
            <ArrowLeft size={14} aria-hidden /> Back to home
          </Link>
          <div className="pt-card p-8 pt-fade-in">
            <div className="grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 mb-6">
              <Wind size={26} strokeWidth={2.5} aria-hidden />
            </div>
            <h2 className="text-xl font-extrabold tracking-tight">Sign in to PlumeTrace</h2>
            <p className="text-muted-foreground mt-1.5 mb-7 text-sm">
              Continue to the Government and Fleet dashboards.
            </p>
            <Button onClick={handleLogin} size="lg" loading={checking} className="w-full">
              <Lock size={15} aria-hidden /> Sign in with Cognito
            </Button>
            <p className="text-[11px] text-muted-foreground mt-4 text-center">
              Secured by Amazon Cognito · gov · fleet · admin roles
            </p>
          </div>
          <Link to="/" className="hidden lg:inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors mt-6">
            <ArrowLeft size={14} aria-hidden /> Back to home
          </Link>
        </div>
      </div>
    </div>
  );
}
