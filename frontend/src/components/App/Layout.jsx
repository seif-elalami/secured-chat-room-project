import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import '../../styles/AppShell.css';

const Layout = () => {
  const { logout, user } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="workspace-shell" style={{ flexDirection: 'column' }}>
      {/* TopBar Navigation */}
      <header className="workspace-topbar" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '15px 30px', background: 'rgba(0,0,0,0.85)', borderBottom: '1px solid rgba(255,255,255,0.1)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '30px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: '#61dafb' }}>Secured Chat Room</h2>
          <nav style={{ display: 'flex', gap: '20px' }}>
            <NavLink to="/dashboard" className={({ isActive }) => `workspace-tab ${isActive ? 'is-active' : ''}`} style={{ textDecoration: 'none' }}>
              Dashboard
            </NavLink>
            <NavLink to="/rooms" className={({ isActive }) => `workspace-tab ${isActive ? 'is-active' : ''}`} style={{ textDecoration: 'none' }}>
              Rooms
            </NavLink>
            <NavLink to="/notes" className={({ isActive }) => `workspace-tab ${isActive ? 'is-active' : ''}`} style={{ textDecoration: 'none' }}>
              Notes
            </NavLink>
            <NavLink to="/assignments" className={({ isActive }) => `workspace-tab ${isActive ? 'is-active' : ''}`} style={{ textDecoration: 'none' }}>
              Assignments
            </NavLink>
          </nav>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
          <span className="workspace-muted">Logged in as {user?.username}</span>
          <button className="workspace-button workspace-button-ghost" onClick={handleLogout} style={{ padding: '6px 12px' }}>
            Logout
          </button>
        </div>
      </header>

      {/* Main Content View (Outlet) */}
      <Outlet />
    </div>
  );
};

export default Layout;
