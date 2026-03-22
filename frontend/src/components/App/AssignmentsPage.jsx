import React, { useEffect, useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { roomAPI } from '../../services/api';
import AssignmentsPanel from './AssignmentsPanel';
import '../../styles/AppShell.css';

const AssignmentsPage = () => {
  const { user } = useAuth();
  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [currentRole, setCurrentRole] = useState('member');
  const [flash, setFlash] = useState({ type: '', message: '' });
  
  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => setFlash({ type: '', message: '' }), 4000);
  };

  useEffect(() => {
    const init = async () => {
      try {
        const res = await roomAPI.getRooms();
        const loadedRooms = res.data || [];
        setRooms(loadedRooms);
        if (loadedRooms.length > 0) {
          setSelectedRoomId(loadedRooms[0]._id);
        }
      } catch(e) {}
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedRoomId) {
      roomAPI.getRoleInfo(selectedRoomId).then(res => {
        setCurrentRole(res.data?.currentUser?.role || 'member');
      }).catch(() => {});
    }
  }, [selectedRoomId]);

  return (
    <div className="page-container">
      <aside className="workspace-sidebar" style={{ width: '300px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="workspace-brand">
          <p className="workspace-kicker">Coursework</p>
          <h1>Assignments</h1>
        </div>
        <div className="workspace-card room-list-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Select Room</p>
          </div>
          <div className="room-list">
            {rooms.length === 0 && <p className="workspace-muted">No rooms found.</p>}
            {rooms.map(room => (
              <button
                key={room._id}
                className={`room-list-item ${selectedRoomId === room._id ? 'is-active' : ''}`}
                onClick={() => setSelectedRoomId(room._id)}
              >
                <span className="room-list-title">{room.title || 'Room'}</span>
              </button>
            ))}
          </div>
        </div>
      </aside>
      <main className="workspace-main" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        {flash.message && (
          <div className={`workspace-flash ${flash.type === 'error' ? 'is-error' : 'is-success'}`} style={{ marginBottom: '20px' }}>
            {flash.message}
          </div>
        )}
        <h1 style={{ marginBottom: '20px' }}>Homework & Tasks</h1>
        {selectedRoomId ? (
          <AssignmentsPanel 
            roomId={selectedRoomId} 
            currentRole={currentRole} 
            showFlash={showFlash} 
            currentUserId={user?._id || user?.id} 
          />
        ) : (
          <div className="workspace-muted">Please select a room from the sidebar.</div>
        )}
      </main>
    </div>
  );
};

export default AssignmentsPage;
