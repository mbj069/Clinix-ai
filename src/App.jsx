import { useState } from 'react';
import { Routes, Route, Link, NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import { NEXUS_TECH_LOGO } from './assets/nexusTechLogo';
import ProtectedRoute from './components/ProtectedRoute';
import Login from './components/Login';
import Dashboard from './components/Dashboard';
import PatientList from './components/PatientList';
import PatientDetail from './components/PatientDetail';
import PatientForm from './components/PatientForm';
import Appointments from './components/Appointments';
import Reception from './components/Reception';
import Doctor from './components/Doctor';
import Nursing from './components/Nursing';
import Admin from './components/Admin';
import AuditLog from './components/AuditLog';
import AISearch from './components/AISearch';
import AIScribe from './components/AIScribe';
import AISettings from './components/AISettings';

function Shell({ children }) {
  const { user, logout, can } = useAuth();
  const navigate = useNavigate();
  const [navOpen, setNavOpen] = useState(false);

  const signOut = () => {
    logout();
    navigate('/login');
  };
  const closeNav = () => setNavOpen(false);

  const links = [
    { to: '/', label: 'Dashboard', show: true },
    { to: '/patients', label: 'Patients', show: true },
    { to: '/appointments', label: 'Appointments', show: can('schedule') },
    { to: '/reception', label: 'Reception', show: can('schedule') },
    { to: '/doctor', label: 'Doctor', show: can('consult') },
    { to: '/nursing', label: 'Nursing', show: can('edit_vitals') },
    { to: '/admin', label: 'Admin', show: can('manage_users') },
    { to: '/audit', label: 'Audit log', show: can('view_audit_log') },
    { to: '/ai-search', label: 'AI search', show: can('ai_search') },
    { to: '/scribe', label: 'AI scribe', show: can('edit_patients') },
    { to: '/settings/ai', label: 'AI settings', show: can('ai_config') },
  ].filter((l) => l.show);

  return (
    <div className="app">
      <header className="mobile-topbar">
        <button className="hamburger" onClick={() => setNavOpen(true)} aria-label="Open menu">☰</button>
        <Link to="/" className="logo"><img className="brand-logo sm" src={NEXUS_TECH_LOGO} alt="Nexus-Tech Solutions" /> Clinix AI</Link>
        <span className="mobile-user">{user.name}</span>
      </header>

      {navOpen && <div className="nav-overlay" onClick={closeNav} />}

      <aside className={`sidebar ${navOpen ? 'open' : ''}`}>
        <Link to="/" className="logo" onClick={closeNav}>
          <img className="brand-logo sm" src={NEXUS_TECH_LOGO} alt="Nexus-Tech Solutions" /> Clinix AI
        </Link>
        <nav>
          {links.map((l) => (
            <NavLink key={l.to} to={l.to} end={l.to === '/'} onClick={closeNav}>
              {l.label}
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <span>{user.name} <span className="role-badge">{user.role}</span></span>
          <button className="btn small" onClick={signOut}>Sign out</button>
        </div>
      </aside>

      <div className="content">
        <main className="main">{children}</main>
        <footer className="footer">Clinix AI by Nexus-Tech Solutions — synthetic demo data only.</footer>
      </div>
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
                <Route path="/patients/new" element={
                  <ProtectedRoute permission="add_patients"><PatientForm /></ProtectedRoute>
                } />
                <Route path="/patients/:id/edit" element={
                  <ProtectedRoute permission="edit_demographics"><PatientForm /></ProtectedRoute>
                } />
                <Route path="/patients/:id" element={<PatientDetail />} />
                <Route path="/appointments" element={
                  <ProtectedRoute permission="schedule"><Appointments /></ProtectedRoute>
                } />
                <Route path="/reception" element={
                  <ProtectedRoute permission="schedule"><Reception /></ProtectedRoute>
                } />
                <Route path="/doctor" element={
                  <ProtectedRoute permission="consult"><Doctor /></ProtectedRoute>
                } />
                <Route path="/nursing" element={
                  <ProtectedRoute permission="edit_vitals"><Nursing /></ProtectedRoute>
                } />
                <Route path="/admin" element={
                  <ProtectedRoute permission="manage_users"><Admin /></ProtectedRoute>
                } />
                <Route path="/audit" element={
                  <ProtectedRoute permission="view_audit_log"><AuditLog /></ProtectedRoute>
                } />
                <Route path="/ai-search" element={
                  <ProtectedRoute permission="ai_search"><AISearch /></ProtectedRoute>
                } />
                <Route path="/scribe" element={
                  <ProtectedRoute permission="edit_patients"><AIScribe /></ProtectedRoute>
                } />
                <Route path="/settings/ai" element={
                  <ProtectedRoute permission="ai_config"><AISettings /></ProtectedRoute>
                } />
              </Routes>
            </Shell>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
