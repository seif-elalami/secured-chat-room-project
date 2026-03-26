import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { userAPI, roomAPI } from '../../services/api';
import '../../styles/AppShell.css';

const getUserId = (value) => value?._id || value?.id || '';
const getDisplayName = (value) => value?.fullName || [value?.firstName, value?.lastName].filter(Boolean).join(' ') || value?.username || 'Unknown user';
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const DashboardPage = () => {
  const navigate = useNavigate();
  const { user, logout, updateSessionUser } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState({
    username: '', email: '', phone: '', firstName: '', lastName: '', fullName: '', bio: '',
  });
  
  const [lookupUsername, setLookupUsername] = useState('');
  const [lookupResults, setLookupResults] = useState([]);
  const [hasSearched, setHasSearched] = useState(false);
  
  const [groupForm, setGroupForm] = useState({ title: '', userIds: '' });
  const [directUserId, setDirectUserId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  
  const [activePanel, setActivePanel] = useState('profile');
  const [flash, setFlash] = useState({ type: '', message: '' });
  const [bootstrapping, setBootstrapping] = useState(true);

  const showFlash = (type, message) => setFlash({ type, message });

  const syncProfileState = (nextProfile) => {
    setProfile(nextProfile);
    setProfileDraft({
      username: nextProfile?.username || '', email: nextProfile?.email || '', phone: nextProfile?.phone || '',
      firstName: nextProfile?.firstName || '', lastName: nextProfile?.lastName || '', fullName: nextProfile?.fullName || '', bio: nextProfile?.bio || '',
    });
    updateSessionUser({ ...user, ...nextProfile, id: nextProfile?._id || nextProfile?.id || user?.id });
  };

  const loadRooms = async () => {
    const roomResponse = await roomAPI.getRooms();
    setRooms(roomResponse.data || []);
  };

  const loadBlockedUsers = async () => {
    const blockedResponse = await userAPI.getBlocked();
    setBlockedUsers(blockedResponse.blockedUsers || []);
  };

  const bootstrap = async () => {
    setBootstrapping(true);
    try {
      const profileResponse = await userAPI.getMe();
      syncProfileState(profileResponse);
      await loadBlockedUsers();
      await loadRooms();
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load workspace'));
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => { bootstrap(); }, []);

  const handleProfileDraftChange = (event) => setProfileDraft(c => ({ ...c, [event.target.name]: event.target.value }));

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await userAPI.updateMe({
        username: profileDraft.username.trim(), email: profileDraft.email.trim(), phone: profileDraft.phone.trim(),
        firstName: profileDraft.firstName.trim(), lastName: profileDraft.lastName.trim(), fullName: profileDraft.fullName.trim(), bio: profileDraft.bio.trim(),
      });
      syncProfileState(response);
      showFlash('success', 'Profile updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not update profile'));
    }
  };

  const handleDeleteAccount = async () => {
    if (!window.confirm('Delete this account permanently? This cannot be undone.')) return;
    try {
      await userAPI.deleteMe();
      logout();
      navigate('/login');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not delete account'));
    }
  };

  const handleLookupUser = async (event) => {
    event.preventDefault();
    if (!lookupUsername.trim()) {
      showFlash('error', 'Enter a username to search');
      return;
    }
    try {
      setHasSearched(true);
      const response = await userAPI.searchUsers(lookupUsername.trim());
      setLookupResults(response.users || []);
      if ((response.users || []).length > 0) {
        showFlash('success', `Found ${response.users.length} user(s).`);
      } else {
        showFlash('error', 'No users found matching that username.');
      }
    } catch (error) {
      setLookupResults([]);
      showFlash('error', getErrorMessage(error, 'Search failed'));
    }
  };

  const handleBlockAction = async (targetUserId, action) => {
    try {
      if (action === 'block') await userAPI.blockById(targetUserId);
      else await userAPI.unblockById(targetUserId);
      await loadBlockedUsers();
      showFlash('success', action === 'block' ? 'User blocked' : 'User unblocked');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Block action failed'));
    }
  };

  const handleCreateGroupRoom = async (event) => {
    event.preventDefault();
    const inputIds = groupForm.userIds.split(',').map(v => v.trim()).filter(Boolean);
    const users = Array.from(new Set([...inputIds, getUserId(user)]));
    try {
      const response = await roomAPI.createGroupRoom({ title: groupForm.title.trim(), users, isGroup: true });
      setGroupForm({ title: '', userIds: '' });
      await loadRooms();
      showFlash('success', response.message || 'Group room created');
      navigate(`/rooms/${response.data?._id || ''}`);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not create room'));
    }
  };

  const handleCreateDirectRoom = async (event) => {
    event.preventDefault();
    if (!directUserId.trim()) return showFlash('error', 'Enter the other user ID or username');
    try {
      const rawValue = directUserId.trim();
      const isMongoId = /^[a-f\d]{24}$/i.test(rawValue);
      const response = await roomAPI.createDirectRoom(isMongoId ? { otherUserId: rawValue } : { username: rawValue });
      setDirectUserId('');
      await loadRooms();
      showFlash('success', response.message || 'Direct room ready');
      navigate(`/rooms/${response.data?._id || ''}`);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not open direct room'));
    }
  };

  const handleJoinInvite = async (event) => {
    event.preventDefault();
    if (!inviteCode.trim()) return showFlash('error', 'Enter an invite code');
    try {
      const response = await roomAPI.joinInvite(inviteCode.trim());
      setInviteCode('');
      await loadRooms();
      showFlash('success', response.message || 'Joined room');
      navigate(`/rooms/${response.data?.room?._id || ''}`);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not join room'));
    }
  };

  if (bootstrapping) return <div className="workspace-loading"><div className="workspace-loading-card"><p>Loading Dashboard...</p></div></div>;

  return (
    <div className="page-container">
      <aside className="workspace-sidebar" style={{ width: '350px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="workspace-brand">
          <h1>Dashboard</h1>
          <p className="workspace-muted">Welcome home, {getDisplayName(profile || user)}</p>
        </div>

        <form className="workspace-card" onSubmit={handleCreateGroupRoom}>
          <p className="workspace-section-title">Create Group Room</p>
          <input className="workspace-input" placeholder="Room title" value={groupForm.title} onChange={e => setGroupForm(c => ({...c, title: e.target.value}))} />
          <textarea className="workspace-textarea" placeholder="Comma-separated user IDs. Your ID is auto-added." value={groupForm.userIds} onChange={e => setGroupForm(c => ({...c, userIds: e.target.value}))} />
          <button className="workspace-button" type="submit">Create Group</button>
        </form>

        <form className="workspace-card" onSubmit={handleCreateDirectRoom}>
          <p className="workspace-section-title">Open Direct Room</p>
          <input className="workspace-input" placeholder="Other user ID or username" value={directUserId} onChange={e => setDirectUserId(e.target.value)} />
          <button className="workspace-button" type="submit">Open Direct Chat</button>
        </form>

        <form className="workspace-card" onSubmit={handleJoinInvite}>
          <p className="workspace-section-title">Join By Invite</p>
          <input className="workspace-input" placeholder="Invite code" value={inviteCode} onChange={e => setInviteCode(e.target.value)} />
          <button className="workspace-button" type="submit">Join Room</button>
        </form>
        
        <div className="workspace-card room-list-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Your Rooms</p>
            <button className="workspace-link-button" onClick={loadRooms}>Refresh</button>
          </div>
          <div className="room-list">
            {rooms.length === 0 && <p className="workspace-muted">No rooms yet.</p>}
            {rooms.map((room) => {
              const roomLabel = room.isGroup ? room.title : getDisplayName((room.users || []).find(entry => getUserId(entry) !== getUserId(user))) || room.title;
              return (
                <button key={room._id} className="room-list-item" onClick={() => navigate(`/rooms/${room._id}`)}>
                  <span className="room-list-title">{roomLabel}</span>
                  <span className="room-list-meta">{room.isGroup ? 'Group' : 'Direct'} · {room.users?.length || 0} users</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="workspace-main" style={{ flex: 1, padding: '30px', overflowY: 'auto' }}>
        {flash.message && <div className={`workspace-flash ${flash.type === 'error' ? 'is-error' : 'is-success'}`} style={{ marginBottom: '20px' }}>{flash.message}</div>}

        <div className="workspace-tabs" style={{ marginBottom: '20px' }}>
          <button className={`workspace-tab ${activePanel === 'profile' ? 'is-active' : ''}`} onClick={() => setActivePanel('profile')}>Profile Details</button>
          <button className={`workspace-tab ${activePanel === 'users' ? 'is-active' : ''}`} onClick={() => setActivePanel('users')}>Search & Blocked Users</button>
        </div>

        {activePanel === 'profile' && (
          <div style={{ maxWidth: '600px' }}>
            <div className="workspace-card" style={{ marginBottom: '20px' }}>
              <p className="workspace-section-title">Signed In</p>
              <h2>{getDisplayName(profile || user)}</h2>
              <p className="workspace-muted">@{profile?.username || user?.username}</p>
              <p className="workspace-muted">My User ID: <strong>{profile?._id || user?._id || user?.id}</strong></p>
            </div>
          
            <form className="workspace-card" onSubmit={handleUpdateProfile} style={{ marginBottom: '20px' }}>
              <p className="workspace-section-title">Edit Profile</p>
              <div className="workspace-grid">
                <input className="workspace-input" name="firstName" value={profileDraft.firstName} onChange={handleProfileDraftChange} placeholder="First name" />
                <input className="workspace-input" name="lastName" value={profileDraft.lastName} onChange={handleProfileDraftChange} placeholder="Last name" />
              </div>
              <input className="workspace-input" name="username" value={profileDraft.username} onChange={handleProfileDraftChange} placeholder="Username" />
              <input className="workspace-input" name="email" value={profileDraft.email} onChange={handleProfileDraftChange} placeholder="Email" />
              <input className="workspace-input" name="phone" value={profileDraft.phone} onChange={handleProfileDraftChange} placeholder="Phone" />
              <input className="workspace-input" name="fullName" value={profileDraft.fullName} onChange={handleProfileDraftChange} placeholder="Full name" />
              <textarea className="workspace-textarea" name="bio" value={profileDraft.bio} onChange={handleProfileDraftChange} placeholder="Bio" />
              <button className="workspace-button" type="submit">Save Profile</button>
            </form>

            <div className="workspace-card danger-card">
              <p className="workspace-section-title">Danger Zone</p>
              <p className="workspace-muted">Delete the signed-in account and clear the session from this device.</p>
              <button className="workspace-button workspace-button-danger" onClick={handleDeleteAccount}>Delete Account</button>
            </div>
          </div>
        )}

        {activePanel === 'users' && (
          <div style={{ maxWidth: '600px' }}>
            <form className="workspace-card" onSubmit={handleLookupUser} style={{ marginBottom: '20px' }}>
              <p className="workspace-section-title">Search Users</p>
              <input className="workspace-input" value={lookupUsername} onChange={(e) => setLookupUsername(e.target.value)} placeholder="Type a username prefix..." />
              <button className="workspace-button" type="submit">Find User</button>
            </form>

            {hasSearched && (
              <div className="workspace-card" style={{ marginBottom: '20px' }}>
                <p className="workspace-section-title">Search Results ({lookupResults.length})</p>
                {lookupResults.length === 0 ? (
                  <p className="workspace-muted">No users found.</p>
                ) : (
                  <div className="blocked-list">
                    {lookupResults.map(result => (
                      <div key={result._id} className="blocked-item">
                        <div>
                          <strong>{getDisplayName(result)}</strong>
                          <p className="workspace-muted">@{result.username}</p>
                          <p className="workspace-muted" style={{ fontSize: '11px' }}>ID: {result._id}</p>
                        </div>
                        <div className="workspace-inline-actions">
                          <button className="workspace-button" onClick={() => { setDirectUserId(result._id); showFlash('success', 'User selected! Go to "Open Direct Room" to start a chat.'); }}>Select for Chat</button>
                          <button className="workspace-button workspace-button-ghost" onClick={() => handleBlockAction(getUserId(result), 'block')}>Block</button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            <div className="workspace-card">
              <div className="room-list-header">
                <p className="workspace-section-title">Blocked Users</p>
                <button className="workspace-link-button" onClick={loadBlockedUsers}>Refresh</button>
              </div>
              <div className="blocked-list">
                {blockedUsers.length === 0 && <p className="workspace-muted">No blocked users.</p>}
                {blockedUsers.map((entry) => (
                  <div key={entry._id} className="blocked-item">
                    <div>
                      <strong>{getDisplayName(entry)}</strong>
                      <p className="workspace-muted">{entry.email}</p>
                    </div>
                    <button className="workspace-button workspace-button-ghost" onClick={() => handleBlockAction(entry._id, 'unblock')}>Unblock</button>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default DashboardPage;
