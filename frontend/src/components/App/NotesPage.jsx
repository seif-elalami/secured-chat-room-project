import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import NotesPanel from './NotesPanel';
import '../../styles/AppShell.css';

const NotesPage = () => {
  const { user } = useAuth();
  const [flash, setFlash] = useState({ type: '', message: '' });

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => setFlash({ type: '', message: '' }), 4000);
  };

  return (
    <div style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
      <div style={{ maxWidth: '1000px', margin: '0 auto' }}>
        <h1 style={{ marginBottom: '5px' }}>My Notes</h1>
        <p className="workspace-muted" style={{ marginBottom: '30px' }}>
          Keep track of your personal notes, tasks, and reminders.
        </p>

        {flash.message && (
          <div className={`workspace-flash ${flash.type === 'error' ? 'is-error' : 'is-success'}`} style={{ marginBottom: '20px' }}>
            {flash.message}
          </div>
        )}

        <div className="workspace-card" style={{ padding: '30px' }}>
          <NotesPanel user={user} showFlash={showFlash} />
        </div>
      </div>
    </div>
  );
};

export default NotesPage;
