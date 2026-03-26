import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { messageAPI, roomAPI, mediaAPI } from '../../services/api';
import { sanitizeMessage } from '../../services/security';
import '../../styles/AppShell.css';

const REACTION_OPTIONS = ['👍', '❤️', '😂'];

const getUserId = (value) => value?._id || value?.id || '';
const getDisplayName = (value) => value?.fullName || [value?.firstName, value?.lastName].filter(Boolean).join(' ') || value?.username || 'Unknown user';
const getErrorMessage = (error, fallback) => error?.response?.data?.message || error?.message || fallback;

const formatStatValue = (val) => {
  if (val === null || val === undefined) return 'None';
  if (typeof val === 'boolean') return val ? 'Yes' : 'No';
  if (typeof val === 'number') return val.toLocaleString();
  if (typeof val === 'object') {
    if (Array.isArray(val)) return `${val.length} items`;
    if (val.username) return val.username;
    if (val.title || val.name) return val.title || val.name;
    // Map internal IDs out if nested
    return Object.entries(val)
      .filter(([k]) => !k.startsWith('_'))
      .map(([k, v]) => `${k.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}: ${v}`)
      .join(', ');
  }
  if (typeof val === 'string' && val.match(/^\d{4}-\d{2}-\d{2}T/)) {
    return new Date(val).toLocaleString();
  }
  return String(val);
};

