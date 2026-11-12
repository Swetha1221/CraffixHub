import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import {
  CalendarPlus,
  Send,
  Check,
  X,
  Eye,
  ArrowRight,
  ShieldAlert,
  FileText,
  FileSpreadsheet,
  FileType2,
} from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge, EmptyState } from '../../components/common/UI';
import { formatDate, formatDateTime, formatRoleLabel } from '../../utils/format';
import { exportToPdf, exportToXlsx, exportToDocx } from '../../utils/exporters';

function getHierarchySteps(leave) {
  const appRole = leave.applicantRole || 'STUDENT';
  const days = Number(leave.days || 1);
  if (appRole === 'MENTOR' || appRole === 'COORDINATOR') {
    return ['Submitted', 'Admin Decision'];
  }
  if (days <= 1) {
    return ['Submitted', 'Mentor Decision'];
  }
  if (days <= 2) {
    return ['Submitted', 'Coordinator Decision'];
  }
  return ['Submitted', 'Admin / Super Admin Decision'];
}

function getHierarchyStepState(leave, stepLabel) {
  const status = leave.status;
  if (stepLabel === 'Submitted') return 'done';

  // Final Decision step (Mentor Decision / Coordinator Decision / Admin Decision / Admin / Super Admin Decision)
  if (status === 'Completed' || leave.finalStatus === 'APPROVED') return 'done';
  if (status === 'Rejected' || leave.finalStatus === 'REJECTED') {
    const isRejectedHere =
      (stepLabel === 'Mentor Decision' && leave.rejectedByRole === 'MENTOR') ||
      (stepLabel === 'Coordinator Decision' && leave.rejectedByRole === 'COORDINATOR') ||
      (stepLabel === 'Admin Decision' && ['ADMIN', 'SUPER_ADMIN'].includes(leave.rejectedByRole)) ||
      (stepLabel === 'Admin / Super Admin Decision' && ['ADMIN', 'SUPER_ADMIN'].includes(leave.rejectedByRole));
    return isRejectedHere ? 'rejected' : 'pending';
  }

  if (stepLabel === 'Mentor Decision' && status === 'Pending Mentor') return 'current';
  if (stepLabel === 'Coordinator Decision' && status === 'Pending Coordinator') return 'current';
  if (
    (stepLabel === 'Admin Decision' || stepLabel === 'Admin / Super Admin Decision') &&
    status === 'Pending Admin'
  ) {
    return 'current';
  }
  return 'pending';
}

function AbstractedLeaveStepper({ leave }) {
  const isApproved = leave.status === 'Approved' || leave.finalStatus === 'APPROVED';
  const isRejected = leave.status === 'Rejected' || leave.finalStatus === 'REJECTED';
  const steps = [{ label: 'Submitted', state: 'done' }];
  if (isApproved) steps.push({ label: 'Approved', state: 'done' });
  if (isRejected) steps.push({ label: 'Rejected', state: 'rejected' });

  return (
    <div className="leave-stepper" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((step, idx) => {
        const cls =
          step.state === 'done'
            ? 'done'
            : step.state === 'rejected'
            ? 'rejected'
            : '';
        return (
          <div key={step.label} className={`leave-step ${cls}`}>
            <span className="leave-step-dot">
              {step.state === 'done' ? <Check size={12} /> : step.state === 'rejected' ? <X size={12} /> : idx + 1}
            </span>
            <span>{step.label}</span>
          </div>
        );
      })}
    </div>
  );
}

