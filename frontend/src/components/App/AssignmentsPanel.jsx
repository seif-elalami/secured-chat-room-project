import React, { useState, useEffect, useRef } from 'react';
import { assignmentAPI } from '../../services/api';

const AssignmentsPanel = ({ roomId, currentRole, showFlash, currentUserId }) => {
  const [assignments, setAssignments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState('list'); // 'list', 'create', 'detail'
  const [activeAssignment, setActiveAssignment] = useState(null);
  
  // Teachers
  const isTeacher = ['admin', 'moderator', 'creator'].includes(currentRole);

  const fetchAssignments = async () => {
    if (!roomId) return;
    setLoading(true);
    try {
      const response = await assignmentAPI.getAssignments(roomId);
      setAssignments(response.data || []);
    } catch (error) {
      showFlash('error', 'Could not load assignments');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAssignments();
    setView('list');
    setActiveAssignment(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  const loadAssignmentDetail = async (id) => {
    try {
      const response = await assignmentAPI.getAssignmentById(id);
      setActiveAssignment(response.data);
      setView('detail');
    } catch (error) {
      showFlash('error', 'Could not load assignment details');
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this assignment permanently?')) return;
    try {
      await assignmentAPI.deleteAssignment(id);
      showFlash('success', 'Assignment deleted');
      fetchAssignments();
    } catch (error) {
      showFlash('error', 'Could not delete assignment');
    }
  };

  // CREATE FORM
  const [createForm, setCreateForm] = useState({ title: '', description: '', deadline: '' });
  const createFileInputRef = useRef(null);
  const [createFiles, setCreateFiles] = useState([]);

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!createForm.title || !createForm.description || !createForm.deadline) {
      showFlash('error', 'Title, description, and deadline are required');
      return;
    }

    const formData = new FormData();
    formData.append('title', createForm.title);
    formData.append('description', createForm.description);
    formData.append('deadline', new Date(createForm.deadline).toISOString());
    formData.append('roomId', roomId);
    Array.from(createFiles).forEach(file => formData.append('attachments', file));

    try {
      await assignmentAPI.createAssignment(formData);
      showFlash('success', 'Assignment created successfully');
      setCreateForm({ title: '', description: '', deadline: '' });
      setCreateFiles([]);
      if (createFileInputRef.current) createFileInputRef.current.value = '';
      setView('list');
      fetchAssignments();
    } catch (error) {
      showFlash('error', 'Failed to create assignment');
    }
  };

  // STUDENT SUBMISSION
  const [submitDescription, setSubmitDescription] = useState('');
  const submitFileInputRef = useRef(null);
  const [submitFiles, setSubmitFiles] = useState([]);

  const handleStudentSubmit = async (e) => {
    e.preventDefault();
    if (submitFiles.length === 0 && !submitDescription) {
      showFlash('error', 'Please attach a file or add a description to submit.');
      return;
    }
    const formData = new FormData();
    if (submitDescription) formData.append('description', submitDescription);
    Array.from(submitFiles).forEach(file => formData.append('files', file));

    try {
      await assignmentAPI.submitAssignment(activeAssignment._id, formData);
      showFlash('success', 'Assignment submitted successfully');
      setSubmitDescription('');
      setSubmitFiles([]);
      if (submitFileInputRef.current) submitFileInputRef.current.value = '';
      loadAssignmentDetail(activeAssignment._id); // refresh
    } catch (error) {
      showFlash('error', error.response?.data?.message || 'Failed to submit assignment');
    }
  };

  // TEACHER GRADING
  const [gradeDrafts, setGradeDrafts] = useState({});

  const handleGradeSubmit = async (studentId) => {
    const draft = gradeDrafts[studentId];
    if (!draft || draft.grade === undefined) return;
    try {
      await assignmentAPI.gradeSubmission(activeAssignment._id, studentId, {
        grade: Number(draft.grade),
        feedback: draft.feedback || ''
      });
      showFlash('success', 'Grade saved');
      loadAssignmentDetail(activeAssignment._id); // refresh
    } catch (error) {
      showFlash('error', 'Grading failed');
    }
  };

  if (!roomId) {
    return <div className="workspace-muted">Please select a room to view its assignments.</div>;
  }

  return (
    <div className="assignments-panel" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {view === 'list' && (
        <div className="workspace-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Room Assignments</p>
            <div>
              {isTeacher && (
                <button className="workspace-button" onClick={() => setView('create')} style={{ marginRight: '10px' }}>
                  + New
                </button>
              )}
              <button className="workspace-link-button" onClick={fetchAssignments}>Refresh</button>
            </div>
          </div>
          
          {loading && <p className="workspace-muted">Loading assignments...</p>}
          {!loading && assignments.length === 0 && <p className="workspace-muted">No assignments in this room.</p>}

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            {assignments.map(assign => (
              <div key={assign._id} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '4px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h4 style={{ margin: '0 0 5px 0' }}>{assign.title}</h4>
                  {isTeacher && (
                    <button className="workspace-link-button" style={{color: '#ff4d4f'}} onClick={() => handleDelete(assign._id)}>Delete</button>
                  )}
                </div>
                <p style={{ margin: '0 0 10px 0', fontSize: '14px', opacity: 0.8 }}>Due: {new Date(assign.deadline).toLocaleString()}</p>
                <button className="workspace-button workspace-button-ghost" onClick={() => loadAssignmentDetail(assign._id)}>
                  View Details
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {view === 'create' && isTeacher && (
        <div className="workspace-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Create New Assignment</p>
            <button className="workspace-link-button" onClick={() => setView('list')}>Back</button>
          </div>
          <form onSubmit={handleCreateSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginTop: '15px' }}>
            <input 
              className="workspace-input" placeholder="Assignment Title" 
              value={createForm.title} onChange={e => setCreateForm({...createForm, title: e.target.value})}
            />
            <textarea 
              className="workspace-textarea" placeholder="Instructions/Description" 
              value={createForm.description} onChange={e => setCreateForm({...createForm, description: e.target.value})}
            />
            <input 
              type="datetime-local" className="workspace-input" 
              value={createForm.deadline} onChange={e => setCreateForm({...createForm, deadline: e.target.value})}
            />
            <div style={{ padding: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
              <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Class Materials (Attachments)</p>
              <input type="file" multiple ref={createFileInputRef} onChange={e => setCreateFiles(e.target.files)} />
            </div>
            <button className="workspace-button" type="submit">Publish Assignment</button>
          </form>
        </div>
      )}

      {view === 'detail' && activeAssignment && (
        <div className="workspace-card">
          <div className="room-list-header">
            <p className="workspace-section-title">Details</p>
            <button className="workspace-link-button" onClick={() => setView('list')}>Back</button>
          </div>
          <h2 style={{ margin: '15px 0 5px 0' }}>{activeAssignment.title}</h2>
          <p className="workspace-muted">Due: {new Date(activeAssignment.deadline).toLocaleString()}</p>
          <div style={{ whiteSpace: 'pre-wrap', margin: '15px 0', background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '4px' }}>
            {activeAssignment.description}
          </div>

          {activeAssignment.attachments && activeAssignment.attachments.length > 0 && (
            <div style={{ marginBottom: '20px' }}>
              <p className="workspace-section-title" style={{ fontSize: '12px' }}>Materials</p>
              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '14px' }}>
                {activeAssignment.attachments.map((att, i) => (
                  <li key={i}><a href={`http://localhost:3000${att.url}`} target="_blank" rel="noreferrer" style={{color: '#61dafb'}}>{att.filename}</a></li>
                ))}
              </ul>
            </div>
          )}

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.1)', margin: '20px 0' }} />

          {/* STUDENT OVERVIEW */}
          {!isTeacher && (
            <div>
              <p className="workspace-section-title">Your Work</p>
              {activeAssignment.submissions && activeAssignment.submissions.some(sub => sub.studentId._id === currentUserId || sub.studentId === currentUserId) ? (
                (() => {
                  const mySub = activeAssignment.submissions.find(sub => sub.studentId._id === currentUserId || sub.studentId === currentUserId);
                  return (
                    <div style={{ background: 'rgba(255,255,255,0.02)', padding: '15px', borderRadius: '4px' }}>
                      <p><strong>Status:</strong> {mySub.status}</p>
                      {mySub.grade !== undefined && mySub.grade !== null && <p><strong>Grade:</strong> {mySub.grade}/100</p>}
                      {mySub.feedback && <p><strong>Teacher Feedback:</strong> {mySub.feedback}</p>}
                    </div>
                  );
                })()
              ) : (
                <form onSubmit={handleStudentSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  <textarea 
                    className="workspace-textarea" placeholder="Comments on submission (optional)" 
                    value={submitDescription} onChange={e => setSubmitDescription(e.target.value)}
                  />
                  <div style={{ padding: '10px', background: 'rgba(0,0,0,0.05)', borderRadius: '4px' }}>
                    <p style={{ margin: '0 0 5px 0', fontSize: '13px' }}>Upload Work</p>
                    <input type="file" multiple ref={submitFileInputRef} onChange={e => setSubmitFiles(e.target.files)} />
                  </div>
                  <button className="workspace-button" type="submit">Submit Assignment</button>
                </form>
              )}
            </div>
          )}

          {/* TEACHER GRADING PORTAL */}
          {isTeacher && (
            <div>
              <p className="workspace-section-title">Student Submissions ({activeAssignment.submissions?.length || 0})</p>
              {activeAssignment.submissions && activeAssignment.submissions.length > 0 ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                  {activeAssignment.submissions.map((sub, i) => {
                    const studentId = sub.studentId._id || sub.studentId;
                    const studentName = sub.studentId.username || sub.studentId.fullName || studentId;
                    return (
                      <div key={i} style={{ border: '1px solid rgba(255,255,255,0.1)', padding: '15px', borderRadius: '4px' }}>
                        <p style={{ margin: '0 0 10px 0' }}><strong>{studentName}</strong> - {sub.status}</p>
                        <p style={{ margin: '0 0 10px 0', fontSize: '14px' }}><strong>Note:</strong> {sub.description || 'None'}</p>
                        {sub.files && sub.files.length > 0 && (
                          <ul style={{ margin: '0 0 15px 0', paddingLeft: '20px', fontSize: '14px' }}>
                            {sub.files.map((f, j) => <li key={j}><a href={`http://localhost:3000${f.url}`} target="_blank" rel="noreferrer" style={{color: '#61dafb'}}>{f.filename}</a></li>)}
                          </ul>
                        )}
                        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', marginTop: '10px' }}>
                          <input 
                            type="number" className="workspace-input" placeholder="Grade (0-100)" style={{ width: '120px', padding: '6px' }}
                            value={gradeDrafts[studentId]?.grade ?? sub.grade ?? ''}
                            onChange={(e) => setGradeDrafts({...gradeDrafts, [studentId]: {...(gradeDrafts[studentId] || {}), grade: e.target.value}})}
                          />
                          <input 
                            className="workspace-input" placeholder="Feedback..." style={{ flex: 1, padding: '6px' }}
                            value={gradeDrafts[studentId]?.feedback ?? sub.feedback ?? ''}
                            onChange={(e) => setGradeDrafts({...gradeDrafts, [studentId]: {...(gradeDrafts[studentId] || {}), feedback: e.target.value}})}
                          />
                          <button className="workspace-button" onClick={() => handleGradeSubmit(studentId)} style={{ padding: '6px 15px' }}>
                            Save
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="workspace-muted">No submissions yet.</p>
              )}
            </div>
          )}

        </div>
      )}
    </div>
  );
};

export default AssignmentsPanel;
