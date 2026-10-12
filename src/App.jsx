import { Routes, Route, Link, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PatientList from './components/PatientList';
import PatientDetail from './components/PatientDetail';
import AuditLog from './components/AuditLog';
import AISearch from './components/AISearch';
import AIScribe from './components/AIScribe';
import AISettings from './components/AISettings';

function Shell({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();

  const signOut = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="app">
      <header className="topbar">
        <Link to="/" className="logo"><span className="brand-mark sm">C+</span> Clinix AI</Link>
        <nav>
          <Link to="/">Dashboard</Link>
          <Link to="/patients">Patients</Link>
          <Link to="/ai-search">AI search</Link>
          {can('edit_patients') && <Link to="/scribe">AI scribe</Link>}
          {can('view_audit_log') && <Link to="/audit">Audit log</Link>}
          {can('manage_users') && <Link to="/settings/ai">AI settings</Link>}
        </nav>
        <div className="userbox">
          <span>{user.name} <span className="role-badge">{user.role}</span></span>
          <button className="btn small" onClick={signOut}>Sign out</button>
        </div>
      </header>
      <main className="main">{children}</main>
      <footer className="footer">Clinix AI prototype by Nexus-Tech Solutions — synthetic demo data only.</footer>
    </div>
  );
}

function Unauthorized() {
  return (
    <div>
      <h2>Not authorized</h2>
      <p className="muted">Your role doesn't have access to this page. This attempt has been noted.</p>
      <Link to="/">← Back to dashboard</Link>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/unauthorized" element={<Unauthorized />} />
      <Route
        path="/*"
        element={
          <ProtectedRoute>
            <Shell>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/patients" element={<PatientList />} />
                <Route path="/patients/:id" element={<PatientDetail />} />
                <Route path="/audit" element={
                  <ProtectedRoute permission="view_audit_log">
                    <AuditLog />
                  </ProtectedRoute>
                } />
                <Route path="/ai-search" element={<AISearch />} />
                <Route path="/scribe" element={
                  <ProtectedRoute permission="edit_patients">
                    <AIScribe />
                  </ProtectedRoute>
                } />
                <Route path="/settings/ai" element={
                  <ProtectedRoute permission="manage_users">
                    <AISettings />
                  </ProtectedRoute>
                } />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
