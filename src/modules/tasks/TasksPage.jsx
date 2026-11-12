import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Clock } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatRoleLabel } from '../../utils/format';

const KANBAN_COLUMNS = [
  { key: 'BACKLOG', label: 'Backlog' },
  { key: 'TODO', label: 'To Do' },
  { key: 'IN_PROGRESS', label: 'In Progress' },
  { key: 'IN_REVIEW', label: 'In Review' },
  { key: 'COMPLETED', label: 'Completed' },
  { key: 'BLOCKED', label: 'Blocked' },
];

export function TasksPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const isSuperAdmin = user?.primaryRole === 'SUPER_ADMIN';
  const canCreate = ['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole);

  const [tasks, setTasks] = useState([]);
  const [users, setUsers] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [logTarget, setLogTarget] = useState(null);
  const [form, setForm] = useState({ title: '', description: '', assignedTo: '', priority: 'MEDIUM', status: 'TODO' });
  const [logForm, setLogForm] = useState({ hours: 1, note: '' });

  const loadData = useCallback(async () => {
    const tRes = await api.get('/tasks');
    setTasks(tRes.data.data || []);
    if (['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole)) {
      const uRes = await api.get('/users');
      const rawUsers = uRes.data.data || [];
      const assignable = user?.primaryRole === 'MENTOR'
        ? rawUsers.filter((u) => u.primaryRole === 'STUDENT')
        : rawUsers;
      setUsers(assignable);
      setForm((prev) => ({
        ...prev,
        assignedTo: assignable.some((u) => u._id === prev.assignedTo)
          ? prev.assignedTo
          : assignable[0]?._id || '',
      }));
    }
  }, [user?.primaryRole]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['tasks']);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/tasks', { ...form, assignedTo: form.assignedTo || null });
      dispatch(pushToast({ type: 'success', title: 'Task Created', message: form.title }));
      setModalOpen(false);
      setForm({ ...form, title: '', description: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const changeStatus = async (taskId, status) => {
    await api.patch(`/tasks/${taskId}`, { status });
    loadData();
  };

  const addWorkLog = async (e) => {
    e.preventDefault();
    await api.post(`/tasks/${logTarget._id}/work-logs`, { hours: Number(logForm.hours), note: logForm.note });
    dispatch(pushToast({ type: 'success', title: 'Work Logged', message: `${logForm.hours}h logged` }));
    setLogTarget(null);
    setLogForm({ hours: 1, note: '' });
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Task Kanban Board</h1>
          <p className="page-subtitle">Task tracking across all 6 workflow stages</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Add Task
          </button>
        )}
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(6, minmax(185px, 1fr))',
          gap: 12,
          alignItems: 'stretch',
          overflowX: 'auto',
          paddingBottom: 8,
        }}
      >
        {KANBAN_COLUMNS.map((col) => {
          const colTasks = tasks.filter((t) => t.status === col.key);
          const stageAccent = {
            BACKLOG: '#64748B',
            TODO: '#3B82F6',
            IN_PROGRESS: '#F59E0B',
            IN_REVIEW: '#8B5CF6',
            COMPLETED: '#10B981',
            BLOCKED: '#EF4444',
          }[col.key] || '#64748B';
          return (
            <div
              key={col.key}
              className="card"
              style={{
                padding: 12,
                background: 'var(--bg-subtle)',
                minHeight: 260,
                display: 'flex',
                flexDirection: 'column',
                borderTop: `3px solid ${stageAccent}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <span style={{ fontWeight: 700, fontSize: 13 }}>{col.label}</span>
                <span className="badge badge-neutral">{colTasks.length}</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, flex: 1 }}>
                {colTasks.length === 0 && (
                  <div
                    style={{
                      fontSize: 12,
                      color: 'var(--text-muted)',
                      textAlign: 'center',
                      padding: '28px 8px',
                      border: '1px dashed var(--border-color)',
                      borderRadius: 10,
                    }}
                  >
                    No tasks
                  </div>
                )}
                {colTasks.map((t) => (
                  <div key={t._id} className="card" style={{ padding: 12 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)' }}>
                        {t.taskCode || 'TASK'}
                      </span>
                      <StatusBadge status={t.priority} />
                    </div>
                    <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 4 }}>{t.title}</div>
                    {t.assignedTo?.fullName && (
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginBottom: 8 }}>
                        Assignee: {t.assignedTo.fullName}
                      </div>
                    )}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6, marginTop: 6 }}>
                      <select
                        className="form-select"
                        style={{ padding: '4px 6px', fontSize: 11.5 }}
                        value={t.status}
                        disabled={isSuperAdmin}
                        onChange={(e) => changeStatus(t._id, e.target.value)}
                      >
                        {KANBAN_COLUMNS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
                      </select>
                      {!isSuperAdmin && (
                        <button
                          type="button"
                          className="icon-btn"
                          style={{ width: 28, height: 28 }}
                          title={`Log work (${t.loggedHours || 0}h logged)`}
                          onClick={() => setLogTarget(t)}
                        >
                          <Clock size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Task">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Title</label>
            <input className="form-input" required placeholder="Enter task title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Priority</label>
            <select className="form-select" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
              <option value="LOW">Low</option>
              <option value="MEDIUM">Medium</option>
              <option value="HIGH">High</option>
              <option value="URGENT">Urgent</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Assign To</label>
            <select
              className="form-select"
              required
              value={form.assignedTo}
              onChange={(e) => setForm({ ...form, assignedTo: e.target.value })}
            >
              {users.length === 0 && <option value="">No eligible assignees</option>}
              {users.map((u) => <option key={u._id} value={u._id}>{u.fullName} ({formatRoleLabel(u.primaryRole)})</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Task</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(logTarget)} onClose={() => setLogTarget(null)} title={`Log Work: ${logTarget?.title || ''}`}>
        <form onSubmit={addWorkLog} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Hours Worked</label>
            <input type="number" step="0.25" min="0.25" required className="form-input" value={logForm.hours} onChange={(e) => setLogForm({ ...logForm, hours: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Work Note</label>
            <textarea className="form-textarea" rows={3} required value={logForm.note} onChange={(e) => setLogForm({ ...logForm, note: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Save Work Log</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
