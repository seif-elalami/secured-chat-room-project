import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { messageAPI, roomAPI, userAPI } from '../../services/api';
import NotesPanel from './NotesPanel';
import AssignmentsPanel from './AssignmentsPanel';
import '../../styles/AppShell.css';

const REACTION_OPTIONS = ['👍', '❤️', '😂'];

const getUserId = (value) => value?._id || value?.id || '';

const getDisplayName = (value) =>
  value?.fullName ||
  [value?.firstName, value?.lastName].filter(Boolean).join(' ') ||
  value?.username ||
  'Unknown user';

const getErrorMessage = (error, fallback) =>
  error?.response?.data?.message || error?.message || fallback;

const Dashboard = () => {
  const navigate = useNavigate();
  const { user, logout, updateSessionUser } = useAuth();

  const [rooms, setRooms] = useState([]);
  const [selectedRoomId, setSelectedRoomId] = useState('');
  const [selectedRoom, setSelectedRoom] = useState(null);
  const [roomRoleInfo, setRoomRoleInfo] = useState(null);
  const [messages, setMessages] = useState([]);
  const [pinnedMessages, setPinnedMessages] = useState([]);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [profile, setProfile] = useState(null);
  const [profileDraft, setProfileDraft] = useState({
    username: '',
    email: '',
    phone: '',
    firstName: '',
    lastName: '',
    fullName: '',
    bio: '',
  });
  const [lookupUserId, setLookupUserId] = useState('');
  const [lookupResult, setLookupResult] = useState(null);
  const [messageDraft, setMessageDraft] = useState('');
  const [groupForm, setGroupForm] = useState({
    title: '',
    userIds: '',
  });
  const [directUserId, setDirectUserId] = useState('');
  const [inviteCode, setInviteCode] = useState('');
  const [memberToAdd, setMemberToAdd] = useState('');
  const [promotion, setPromotion] = useState({
    targetUserId: '',
    targetRole: 'moderator',
  });
  const [demotionUserId, setDemotionUserId] = useState('');
  const [roomSettings, setRoomSettings] = useState({
    title: '',
    description: '',
    messagingPolicy: 'all_members',
    allowInvites: true,
    maxParticipants: 50,
  });
  const [activePanel, setActivePanel] = useState('profile');
  const [flash, setFlash] = useState({ type: '', message: '' });
  const [bootstrapping, setBootstrapping] = useState(true);
  const [roomLoading, setRoomLoading] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [roomStats, setRoomStats] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const fileInputRef = useRef(null);
  const [activeMessageInfoId, setActiveMessageInfoId] = useState(null);
  const [messageReaders, setMessageReaders] = useState([]);

  const currentUserId = getUserId(user);
  const currentRole = roomRoleInfo?.currentUser?.role || 'member';
  const currentPermissions = roomRoleInfo?.currentUser?.permissions || {};
  const canSendMessages = roomRoleInfo?.currentUser?.canSendMessages ?? false;

  const roomMembers = useMemo(
    () => roomRoleInfo?.allMembers || [],
    [roomRoleInfo]
  );

  const visibleRoomTitle = useMemo(() => {
    if (!selectedRoom) {
      return 'Choose a room';
    }

    if (selectedRoom.isGroup) {
      return selectedRoom.title || 'Group room';
    }

    const otherUser = (selectedRoom.users || []).find(
      (entry) => getUserId(entry) !== currentUserId
    );

    return otherUser ? getDisplayName(otherUser) : selectedRoom.title || 'Direct room';
  }, [currentUserId, selectedRoom]);

  const showFlash = (type, message) => {
    setFlash({ type, message });
  };

  const syncProfileState = (nextProfile) => {
    setProfile(nextProfile);
    setProfileDraft({
      username: nextProfile?.username || '',
      email: nextProfile?.email || '',
      phone: nextProfile?.phone || '',
      firstName: nextProfile?.firstName || '',
      lastName: nextProfile?.lastName || '',
      fullName: nextProfile?.fullName || '',
      bio: nextProfile?.bio || '',
    });
    updateSessionUser({
      ...user,
      ...nextProfile,
      id: nextProfile?._id || nextProfile?.id || user?.id,
    });
  };

  const loadRooms = async (preferredRoomId) => {
    const roomResponse = await roomAPI.getRooms();
    const nextRooms = roomResponse.data || [];
    setRooms(nextRooms);

    const nextSelectedId =
      preferredRoomId ||
      (nextRooms.some((room) => room._id === selectedRoomId) ? selectedRoomId : nextRooms[0]?._id || '');

    setSelectedRoomId(nextSelectedId);
    return nextSelectedId;
  };

  const loadBlockedUsers = async () => {
    const blockedResponse = await userAPI.getBlocked();
    setBlockedUsers(blockedResponse.blockedUsers || []);
  };

  const loadRoomContext = async (roomId) => {
    if (!roomId) {
      setSelectedRoom(null);
      setRoomRoleInfo(null);
      setMessages([]);
      setPinnedMessages([]);
      setRoomStats(null);
      return;
    }

    setRoomLoading(true);
    try {
      const [roomResponse, roleResponse, messageResponse, pinnedResponse] = await Promise.all([
        roomAPI.getRoomById(roomId),
        roomAPI.getRoleInfo(roomId),
        messageAPI.getMessages(roomId),
        messageAPI.getPinnedMessages(roomId),
      ]);

      const nextRoom = roomResponse.data;
      const nextRoleInfo = roleResponse.data;
      const nextMessages = messageResponse.data || [];

      setSelectedRoom(nextRoom);
      setRoomRoleInfo(nextRoleInfo);
      setMessages(nextMessages);
      setPinnedMessages(pinnedResponse.data || []);
      setRoomSettings({
        title: nextRoom?.title || '',
        description: nextRoom?.description || '',
        messagingPolicy: nextRoom?.settings?.messagingPolicy || 'all_members',
        allowInvites: nextRoom?.settings?.allowInvites ?? true,
        maxParticipants: nextRoom?.settings?.maxParticipants || 50,
      });

      const unreadIds = nextMessages
        .filter((entry) => getUserId(entry.author) !== currentUserId)
        .map((entry) => entry._id);

      if (unreadIds.length) {
        await messageAPI.markReadBatch(unreadIds);
      }
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load room details'));
    } finally {
      setRoomLoading(false);
    }
  };

  const bootstrap = async () => {
    setBootstrapping(true);
    try {
      const profileResponse = await userAPI.getMe();
      syncProfileState(profileResponse);
      await loadBlockedUsers();
      const roomId = await loadRooms();
      if (roomId) {
        await loadRoomContext(roomId);
      }
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load workspace'));
    } finally {
      setBootstrapping(false);
    }
  };

  useEffect(() => {
    bootstrap();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedRoomId) {
      setSelectedRoom(null);
      setRoomRoleInfo(null);
      setMessages([]);
      setPinnedMessages([]);
      return;
    }

    loadRoomContext(selectedRoomId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedRoomId]);

  const handleProfileDraftChange = (event) => {
    setProfileDraft((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
  };

  const handleUpdateProfile = async (event) => {
    event.preventDefault();
    try {
      const response = await userAPI.updateMe({
        username: profileDraft.username.trim(),
        email: profileDraft.email.trim(),
        phone: profileDraft.phone.trim(),
        firstName: profileDraft.firstName.trim(),
        lastName: profileDraft.lastName.trim(),
        fullName: profileDraft.fullName.trim(),
        bio: profileDraft.bio.trim(),
      });
      syncProfileState(response);
      showFlash('success', 'Profile updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not update profile'));
    }
  };

  const handleDeleteAccount = async () => {
    const confirmed = window.confirm('Delete this account permanently? This cannot be undone.');
    if (!confirmed) {
      return;
    }

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
    if (!lookupUserId.trim()) {
      showFlash('error', 'Enter a user ID to look up');
      return;
    }

    try {
      const response = await userAPI.getById(lookupUserId.trim());
      setLookupResult(response);
      showFlash('success', 'User loaded');
    } catch (error) {
      setLookupResult(null);
      showFlash('error', getErrorMessage(error, 'Could not find that user'));
    }
  };

  const handleBlockAction = async (targetUserId, action) => {
    try {
      if (action === 'block') {
        await userAPI.blockById(targetUserId);
      } else {
        await userAPI.unblockById(targetUserId);
      }
      await loadBlockedUsers();
      showFlash('success', action === 'block' ? 'User blocked' : 'User unblocked');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Block action failed'));
    }
  };

  const handleCreateGroupRoom = async (event) => {
    event.preventDefault();

    const inputIds = groupForm.userIds
      .split(',')
      .map((value) => value.trim())
      .filter(Boolean);
    const users = Array.from(new Set([...inputIds, currentUserId]));

    try {
      const response = await roomAPI.createGroupRoom({
        title: groupForm.title.trim(),
        users,
        isGroup: true,
      });
      const nextRoomId = response?.data?._id;
      setGroupForm({ title: '', userIds: '' });
      const selectedId = await loadRooms(nextRoomId);
      setSelectedRoomId(selectedId);
      showFlash('success', response.message || 'Group room created');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not create room'));
    }
  };

  const handleCreateDirectRoom = async (event) => {
    event.preventDefault();
    if (!directUserId.trim()) {
      showFlash('error', 'Enter the other user ID');
      return;
    }

    try {
      const response = await roomAPI.createDirectRoom({ otherUserId: directUserId.trim() });
      const nextRoomId = response?.data?._id;
      setDirectUserId('');
      const selectedId = await loadRooms(nextRoomId);
      setSelectedRoomId(selectedId);
      showFlash('success', response.message || 'Direct room ready');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not open direct room'));
    }
  };

  const handleJoinInvite = async (event) => {
    event.preventDefault();
    if (!inviteCode.trim()) {
      showFlash('error', 'Enter an invite code');
      return;
    }

    try {
      const response = await roomAPI.joinInvite(inviteCode.trim());
      const nextRoomId = response?.data?.room?._id;
      setInviteCode('');
      const selectedId = await loadRooms(nextRoomId);
      setSelectedRoomId(selectedId);
      showFlash('success', response.message || 'Joined room');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not join room'));
    }
  };

  const handleSendMessage = async (event) => {
    event.preventDefault();
    if (!selectedRoomId || (!messageDraft.trim() && !selectedFile)) {
      return;
    }

    setSendingMessage(true);
    try {
      if (selectedFile) {
        const formData = new FormData();
        formData.append('media', selectedFile);
        if (messageDraft.trim()) formData.append('content', messageDraft.trim());
        await messageAPI.uploadMedia(selectedRoomId, formData);
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
      } else {
        await messageAPI.sendMessage({
          roomId: selectedRoomId,
          content: messageDraft.trim(),
        });
      }
      setMessageDraft('');
      await loadRoomContext(selectedRoomId);
      await loadRooms(selectedRoomId);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not send message'));
    } finally {
      setSendingMessage(false);
    }
  };

  const handleEditMessage = async (messageId, currentContent) => {
    const nextContent = window.prompt('Edit message', currentContent || '');
    if (nextContent === null || !nextContent.trim()) {
      return;
    }

    try {
      await messageAPI.editMessage(messageId, nextContent.trim());
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Message updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not edit message'));
    }
  };

  const handleDeleteMessage = async (messageId) => {
    const confirmed = window.confirm('Delete this message?');
    if (!confirmed) {
      return;
    }

    try {
      await messageAPI.deleteMessage(messageId);
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Message deleted');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not delete message'));
    }
  };

  const handleReaction = async (messageId, emoji) => {
    try {
      await messageAPI.toggleReaction(messageId, emoji);
      await loadRoomContext(selectedRoomId);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not update reaction'));
    }
  };

  const handlePinMessage = async (messageId) => {
    try {
      await messageAPI.pinMessage(messageId);
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Pin state updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not change pin state'));
    }
  };

  const handleRoomSettingsChange = (event) => {
    const { name, value, type, checked } = event.target;
    setRoomSettings((current) => ({
      ...current,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleUpdateRoomSettings = async (event) => {
    event.preventDefault();
    if (!selectedRoomId) {
      return;
    }

    try {
      await roomAPI.updateSettings(selectedRoomId, {
        title: roomSettings.title,
        description: roomSettings.description,
        messagingPolicy: roomSettings.messagingPolicy,
        allowInvites: roomSettings.allowInvites,
        maxParticipants: Number(roomSettings.maxParticipants),
      });
      await loadRooms(selectedRoomId);
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Room settings updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not update room settings'));
    }
  };

  const handleAddMember = async (event) => {
    event.preventDefault();
    if (!selectedRoomId || !memberToAdd.trim()) {
      return;
    }

    try {
      await roomAPI.addMember(selectedRoomId, memberToAdd.trim());
      setMemberToAdd('');
      await loadRoomContext(selectedRoomId);
      await loadRooms(selectedRoomId);
      showFlash('success', 'Member added');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not add member'));
    }
  };

  const handleRemoveMember = async (userId) => {
    const confirmed = window.confirm('Are you sure you want to remove this member?');
    if (!confirmed) return;
    try {
      await roomAPI.removeMember(selectedRoomId, userId);
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Member removed');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not remove member'));
    }
  };

  const handlePromotion = async (event) => {
    event.preventDefault();
    if (!promotion.targetUserId.trim()) {
      return;
    }

    try {
      await roomAPI.promoteMember(selectedRoomId, {
        targetUserId: promotion.targetUserId.trim(),
        targetRole: promotion.targetRole,
      });
      setPromotion({ targetUserId: '', targetRole: promotion.targetRole });
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Member role updated');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not promote member'));
    }
  };

  const handleDemotion = async (event) => {
    event.preventDefault();
    if (!demotionUserId.trim()) {
      return;
    }

    try {
      await roomAPI.demoteMember(selectedRoomId, demotionUserId.trim());
      setDemotionUserId('');
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Member demoted');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not demote member'));
    }
  };

  const handleGenerateInvite = async () => {
    try {
      const response = await roomAPI.generateInvite(selectedRoomId);
      showFlash('success', response.message || 'Invite created');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not generate invite'));
    }
  };

  const handleFetchInvite = async () => {
    try {
      const response = await roomAPI.getInvite(selectedRoomId);
      const invite = response?.data?.inviteCode || response?.data?.inviteUrl;
      showFlash('success', invite ? `Invite: ${invite}` : 'Invite loaded');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load invite'));
    }
  };

  const handleRevokeInvite = async () => {
    try {
      await roomAPI.revokeInvite(selectedRoomId);
      showFlash('success', 'Invite revoked successfully');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not revoke invite'));
    }
  };

  const handleGetStatistics = async () => {
    try {
      const response = await roomAPI.getStatistics(selectedRoomId);
      setRoomStats(response.data || response.statistics || response);
      showFlash('success', 'Statistics loaded');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load statistics'));
    }
  };

  const handleDeleteRoom = async () => {
    const confirmed = window.confirm('Are you sure you want to permanently delete this room? This action cannot be undone.');
    if (!confirmed) return;
    try {
      await roomAPI.deleteRoom(selectedRoomId);
      showFlash('success', 'Room deleted successfully');
      await loadRooms();
      setSelectedRoomId('');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not delete room'));
    }
  };

  const handleDeleteMedia = async (messageId, mediaId) => {
    const confirmed = window.confirm('Delete this media?');
    if (!confirmed) return;
    try {
      await messageAPI.deleteMedia(messageId, mediaId);
      await loadRoomContext(selectedRoomId);
      showFlash('success', 'Media deleted');
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not delete media'));
    }
  };

  const handleViewReaders = async (messageId) => {
    if (activeMessageInfoId === messageId) {
      setActiveMessageInfoId(null);
      setMessageReaders([]);
      return;
    }
    
    try {
      const response = await messageAPI.getMessageReaders(messageId);
      setMessageReaders(response.data || response.readers || response || []);
      setActiveMessageInfoId(messageId);
    } catch (error) {
      showFlash('error', getErrorMessage(error, 'Could not load message readers'));
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  if (bootstrapping) {
    return (
      <div className="workspace-loading">
        <div className="workspace-loading-card">
          <p className="workspace-loading-label">Secured Chat Workspace</p>
          <h1>Booting the collaboration console...</h1>
        </div>
      </div>
    );
  }

  return (
    <div className="workspace-shell">
      <aside className="workspace-sidebar">
        <div className="workspace-brand">
          <p className="workspace-kicker">Secured Chat Room</p>
          <h1>Operator Console</h1>
          <p className="workspace-muted">
            Rooms, member roles, input-driven chat, and user controls live together here.
          </p>
        </div>

        <div className="workspace-card">
          <p className="workspace-section-title">Signed In</p>
          <h2>{getDisplayName(profile || user)}</h2>
          <p className="workspace-muted">@{profile?.username || user?.username}</p>
          <p className="workspace-muted">{profile?.email || user?.email}</p>
          <button className="workspace-button workspace-button-ghost" onClick={handleLogout}>
            Logout
          </button>
        </div>

        <form className="workspace-card" onSubmit={handleCreateGroupRoom}>
          <p className="workspace-section-title">Create Group Room</p>
          <input
            className="workspace-input"
            placeholder="Room title"
            value={groupForm.title}
            onChange={(event) =>
              setGroupForm((current) => ({ ...current, title: event.target.value }))
            }
          />
          <textarea
            className="workspace-textarea"
            placeholder="Comma-separated user IDs. Your ID is auto-added."
            value={groupForm.userIds}
            onChange={(event) =>
              setGroupForm((current) => ({ ...current, userIds: event.target.value }))
            }
          />
          <button className="workspace-button" type="submit">
            Create Group
          </button>
        </form>

        <form className="workspace-card" onSubmit={handleCreateDirectRoom}>
          <p className="workspace-section-title">Open Direct Room</p>
          <input
            className="workspace-input"
            placeholder="Other user ID"
            value={directUserId}
            onChange={(event) => setDirectUserId(event.target.value)}
          />
          <button className="workspace-button" type="submit">
            Open Direct Chat
          </button>
        </form>

        <form className="workspace-card" onSubmit={handleJoinInvite}>
          <p className="workspace-section-title">Join By Invite</p>
          <input
            className="workspace-input"
            placeholder="Invite code"
            value={inviteCode}
            onChange={(event) => setInviteCode(event.target.value)}
          />
          <button className="workspace-button" type="submit">
            Join Room
          </button>
        </form>

        <div className="workspace-card room-list-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Your Rooms</p>
            <button className="workspace-link-button" onClick={() => loadRooms(selectedRoomId)}>
              Refresh
            </button>
          </div>
          <div className="room-list">
            {rooms.length === 0 && <p className="workspace-muted">No rooms yet.</p>}
            {rooms.map((room) => {
              const roomLabel = room.isGroup
                ? room.title
                : getDisplayName(
                    (room.users || []).find((entry) => getUserId(entry) !== currentUserId)
                  ) || room.title;

              return (
                <button
                  key={room._id}
                  className={`room-list-item ${selectedRoomId === room._id ? 'is-active' : ''}`}
                  onClick={() => setSelectedRoomId(room._id)}
                >
                  <span className="room-list-title">{roomLabel}</span>
                  <span className="room-list-meta">
                    {room.isGroup ? 'Group' : 'Direct'} · {room.users?.length || 0} users
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>

      <main className="workspace-main">
        {flash.message && (
          <div className={`workspace-flash ${flash.type === 'error' ? 'is-error' : 'is-success'}`}>
            {flash.message}
          </div>
        )}

        <section className="workspace-room">
          <header className="workspace-room-header">
            <div>
              <p className="workspace-section-title">Current Room</p>
              <h2>{visibleRoomTitle}</h2>
              <p className="workspace-muted">
                {selectedRoom
                  ? `${selectedRoom.isGroup ? 'Group room' : 'Direct chat'} · Your role: ${currentRole}`
                  : 'Select a room from the sidebar to load messages and controls.'}
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
            <div className="workspace-card pinned-card">
              <p className="workspace-section-title">Pinned Messages</p>
              <div className="pinned-list">
                {pinnedMessages.map((entry) => (
                  <div key={entry._id} className="pinned-item">
                    <strong>{entry.author?.username || 'Unknown'}:</strong> {entry.content}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="workspace-card message-panel">
            <div className="message-list">
              {roomLoading && <p className="workspace-muted">Loading room details...</p>}
              {!roomLoading && !selectedRoom && (
                <p className="workspace-muted">No room selected yet.</p>
              )}
              {!roomLoading && selectedRoom && messages.length === 0 && (
                <p className="workspace-muted">No messages yet. Start the room conversation below.</p>
              )}

              {messages.map((entry) => {
                const mine = getUserId(entry.author) === currentUserId;
                const canModerate = ['moderator', 'admin', 'creator'].includes(currentRole);

                return (
                  <article
                    key={entry._id}
                    className={`message-item ${mine ? 'is-mine' : ''}`}
                  >
                    <div className="message-item-head">
                      <div>
                        <strong>{entry.author?.username || 'Unknown user'}</strong>
                        <span className="message-meta">
                          {new Date(entry.createdAt || entry.date || Date.now()).toLocaleString()}
                        </span>
                      </div>
                      <div className="message-actions">
                        {mine && entry.type === 'text' && !entry.isDeleted && (
                          <button
                            className="workspace-link-button"
                            onClick={() => handleEditMessage(entry._id, entry.content)}
                          >
                            Edit
                          </button>
                        )}
                        {(mine || canModerate) && (
                          <button
                            className="workspace-link-button"
                            onClick={() => handleDeleteMessage(entry._id)}
                          >
                            Delete
                          </button>
                        )}
                        {canModerate && (
                          <button
                            className="workspace-link-button"
                            onClick={() => handlePinMessage(entry._id)}
                            style={{marginLeft: '8px'}}
                          >
                            {entry.isPinned ? 'Unpin' : 'Pin'}
                          </button>
                        )}
                        {mine && (
                          <button
                            className="workspace-link-button"
                            onClick={() => handleViewReaders(entry._id)}
                            style={{marginLeft: '8px'}}
                          >
                            Info
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="message-body">
                      {entry.replyToContent?.content && (
                        <div className="message-reply-preview">
                          Replying to {entry.replyToContent.author?.username || 'a message'}: {entry.replyToContent.content}
                        </div>
                      )}

                      <p>{entry.isDeleted ? '[Message deleted]' : entry.content}</p>

                      {entry.media && entry.media.length > 0 && (
                        <div className="message-media">
                          {entry.media.map(m => (
                            <div key={m._id} style={{ marginTop: '10px' }}>
                              <img src={m.url || 'https://via.placeholder.com/150'} alt="Attachment preview" style={{ maxWidth: '100%', borderRadius: '4px', maxHeight: '200px', objectFit: 'cover' }} />
                              {mine && !entry.isDeleted && (
                                <button
                                  className="workspace-link-button"
                                  onClick={() => handleDeleteMedia(entry._id, m._id)}
                                  style={{ display: 'block', marginTop: '4px', color: '#ff4d4f' }}
                                >
                                  Delete Media
                                </button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}

                      {entry.location?.url && (
                        <a href={entry.location.url} target="_blank" rel="noreferrer" className="message-link">
                          Open shared location
                        </a>
                      )}
                    </div>

                    <div className="message-reactions">
                      {REACTION_OPTIONS.map((emoji) => (
                        <button
                          key={emoji}
                          className="reaction-pill"
                          onClick={() => handleReaction(entry._id, emoji)}
                        >
                          {emoji}
                        </button>
                      ))}
                       {entry.reactions?.length > 0 && (
                        <span className="workspace-muted">{entry.reactions.length} reactions</span>
                      )}
                    </div>

                    {activeMessageInfoId === entry._id && (
                      <div className="message-readers-panel" style={{ marginTop: '8px', padding: '8px', background: 'rgba(0,0,0,0.02)', borderRadius: '4px', fontSize: '12px' }}>
                        <strong>Read by:</strong>
                        {messageReaders.length > 0 ? (
                          <ul style={{ margin: '4px 0 0 0', paddingLeft: '20px' }}>
                            {messageReaders.map(reader => (
                              <li key={reader._id || reader.id}>{getDisplayName(reader)}</li>
                            ))}
                          </ul>
                        ) : (
                          <p style={{ margin: '4px 0 0 0', opacity: 0.7 }}>No one has read this yet.</p>
                        )}
                      </div>
                    )}
                  </article>
                );
              })}
            </div>

            <form className="message-composer" onSubmit={handleSendMessage} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {selectedFile && (
                <div style={{ padding: '8px 12px', fontSize: '13px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px', display: 'flex', justifyContent: 'space-between' }}>
                  <span><strong style={{ opacity: 0.7 }}>Attachment:</strong> {selectedFile.name}</span>
                  <button type="button" className="workspace-link-button" onClick={() => { setSelectedFile(null); if(fileInputRef.current) fileInputRef.current.value = ''; }} style={{color: '#ff4d4f'}}>Remove</button>
                </div>
              )}
              <div style={{ display: 'flex', gap: '10px', width: '100%', alignItems: 'flex-start' }}>
                <input
                  type="file"
                  ref={fileInputRef}
                  onChange={(e) => setSelectedFile(e.target.files[0])}
                  style={{ display: 'none' }}
                />
                <button
                  type="button"
                  className="workspace-button workspace-button-ghost"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={!selectedRoom || !canSendMessages || sendingMessage}
                  style={{ padding: '0 12px', height: '100%', minHeight: '44px', display: 'flex', alignItems: 'center' }}
                  title="Attach Media"
                >
                  📎
                </button>
                <textarea
                  className="workspace-textarea"
                  style={{ flex: 1, margin: 0, minHeight: '44px' }}
                  placeholder={
                    canSendMessages
                      ? 'Type a message for this room...'
                      : 'Messaging is restricted by room policy for your current role.'
                  }
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  disabled={!selectedRoom || !canSendMessages || sendingMessage}
                />
                <button
                  className="workspace-button"
                  style={{ height: '100%', minHeight: '44px' }}
                  type="submit"
                  disabled={!selectedRoom || !canSendMessages || sendingMessage}
                >
                  {sendingMessage ? 'Sending...' : 'Send'}
                </button>
              </div>
            </form>
          </div>
        </section>
      </main>

      <aside className="workspace-detail">
        <div className="workspace-tabs">
          <button
            className={`workspace-tab ${activePanel === 'profile' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('profile')}
          >
            Profile
          </button>
          <button
            className={`workspace-tab ${activePanel === 'users' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('users')}
          >
            Users
          </button>
          <button
            className={`workspace-tab ${activePanel === 'room' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('room')}
          >
            Room
          </button>
          <button
            className={`workspace-tab ${activePanel === 'notes' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('notes')}
          >
            Notes
          </button>
          <button
            className={`workspace-tab ${activePanel === 'assignments' ? 'is-active' : ''}`}
            onClick={() => setActivePanel('assignments')}
          >
            Assignments
          </button>
        </div>

        {activePanel === 'profile' && (
          <>
            <form className="workspace-card" onSubmit={handleUpdateProfile}>
              <p className="workspace-section-title">My Profile</p>
              <div className="workspace-grid">
                <input className="workspace-input" name="firstName" value={profileDraft.firstName} onChange={handleProfileDraftChange} placeholder="First name" />
                <input className="workspace-input" name="lastName" value={profileDraft.lastName} onChange={handleProfileDraftChange} placeholder="Last name" />
              </div>
              <input className="workspace-input" name="username" value={profileDraft.username} onChange={handleProfileDraftChange} placeholder="Username" />
              <input className="workspace-input" name="email" value={profileDraft.email} onChange={handleProfileDraftChange} placeholder="Email" />
              <input className="workspace-input" name="phone" value={profileDraft.phone} onChange={handleProfileDraftChange} placeholder="Phone" />
              <input className="workspace-input" name="fullName" value={profileDraft.fullName} onChange={handleProfileDraftChange} placeholder="Full name" />
              <textarea className="workspace-textarea" name="bio" value={profileDraft.bio} onChange={handleProfileDraftChange} placeholder="Bio" />
              <button className="workspace-button" type="submit">
                Save Profile
              </button>
            </form>

            <div className="workspace-card danger-card">
              <p className="workspace-section-title">Danger Zone</p>
              <p className="workspace-muted">Delete the signed-in account and clear the session from this device.</p>
              <button className="workspace-button workspace-button-danger" onClick={handleDeleteAccount}>
                Delete Account
              </button>
            </div>
          </>
        )}

        {activePanel === 'users' && (
          <>
            <form className="workspace-card" onSubmit={handleLookupUser}>
              <p className="workspace-section-title">User Lookup By ID</p>
              <input
                className="workspace-input"
                value={lookupUserId}
                onChange={(event) => setLookupUserId(event.target.value)}
                placeholder="Paste a user ID"
              />
              <button className="workspace-button" type="submit">
                View Profile
              </button>
            </form>

            {lookupResult && (
              <div className="workspace-card">
                <p className="workspace-section-title">Lookup Result</p>
                <h3>{getDisplayName(lookupResult)}</h3>
                <p className="workspace-muted">@{lookupResult.username}</p>
                <p className="workspace-muted">{lookupResult.email}</p>
                <p className="workspace-muted">{lookupResult.phone}</p>
                <div className="workspace-inline-actions">
                  <button
                    className="workspace-button"
                    onClick={() => handleBlockAction(getUserId(lookupResult), 'block')}
                  >
                    Block User
                  </button>
                  <button
                    className="workspace-button workspace-button-ghost"
                    onClick={() => handleBlockAction(getUserId(lookupResult), 'unblock')}
                  >
                    Unblock User
                  </button>
                </div>
              </div>
            )}

            <div className="workspace-card">
              <div className="room-list-header">
                <p className="workspace-section-title">Blocked Users</p>
                <button className="workspace-link-button" onClick={loadBlockedUsers}>
                  Refresh
                </button>
              </div>
              <div className="blocked-list">
                {blockedUsers.length === 0 && <p className="workspace-muted">No blocked users.</p>}
                {blockedUsers.map((entry) => (
                  <div key={entry._id} className="blocked-item">
                    <div>
                      <strong>{getDisplayName(entry)}</strong>
                      <p className="workspace-muted">{entry.email}</p>
                    </div>
                    <button
                      className="workspace-button workspace-button-ghost"
                      onClick={() => handleBlockAction(entry._id, 'unblock')}
                    >
                      Unblock
                    </button>
                  </div>
                ))}
              </div>
            </div>
          </>
        )}

        {activePanel === 'room' && (
          <>
            <div className="workspace-card">
              <p className="workspace-section-title">Room Access</p>
              {!selectedRoom && <p className="workspace-muted">Select a room to reveal member and settings controls.</p>}
              {selectedRoom && (
                <>
                  <h3>{visibleRoomTitle}</h3>
                  <p className="workspace-muted">Your role: {currentRole}</p>
                  <div className="member-role-list">
                    {roomMembers.map((entry) => (
                      <div key={entry.id} className="member-role-item" style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center'}}>
                        <span>{entry.username}</span>
                        <div>
                          <span className="workspace-badge">{entry.role}</span>
                          {currentPermissions.canManageMembers && entry.id !== currentUserId && (
                            <button
                              className="workspace-link-button"
                              onClick={() => handleRemoveMember(entry.id)}
                              style={{ marginLeft: '10px', color: '#ff4d4f' }}
                            >
                              Kick
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            {selectedRoom && currentPermissions.canManageMembers && (
              <form className="workspace-card" onSubmit={handleAddMember}>
                <p className="workspace-section-title">Add Member</p>
                <input
                  className="workspace-input"
                  value={memberToAdd}
                  onChange={(event) => setMemberToAdd(event.target.value)}
                  placeholder="User ID"
                />
                <button className="workspace-button" type="submit">
                  Add Member
                </button>
              </form>
            )}

            {selectedRoom && (currentRole === 'creator' || currentRole === 'admin') && (
              <>
                <form className="workspace-card" onSubmit={handlePromotion}>
                  <p className="workspace-section-title">Promote Member</p>
                  <input
                    className="workspace-input"
                    value={promotion.targetUserId}
                    onChange={(event) =>
                      setPromotion((current) => ({ ...current, targetUserId: event.target.value }))
                    }
                    placeholder="Target user ID"
                  />
                  <select
                    className="workspace-input"
                    value={promotion.targetRole}
                    onChange={(event) =>
                      setPromotion((current) => ({ ...current, targetRole: event.target.value }))
                    }
                  >
                    <option value="moderator">Moderator</option>
                    <option value="admin">Admin</option>
                  </select>
                  <button className="workspace-button" type="submit">
                    Promote
                  </button>
                </form>

                <form className="workspace-card" onSubmit={handleDemotion}>
                  <p className="workspace-section-title">Demote Member</p>
                  <input
                    className="workspace-input"
                    value={demotionUserId}
                    onChange={(event) => setDemotionUserId(event.target.value)}
                    placeholder="Target user ID"
                  />
                  <button className="workspace-button workspace-button-ghost" type="submit">
                    Demote To Member
                  </button>
                </form>
              </>
            )}

            {selectedRoom && currentPermissions.canChangeSettings && (
              <>
                <form className="workspace-card" onSubmit={handleUpdateRoomSettings}>
                  <p className="workspace-section-title">Room Settings</p>
                  <input className="workspace-input" name="title" value={roomSettings.title} onChange={handleRoomSettingsChange} placeholder="Title" />
                  <textarea className="workspace-textarea" name="description" value={roomSettings.description} onChange={handleRoomSettingsChange} placeholder="Description" />
                  <select className="workspace-input" name="messagingPolicy" value={roomSettings.messagingPolicy} onChange={handleRoomSettingsChange}>
                    <option value="all_members">All members can send</option>
                    <option value="admins_only">Admins only can send</option>
                  </select>
                  <input className="workspace-input" name="maxParticipants" type="number" value={roomSettings.maxParticipants} onChange={handleRoomSettingsChange} />
                  <label className="workspace-checkbox">
                    <input type="checkbox" name="allowInvites" checked={roomSettings.allowInvites} onChange={handleRoomSettingsChange} />
                    Allow invite links
                  </label>
                  <button className="workspace-button" type="submit">
                    Save Room Settings
                  </button>
                </form>

                <div className="workspace-card">
                  <div className="room-list-header">
                    <p className="workspace-section-title">Room Statistics</p>
                    <button className="workspace-link-button" onClick={handleGetStatistics}>
                      Load Stats
                    </button>
                  </div>
                  {roomStats && (
                    <div className="stats-display" style={{ marginTop: '10px', padding: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                      <pre style={{ fontSize: '12px', whiteSpace: 'pre-wrap', margin: 0 }}>
                        {JSON.stringify(roomStats, null, 2)}
                      </pre>
                    </div>
                  )}
                </div>

                <div className="workspace-card">
                  <p className="workspace-section-title">Invite Controls</p>
                  <div className="workspace-inline-actions">
                    <button className="workspace-button" onClick={handleGenerateInvite}>
                      Generate Invite
                    </button>
                    <button className="workspace-button workspace-button-ghost" onClick={handleFetchInvite}>
                      View Invite
                    </button>
                    <button className="workspace-button workspace-button-danger" onClick={handleRevokeInvite}>
                      Revoke
                    </button>
                  </div>
                </div>
              </>
            )}

            {selectedRoom && (currentRole === 'creator' || currentRole === 'admin') && (
              <div className="workspace-card danger-card">
                <div className="room-list-header">
                  <p className="workspace-section-title">Danger Zone</p>
                </div>
                <p className="workspace-muted" style={{ marginBottom: '12px' }}>
                  Permanently delete this entire room and erase all its messages, settings, and media.
                </p>
                <button className="workspace-button workspace-button-danger" onClick={handleDeleteRoom} style={{ width: '100%' }}>
                  Delete Room
                </button>
              </div>
            )}
          </>
        )}

        {activePanel === 'notes' && (
          <NotesPanel user={profile || user} showFlash={showFlash} />
        )}

        {activePanel === 'assignments' && (
          <AssignmentsPanel 
            roomId={selectedRoomId} 
            currentRole={currentRole} 
            showFlash={showFlash} 
            currentUserId={currentUserId} 
          />
        )}
      </aside>
    </div>
  );
};

export default Dashboard;
