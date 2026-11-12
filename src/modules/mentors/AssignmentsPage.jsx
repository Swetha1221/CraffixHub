import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Upload, CheckCircle2 } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function AssignmentsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canCreate = ['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole);
  const isStudent = user?.primaryRole === 'STUDENT';

  const [assignments, setAssignments] = useState([]);
  const [submissions, setSubmissions] = useState([]);
  const [batches, setBatches] = useState([]);
  const [createOpen, setCreateOpen] = useState(false);
  const [submitTarget, setSubmitTarget] = useState(null);
  const [evalTarget, setEvalTarget] = useState(null);

  const [createForm, setCreateForm] = useState({ title: '', description: '', batchId: '', courseId: '', maxMarks: 100, dueDate: '' });
  const [submitForm, setSubmitForm] = useState({ submissionUrl: '', notes: '' });
  const [evalForm, setEvalForm] = useState({ marks: '', feedback: '' });

  const loadData = useCallback(async () => {
    const [aRes, sRes] = await Promise.all([api.get('/mentors/assignments'), api.get('/mentors/submissions')]);
    setAssignments(aRes.data.data || []);
    setSubmissions(sRes.data.data || []);
    if (canCreate) {
      const bRes = await api.get('/batches');
      const bList = bRes.data.data || [];
      setBatches(bList);
      setCreateForm((prev) => ({
        ...prev,
        batchId: prev.batchId || bList[0]?._id || '',
        courseId: prev.courseId || bList[0]?.courseId?._id || '',
      }));
    }
  }, [canCreate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['assignments', 'submissions']);

  const handleCreate = async (e) => {
    e.preventDefault();
    const chosenBatch = batches.find((b) => b._id === createForm.batchId);
    try {
      await api.post('/mentors/assignments', {
        ...createForm,
        courseId: chosenBatch?.courseId?._id || createForm.courseId,
        maxMarks: Number(createForm.maxMarks),
      });
      dispatch(pushToast({ type: 'success', title: 'Assignment Published', message: createForm.title }));
      setCreateOpen(false);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/mentors/assignments/${submitTarget._id}/submit`, submitForm);
      dispatch(pushToast({ type: 'success', title: 'Submitted', message: 'Your assignment was submitted' }));
      setSubmitTarget(null);
      setSubmitForm({ submissionUrl: '', notes: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleEvaluate = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/mentors/submissions/${evalTarget._id}/evaluate`, {
        marks: Number(evalForm.marks),
        feedback: evalForm.feedback,
      });
      dispatch(pushToast({ type: 'success', title: 'Evaluated', message: 'Marks & feedback published' }));
      setEvalTarget(null);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Assignments & Evaluations</h1>
          <p className="page-subtitle">Assignment publishing, student submissions, and mentor grading</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setCreateOpen(true)}>
            <Plus size={15} /> Publish Assignment
          </button>
        )}
      </div>

      <div className="card" style={{ marginBottom: 18 }}>
        <div className="card-header">
          <h3 className="card-title">Assignments ({assignments.length})</h3>
        </div>
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Batch & Course</th>
                <th>Due Date</th>
                <th>Max Marks</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a._id}>
                  <td>
                    <div style={{ fontWeight: 700 }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{a.description}</div>
                  </td>
                  <td>{a.batchId?.batchCode} • {a.courseId?.title}</td>
                  <td>{formatDate(a.dueDate)}</td>
                  <td>{a.maxMarks}</td>
                  <td>
                    {isStudent ? (
                      <StatusBadge status={a.mySubmission?.status || 'PENDING'} />
                    ) : (
                      <span className="badge badge-primary">{a.submissionCount} Submissions</span>
                    )}
                  </td>
                  <td>
                    {isStudent && (
                      <button type="button" className="btn btn-primary btn-sm" onClick={() => setSubmitTarget(a)}>
                        <Upload size={14} /> {a.mySubmission ? 'Resubmit' : 'Submit'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="card">
        <div className="card-header">
          <h3 className="card-title">Submissions ({submissions.length})</h3>
        </div>
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Assignment</th>
                <th>Student</th>
                <th>Submission URL</th>
                <th>Marks</th>
                <th>Status</th>
                {canCreate && <th>Evaluate</th>}
              </tr>
            </thead>
            <tbody>
              {submissions.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 600 }}>{s.assignmentId?.title}</td>
                  <td>{s.studentId?.userId?.fullName}</td>
                  <td>
                    <a href={s.submissionUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--color-secondary)', fontWeight: 600 }}>
                      Open Link
                    </a>
                  </td>
                  <td style={{ fontWeight: 700 }}>
                    {s.marks !== null && s.marks !== undefined ? `${s.marks} / ${s.assignmentId?.maxMarks || 100}` : '—'}
                  </td>
                  <td><StatusBadge status={s.status} /></td>
                  {canCreate && (
                    <td>
                      <button type="button" className="btn btn-outline btn-sm" onClick={() => setEvalTarget(s)}>
                        <CheckCircle2 size={14} /> Grade
                      </button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={createOpen} onClose={() => setCreateOpen(false)} title="Create Assignment">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Title</label>
            <input className="form-input" required value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Batch</label>
            <select className="form-select" value={createForm.batchId} onChange={(e) => setCreateForm({ ...createForm, batchId: e.target.value })}>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchCode} — {b.courseId?.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Due Date</label>
            <input type="date" required className="form-input" value={createForm.dueDate} onChange={(e) => setCreateForm({ ...createForm, dueDate: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Max Marks</label>
            <input type="number" className="form-input" value={createForm.maxMarks} onChange={(e) => setCreateForm({ ...createForm, maxMarks: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Instructions</label>
            <textarea className="form-textarea" rows={3} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Publish Assignment</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(submitTarget)} onClose={() => setSubmitTarget(null)} title={`Submit: ${submitTarget?.title || ''}`}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-field full">
            <label className="form-label">GitHub / Project / Document URL</label>
            <input className="form-input" required placeholder="https://github.com/..." value={submitForm.submissionUrl} onChange={(e) => setSubmitForm({ ...submitForm, submissionUrl: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Notes</label>
            <textarea className="form-textarea" rows={3} value={submitForm.notes} onChange={(e) => setSubmitForm({ ...submitForm, notes: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Assignment</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(evalTarget)} onClose={() => setEvalTarget(null)} title="Evaluate Submission">
        <form onSubmit={handleEvaluate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Marks (out of {evalTarget?.assignmentId?.maxMarks || 100})</label>
            <input type="number" min="0" max={evalTarget?.assignmentId?.maxMarks || 100} required className="form-input" value={evalForm.marks} onChange={(e) => setEvalForm({ ...evalForm, marks: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Feedback</label>
            <textarea className="form-textarea" rows={3} value={evalForm.feedback} onChange={(e) => setEvalForm({ ...evalForm, feedback: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Publish Evaluation</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
