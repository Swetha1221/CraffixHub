import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  BookOpen,
  Plus,
  Upload,
  FileText,
  Download,
  Presentation,
  Layers,
  Lock,
  Unlock,
  Target,
  Award,
  Crown,
} from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge, EmptyState } from '../../components/common/UI';
import { formatINR, formatDate } from '../../utils/format';

export function CoursesPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const role = user?.primaryRole;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isCoordinator = role === 'COORDINATOR';
  const isStudent = role === 'STUDENT';
  const canCreateCourse = ['ADMIN', 'COORDINATOR'].includes(role);
  const canUploadMaterial = ['MENTOR', 'COORDINATOR', 'ADMIN'].includes(role);
  const canUnlockPrice = ['ADMIN', 'COORDINATOR'].includes(role);
  const canMonitorRequests = ['COORDINATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);

  const [tab, setTab] = useState('courses');
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [cadenceFilter, setCadenceFilter] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [materialModalOpen, setMaterialModalOpen] = useState(false);
  const [catalogCourse, setCatalogCourse] = useState(null);
  const [enrolBatchId, setEnrolBatchId] = useState('');
  const [viewDoc, setViewDoc] = useState(null);

  const [form, setForm] = useState({
    title: '',
    categorySelect: 'OTHER',
    customCategory: '',
    description: '',
    objective: '',
    outcome: '',
    durationValue: '',
    durationUnit: 'WEEKS',
    feeAmount: '',
  });

  const [matForm, setMatForm] = useState({
    courseId: '',
    batchId: '',
    title: '',
    contentType: 'HYBRID',
    cadence: 'WEEKLY',
    periodLabel: '',
    documentContent: '',
    pptUrl: '',
    file: null,
  });

  const existingCategories = Array.from(new Set(courses.map((c) => c.category).filter(Boolean)));

  const loadData = useCallback(async () => {
    const reqs = [
      api.get('/courses'),
      api.get('/batches'),
      api.get('/courses/materials/all', { params: { cadence: cadenceFilter || undefined } }),
    ];
    if (isStudent || canMonitorRequests) {
      reqs.push(api.get('/enrollments'));
    }
    const [cRes, bRes, mRes, eRes] = await Promise.all(reqs);
    const cList = cRes.data.data || [];
    setCourses(cList);
    setBatches(bRes.data.data || []);
    setMaterials(mRes.data.data || []);
    if (eRes) {
      setEnrollments(eRes.data.data || []);
    }
    setCatalogCourse((prev) => (prev ? cList.find((c) => c._id === prev._id) || prev : null));
    setMatForm((prev) => ({ ...prev, courseId: prev.courseId || cList[0]?._id || '' }));
  }, [cadenceFilter, isStudent, canMonitorRequests]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['courses', 'enrollments']);

  const handleCreateCourse = async (e) => {
    e.preventDefault();
    const resolvedCategory =
      form.categorySelect === 'OTHER' ? form.customCategory.trim() : form.categorySelect;
    if (!resolvedCategory) {
      dispatch(pushToast({ type: 'error', title: 'Validation', message: 'Please type a custom category' }));
      return;
    }
    try {
      await api.post('/courses', {
        title: form.title,
        category: resolvedCategory,
        description: form.description,
        objective: form.objective,
        outcome: form.outcome,
        durationValue: Number(form.durationValue),
        durationUnit: form.durationUnit,
        feeAmount: Number(form.feeAmount),
      });
      dispatch(pushToast({ type: 'success', title: 'Course Created', message: `${form.title} (fee locked by default)` }));
      setModalOpen(false);
      setForm({
        title: '',
        categorySelect: 'OTHER',
        customCategory: '',
        description: '',
        objective: '',
        outcome: '',
        durationValue: '',
        durationUnit: 'WEEKS',
        feeAmount: '',
      });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleUploadMaterial = async (e) => {
    e.preventDefault();
    try {
      const fd = new FormData();
      fd.append('title', matForm.title);
      fd.append('contentType', matForm.contentType);
      fd.append('cadence', matForm.cadence);
      fd.append('periodLabel', matForm.periodLabel);
      fd.append('documentContent', matForm.documentContent);
      fd.append('pptUrl', matForm.pptUrl);
      if (matForm.batchId) fd.append('batchId', matForm.batchId);
      if (matForm.file) fd.append('file', matForm.file);

      await api.post(`/courses/${matForm.courseId}/materials`, fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      dispatch(pushToast({ type: 'success', title: 'Material Uploaded', message: `${matForm.cadence} ${matForm.contentType} material saved` }));
      setMaterialModalOpen(false);
      setMatForm({
        ...matForm,
        title: '',
        documentContent: '',
        pptUrl: '',
        file: null,
      });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Upload Failed', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openCatalogModal = (course) => {
    const courseBatches = batches.filter((b) => String(b.courseId?._id || b.courseId) === String(course._id));
    setEnrolBatchId(courseBatches[0]?._id || '');
    setCatalogCourse(course);
  };

  const handleToggleCoursePriceLock = async (course) => {
    try {
      const res = await api.post(`/courses/${course._id}/toggle-price-lock`);
      const updated = res.data.data;
      dispatch(
        pushToast({
          type: 'success',
          title: updated.priceUnlocked ? 'Course Price Unlocked' : 'Course Price Locked',
          message: updated.priceUnlocked
            ? `Students can now view fee details for ${course.title}`
            : `Fee details locked again for ${course.title}`,
        })
      );
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Action failed' }));
    }
  };

  const handleUnlockEnrollmentPrice = async (enrId) => {
    try {
      await api.post(`/enrollments/${enrId}/unlock-price`);
      dispatch(pushToast({ type: 'success', title: 'Fee Unlocked', message: 'Student can now see the course fee' }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleEnrol = async (e) => {
    e.preventDefault();
    if (!catalogCourse) return;
    try {
      await api.post('/enrollments', { courseId: catalogCourse._id, batchId: enrolBatchId || null });
      dispatch(
        pushToast({
          type: 'success',
          title: 'Enrolment Request Sent to Admin',
          message: `${catalogCourse.title} sent for Admin approval; Course Coordinator can monitor and unlock fee.`,
        })
      );
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'info', title: 'Enrolment', message: err.response?.data?.message || 'Already requested' }));
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            Academy Courses & Catalog{' '}
            {isSuperAdmin && (
              <span className="badge badge-info" style={{ verticalAlign: 'middle', marginLeft: 8 }}>
                <Crown size={12} /> CEO Read-Only
              </span>
            )}
          </h1>
          <p className="page-subtitle">Open any Course Catalog to view Course Objective, Course Outcome, and fee availability</p>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          {canUploadMaterial && (
            <button type="button" className="btn btn-outline" onClick={() => setMaterialModalOpen(true)}>
              <Upload size={15} /> Upload Material (Doc / PPT)
            </button>
          )}
          {canCreateCourse && (
            <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
              <Plus size={15} /> Create Course
            </button>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 18, flexWrap: 'wrap' }}>
        <button type="button" className={`btn btn-sm ${tab === 'courses' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('courses')}>
          <BookOpen size={14} /> Courses ({courses.length})
        </button>
        <button type="button" className={`btn btn-sm ${tab === 'materials' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('materials')}>
          <Presentation size={14} /> Course Materials ({materials.length})
        </button>
      </div>

      {tab === 'courses' && (
        <div className="grid-3">
          {courses.map((c) => {
            const myRequest = isStudent
              ? enrollments.find((e) => String(e.courseId?._id || e.courseId) === String(c._id))
              : null;
            const courseRequestsCount = canMonitorRequests
              ? enrollments.filter((e) => String(e.courseId?._id || e.courseId) === String(c._id)).length
              : 0;
            return (
              <div key={c._id} className="card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 14 }}>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span className="badge badge-primary">{c.courseCode}</span>
                    <StatusBadge status={c.courseStatus} />
                  </div>
                  <h3 style={{ margin: '0 0 6px', fontSize: 16.5, fontWeight: 800 }}>{c.title}</h3>
                  <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-secondary)', marginBottom: 8 }}>
                    {c.category} • {c.duration?.value} {c.duration?.unit}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, color: 'var(--text-secondary)' }}>{c.description}</p>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, paddingTop: 12, borderTop: '1px solid var(--border-color)', flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)' }}>
                      {c.batchCount || 0} Batches
                    </div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
                      {c.priceUnlocked ? <Unlock size={12} /> : <Lock size={12} />}
                      {c.priceUnlocked ? 'Fee Unlocked' : 'Fee Locked by Coordinator'}
                    </div>
                    {canMonitorRequests && courseRequestsCount > 0 && (
                      <div style={{ fontSize: 11.5, color: 'var(--color-primary)', fontWeight: 700, marginTop: 2 }}>
                        {courseRequestsCount} Student Request{courseRequestsCount > 1 ? 's' : ''}
                      </div>
                    )}
                    {myRequest && (
                      <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--color-secondary)', marginTop: 2 }}>
                        Status: {myRequest.status?.replace('_', ' ')}
                      </div>
                    )}
                  </div>
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => openCatalogModal(c)}>
                    <BookOpen size={14} /> Open Course Catalog
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === 'materials' && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Hybrid Course Materials (Document Content & PPT)</h3>
            <select
              className="form-select"
              style={{ width: 180 }}
              value={cadenceFilter}
              onChange={(e) => setCadenceFilter(e.target.value)}
            >
              <option value="">All Schedules</option>
              <option value="WEEKLY">Weekly Uploads</option>
              <option value="MONTHLY">Monthly Uploads</option>
            </select>
          </div>

          {materials.length === 0 ? (
            <EmptyState
              icon={FileText}
              title="No course materials uploaded yet"
              description={canUploadMaterial ? 'Upload weekly or monthly documents, notes, and PPTs.' : 'Materials for your enrolled courses will appear here.'}
            />
          ) : (
            <div className="table-wrap">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Course & Batch</th>
                    <th>Format</th>
                    <th>Schedule</th>
                    <th>Uploaded By</th>
                    <th>Access</th>
                  </tr>
                </thead>
                <tbody>
                  {materials.map((m) => (
                    <tr key={m._id}>
                      <td>
                        <div style={{ fontWeight: 700 }}>{m.title}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatDate(m.createdAt)}</div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{m.courseId?.title}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{m.batchId?.batchCode || 'All Batches'}</div>
                      </td>
                      <td><span className="badge badge-primary">{m.contentType}</span></td>
                      <td>
                        <span className="badge badge-success">{m.cadence}</span>{' '}
                        <span style={{ fontSize: 12, fontWeight: 600 }}>{m.periodLabel}</span>
                      </td>
                      <td style={{ fontSize: 12.5 }}>{m.uploadedBy?.fullName}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {m.documentContent && (
                            <button type="button" className="btn btn-outline btn-sm" onClick={() => setViewDoc(m)}>
                              <FileText size={13} /> Read Content
                            </button>
                          )}
                          {m.fileUrl && (
                            <a href={m.fileUrl} target="_blank" rel="noreferrer" className="btn btn-primary btn-sm">
                              <Download size={13} /> File
                            </a>
                          )}
                          {m.pptUrl && (
                            <a href={m.pptUrl} target="_blank" rel="noreferrer" className="btn btn-outline btn-sm">
                              <Layers size={13} /> PPT Link
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create Course Modal with Customizable Category */}
      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Course">
        <form onSubmit={handleCreateCourse} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Course Title</label>
            <input className="form-input" required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Category</label>
            <select
              className="form-select"
              value={form.categorySelect}
              onChange={(e) => setForm({ ...form, categorySelect: e.target.value })}
            >
              {existingCategories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
              <option value="OTHER">Other (Type Custom Category)</option>
            </select>
          </div>
          {form.categorySelect === 'OTHER' && (
            <div className="form-field">
              <label className="form-label">Custom Category</label>
              <input
                className="form-input"
                required
                placeholder="Type custom category..."
                value={form.customCategory}
                onChange={(e) => setForm({ ...form, customCategory: e.target.value })}
              />
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Fee (INR)</label>
            <input type="number" min="0" className="form-input" required value={form.feeAmount} onChange={(e) => setForm({ ...form, feeAmount: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Duration Value</label>
            <input type="number" min="1" className="form-input" required value={form.durationValue} onChange={(e) => setForm({ ...form, durationValue: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Duration Unit</label>
            <select className="form-select" value={form.durationUnit} onChange={(e) => setForm({ ...form, durationUnit: e.target.value })}>
              <option value="WEEKS">Weeks</option>
              <option value="MONTHS">Months</option>
              <option value="HOURS">Hours</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Course Objective</label>
            <textarea
              className="form-textarea"
              rows={2}
              required
              placeholder="What core foundations and engineering skills this course aims to teach..."
              value={form.objective}
              onChange={(e) => setForm({ ...form, objective: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <label className="form-label">Course Outcome</label>
            <textarea
              className="form-textarea"
              rows={2}
              required
              placeholder="What projects, certifications, or career outcomes students achieve upon completion..."
              value={form.outcome}
              onChange={(e) => setForm({ ...form, outcome: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Create Course</button>
          </div>
        </form>
      </Modal>

      {/* Hybrid Upload Course Material Modal (Document Content + PPT + Weekly/Monthly) */}
      <Modal open={materialModalOpen} onClose={() => setMaterialModalOpen(false)} title="Upload Hybrid Course Material">
        <form onSubmit={handleUploadMaterial} className="form-grid">
          <div className="form-field">
            <label className="form-label">Course</label>
            <select className="form-select" required value={matForm.courseId} onChange={(e) => setMatForm({ ...matForm, courseId: e.target.value })}>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.title}</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Batch (Optional)</label>
            <select className="form-select" value={matForm.batchId} onChange={(e) => setMatForm({ ...matForm, batchId: e.target.value })}>
              <option value="">All Batches</option>
              {batches.map((b) => <option key={b._id} value={b._id}>{b.batchCode}</option>)}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Material Title</label>
            <input className="form-input" required placeholder="e.g. Week 1 — React Architecture & Slides" value={matForm.title} onChange={(e) => setMatForm({ ...matForm, title: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Hybrid Format</label>
            <select className="form-select" value={matForm.contentType} onChange={(e) => setMatForm({ ...matForm, contentType: e.target.value })}>
              <option value="HYBRID">Hybrid (Document + PPT)</option>
              <option value="DOCUMENT">Document Content Only</option>
              <option value="PPT">PPT / Slides Only</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Upload Schedule</label>
            <select
              className="form-select"
              value={matForm.cadence}
              onChange={(e) =>
                setMatForm({
                  ...matForm,
                  cadence: e.target.value,
                  periodLabel: e.target.value === 'MONTHLY' ? 'Month 1' : 'Week 1',
                })
              }
            >
              <option value="WEEKLY">Weekly</option>
              <option value="MONTHLY">Monthly</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Period Label</label>
            <input className="form-input" placeholder="e.g. Week 1 / Month 1" value={matForm.periodLabel} onChange={(e) => setMatForm({ ...matForm, periodLabel: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Upload File (PDF / DOC / PPT / PPTX)</label>
            <input
              type="file"
              accept=".pdf,.doc,.docx,.ppt,.pptx,.txt,.md"
              className="form-input"
              onChange={(e) => setMatForm({ ...matForm, file: e.target.files?.[0] || null })}
            />
          </div>
          <div className="form-field full">
            <label className="form-label">PPT / Slides External URL (Optional)</label>
            <input className="form-input" placeholder="https://..." value={matForm.pptUrl} onChange={(e) => setMatForm({ ...matForm, pptUrl: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Document Content / Notes (Hybrid Text)</label>
            <textarea
              className="form-textarea"
              rows={4}
              placeholder="Write lecture notes, summary, or study guide..."
              value={matForm.documentContent}
              onChange={(e) => setMatForm({ ...matForm, documentContent: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">
              <Upload size={15} /> Publish Course Material
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(viewDoc)} onClose={() => setViewDoc(null)} title={viewDoc?.title || 'Document Content'}>
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginBottom: 12 }}>
          {viewDoc?.courseId?.title} • {viewDoc?.cadence} ({viewDoc?.periodLabel})
        </div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.7, fontSize: 13.5, background: 'var(--bg-subtle)', padding: 16, borderRadius: 12 }}>
          {viewDoc?.documentContent}
        </div>
      </Modal>

      <Modal
        open={Boolean(catalogCourse)}
        onClose={() => setCatalogCourse(null)}
        title={`Course Catalog — ${catalogCourse?.title || ''}`}
        maxWidth={680}
      >
        {catalogCourse && (() => {
          const courseRequests = enrollments.filter(
            (e) => String(e.courseId?._id || e.courseId) === String(catalogCourse._id)
          );
          const myRequest = isStudent ? courseRequests[0] || null : null;
          const isUnlockedForStudent = Boolean(
            catalogCourse.priceUnlocked || myRequest?.priceUnlocked
          );
          const resolvedDisplayFee = myRequest?.feeDetails?.finalFee ?? catalogCourse.fee?.amount;

          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="badge badge-primary">{catalogCourse.courseCode}</span>
                  <span className="badge badge-neutral">
                    {catalogCourse.category} • {catalogCourse.duration?.value} {catalogCourse.duration?.unit}
                  </span>
                </div>
                <StatusBadge status={catalogCourse.courseStatus} />
              </div>

              {/* Section 1: Course Objective */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <Target size={16} color="var(--color-primary)" /> Course Objective
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {catalogCourse.objective || catalogCourse.description || 'Objective details are being updated by Course Coordinator.'}
                </p>
              </div>

              {/* Section 2: Next Course Outcome */}
              <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 800, fontSize: 13.5, color: 'var(--text-primary)', marginBottom: 6 }}>
                  <Award size={16} color="var(--color-secondary)" /> Course Outcome
                </div>
                <p style={{ margin: 0, fontSize: 13.5, lineHeight: 1.6, color: 'var(--text-secondary)' }}>
                  {catalogCourse.outcome || 'Deliver production-grade capstone projects, technical mastery, and verified certification readiness.'}
                </p>
              </div>

              {/* Section 3: Price Lock & Fee Availability */}
              <div
                style={{
                  padding: 14,
                  borderRadius: 12,
                  border: '1px solid var(--border-color)',
                  background: isUnlockedForStudent || !isStudent ? '#FFFFFF' : '#FEF2F2',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: 12,
                  flexWrap: 'wrap',
                }}
              >
                <div>
                  <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {catalogCourse.priceUnlocked || myRequest?.priceUnlocked ? <Unlock size={13} color="#10B981" /> : <Lock size={13} color="#EF4444" />}
                    Course Fee & Price Lock Status
                  </div>
                  {isStudent ? (
                    isUnlockedForStudent && resolvedDisplayFee != null ? (
                      <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--text-primary)', marginTop: 4 }}>
                        {formatINR(resolvedDisplayFee)}{' '}
                        <span className="badge badge-success" style={{ fontSize: 11, verticalAlign: 'middle' }}>
                          Unlocked by Coordinator
                        </span>
                      </div>
                    ) : (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#B91C1C', marginTop: 4 }}>
                        Price Locked — Submit a course enrolment request; the Course Coordinator will unlock the fee for you.
                      </div>
                    )
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 4, flexWrap: 'wrap' }}>
                      <span style={{ fontSize: 18, fontWeight: 800 }}>
                        {catalogCourse.fee?.amount != null ? formatINR(catalogCourse.fee.amount) : 'Locked'}
                      </span>
                      <span className={`badge ${catalogCourse.priceUnlocked ? 'badge-success' : 'badge-warning'}`}>
                        {catalogCourse.priceUnlocked ? 'Unlocked for Students' : 'Locked for Students'}
                      </span>
                    </div>
                  )}
                </div>

                {canUnlockPrice && (
                  <button
                    type="button"
                    className={`btn btn-sm ${catalogCourse.priceUnlocked ? 'btn-outline' : 'btn-primary'}`}
                    onClick={() => handleToggleCoursePriceLock(catalogCourse)}
                  >
                    {catalogCourse.priceUnlocked ? <Lock size={14} /> : <Unlock size={14} />}
                    {catalogCourse.priceUnlocked ? 'Lock Price' : 'Unlock Course Price'}
                  </button>
                )}
              </div>

              {/* Section 4A: Student Request Action */}
              {isStudent && (
                myRequest ? (
                  <div style={{ padding: 14, borderRadius: 12, background: 'var(--bg-subtle)', border: '1px solid var(--border-color)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: 13.5 }}>Your Enrolment Request</div>
                        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 2 }}>
                          Sent to Admin for Approval • Monitored by Course Coordinator
                        </div>
                      </div>
                      <StatusBadge status={myRequest.status} />
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleEnrol} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                    <div className="form-field">
                      <label className="form-label">Select Preferred Batch</label>
                      <select className="form-select" value={enrolBatchId} onChange={(e) => setEnrolBatchId(e.target.value)}>
                        <option value="">Any Available Batch</option>
                        {batches
                          .filter((b) => String(b.courseId?._id || b.courseId) === String(catalogCourse._id))
                          .map((b) => (
                            <option key={b._id} value={b._id} disabled={b.studentCount >= b.capacity}>
                              {b.batchCode} ({b.studentCount}/{b.capacity} seats)
                            </option>
                          ))}
                      </select>
                    </div>
                    <button type="submit" className="btn btn-primary">
                      Request Course Enrolment (Sends to Admin & Coordinator)
                    </button>
                  </form>
                )
              )}

              {/* Section 4B: Course Coordinator / Admin / CEO Student Request Monitoring */}
              {canMonitorRequests && (
                <div style={{ paddingTop: 10, borderTop: '1px solid var(--border-color)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <h4 style={{ margin: 0, fontSize: 14, fontWeight: 800 }}>
                      Student Enrolment Requests Monitor ({courseRequests.length})
                    </h4>
                    <span style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                      Admin handles Approval • {isCoordinator ? 'You can unlock fees' : 'Coordinator unlocks fees'}
                    </span>
                  </div>
                  {courseRequests.length === 0 ? (
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)', padding: '8px 0' }}>
                      No student enrolment requests submitted for this course yet.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8, maxHeight: 220, overflowY: 'auto' }}>
                      {courseRequests.map((enr) => (
                        <div
                          key={enr._id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: 10,
                            padding: '10px 12px',
                            borderRadius: 10,
                            background: 'var(--bg-subtle)',
                            flexWrap: 'wrap',
                          }}
                        >
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 13 }}>
                              {enr.studentId?.fullName || 'Student'}{' '}
                              <span style={{ fontSize: 11.5, color: 'var(--text-muted)', fontWeight: 500 }}>
                                ({enr.batchId?.batchCode || 'No Batch Assigned'})
                              </span>
                            </div>
                            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 2 }}>
                              Price: {enr.priceUnlocked ? `Unlocked (${formatINR(enr.feeDetails?.finalFee)})` : 'Locked for Student'}
                            </div>
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                            <StatusBadge status={enr.status} />
                            {canUnlockPrice && !enr.priceUnlocked && (
                              <button
                                type="button"
                                className="btn btn-primary btn-sm"
                                onClick={() => handleUnlockEnrollmentPrice(enr._id)}
                              >
                                <Unlock size={12} /> Unlock Price
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}
      </Modal>
    </div>
  );
}
