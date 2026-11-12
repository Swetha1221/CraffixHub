import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Plus, Check, Layers, Lock, Unlock, XCircle, IndianRupee } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatINR, formatDate } from '../../utils/format';

function computeFeeBreakdown(baseFee, rawPercent, rawScholarship) {
  const originalFee = Math.max(0, Number(baseFee || 0));
  const discountPercent = Math.min(100, Math.max(0, Number(rawPercent || 0)));
  const discountAmount = Number(((originalFee * discountPercent) / 100).toFixed(2));
  const scholarshipAmount = Math.max(0, Number(rawScholarship || 0));
  const finalFee = Math.max(0, Number((originalFee - discountAmount - scholarshipAmount).toFixed(2)));
  return { originalFee, discountPercent, discountAmount, scholarshipAmount, finalFee };
}

function FeeBreakdownCard({ breakdown }) {
  return (
    <div
      className="form-field full"
      style={{
        padding: '12px 14px',
        borderRadius: 12,
        background: 'var(--color-secondary-soft)',
        border: '1px solid rgba(98, 95, 255, 0.22)',
        display: 'flex',
        flexDirection: 'column',
        gap: 6,
        fontSize: 13,
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <span style={{ color: 'var(--text-secondary)' }}>Course Fee (Original)</span>
        <strong>{formatINR(breakdown.originalFee)}</strong>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
        <span>Discount ({breakdown.discountPercent}%)</span>
        <strong>- {formatINR(breakdown.discountAmount)}</strong>
      </div>
      {breakdown.scholarshipAmount > 0 && (
        <div style={{ display: 'flex', justifyContent: 'space-between', color: 'var(--color-success)' }}>
          <span>Scholarship</span>
          <strong>- {formatINR(breakdown.scholarshipAmount)}</strong>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          borderTop: '1px solid rgba(98, 95, 255, 0.2)',
          paddingTop: 6,
          marginTop: 2,
          fontSize: 14.5,
          color: 'var(--color-primary)',
        }}
      >
        <strong>Final Payable Fee</strong>
        <strong>{formatINR(breakdown.finalFee)}</strong>
      </div>
    </div>
  );
}

export function EnrollmentsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const role = user?.primaryRole;
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isAdmin = role === 'ADMIN';
  const isCoordinator = role === 'COORDINATOR';
  const isStudent = role === 'STUDENT';
  const canManage = isAdmin || isSuperAdmin || isCoordinator;
  const canApprove = isAdmin || isSuperAdmin;
  const canInspectDirectory = isAdmin || isCoordinator || isSuperAdmin;

  const [enrollments, setEnrollments] = useState([]);
  const [students, setStudents] = useState([]);
  const [courses, setCourses] = useState([]);
  const [batches, setBatches] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [assignModal, setAssignModal] = useState(null);
  const [assignBatchId, setAssignBatchId] = useState('');
  const [editDiscountPercent, setEditDiscountPercent] = useState('');
  const [editScholarship, setEditScholarship] = useState('');
  const [form, setForm] = useState({ studentId: '', courseId: '', batchId: '', discount: '', scholarship: '' });
  const [payModalEnr, setPayModalEnr] = useState(null);
  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'UPI', transactionReference: '' });

  const loadData = useCallback(async () => {
    const res = await api.get('/enrollments');
    setEnrollments(res.data.data || []);
    if (canInspectDirectory) {
      const [sRes, cRes, bRes] = await Promise.all([api.get('/students?limit=100'), api.get('/courses'), api.get('/batches')]);
      const sList = sRes.data.data || [];
      const cList = cRes.data.data || [];
      const bList = bRes.data.data || [];
      setStudents(sList);
      setCourses(cList);
      setBatches(bList);
      setForm((prev) => {
        const nextCourseId = prev.courseId || cList[0]?._id || '';
        const matchingBatches = bList.filter((b) => String(b.courseId?._id || b.courseId) === String(nextCourseId));
        return {
          ...prev,
          studentId: prev.studentId || sList[0]?._id || '',
          courseId: nextCourseId,
          batchId:
            prev.batchId && matchingBatches.some((b) => b._id === prev.batchId)
              ? prev.batchId
              : matchingBatches[0]?._id || '',
        };
      });
    }
  }, [canInspectDirectory]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['enrollments', 'batches']);

  const courseBatches = batches.filter((b) => String(b.courseId?._id || b.courseId) === String(form.courseId));

  const handleCourseChange = (newCourseId) => {
    const matching = batches.filter((b) => String(b.courseId?._id || b.courseId) === String(newCourseId));
    setForm({ ...form, courseId: newCourseId, batchId: matching[0]?._id || '' });
  };

  const selectedCourse = courses.find((c) => String(c._id) === String(form.courseId));
  const createFeeBreakdown = computeFeeBreakdown(selectedCourse?.fee?.amount, form.discount, form.scholarship);
  const editFeeBreakdown = computeFeeBreakdown(assignModal?.feeDetails?.originalFee, editDiscountPercent, editScholarship);

  const handleCreate = async (e) => {
    e.preventDefault();
    try {
      await api.post('/enrollments', {
        studentId: form.studentId,
        courseId: form.courseId,
        batchId: form.batchId || null,
        discountPercent: createFeeBreakdown.discountPercent,
        scholarship: createFeeBreakdown.scholarshipAmount,
      });
      dispatch(pushToast({ type: 'success', title: 'Enrolment Created', message: 'Fee snapshot & invoice generated' }));
      setModalOpen(false);
      setForm({ ...form, discount: '', scholarship: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openApproveOrAssignModal = (enr) => {
    const cId = enr.courseId?._id || enr.courseId;
    const matching = batches.filter((b) => String(b.courseId?._id || b.courseId) === String(cId));
    setAssignBatchId(enr.batchId?._id || matching[0]?._id || '');
    const pct =
      enr.feeDetails?.discountPercent ??
      (enr.feeDetails?.originalFee && enr.feeDetails?.discount
        ? Number(((enr.feeDetails.discount / enr.feeDetails.originalFee) * 100).toFixed(2))
        : 0);
    setEditDiscountPercent(String(pct || ''));
    setEditScholarship(String(enr.feeDetails?.scholarship || ''));
    setAssignModal(enr);
  };

  const handleConfirmAssignOrApprove = async (e) => {
    e.preventDefault();
    if (!assignModal) return;
    try {
      if (assignModal.status === 'PENDING_REVIEW') {
        await api.post(`/enrollments/${assignModal._id}/approve`, { batchId: assignBatchId || undefined });
        dispatch(pushToast({ type: 'success', title: 'Approved', message: 'Enrolment activated & invoice generated' }));
      } else {
        await api.patch(`/enrollments/${assignModal._id}`, {
          batchId: assignBatchId || null,
          discountPercent: editFeeBreakdown.discountPercent,
          scholarship: editFeeBreakdown.scholarshipAmount,
        });
        dispatch(pushToast({ type: 'success', title: 'Enrolment Updated', message: 'Batch & percentage discount recalculated' }));
      }
      setAssignModal(null);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleUnlockPrice = async (enr) => {
    try {
      await api.post(`/enrollments/${enr._id}/unlock-price`);
      dispatch(pushToast({ type: 'success', title: 'Course Price Unlocked', message: `Student can now view fee for ${enr.courseId?.title}` }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleReject = async (enr) => {
    try {
      await api.post(`/enrollments/${enr._id}/reject`);
      dispatch(pushToast({ type: 'info', title: 'Enrolment Rejected', message: `${enr.studentId?.userId?.fullName}'s request was declined` }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openRecordPayment = (enr) => {
    setPayModalEnr(enr);
    setPayForm({
      amount: String(enr.feeDetails?.finalFee || ''),
      paymentMethod: 'UPI',
      transactionReference: `TXN-${Date.now().toString().slice(-6)}`,
    });
  };

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/payments', {
        enrollmentId: payModalEnr._id,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionReference: payForm.transactionReference,
      });
      dispatch(
        pushToast({
          type: 'success',
          title: 'Payment Updated',
          message: `Recorded ${formatINR(payForm.amount)} for ${payModalEnr.studentId?.userId?.fullName}`,
        })
      );
      setPayModalEnr(null);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Payment update failed' }));
    }
  };

  const modalBatches = assignModal
    ? batches.filter((b) => String(b.courseId?._id || b.courseId) === String(assignModal.courseId?._id || assignModal.courseId))
    : [];

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isStudent ? 'My Enrolment Requests' : 'Enrolment Management'}
          </h1>
          <p className="page-subtitle">
            {isCoordinator
              ? 'Enrol students, monitor student enrolment requests, and unlock locked course prices'
              : canApprove
              ? 'Enrol students and approve or reject student course enrolment requests'
              : 'Track course enrolment requests, Admin / Super Admin approval status, and fee unlock availability'}
          </p>
        </div>
        {canManage && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> New Enrolment
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Enrolment #</th>
                <th>Student</th>
                <th>Course & Batch</th>
                <th>Agreed Fee</th>
                <th>Price Lock</th>
                <th>Payment</th>
                <th>Status</th>
                <th>Enrolled On</th>
                {canManage && <th>Action</th>}
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enr) => (
                <tr key={enr._id}>
                  <td style={{ fontWeight: 700 }}>{enr.enrollmentNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{enr.studentId?.userId?.fullName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{enr.studentId?.studentId}</div>
                  </td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{enr.courseId?.title}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>Batch: {enr.batchId?.batchCode || 'Unassigned'}</div>
                  </td>
                  <td>
                    {enr.feeDetails?.locked ? (
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#B91C1C', display: 'flex', alignItems: 'center', gap: 5 }}>
                        <Lock size={13} /> Locked (Awaiting Coordinator)
                      </div>
                    ) : (
                      <>
                        <div style={{ fontWeight: 700 }}>{formatINR(enr.feeDetails?.finalFee)}</div>
                        {(enr.feeDetails?.discount > 0 || enr.feeDetails?.scholarship > 0) && (
                          <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                            Base {formatINR(enr.feeDetails?.originalFee)}
                            {enr.feeDetails?.discount > 0
                              ? ` • ${
                                  enr.feeDetails?.discountPercent ??
                                  (enr.feeDetails?.originalFee
                                    ? Math.round((enr.feeDetails.discount / enr.feeDetails.originalFee) * 1000) / 10
                                    : 0)
                                }% (-${formatINR(enr.feeDetails.discount)})`
                              : ''}
                            {enr.feeDetails?.scholarship > 0 ? ` • Schol -${formatINR(enr.feeDetails.scholarship)}` : ''}
                          </div>
                        )}
                      </>
                    )}
                  </td>
                  <td>
                    <span className={`badge ${enr.priceUnlocked ? 'badge-success' : 'badge-warning'}`}>
                      {enr.priceUnlocked ? <><Unlock size={11} /> Unlocked</> : <><Lock size={11} /> Locked</>}
                    </span>
                  </td>
                  <td><StatusBadge status={enr.paymentStatus} /></td>
                  <td>
                    <StatusBadge status={enr.status} />
                    {enr.status === 'PENDING_REVIEW' && (
                      <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                        Awaiting Admin / Super Admin Approval
                      </div>
                    )}
                  </td>
                  <td>{formatDate(enr.enrolledAt)}</td>
                  {canManage && (
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        {isCoordinator && !enr.priceUnlocked && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleUnlockPrice(enr)}>
                            <Unlock size={13} /> Unlock Price
                          </button>
                        )}
                        {canApprove && enr.status === 'PENDING_REVIEW' && (
                          <>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => openApproveOrAssignModal(enr)}>
                              <Check size={14} /> Approve
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleReject(enr)}>
                              <XCircle size={13} /> Reject
                            </button>
                          </>
                        )}
                        {enr.status !== 'PENDING_REVIEW' && enr.status !== 'REJECTED' && enr.status !== 'CANCELLED' && (
                          <button type="button" className="btn btn-outline btn-sm" onClick={() => openApproveOrAssignModal(enr)}>
                            <Layers size={13} /> {enr.batchId ? 'Change Batch' : 'Assign Batch'}
                          </button>
                        )}
                        {canManage && enr.paymentStatus !== 'PAID' && enr.status !== 'CANCELLED' && enr.status !== 'PENDING_REVIEW' && (enr.feeDetails?.finalFee || 0) > 0 && (
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => openRecordPayment(enr)}>
                            <IndianRupee size={13} /> Record Payment
                          </button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Enrol Student in Course & Batch">
        <form onSubmit={handleCreate} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Student</label>
            <select className="form-select" required value={form.studentId} onChange={(e) => setForm({ ...form, studentId: e.target.value })}>
              {students.map((s) => <option key={s._id} value={s._id}>{s.userId?.fullName} ({s.studentId})</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Course</label>
            <select className="form-select" required value={form.courseId} onChange={(e) => handleCourseChange(e.target.value)}>
              {courses.map((c) => <option key={c._id} value={c._id}>{c.title} ({formatINR(c.fee?.amount)})</option>)}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Batch (Filtered by Course)</label>
            <select className="form-select" value={form.batchId} onChange={(e) => setForm({ ...form, batchId: e.target.value })}>
              <option value="">Assign later</option>
              {courseBatches.map((b) => (
                <option key={b._id} value={b._id} disabled={b.studentCount >= b.capacity}>
                  {b.batchCode} ({b.studentCount}/{b.capacity} seats)
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Discount (%)</label>
            <input
              type="number"
              min="0"
              max="100"
              step="0.01"
              className="form-input"
              placeholder="0"
              value={form.discount}
              onChange={(e) => setForm({ ...form, discount: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Scholarship (INR)</label>
            <input type="number" min="0" className="form-input" placeholder="0" value={form.scholarship} onChange={(e) => setForm({ ...form, scholarship: e.target.value })} />
          </div>
          {selectedCourse && <FeeBreakdownCard breakdown={createFeeBreakdown} />}
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Confirm Enrolment</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(payModalEnr)}
        onClose={() => setPayModalEnr(null)}
        title={`Update Student Payment — ${payModalEnr?.enrollmentNumber || ''}`}
      >
        <form onSubmit={handleRecordPayment} className="form-grid">
          <div className="form-field full">
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
              Student: <strong>{payModalEnr?.studentId?.userId?.fullName}</strong> • Course:{' '}
              <strong>{payModalEnr?.courseId?.title}</strong>
            </div>
          </div>
          <div className="form-field">
            <label className="form-label">Amount (INR)</label>
            <input
              type="number"
              min="1"
              required
              className="form-input"
              value={payForm.amount}
              onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Payment Method</label>
            <select
              className="form-select"
              value={payForm.paymentMethod}
              onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}
            >
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="NET_BANKING">Net Banking</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Transaction Reference</label>
            <input
              className="form-input"
              required
              value={payForm.transactionReference}
              onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Save &amp; Update Student Payment</button>
          </div>
        </form>
      </Modal>

      <Modal
        open={Boolean(assignModal)}
        onClose={() => setAssignModal(null)}
        title={assignModal?.status === 'PENDING_REVIEW' ? 'Approve & Assign Batch' : 'Update Batch & Fee Discount (%)'}
        maxWidth={480}
      >
        <form onSubmit={handleConfirmAssignOrApprove} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
            Student: <strong>{assignModal?.studentId?.userId?.fullName}</strong> • Course: <strong>{assignModal?.courseId?.title}</strong>
          </div>
          <div className="form-field">
            <label className="form-label">Select Batch for {assignModal?.courseId?.title}</label>
            <select className="form-select" value={assignBatchId} onChange={(e) => setAssignBatchId(e.target.value)}>
              <option value="">Unassigned</option>
              {modalBatches.map((b) => (
                <option key={b._id} value={b._id} disabled={b.studentCount >= b.capacity && b._id !== assignModal?.batchId?._id}>
                  {b.batchCode} ({b.studentCount}/{b.capacity} seats)
                </option>
              ))}
            </select>
          </div>
          {assignModal?.status !== 'PENDING_REVIEW' && (
            <>
              <div className="form-grid" style={{ gap: 12 }}>
                <div className="form-field">
                  <label className="form-label">Discount (%)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    className="form-input"
                    placeholder="0"
                    value={editDiscountPercent}
                    onChange={(e) => setEditDiscountPercent(e.target.value)}
                  />
                </div>
                <div className="form-field">
                  <label className="form-label">Scholarship (INR)</label>
                  <input
                    type="number"
                    min="0"
                    className="form-input"
                    placeholder="0"
                    value={editScholarship}
                    onChange={(e) => setEditScholarship(e.target.value)}
                  />
                </div>
              </div>
              <FeeBreakdownCard breakdown={editFeeBreakdown} />
            </>
          )}
          <button type="submit" className="btn btn-primary">
            {assignModal?.status === 'PENDING_REVIEW' ? 'Approve Enrolment' : 'Save Batch & Fee Calculation'}
          </button>
        </form>
      </Modal>
    </div>
  );
}
