import React, { useState, useEffect } from 'react';
import { noteAPI } from '../../services/api';

const NotesPanel = ({ user, showFlash }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [editingNote, setEditingNote] = useState(null);
  const [formDraft, setFormDraft] = useState({ title: '', content_body: '', isChecklist: false });
  const [view, setView] = useState('list'); // 'list' | 'form'

  const fetchNotes = async () => {
    setLoading(true);
    try {
      const response = await noteAPI.getNotes(searchQuery ? `?search=${encodeURIComponent(searchQuery)}` : '');
      setNotes(response.data || response.notes || response || []);
    } catch (error) {
      showFlash('error', 'Could not load notes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchNotes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  const handleCreateOrUpdate = async (e) => {
    e.preventDefault();
    if (!formDraft.title.trim()) {
      showFlash('error', 'Title is required');
      return;
    }

    try {
      if (editingNote) {
        await noteAPI.updateNote(editingNote._id || editingNote.id, formDraft);
        showFlash('success', 'Note updated');
      } else {
        await noteAPI.createNote(formDraft);
        showFlash('success', 'Note created');
      }
      setEditingNote(null);
      setFormDraft({ title: '', content_body: '', isChecklist: false });
      setView('list');
      fetchNotes();
    } catch (error) {
      showFlash('error', 'Failed to save note');
    }
  };

  const handleDelete = async (noteId) => {
    if (!window.confirm('Send this note to trash?')) return;
    try {
      await noteAPI.deleteNote(noteId);
      showFlash('success', 'Note trashed');
      fetchNotes();
    } catch (error) {
      showFlash('error', 'Failed to delete note');
    }
  };

  const handleTogglePin = async (noteId) => {
    try {
      await noteAPI.togglePin(noteId);
      fetchNotes();
    } catch (error) {
      showFlash('error', 'Failed to change pin state');
    }
  };

  const handleToggleFavorite = async (noteId) => {
    try {
      await noteAPI.toggleFavorite(noteId);
      fetchNotes();
    } catch (error) {
      showFlash('error', 'Failed to change favorite status');
    }
  };
  
  return (
    <div className="notes-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {view === 'form' && (
        <div className="workspace-card">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <p className="workspace-section-title">{editingNote ? 'Edit Note' : 'Create Note'}</p>
            <button className="workspace-link-button" onClick={() => { setView('list'); setEditingNote(null); setFormDraft({ title: '', content_body: '', isChecklist: false }); }}>Back</button>
          </div>
          <form onSubmit={handleCreateOrUpdate} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <input 
              className="workspace-input" 
              placeholder="Note title..." 
              value={formDraft.title}
              onChange={(e) => setFormDraft({...formDraft, title: e.target.value})}
            />
            <textarea 
              className="workspace-textarea" 
              placeholder="Note content..." 
              value={formDraft.content_body}
              onChange={(e) => setFormDraft({...formDraft, content_body: e.target.value})}
              style={{ minHeight: '80px' }}
            />
            <label className="workspace-checkbox" style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '14px' }}>
              <input 
                type="checkbox" 
                checked={formDraft.isChecklist}
                onChange={(e) => setFormDraft({...formDraft, isChecklist: e.target.checked})}
              />
              Format as Checklist
            </label>
            <div className="workspace-inline-actions">
              <button className="workspace-button" type="submit">
                {editingNote ? 'Update Note' : 'Save Note'}
              </button>
              {editingNote && (
                <button 
                  type="button" 
                  className="workspace-button workspace-button-ghost" 
                  onClick={() => { setEditingNote(null); setFormDraft({ title: '', content_body: '', isChecklist: false }); setView('list'); }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
        </div>
      )}

      {view === 'list' && (
        <div className="workspace-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Your Notes</p>
            <div>
              <button className="workspace-button" onClick={() => setView('form')} style={{ marginRight: '10px' }}>+ New</button>
              <button className="workspace-link-button" onClick={fetchNotes}>Refresh</button>
            </div>
          </div>
          
          <input 
            className="workspace-input" 
            placeholder="Search notes..." 
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ marginBottom: '15px' }}
          />

          {loading && <p className="workspace-muted">Loading notes...</p>}
          {!loading && notes.length === 0 && <p className="workspace-muted">No notes found.</p>}
          
          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {notes.map(note => (
              <div key={note._id || note.id} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '4px', background: note.isPinned ? 'rgba(255,255,255,0.05)' : 'transparent' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '8px' }}>
                  <h4 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {note.isPinned && <span>📌</span>}
                    {note.is_favorite && <span>⭐</span>}
                    {note.title || 'Untitled Note'}
                  </h4>
                  <div style={{ display: 'flex', gap: '10px', fontSize: '13px' }}>
                    <button className="workspace-link-button" onClick={() => handleTogglePin(note._id || note.id)}>
                      {note.isPinned ? 'Unpin' : 'Pin'}
                    </button>
                    <button className="workspace-link-button" onClick={() => handleToggleFavorite(note._id || note.id)}>
                      {note.is_favorite ? 'Unstar' : 'Star'}
                    </button>
                  </div>
                </div>
                <p style={{ margin: '0 0 12px 0', fontSize: '14px', whiteSpace: 'pre-wrap', opacity: 0.8 }}>
                  {note.content_body}
                </p>
                <div style={{ display: 'flex', gap: '12px', fontSize: '12px' }}>
                  <span className="workspace-muted">{note.isChecklist ? '✅ Checklist' : '📝 Standard'}</span>
                  <span style={{flex: 1}}></span>
                  <button 
                    className="workspace-link-button" 
                    onClick={() => { setEditingNote(note); setFormDraft({ title: note.title || '', content_body: note.content_body || '', isChecklist: note.isChecklist || false }); setView('form'); }}
                  >
                    Edit
                  </button>
                  <button 
                    className="workspace-link-button" 
                    style={{ color: '#ff4d4f' }}
                    onClick={() => handleDelete(note._id || note.id)}
                  >
                    Trash
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotesPanel;
