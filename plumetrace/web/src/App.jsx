/**
 * OWNER    : Tanmay
 * DUE      : D1 13:00
 * TASK     :
 *   Routes: /gov, /fleet, /skill, /approvals, /copilot, /login, /consent; AppShell layout; role-gated routes (groups from authStore).
 * DONE WHEN: -
 * GUIDE    : docs/team/TANMAY.md  |  brief: docs/PROJECT_BRIEF.md
 * STATUS   : DONE
 */
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';

import AppShell from './components/layout/AppShell';
import GovernmentPage from './pages/GovernmentPage';
import FleetPage from './pages/FleetPage';
import SkillPage from './pages/SkillPage';
import ApprovalsPage from './pages/ApprovalsPage';
import CopilotPage from './pages/CopilotPage';
import LoginPage from './pages/LoginPage';
import ConsentPage from './pages/ConsentPage';

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { tokens, groups } = useAuthStore();
  if (!tokens) return <Navigate to="/login" replace />;
  if (allowedRoles && !allowedRoles.some(r => groups.includes(r)) && !groups.includes('admin')) {
    return <div>Access Denied</div>;
  }
  return <AppShell>{children}</AppShell>;
};

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/consent" element={<ConsentPage />} />
      <Route path="/" element={<Navigate to="/gov" replace />} />
      <Route path="/gov" element={<ProtectedRoute allowedRoles={['gov']}><GovernmentPage /></ProtectedRoute>} />
      <Route path="/fleet" element={<ProtectedRoute allowedRoles={['fleet']}><FleetPage /></ProtectedRoute>} />
      <Route path="/skill" element={<ProtectedRoute><SkillPage /></ProtectedRoute>} />
      <Route path="/approvals" element={<ProtectedRoute><ApprovalsPage /></ProtectedRoute>} />
      <Route path="/copilot" element={<ProtectedRoute><CopilotPage /></ProtectedRoute>} />
    </Routes>
  );
}