const RoomPage = () => {
  const navigate = useNavigate();
  const { roomId } = useParams();
  const { user } = useAuth();
  const currentUserId = getUserId(user);

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState(roomId || '');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomRoleInfo, setRoomRoleInfo] = useState(null);

  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [roomStats, setRoomStats] = useState(null);

  const [messageDraft, setMessageDraft] = useState('');
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);

  const [activeMessageInfoId, setActiveMessageInfoId] = useState(null);
  const [messageReaders, setMessageReaders] = useState([]);

  const [memberToAdd, setMemberToAdd] = useState('');
  const [promotion, setPromotion] = useState({ targetUserId: '', targetRole: 'moderator' });
  const [demotionUserId, setDemotionUserId] = useState('');
  const [roomSettings, setRoomSettings] = useState({ title: '', description: '', messagingPolicy: 'all_members', allowInvites: true, maxParticipants: 50 });
  const [inviteCodeDisplay, setInviteCodeDisplay] = useState('');

  const [flash, setFlash] = useState({ type: '', message: '' });
  const [roomLoading, setRoomLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);

  const currentRole = roomRoleInfo?.currentUser?.role || 'member';
  const currentPermissions = roomRoleInfo?.currentUser?.permissions || {};
  const canSendMessages = roomRoleInfo?.currentUser?.canSendMessages ?? false;

  // Deduplicate room members by their unique ID (._id or .id)
  const roomMembers = useMemo(() => {
    const seen = new Set();
    return (roomRoleInfo?.allMembers || []).filter(member => {
      const id = member._id || member.id;
      if (!id) return false;
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }, [roomRoleInfo]);

  const visibleRoomTitle = useMemo(() => {
    if (!selectedRoom) return 'Choose a room';
    if (selectedRoom.isGroup) return selectedRoom.title || 'Group room';
    const otherUser = (selectedRoom.users || []).find(entry => getUserId(entry) !== currentUserId);
    return otherUser ? getDisplayName(otherUser) : selectedRoom.title || 'Direct room';
  }, [currentUserId, selectedRoom]);

  const showFlash = (type, message) => {
    setFlash({ type, message });
    setTimeout(() => setFlash({ type: '', message: '' }), 4000);
  };

  const loadRooms = async () => {
    const roomResponse = await roomAPI.getRooms();
    const nextRooms = roomResponse.data || [];
    setRooms(nextRooms);
    if (!selectedRoomId && nextRooms.length > 0) {
      handleSelectRoom(nextRooms[0]._id);
    }
  };

  const loadRoomContext = async (id) => {
    if (!id) return;
    setRoomLoading(true);
    try {
      const [roomRes, roleRes, messageRes, pinnedRes] = await Promise.all([
        roomAPI.getRoomById(id), roomAPI.getRoleInfo(id),
        messageAPI.getMessages(id), messageAPI.getPinnedMessages(id),
      ]);
      const nextRoom = roomRes.data;
      setSelectedRoom(nextRoom);
      setRoomRoleInfo(roleRes.data);
      setMessages(messageRes.data || []);
      setPinnedMessages(pinnedRes.data || []);
      setRoomSettings({
        title: nextRoom?.title || '', description: nextRoom?.description || '',
        messagingPolicy: nextRoom?.settings?.messagingPolicy || 'all_members',
        allowInvites: nextRoom?.settings?.allowInvites ?? true, maxParticipants: nextRoom?.settings?.maxParticipants || 50,
      });

      const unreadIds = (messageRes.data || []).filter(entry => getUserId(entry.author) !== currentUserId).map(entry => entry._id);
      if (unreadIds.length) await messageAPI.markReadBatch(unreadIds);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load room details'));
    } finally {
      setRoomLoading(false);
    }
  };

  useEffect(() => { loadRooms(); }, []);

  useEffect(() => {
    if (selectedRoomId) {
      setInviteCodeDisplay('');
      loadRoomContext(selectedRoomId);
    } else {
      setSelectedRoom(null);
      setRoomRoleInfo(null);
      setMessages([]);
      setPinnedMessages([]);
      setInviteCodeDisplay('');
    }
  }, [selectedRoomId]);

  const handleSelectRoom = (id) => {
    setSelectedRoomId(id);
    navigate(`/rooms/${id}`);
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedRoomId || (!messageDraft.trim() && !selectedFile)) return;
    setSendingMessage(true);
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('file', selectedFile);
        formData.append('roomId', selectedRoomId);

        const mediaRes = await mediaAPI.uploadToGallery(formData);
        const fileUrl = mediaRes.data?.data?.fileUrl || mediaRes.data?.media?.fileUrl || mediaRes.data?.fileUrl || mediaRes.data?.url;

        if (fileUrl) {
          await messageAPI.sendMessage({
            roomId: selectedRoomId,
            content: fileUrl,
            type: 'image'
          });
        }

        if (messageDraft.trim()) {
           await messageAPI.sendMessage({ roomId: selectedRoomId, content: messageDraft.trim() });
        }

        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await messageAPI.sendMessage({ roomId: selectedRoomId, content: messageDraft.trim() });
      }
      setMessageDraft('');
      await loadRoomContext(selectedRoomId);
      await loadRooms();
    } catch (error) { showFlash('error', getErrorMessage(error, 'Could not send message')); }
    finally { setSendingMessage(false); }
  };

  const handleSendLocation = () => {
    if (!navigator.geolocation) {
      showFlash('error', 'Geolocation is not supported by your browser');
      return;
    }
    setSendingMessage(true);
    navigator.geolocation.getCurrentPosition(
      async (position) => {
        try {
          await messageAPI.sendMessage({
            roomId: selectedRoomId,
            type: 'location',
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
          setMessageDraft('');
          await loadRoomContext(selectedRoomId);
          await loadRooms();
          showFlash('success', 'Location sent');
        } catch (error) {
          showFlash('error', getErrorMessage(error, 'Could not send location'));
        } finally {
          setSendingMessage(false);
        }
      },
      (error) => {
        showFlash('error', 'Could not get your location. Please check browser permissions.');
        setSendingMessage(false);
      }
    );
  };

  const handleEditMessage = async (messageId, currentContent) => {
    const nextContent = window.prompt('Edit message', currentContent || '');
    if (nextContent === null || !nextContent.trim()) return;
    try {
      await messageAPI.editMessage(messageId, nextContent.trim());
      await loadRoomContext(selectedRoomId);
    } catch (error) { showFlash('error', getErrorMessage(error, 'Could not edit message')); }
  };

  const handleDeleteMessage = async (messageId) => {
    if (!window.confirm('Delete this message?')) return;
    try {
      await messageAPI.deleteMessage(messageId);
      await loadRoomContext(selectedRoomId);
    } catch (error) { showFlash('error', getErrorMessage(error, 'Could not delete message')); }
  };

  const handleReaction = async (messageId, emoji) => {
    try { await messageAPI.toggleReaction(messageId, emoji); await loadRoomContext(selectedRoomId); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not update reaction')); }
  };

  const handlePinMessage = async (messageId) => {
    try { await messageAPI.pinMessage(messageId); await loadRoomContext(selectedRoomId); showFlash('success', 'Pin state updated'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not change pin state')); }
  };

  const handleViewReaders = async (messageId) => {
    if (activeMessageInfoId === messageId) { setActiveMessageInfoId(null); setMessageReaders([]); return; }
    try {
      const response = await messageAPI.getMessageReaders(messageId);
      setMessageReaders(response.data || response.readers || response || []);
      setActiveMessageInfoId(messageId);
    } catch (error) { showFlash('error', getErrorMessage(error, 'Could not load message readers')); }
  };

  const handleDeleteMedia = async (messageId, mediaId) => {
    if (!window.confirm('Delete this media?')) return;
    try { await messageAPI.deleteMedia(messageId, mediaId); await loadRoomContext(selectedRoomId); showFlash('success', 'Media deleted'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not delete media')); }
  };

  const handleUpdateRoomSettings = async (event) => {
    event.preventDefault();
    try {
      await roomAPI.updateSettings(selectedRoomId, { ...roomSettings, maxParticipants: Number(roomSettings.maxParticipants) });
      await loadRooms(); await loadRoomContext(selectedRoomId); showFlash('success', 'Settings updated');
    } catch (error) { showFlash('error', getErrorMessage(error, 'Could not update room settings')); }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!memberToAdd.trim()) return;
    try { await roomAPI.addMember(selectedRoomId, memberToAdd.trim()); setMemberToAdd(''); await loadRoomContext(selectedRoomId); await loadRooms(); showFlash('success', 'Member added'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not add member')); }
  };

  const handleRemoveMember = async (userId) => {
    if (!window.confirm('Remove this member?')) return;
    try { await roomAPI.removeMember(selectedRoomId, userId); await loadRoomContext(selectedRoomId); showFlash('success', 'Member removed'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not remove member')); }
  };

  const handlePromotion = async (event) => {
    event.preventDefault();
    if (!promotion.targetUserId.trim()) return;
    try { await roomAPI.promoteMember(selectedRoomId, promotion); setPromotion({ targetUserId: '', targetRole: promotion.targetRole }); await loadRoomContext(selectedRoomId); showFlash('success', 'Role updated'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not promote member')); }
  };

  const handleDemotion = async (event) => {
    event.preventDefault();
    if (!demotionUserId.trim()) return;
    try { await roomAPI.demoteMember(selectedRoomId, demotionUserId.trim()); setDemotionUserId(''); await loadRoomContext(selectedRoomId); showFlash('success', 'Member demoted'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not demote member')); }
  };

  const handleGenerateInvite = async () => {
    try {
      const res = await roomAPI.generateInvite(selectedRoomId);
      const code = res?.data?.inviteCode || res?.data?.inviteUrl || res?.inviteCode;
      if (code) setInviteCodeDisplay(code);
      showFlash('success', 'Invite created');
    }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not generate invite')); }
  };

  const handleFetchInvite = async () => {
    try {
      const res = await roomAPI.getInvite(selectedRoomId);
      const invite = res?.data?.inviteCode || res?.data?.inviteUrl || res?.inviteCode;
      if (invite) setInviteCodeDisplay(invite);
      else showFlash('error', 'No active invite found');
    }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not load invite')); }
  };

  const handleRevokeInvite = async () => {
    try {
      await roomAPI.revokeInvite(selectedRoomId);
      setInviteCodeDisplay('');
      showFlash('success', 'Invite revoked');
    }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not revoke invite')); }
  };

  const handleGetStatistics = async () => {
    try { const res = await roomAPI.getStatistics(selectedRoomId); setRoomStats(res.data || res.statistics || res); showFlash('success', 'Statistics loaded'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not load statistics')); }
  };

  const handleDeleteRoom = async () => {
    if (!window.confirm('Delete this room? This action cannot be undone.')) return;
    try { await roomAPI.deleteRoom(selectedRoomId); showFlash('success', 'Room deleted'); await loadRooms(); setSelectedRoomId(''); navigate('/rooms'); }
    catch (error) { showFlash('error', getErrorMessage(error, 'Could not delete room')); }
  };

  return (
    <div className="page-container">
      <aside className="workspace-sidebar" style={{ width: '250px', borderRight: '1px solid rgba(255,255,255,0.1)' }}>
        <div className="workspace-brand">
          <p className="workspace-kicker">Communications</p>
          <h1>Rooms</h1>
        </div>
        <div className="workspace-card room-list-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Your Rooms</p>
            <button className="workspace-link-button" onClick={loadRooms}>Refresh</button>
          </div>
          <div className="room-list">
            {rooms.length === 0 && <p className="workspace-muted">No rooms yet.</p>}
            {rooms.map((room) => {
              const roomLabel = room.isGroup ? room.title : getDisplayName((room.users || []).find(entry => getUserId(entry) !== currentUserId)) || room.title;
              return (
                <button key={room._id} className={`room-list-item ${selectedRoomId === room._id ? 'is-active' : ''}`} onClick={() => handleSelectRoom(room._id)}>
                  <span className="room-list-title">{roomLabel}</span>
                  <span className="room-list-meta">{room.isGroup ? 'Group' : 'Direct'} · {room.users?.length || 0} users</span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="workspace-main" style={{ flex: 1, position: 'relative' }}>
        {flash.message && <div className={`workspace-flash ${flash.type === 'error' ? 'is-error' : 'is-success'}`} style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 10 }}>{flash.message}</div>}

        <section className="workspace-room" style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
          <header className="workspace-room-header" style={{ padding: '20px' }}>
            <div>
              <p className="workspace-section-title">Current Room</p>
              <h2>{visibleRoomTitle}</h2>
              <p className="workspace-muted">
                {selectedRoom ? `${selectedRoom.isGroup ? 'Group room' : 'Direct chat'} · Your role: ${currentRole}` : 'Select a room from the sidebar.'}
              </p>
            </div>
            {selectedRoom && (
              <div className="workspace-badges">
                <span className="workspace-badge">{selectedRoom.settings?.messagingPolicy || 'all_members'}</span>
                <span className="workspace-badge">{roomMembers.length} members</span>
                <span className="workspace-badge">{canSendMessages ? 'Can send' : 'Read only'}</span>
              </div>
            )}
          </header>

          {selectedRoom && pinnedMessages.length > 0 && (
            <div className="workspace-card pinned-card" style={{ margin: '0 20px' }}>
              <p className="workspace-section-title">Pinned Messages</p>
              <div className="pinned-list">
                {pinnedMessages.map(entry => (
                  <div key={entry._id} className="pinned-item"><strong>{entry.author?.username || 'Unknown'}:</strong> {sanitizeMessage(entry.content)}</div>
                ))}
              </div>
            </div>
          )}

          <div className="workspace-card message-panel" style={{ margin: '20px', flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div className="message-list" style={{ flex: 1, overflowY: 'auto' }}>
              {roomLoading && <p className="workspace-muted">Loading room details...</p>}
              {!roomLoading && !selectedRoom && <p className="workspace-muted">No room selected yet.</p>}
              {!roomLoading && selectedRoom && messages.length === 0 && <p className="workspace-muted">No messages yet. Start the room conversation below.</p>}

              {messages.map((entry) => {
                const mine = getUserId(entry.author) === currentUserId;
                const canModerate = !selectedRoom.isGroup || ['moderator', 'admin', 'creator'].includes(currentRole);
                return (
                  <article key={entry._id} className={`message-item ${mine ? 'is-mine' : ''}`}>
                    <div className="message-item-head">
                      <div>
                        <strong>{entry.author?.username || 'Unknown user'}</strong>
                        <span className="message-meta">{new Date(entry.createdAt || entry.date || Date.now()).toLocaleString()}</span>
                      </div>
                      <div className="message-actions">
                        {mine && entry.type === 'text' && !entry.isDeleted && (
                          <button className="workspace-link-button" onClick={() => handleEditMessage(entry._id, entry.content)}>Edit</button>
                        )}
                        {(mine || canModerate) && (
                          <button className="workspace-link-button" onClick={() => handleDeleteMessage(entry._id)}>Delete</button>
                        )}
                        {canModerate && (
                          <button className="workspace-link-button" onClick={() => handlePinMessage(entry._id)} style={{marginLeft: '8px'}}>{entry.isPinned ? 'Unpin' : 'Pin'}</button>
                        )}
                        {mine && (
                          <button className="workspace-link-button" onClick={() => handleViewReaders(entry._id)} style={{marginLeft: '8px'}}>Info</button>
                        )}
                      </div>
                    </div>
                    <div className="message-body">
                      {entry.replyToContent?.content && (
                        <div className="message-reply-preview">Replying to {entry.replyToContent.author?.username || 'a message'}: {sanitizeMessage(entry.replyToContent.content)}</div>
                      )}
                      {entry.isDeleted ? (
                        <p className="workspace-muted" style={{ fontStyle: 'italic' }}>[Message deleted]</p>
                      ) : (
                        // Intelligently render file uploads as images or download buttons
                        ((entry.type === 'image' || entry.type === 'file' || entry.content.includes('/uploads/')) && entry.content.startsWith('http')) ? (
                          entry.content.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                            <div style={{ marginTop: '8px' }}>
                              <img src={entry.content} alt="Attachment" style={{ maxWidth: '100%', borderRadius: '8px', maxHeight: '300px', objectFit: 'contain', cursor: 'pointer', border: '1px solid #333' }} onClick={() => window.open(entry.content, '_blank')} />
                            </div>
                          ) : (
                            <div style={{ marginTop: '8px' }}>
                              <a href={entry.content} target="_blank" rel="noreferrer" className="workspace-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '10px 16px', textDecoration: 'none', background: '#2c2c2c', border: '1px solid #444', borderRadius: '8px', color: '#fff', fontSize: '14px' }}>
                                📄 View / Download Document
                              </a>
                            </div>
                          )
                        ) : (
                          <p>{sanitizeMessage(entry.content)}</p>
                        )
                      )}
                      {entry.media && entry.media.length > 0 && (
                        <div className="message-media">
                          {entry.media.map(m => (
                            <div key={m._id} style={{ marginTop: '10px' }}>
                              <img src={m.url || 'https://via.placeholder.com/150'} alt="Attachment preview" style={{ maxWidth: '100%', borderRadius: '4px', maxHeight: '200px', objectFit: 'cover' }} />
                              {mine && !entry.isDeleted && (
                                <button className="workspace-link-button" onClick={() => handleDeleteMedia(entry._id, m._id)} style={{ display: 'block', marginTop: '4px', color: '#ff4d4f' }}>Delete Media</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                      {entry.location?.url && <a href={entry.location.url} target="_blank" rel="noreferrer" className="message-link">Open shared location</a>}
                    </div>
                    <div className="message-reactions">
                      {REACTION_OPTIONS.map((emoji) => <button key={emoji} className="reaction-pill" onClick={() => handleReaction(entry._id, emoji)}>{emoji}</button>)}
                       {entry.reactions?.length > 0 && <span className="workspace-muted">{entry.reactions.length} reactions</span>}
                    </div>
                    {activeMessageInfoId === entry._id && (
                      <div className="message-readers-panel" style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px', fontSize: '12px' }}>
                        <strong>Read by:</strong>
                        {messageReaders.length > 0 ? (
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                            {messageReaders.map(reader => <li key={reader._id || reader.id}>{getDisplayName(reader)}</li>)}
                          </ul>
                        ) : (<p style={{ margin: '4px 0 0 0', opacity: 0.7 }}>No one has read this yet.</p>)}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <form className="message-composer" onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '15px' }}>
              {selectedFile && (
                <div style={{ padding: '8px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong style={{ opacity: 0.7 }}>Attachment:</strong> {selectedFile.name}</span>
                  <button type="button" className="workspace-link-button" onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} style={{color: '#ff4d4f'}}>Remove</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
                <input type="file" ref={fileInputRef} onChange={(e) => setSelectedFile(e.target.files[0])} style={{ display: 'none' }} />
                <button type="button" className="workspace-button workspace-button-ghost" onClick={() => fileInputRef.current?.click()} disabled={!selectedRoom || !canSendMessages || sendingMessage} style={{ padding: '0 12px', height: '44px', display: 'flex', alignItems: 'center' }} title="Attach Media">📎</button>
                <button type="button" className="workspace-button workspace-button-ghost" onClick={handleSendLocation} disabled={!selectedRoom || !canSendMessages || sendingMessage} style={{ padding: '0 12px', height: '44px', display: 'flex', alignItems: 'center', marginLeft: '-5px' }} title="Share Location">📍</button>
                <textarea className="workspace-textarea" style={{ flex: 1, margin: 0, minHeight: '44px' }} placeholder={canSendMessages ? 'Type a message for this room...' : 'Messaging is restricted.'} value={messageDraft} onChange={(e) => setMessageDraft(e.target.value)} disabled={!selectedRoom || !canSendMessages || sendingMessage} />
                <button className="workspace-button" style={{ height: '44px' }} type="submit" disabled={!selectedRoom || !canSendMessages || sendingMessage}>{sendingMessage ? 'Sending...' : 'Send'}</button>
              </div>
            </form>
          </div>
        </section>
      </main>

      {selectedRoom && (
        <aside className="workspace-detail" style={{ width: '300px', padding: '20px', overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,0.1)', background: 'rgba(0,0,0,0.2)' }}>
          <div className="workspace-card" style={{ marginBottom: '20px' }}>
            <p className="workspace-section-title">Members</p>
            <div className="member-role-list">
              {roomMembers.map((entry) => (
                <div key={entry.id} className="member-role-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                  <span>{entry.username}</span>
                  <div>
                    <span className="workspace-badge">{entry.role}</span>
                    {currentPermissions.canManageMembers && entry.id !== currentUserId && (
                      <button className="workspace-link-button" onClick={() => handleRemoveMember(entry.id)} style={{ marginLeft: '10px', color: '#ff4d4f' }}>Kick</button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {selectedRoom.isGroup && currentPermissions.canManageMembers && (
            <form className="workspace-card" onSubmit={handleAddMember} style={{ marginBottom: '20px' }}>
              <p className="workspace-section-title">Add Member</p>
              <input className="workspace-input" value={memberToAdd} onChange={(e) => setMemberToAdd(e.target.value)} placeholder="User ID or username" />
              <button className="workspace-button" type="submit">Add Member</button>
            </form>
          )}

          {(currentRole === 'creator' || currentRole === 'admin') && (
            <>
              <form className="workspace-card" onSubmit={handlePromotion} style={{ marginBottom: '20px' }}>
                <p className="workspace-section-title">Promote Member</p>
                <input className="workspace-input" value={promotion.targetUserId} onChange={(e) => setPromotion(c => ({ ...c, targetUserId: e.target.value }))} placeholder="Target user ID" />
                <select className="workspace-input" value={promotion.targetRole} onChange={(e) => setPromotion(c => ({ ...c, targetRole: e.target.value }))}>
                  <option value="moderator">Moderator</option>
                  <option value="admin">Admin</option>
                </select>
                <button className="workspace-button" type="submit">Promote</button>
              </form>

              <form className="workspace-card" onSubmit={handleDemotion} style={{ marginBottom: '20px' }}>
                <p className="workspace-section-title">Demote Member</p>
                <input className="workspace-input" value={demotionUserId} onChange={(e) => setDemotionUserId(e.target.value)} placeholder="Target user ID" />
                <button className="workspace-button workspace-button-ghost" type="submit">Demote To Member</button>
              </form>
            </>
          )}

          {currentPermissions.canChangeSettings && (
            <>
              <form className="workspace-card" onSubmit={handleUpdateRoomSettings} style={{ marginBottom: '20px' }}>
                <p className="workspace-section-title">Room Settings</p>
                <input className="workspace-input" name="title" value={roomSettings.title} onChange={e => setRoomSettings({...roomSettings, title: e.target.value})} placeholder="Title" />
                <textarea className="workspace-textarea" name="description" value={roomSettings.description} onChange={e => setRoomSettings({...roomSettings, description: e.target.value})} placeholder="Description" />
                <select className="workspace-input" name="messagingPolicy" value={roomSettings.messagingPolicy} onChange={e => setRoomSettings({...roomSettings, messagingPolicy: e.target.value})}>
                  <option value="all_members">All members can send</option>
                  <option value="admins_only">Admins only can send</option>
                </select>
                <input className="workspace-input" name="maxParticipants" type="number" value={roomSettings.maxParticipants} onChange={e => setRoomSettings({...roomSettings, maxParticipants: e.target.value})} />
                <label className="workspace-checkbox">
                  <input type="checkbox" name="allowInvites" checked={roomSettings.allowInvites} onChange={e => setRoomSettings({...roomSettings, allowInvites: e.target.checked})} /> Allow invite links
                </label>
                <button className="workspace-button" type="submit">Save Settings</button>
              </form>

              <div className="workspace-card" style={{ marginBottom: '20px' }}>
                <div className="room-list-header">
                  <p className="workspace-section-title">Statistics</p>
                  <button className="workspace-link-button" onClick={handleGetStatistics}>Load Stats</button>
                </div>
                {roomStats && (
                  <div className="stats-display" style={{ marginTop: '12px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
                    {Object.entries(roomStats).filter(([k]) => !k.startsWith('_')).map(([key, value]) => {
                      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
                      return (
                        <div key={key} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '10px 12px', background: 'rgba(0,0,0,0.04)', borderRadius: '6px' }}>
                          <span className="workspace-muted" style={{ fontSize: '12px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</span>
                          <span style={{ fontSize: '15px', fontWeight: 500, wordBreak: 'break-word', lineHeight: 1.4 }}>{formatStatValue(value)}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <div className="workspace-card" style={{ marginBottom: '20px' }}>
                <p className="workspace-section-title">Invite Controls</p>
                <div className="workspace-inline-actions">
                  <button className="workspace-button" type="button" onClick={handleGenerateInvite}>Generate Invite</button>
                  <button className="workspace-button workspace-button-ghost" type="button" onClick={handleFetchInvite}>View Invite</button>
                  <button className="workspace-button workspace-button-danger" type="button" onClick={handleRevokeInvite}>Revoke</button>
                </div>
                {inviteCodeDisplay && (
                  <div style={{ marginTop: '12px', display: 'flex', gap: '8px' }}>
                    <input className="workspace-input" readOnly value={inviteCodeDisplay} style={{ flex: 1, margin: 0, fontFamily: 'monospace' }} />
                    <button className="workspace-button workspace-button-ghost" type="button" onClick={() => { navigator.clipboard.writeText(inviteCodeDisplay); showFlash('success', 'Copied to clipboard'); }}>Copy</button>
                  </div>
                )}
              </div>
            </>
          )}

          {(!selectedRoom.isGroup || currentRole === 'creator' || currentRole === 'admin') && (
            <div className="workspace-card danger-card">
              <div className="room-list-header"><p className="workspace-section-title">Danger Zone</p></div>
              <p className="workspace-muted" style={{ marginBottom: '12px' }}>Permanently delete this room.</p>
              <button className="workspace-button workspace-button-danger" onClick={handleDeleteRoom} style={{ width: '100%' }}>Delete Room</button>
            </div>
          )}
        </aside>
      )}
    </div>
  );
};

export default RoomPage;
