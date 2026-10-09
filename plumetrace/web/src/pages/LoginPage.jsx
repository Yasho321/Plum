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
    <div className="flex h-screen items-center justify-center bg-muted/50">
      <div className="w-full max-w-sm p-8 bg-card border border-border rounded-lg shadow-lg text-center">
        <h1 className="text-2xl font-bold mb-2">PlumeTrace</h1>
        <p className="text-muted-foreground mb-6 text-sm">Sign in to continue</p>
        <button 
          onClick={handleLogin}
          className="w-full py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors font-medium shadow-sm"
        >
          Sign in with Cognito
        </button>
      </div>
    </div>
  );
}
