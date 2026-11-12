import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function ProjectsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canCreate = ['ADMIN', 'COORDINATOR'].includes(user?.primaryRole);

  const [projects, setProjects] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: '',
    clientName: '',
    description: '',
    dueDate: '',
    priority: 'MEDIUM',
  });

  const loadData = useCallback(async () => {
    const res = await api.get('/projects');
    setProjects(res.data.data || []);
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['projects', 'tasks']);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/projects', form);
      dispatch(pushToast({ type: 'success', title: 'Project Created', message: form.name }));
      setModalOpen(false);
      setForm({ name: '', clientName: 'CraffixWeb Internal', description: '', dueDate: form.dueDate, priority: 'MEDIUM' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Project Management</h1>
          <p className="page-subtitle">Track internal & client projects, milestones, and task completion</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> New Project
          </button>
        )}
      </div>

      <div className="grid-3">
        {projects.map((p) => (
          <div key={p._id} className="card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span className="badge badge-primary">{p.projectCode}</span>
              <StatusBadge status={p.status} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 16.5, fontWeight: 800 }}>{p.name}</h3>
            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 10 }}>
              Client: {p.clientName} • Due {formatDate(p.dueDate)}
            </div>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>{p.description}</p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <div className="progress-track">
                <div className="progress-fill" style={{ width: `${p.progressPercent || 0}%` }} />
              </div>
              <span style={{ fontSize: 12, fontWeight: 700 }}>{p.completedTasks}/{p.totalTasks}</span>
            </div>
          </div>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Project">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Project Name</label>
            <input className="form-input" required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Client</label>
            <input className="form-input" value={form.clientName} onChange={(e) => setForm({ ...form, clientName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Due Date</label>
            <input type="date" className="form-input" required value={form.dueDate} onChange={(e) => setForm({ ...form, dueDate: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Project</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
