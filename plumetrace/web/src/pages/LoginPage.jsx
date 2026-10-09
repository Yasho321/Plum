/**
 * OWNER    : Tanmay
 * DUE      : D3 11:00
 * TASK     :
 *   Cognito Hosted UI redirect + callback handling.
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Wind } from 'lucide-react';
import { handleLogin, checkAuthSession } from '../lib/auth';
import { useAuthStore } from '../stores/authStore';

export default function LoginPage() {
  const navigate = useNavigate();
  const { tokens } = useAuthStore();

  useEffect(() => {
    checkAuthSession().then(loggedIn => {
      if (loggedIn) navigate('/gov', { replace: true });
    });
  }, [navigate]);

  if (tokens) return null;

  return (
    <div className="flex h-screen items-center justify-center p-6">
      <div className="w-full max-w-sm pt-card p-8 text-center pt-fade-in">
        <div className="mx-auto grid place-items-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-lg shadow-primary/30 mb-5">
          <Wind size={26} strokeWidth={2.5} />
        </div>
        <h1 className="text-2xl font-extrabold tracking-tight">Plume<span className="text-primary">Trace</span></h1>
        <p className="text-muted-foreground mt-1.5 mb-7 text-sm">Source-attributed PM2.5 forecasting<br />for Delhi-NCR</p>
        <button
          onClick={handleLogin}
          className="w-full py-2.5 bg-primary text-primary-foreground rounded-md hover:brightness-110 transition font-semibold shadow-lg shadow-primary/20"
        >
          Sign in with Cognito
        </button>
        <p className="text-[11px] text-muted-foreground mt-4">Secured by Amazon Cognito · gov · fleet · admin roles</p>
      </div>
    </div>
  );
}
