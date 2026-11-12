import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { UserPlus, Edit3, Trash2 } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';

const EMPTY_FORM = {
  fullName: '',
  email: '',
  phone: '',
  password: '',
  college: '',
  department: '',
  academicYear: '',
  studentStatus: 'REGISTERED',
};

export function StudentsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canManage = ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(user?.primaryRole);

  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const loadData = useCallback(async () => {
    const res = await api.get('/students', { params: { search } });
    setStudents(res.data.data || []);
  }, [search]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['students']);

  const openAddModal = () => {
    setEditingStudent(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEditModal = (stu) => {
    setEditingStudent(stu);
    setForm({
      fullName: stu.userId?.fullName || '',
      email: stu.userId?.email || '',
      phone: stu.userId?.phone || '',
      password: '',
      college: stu.college || '',
      department: stu.department || '',
      academicYear: stu.academicYear || '',
      studentStatus: stu.studentStatus || 'REGISTERED',
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingStudent) {
        await api.patch(`/students/${editingStudent._id}`, {
          fullName: form.fullName,
          email: form.email,
          phone: form.phone,
          college: form.college,
          department: form.department,
          academicYear: form.academicYear,
          studentStatus: form.studentStatus,
        });
        dispatch(pushToast({ type: 'success', title: 'Student Updated', message: form.fullName }));
      } else {
        await api.post('/students', form);
        dispatch(pushToast({ type: 'success', title: 'Student Added', message: form.fullName }));
      }
      setModalOpen(false);
      setEditingStudent(null);
      setForm(EMPTY_FORM);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleDelete = async (stu) => {
    if (!window.confirm(`Delete student ${stu.userId?.fullName || stu.studentId}?`)) return;
    try {
      await api.delete(`/students/${stu._id}`);
      dispatch(pushToast({ type: 'info', title: 'Student Deleted', message: stu.userId?.fullName || stu.studentId }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Delete failed' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Student Directory</h1>
          <p className="page-subtitle">Manage registered students, college profiles, and academic status</p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={openAddModal}>
            <UserPlus size={15} /> Add Student
          </button>
        )}
      </div>

      <div className="card">
        <div style={{ marginBottom: 16 }}>
          <input
            className="form-input"
            style={{ maxWidth: 320 }}
            placeholder="Search student ID, name, email, or college..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Student ID</th>
                <th>Name</th>
                <th>College</th>
                <th>Department</th>
                <th>Year</th>
                <th>Status</th>
                {canManage && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {students.map((s) => (
                <tr key={s._id}>
                  <td style={{ fontWeight: 700 }}>{s.studentId}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{s.userId?.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                      {s.userId?.email}{s.userId?.phone ? ` • ${s.userId.phone}` : ''}
                    </div>
                  </td>
                  <td>{s.college || '—'}</td>
                  <td>{s.department || '—'}</td>
                  <td>{s.academicYear || '—'}</td>
                  <td><StatusBadge status={s.studentStatus} /></td>
                  {canManage && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button type="button" className="btn btn-outline btn-sm" onClick={() => openEditModal(s)}>
                          <Edit3 size={13} /> Edit
                        </button>
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleDelete(s)}>
                          <Trash2 size={13} /> Delete
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingStudent ? 'Edit Student' : 'Add Student'}>
        <form onSubmit={handleSubmit} className="form-grid">
          <div className="form-field">
            <label className="form-label">Full Name</label>
            <input className="form-input" required value={form.fullName} onChange={(e) => setForm({ ...form, fullName: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Email</label>
            <input type="email" className="form-input" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} />
          </div>
          {!editingStudent && (
            <div className="form-field">
              <label className="form-label">Password (min 8 chars)</label>
              <input type="password" minLength={8} className="form-input" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Phone</label>
            <input className="form-input" value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">College</label>
            <input className="form-input" value={form.college} onChange={(e) => setForm({ ...form, college: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Department</label>
            <input className="form-input" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Academic Year</label>
            <input className="form-input" value={form.academicYear} onChange={(e) => setForm({ ...form, academicYear: e.target.value })} />
          </div>
          {editingStudent && (
            <div className="form-field">
              <label className="form-label">Status</label>
              <select className="form-select" value={form.studentStatus} onChange={(e) => setForm({ ...form, studentStatus: e.target.value })}>
                <option value="REGISTERED">REGISTERED</option>
                <option value="ENROLLED">ENROLLED</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_HOLD">ON HOLD</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="INACTIVE">INACTIVE</option>
              </select>
            </div>
          )}
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">{editingStudent ? 'Save Changes' : 'Add Student'}</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