function LeaveStepper({ leave, isAbstracted }) {
  if (isAbstracted) {
    return <AbstractedLeaveStepper leave={leave} />;
  }
  const steps = getHierarchySteps(leave);
  return (
    <div className="leave-stepper" style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0, 1fr))` }}>
      {steps.map((label, idx) => {
        const st = getHierarchyStepState(leave, label);
        const cls = st === 'done' ? 'done' : st === 'current' ? 'current' : st === 'rejected' ? 'rejected' : '';
        return (
          <div key={label} className={`leave-step ${cls}`}>
            <span className="leave-step-dot">
              {st === 'done' ? <Check size={12} /> : st === 'rejected' ? <X size={12} /> : idx + 1}
            </span>
            <span>{label}</span>
          </div>
        );
      })}
    </div>
  );
}

export function LeaveWorkflowPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const role = user?.primaryRole || 'STUDENT';

  const isStudent = role === 'STUDENT';
  const canApply = ['STUDENT', 'MENTOR', 'COORDINATOR'].includes(role);
  const canExport = !['STUDENT', 'GUEST'].includes(role);
  const isSuperAdmin = role === 'SUPER_ADMIN';

  const [leaves, setLeaves] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [applyModal, setApplyModal] = useState(false);
  const [detailLeave, setDetailLeave] = useState(null);
  const [remarks, setRemarks] = useState('');
  const [statusFilter, setStatusFilter] = useState('ALL');

  const [form, setForm] = useState({
    leaveType: isStudent ? 'Medical' : 'CASUAL',
    leaveCategory: 'Family Function',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    days: 1,
    reason: '',
    assignedMentorId: '',
  });

  const loadData = useCallback(async () => {
    const reqs = [api.get('/leaves')];
    if (isStudent) reqs.push(api.get('/mentors'));
    const [lRes, mRes] = await Promise.all(reqs);
    setLeaves(lRes.data.data || []);
    if (mRes) {
      const mList = mRes.data.data || [];
      setMentors(mList);
      setForm((prev) => ({ ...prev, assignedMentorId: prev.assignedMentorId || mList[0]?._id || '' }));
    }
  }, [isStudent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['leaves']);

  const updateDateRange = (nextStart, nextEnd) => {
    let computedDays = form.days;
    if (nextStart && nextEnd) {
      const s = new Date(nextStart);
      const e = new Date(nextEnd);
      if (!Number.isNaN(s.getTime()) && !Number.isNaN(e.getTime()) && e >= s) {
        computedDays = Math.floor((e - s) / 86400000) + 1;
      }
    }
    setForm((prev) => ({ ...prev, startDate: nextStart, endDate: nextEnd, days: computedDays }));
  };

  const isPersonalLeaveSelected = String(form.leaveType || '').toUpperCase() === 'PERSONAL';

  const handleApply = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        ...form,
        leaveCategory: isPersonalLeaveSelected ? form.leaveCategory : '',
        days: Number(form.days || 1),
      };
      const res = await api.post('/leaves', payload);
      dispatch(pushToast({ type: 'success', title: 'Leave Applied', message: res.data.message }));
      setApplyModal(false);
      setForm((prev) => ({ ...prev, reason: '' }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleTransition = async (leaveId, action, note = '') => {
    try {
      const res = await api.post(`/leaves/${leaveId}/transition`, { action, remarks: note });
      dispatch(pushToast({ type: 'success', title: 'Workflow Updated', message: res.data.message }));
      setDetailLeave(null);
      setRemarks('');
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Action Blocked', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const filteredLeaves = leaves.filter((l) => {
    if (statusFilter === 'ALL') return true;
    return l.status === statusFilter;
  });

  const getAvailableActions = (l) => {
    if (isStudent || l.abstracted) return [];
    const days = Number(l.days || 1);
    const isStaffLeave = ['MENTOR', 'COORDINATOR'].includes(l.applicantRole);

    if (isStaffLeave) {
      if (['ADMIN', 'SUPER_ADMIN'].includes(role) && l.status === 'Pending Admin') {
        return [
          { action: 'APPROVE', label: 'Approve Staff Leave', cls: 'btn-success' },
          { action: 'REJECT', label: 'Reject Staff Leave', cls: 'btn-danger' },
        ];
      }
      return [];
    }

    // Student leave FINAL authority:
    // Exactly 1 day -> Assigned Mentor
    // Exactly 2 days -> Assigned Course Coordinator
    // More than 2 days (3+) -> Admin (primary) / Super Admin (fallback)
    if (days <= 1) {
      if (role === 'MENTOR' && l.status === 'Pending Mentor') {
        return [
          { action: 'APPROVE', label: 'Approve (1-Day)', cls: 'btn-success' },
          { action: 'REJECT', label: 'Reject', cls: 'btn-danger' },
        ];
      }
      return [];
    }

    if (days <= 2) {
      if (role === 'COORDINATOR' && l.status === 'Pending Coordinator') {
        return [
          { action: 'APPROVE', label: 'Approve (2-Day)', cls: 'btn-success' },
          { action: 'REJECT', label: 'Reject', cls: 'btn-danger' },
        ];
      }
      return [];
    }

    if (['ADMIN', 'SUPER_ADMIN'].includes(role) && l.status === 'Pending Admin') {
      return [
        { action: 'APPROVE', label: 'Approve (3+ Days)', cls: 'btn-success' },
        { action: 'REJECT', label: 'Reject', cls: 'btn-danger' },
      ];
    }
    return [];
  };

  const filterOptions = isStudent
    ? ['ALL', 'Submitted', 'Approved', 'Rejected']
    : ['ALL', 'Pending Mentor', 'Pending Coordinator', 'Pending Admin', 'Completed', 'Rejected', 'Submitted', 'Approved'];

  const handleExportLeaves = (type) => {
    const rows = filteredLeaves.map((l) => ({
      LeaveCode: l.leaveCode || 'LVE',
      Applicant: l.applicantName || '-',
      Role: formatRoleLabel(l.applicantRole),
      LeaveType: l.leaveCategory ? `${l.leaveType} (${l.leaveCategory})` : l.leaveType,
      Dates: `${formatDate(l.startDate)} - ${formatDate(l.endDate)}`,
      Days: l.days,
      Status: l.status || l.finalStatus,
      Reason: l.reason || '-',
    }));
    const subtitle = `Generated ${formatDateTime(new Date())} by ${user?.fullName || 'CraffixHub'}`;
    if (type === 'pdf') exportToPdf('craffixhub-leaves.pdf', 'Leave Management Report', rows, subtitle);
    if (type === 'xlsx') exportToXlsx('craffixhub-leaves.xlsx', 'Leaves', rows);
    if (type === 'docx') exportToDocx('craffixhub-leaves.docx', 'Leave Management Report', rows, subtitle);
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isStudent
              ? 'My Leave Applications'
              : 'Leave Management'}
          </h1>
          <p className="page-subtitle">
            {role === 'STUDENT' && 'Apply for Medical, Academic, or Personal leave and track your application status'}
            {role === 'MENTOR' && 'Approve or reject 1-day student leaves, or apply for personal Mentor leave'}
            {role === 'COORDINATOR' && 'Approve or reject 2-day student leaves, or apply for personal Course Coordinator leave'}
            {role === 'ADMIN' && 'Primary approval authority for 3+ day student leaves and staff (Mentor & Coordinator) leaves'}
            {isSuperAdmin && 'Receives informational alerts for all student leaves; approval authority (with Admin primary) for 3+ day student leaves and fallback for staff leaves'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          {canExport && (
            <>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportLeaves('pdf')}>
                <FileText size={14} /> PDF
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportLeaves('xlsx')}>
                <FileSpreadsheet size={14} /> Excel (.xlsx)
              </button>
              <button type="button" className="btn btn-outline btn-sm" onClick={() => handleExportLeaves('docx')}>
                <FileType2 size={14} /> Word (.docx)
              </button>
            </>
          )}
          {canApply && (
            <button type="button" className="btn btn-primary" onClick={() => setApplyModal(true)}>
              <CalendarPlus size={15} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {isSuperAdmin && (
        <div
          className="card"
          style={{
            marginBottom: 16,
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'var(--bg-subtle)',
          }}
        >
          <ShieldAlert size={18} color="var(--color-indigo)" />
          <span style={{ fontSize: 13, fontWeight: 600 }}>
            Super Admin Governance: You receive informational notifications for all student leaves (1-day &amp; 2-day remain with Mentor / Course Coordinator). Admin is primary for 3+ day and staff leaves, with Super Admin fallback if needed.
          </span>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="filter-tabs">
          {filterOptions.map((st) => (
            <button
              key={st}
              type="button"
              className={`filter-tab ${statusFilter === st ? 'active' : ''}`}
              onClick={() => setStatusFilter(st)}
            >
              {st === 'ALL' ? `All (${leaves.length})` : st}
            </button>
          ))}
        </div>
      </div>

      {filteredLeaves.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={CalendarPlus}
            title="No leave requests in this stage"
            description={canApply ? 'Click Apply Leave to start a tracked leave approval request.' : 'No requests match the selected stage.'}
          />
        </div>
      ) : (
        <div className="card">
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Leave #</th>
                  {!isStudent && <th>Applicant</th>}
                  <th>Type &amp; Category</th>
                  <th>Dates &amp; Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredLeaves.map((l) => {
                  const actions = getAvailableActions(l);
                  return (
                    <tr key={l._id}>
                      <td style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{l.leaveCode || 'LVE'}</td>
                      {!isStudent && (
                        <td>
                          <div style={{ fontWeight: 700 }}>{l.applicantName}</div>
                          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                            {formatRoleLabel(l.applicantRole)}
                            {l.assignedMentorName && l.applicantRole === 'STUDENT' ? ` • Mentor: ${l.assignedMentorName}` : ''}
                          </div>
                        </td>
                      )}
                      <td>
                        <div style={{ fontWeight: 600 }}>{l.leaveType}</div>
                        {l.leaveCategory && (
                          <div style={{ fontSize: 11.5, color: 'var(--color-secondary)', fontWeight: 600 }}>
                            {l.leaveCategory}
                          </div>
                        )}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ fontWeight: 600 }}>{formatDate(l.startDate)} – {formatDate(l.endDate)}</div>
                        <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                          {l.days} day{Number(l.days) > 1 ? 's' : ''}
                        </div>
                      </td>
                      <td style={{ maxWidth: 240, fontSize: 12.5, color: 'var(--text-secondary)' }}>{l.reason}</td>
                      <td><StatusBadge status={l.status || l.finalStatus} /></td>
                      <td>
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          {actions.map((act) => (
                            <button
                              key={act.action}
                              type="button"
                              className={`btn btn-sm ${act.cls}`}
                              onClick={() => {
                                setDetailLeave(l);
                                setRemarks('');
                              }}
                            >
                              {act.action.includes('REJECT') ? <X size={13} /> : <Check size={13} />} {act.label}
                            </button>
                          ))}
                          <button
                            type="button"
                            className="btn btn-outline btn-sm"
                            onClick={() => {
                              setDetailLeave(l);
                              setRemarks('');
                            }}
                          >
                            <Eye size={13} /> {l.abstracted || isStudent ? 'View Status' : 'Details'}
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Leave Modal */}
      <Modal open={applyModal} onClose={() => setApplyModal(false)} title="Apply for Leave" maxWidth={520}>
        <form onSubmit={handleApply} className="form-grid">
          <div className="form-field">
            <label className="form-label">Leave Type</label>
            <select className="form-select" value={form.leaveType} onChange={(e) => setForm({ ...form, leaveType: e.target.value })}>
              {isStudent ? (
                <>
                  <option value="Medical">Medical</option>
                  <option value="Academic">Academic</option>
                  <option value="Personal">Personal</option>
                </>
              ) : (
                <>
                  <option value="CASUAL">Casual</option>
                  <option value="SICK">Sick</option>
                  <option value="EARNED">Earned</option>
                  <option value="PERSONAL">Personal</option>
                </>
              )}
            </select>
          </div>
          {isPersonalLeaveSelected && (
            <div className="form-field">
              <label className="form-label">Personal Leave Category</label>
              <select
                className="form-select"
                value={form.leaveCategory}
                onChange={(e) => setForm({ ...form, leaveCategory: e.target.value })}
              >
                <option value="Family Function">Family Function</option>
                <option value="Emergency">Emergency</option>
                <option value="Travel">Travel</option>
                <option value="Medical / Health">Medical / Health</option>
                <option value="Personal Errand">Personal Errand</option>
                <option value="Other">Other</option>
              </select>
            </div>
          )}
          <div className="form-field">
            <label className="form-label">Total Days</label>
            <input
              type="number"
              min="0.5"
              step="0.5"
              required
              className="form-input"
              value={form.days}
              onChange={(e) => setForm({ ...form, days: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input
              type="date"
              required
              className="form-input"
              value={form.startDate}
              onChange={(e) => updateDateRange(e.target.value, form.endDate < e.target.value ? e.target.value : form.endDate)}
            />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input
              type="date"
              required
              className="form-input"
              value={form.endDate}
              onChange={(e) => updateDateRange(form.startDate, e.target.value)}
            />
          </div>
          {isStudent && (
            <div className="form-field full">
              <label className="form-label">Select Mentor</label>
              <select
                className="form-select"
                required
                value={form.assignedMentorId}
                onChange={(e) => setForm({ ...form, assignedMentorId: e.target.value })}
              >
                <option value="">Select Mentor</option>
                {mentors.map((m) => (
                  <option key={m._id} value={m._id}>{m.fullName} ({m.email})</option>
                ))}
              </select>
            </div>
          )}
          <div className="form-field full">
            <label className="form-label">Reason</label>
            <textarea
              className="form-textarea"
              required
              rows={3}
              placeholder="Explain reason for leave..."
              value={form.reason}
              onChange={(e) => setForm({ ...form, reason: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">
              <Send size={14} /> Submit Leave Request
            </button>
          </div>
        </form>
      </Modal>

      {/* Review & Audit Timeline Modal */}
      <Modal
        open={Boolean(detailLeave)}
        onClose={() => setDetailLeave(null)}
        title={`Leave Tracker — ${detailLeave?.leaveCode || ''}`}
        maxWidth={660}
      >
        {detailLeave && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{detailLeave.applicantName}</strong> {!isStudent && `(${formatRoleLabel(detailLeave.applicantRole)})`}
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {detailLeave.leaveType} • {formatDate(detailLeave.startDate)} – {formatDate(detailLeave.endDate)} ({detailLeave.days} day{Number(detailLeave.days) > 1 ? 's' : ''})
                </div>
              </div>
              <StatusBadge status={detailLeave.status || detailLeave.finalStatus} />
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)', fontSize: 13 }}>
              <strong>Reason:</strong> {detailLeave.reason}
            </div>

            <LeaveStepper
              leave={detailLeave}
              isAbstracted={Boolean(detailLeave.abstracted || isStudent || String(detailLeave.applicantUserId) === String(user?._id))}
            />

            {!(detailLeave.abstracted || isStudent || String(detailLeave.applicantUserId) === String(user?._id)) && (
              <div>
                <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>
                  Approval Audit Trail
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {(detailLeave.history || []).map((h, idx) => (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        gap: 10,
                        padding: '8px 12px',
                        borderRadius: 8,
                        border: '1px solid var(--border-color)',
                        fontSize: 12.5,
                      }}
                    >
                      <div>
                        <strong>{h.step}</strong> — {h.actorName} ({formatRoleLabel(h.actorRole)})
                        {h.remarks && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{h.remarks}</div>}
                      </div>
                      <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                        {formatDateTime(h.timestamp)}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {getAvailableActions(detailLeave).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-field">
                  <label className="form-label">Review Remarks / Endorsement Note (Optional)</label>
                  <input
                    className="form-input"
                    placeholder="Add remarks before forwarding or deciding..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {getAvailableActions(detailLeave).map((act) => (
                    <button
                      key={act.action}
                      type="button"
                      className={`btn btn-sm ${act.cls}`}
                      onClick={() => handleTransition(detailLeave._id, act.action, remarks)}
                    >
                      <ArrowRight size={13} /> {act.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
