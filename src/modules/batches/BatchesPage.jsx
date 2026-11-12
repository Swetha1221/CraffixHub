import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Users, Eye } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function BatchesPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canCreate = ['ADMIN', 'COORDINATOR'].includes(user?.primaryRole);

  const [batches, setBatches] = useState([]);
  const [courses, setCourses] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [coordinators, setCoordinators] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);

  const [viewBatch, setViewBatch] = useState(null);
  const [batchEnrollments, setBatchEnrollments] = useState([]);
  const [assignStudentId, setAssignStudentId] = useState('');
  const [progressInput, setProgressInput] = useState(0);
  const [manageCoordinatorId, setManageCoordinatorId] = useState('');

  const [form, setForm] = useState({
    batchCode: '',
    name: '',
    categorySelect: 'OTHER',
    customCategory: '',
    courseId: '',
    coordinatorId: '',
    mentorId: '',
    startDate: '',
    endDate: '',
    capacity: '',
  });
  const existingBatchCategories = Array.from(new Set(batches.map((b) => b.category).filter(Boolean)));

  const loadData = useCallback(async () => {
    const [bRes, cRes] = await Promise.all([api.get('/batches'), api.get('/courses')]);
    setBatches(bRes.data.data || []);
    const cList = cRes.data.data || [];
    setCourses(cList);
    setForm((prev) => ({ ...prev, courseId: prev.courseId || cList[0]?._id || '' }));
    if (canCreate) {
      const [mRes, sRes, uRes] = await Promise.all([
        api.get('/mentors'),
        api.get('/students?limit=100'),
        api.get('/users?role=COORDINATOR'),
      ]);
      const mList = mRes.data.data || [];
      const sList = sRes.data.data || [];
      const cUsers = uRes.data.data || [];
      setMentors(mList);
      setStudents(sList);
      setCoordinators(cUsers);
      setForm((prev) => ({ ...prev, mentorId: prev.mentorId || mList[0]?._id || '' }));
      setAssignStudentId((prev) => prev || sList[0]?._id || '');
    }
  }, [canCreate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['batches', 'enrollments']);

  const handleCreate = async (e) => {
    e.preventDefault();
    const resolvedCategory =
      form.categorySelect === 'OTHER' ? form.customCategory.trim() : form.categorySelect;
    if (!resolvedCategory) {
      dispatch(pushToast({ type: 'error', title: 'Validation', message: 'Please type a custom batch category' }));
      return;
    }
    try {
      await api.post('/batches', {
        batchCode: form.batchCode,
        name: form.name,
        category: resolvedCategory,
        courseId: form.courseId,
        coordinatorId: form.coordinatorId || null,
        mentors: form.mentorId ? [form.mentorId] : [],
        startDate: form.startDate,
        endDate: form.endDate,
        capacity: Number(form.capacity),
      });
      dispatch(pushToast({ type: 'success', title: 'Batch Created', message: form.batchCode }));
      setModalOpen(false);
      setForm({
        batchCode: '',
        name: '',
        categorySelect: 'OTHER',
        customCategory: '',
        courseId: courses[0]?._id || '',
        coordinatorId: '',
        mentorId: mentors[0]?._id || '',
        startDate: '',
        endDate: '',
        capacity: '',
      });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openBatchDetails = async (batch) => {
    setViewBatch(batch);
    setProgressInput(batch.progressPercent || 0);
    const rawCoordId = batch.coordinatorId?._id || batch.coordinatorId || '';
    const isCoordUser = coordinators.some((c) => c._id === rawCoordId);
    setManageCoordinatorId(isCoordUser ? rawCoordId : '');
    const res = await api.get(`/batches/${batch._id}/enrollments`);
    setBatchEnrollments(res.data.data || []);
  };

  const handleEnrolInBatch = async (e) => {
    e.preventDefault();
    if (!viewBatch || !assignStudentId) return;
    try {
      await api.post('/enrollments', {
        studentId: assignStudentId,
        courseId: viewBatch.courseId?._id || viewBatch.courseId,
        batchId: viewBatch._id,
      });
      dispatch(pushToast({ type: 'success', title: 'Enrolled in Batch', message: `Student added to ${viewBatch.batchCode}` }));
      const res = await api.get(`/batches/${viewBatch._id}/enrollments`);
      setBatchEnrollments(res.data.data || []);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Enrolment Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleSaveProgress = async () => {
    if (!viewBatch) return;
    const payload = { progressPercent: Number(progressInput) };
    if (canCreate) {
      payload.coordinatorId = manageCoordinatorId || null;
    }
    await api.patch(`/batches/${viewBatch._id}`, payload);
    dispatch(pushToast({ type: 'success', title: 'Updated', message: 'Batch details updated' }));
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Batch Management</h1>
          <p className="page-subtitle">Schedules, customizable batch categories, capacity & student batch enrolments</p>
        </div>
        {canCreate && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> Create Batch
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Batch Code</th>
                <th>Category</th>
                <th>Course</th>
                <th>Mentors</th>
                <th>Duration</th>
                <th>Students</th>
                <th>Progress</th>
                <th>Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {batches.map((b) => (
                <tr key={b._id}>
                  <td style={{ fontWeight: 700 }}>{b.batchCode}</td>
                  <td><span className="badge badge-primary">{b.category || 'Regular'}</span></td>
                  <td>{b.courseId?.title}</td>
                  <td>{b.mentors?.map((m) => m.fullName).join(', ') || 'Unassigned'}</td>
                  <td style={{ fontSize: 12.5 }}>{formatDate(b.startDate)} – {formatDate(b.endDate)}</td>
                  <td>{b.studentCount} / {b.capacity}</td>
                  <td style={{ minWidth: 140 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div className="progress-track">
                        <div className="progress-fill" style={{ width: `${b.progressPercent || 0}%` }} />
                      </div>
                      <span style={{ fontSize: 12, fontWeight: 700 }}>{b.progressPercent || 0}%</span>
                    </div>
                  </td>
                  <td><StatusBadge status={b.batchStatus} /></td>
                  <td>
                    <button type="button" className="btn btn-outline btn-sm" onClick={() => openBatchDetails(b)}>
                      <Eye size={13} /> Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Batch">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field">
            <label className="form-label">Batch Code</label>
            <input className="form-input" required placeholder="e.g. MERN-B1" value={form.batchCode} onChange={(e) => setForm({ ...form, batchCode: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Batch Name</label>
            <input className="form-input" placeholder="Cohort name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Batch Category</label>
            <select className="form-select" value={form.categorySelect} onChange={(e) => setForm({ ...form, categorySelect: e.target.value })}>
              {existingBatchCategories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              <option value="OTHER">Other (Type Custom Category)</option>
            </select>
          </div>
          {form.categorySelect === 'OTHER' && (
            <div className="form-field">
              <label className="form-label">Custom Category</label>
              <input
                className="form-input"
                required
                placeholder="Type custom batch category..."
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
              />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Course</label>
            <select className="form-select" required value={form.courseId} onChange={(e) => setForm({ ...form, courseId: e.target.value })}>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Assign Coordinator</label>
            <select className="form-select" value={form.coordinatorId} onChange={(e) => setForm({ ...form, coordinatorId: e.target.value })}>
              <option value="">All Coordinators (Unassigned)</option>
              {coordinators.map((c) => <option key={c._id} value={c._id}>{c.fullName}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Assign Mentor</label>
            <select className="form-select" value={form.mentorId} onChange={(e) => setForm({ ...form, mentorId: e.target.value })}>
              <option value="">Select Mentor</option>
              {mentors.map((m) => <option key={m._id} value={m._id}>{m.fullName}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Capacity (Max Students)</label>
            <input type="number" min="1" required className="form-input" placeholder="e.g. 30" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input type="date" required className="form-input" value={form.startDate} onChange={(e) => setForm({ ...form, startDate: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input type="date" required className="form-input" value={form.endDate} onChange={(e) => setForm({ ...form, endDate: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Batch</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(viewBatch)}
        onClose={() => setViewBatch(null)}
        title={`Batch ${viewBatch?.batchCode || ''} — ${viewBatch?.courseId?.title || ''}`}
        maxWidth={680}
      >
        {viewBatch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: 12, borderRadius: 12, background: 'var(--bg-subtle)' }}>
              <div style={{ flex: 1, minWidth: 180 }}>
                <label className="form-label">Batch Progress ({progressInput}%)</label>
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={progressInput}
                  onChange={(e) => setProgressInput(e.target.value)}
                  style={{ width: '100%' }}
                />
              </div>
              {canCreate && (
                <div style={{ minWidth: 190 }}>
                  <label className="form-label">Coordinator</label>
                  <select className="form-select" value={manageCoordinatorId} onChange={(e) => setManageCoordinatorId(e.target.value)}>
                    <option value="">All Coordinators</option>
                    {coordinators.map((c) => (
                      <option key={c._id} value={c._id}>{c.fullName}</option>
                    ))}
                  </select>
                </div>
              )}
              <button type="button" className="btn btn-outline btn-sm" onClick={handleSaveProgress}>
                Save Batch
              </button>
            </div>

            {canCreate && (
              <form onSubmit={handleEnrolInBatch} style={{ display: 'flex', gap: 10, alignItems: 'flex-end', flexWrap: 'wrap' }}>
                <div className="form-field" style={{ flex: 1, minWidth: 220 }}>
                  <label className="form-label">Enrol Student into {viewBatch.batchCode}</label>
                  <select className="form-select" required value={assignStudentId} onChange={(e) => setAssignStudentId(e.target.value)}>
                    {students.map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.userId?.fullName} ({s.studentId})
                      </option>
                    ))}
                  </select>
                </div>
                <button type="submit" className="btn btn-primary">
                  <Users size={14} /> Enrol in Batch
                </button>
              </form>
            )}

            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Enrolment #</th>
                    <th>Student</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {batchEnrollments.length === 0 ? (
                    <tr>
                      <td colSpan={3} style={{ textAlign: 'center', color: 'var(--text-muted)' }}>
                        No students enrolled in this batch yet
                      </td>
                    </tr>
                  ) : (
                    batchEnrollments.map((enr) => (
                      <tr key={enr._id}>
                        <td style={{ fontWeight: 700 }}>{enr.enrollmentNumber}</td>
                        <td>
                          <div style={{ fontWeight: 600 }}>{enr.studentId?.userId?.fullName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{enr.studentId?.studentId}</div>
                        </td>
                        <td><StatusBadge status={enr.status} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
