import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { CalendarPlus, Check, X } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function HrmsPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canReview = ['ADMIN'].includes(user?.primaryRole);
  const canApplyLeave = !['SUPER_ADMIN', 'ADMIN'].includes(user?.primaryRole);

  const [leaves, setLeaves] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [leaveModal, setLeaveModal] = useState(false);
  const [attModal, setAttModal] = useState(false);

  const [leaveForm, setLeaveForm] = useState({
    leaveType: 'CASUAL',
    startDate: new Date().toISOString().slice(0, 10),
    endDate: new Date().toISOString().slice(0, 10),
    days: 1,
    reason: '',
  });
  const [attForm, setAttForm] = useState({
    employeeId: '',
    date: new Date().toISOString().slice(0, 10),
    status: 'PRESENT',
    remarks: '',
  });

  const loadData = useCallback(async () => {
    const [lRes, eRes] = await Promise.all([api.get('/employees/leaves'), api.get('/employees')]);
    setLeaves(lRes.data.data || []);
    const emps = eRes.data.data || [];
    setEmployees(emps);
    setAttForm((prev) => ({ ...prev, employeeId: prev.employeeId || emps[0]?._id || '' }));
    if (canReview) {
      const aRes = await api.get('/employees/attendance/all');
      setAttendance(aRes.data.data || []);
    }
  }, [canReview]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['leaves', 'attendance']);

  const applyLeave = async (e) => {
    e.preventDefault();
    try {
      await api.post('/employees/leaves', { ...leaveForm, days: Number(leaveForm.days) });
      dispatch(pushToast({ type: 'success', title: 'Leave Applied', message: 'Submitted for approval' }));
      setLeaveModal(false);
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const reviewLeave = async (id, decision) => {
    await api.post(`/employees/leaves/${id}/review`, { stage: 'HR', decision });
    dispatch(pushToast({ type: 'info', title: 'Leave Updated', message: `Marked ${decision}` }));
    loadData();
  };

  const markAttendance = async (e) => {
    e.preventDefault();
    await api.post('/employees/attendance', attForm);
    dispatch(pushToast({ type: 'success', title: 'Attendance Marked', message: 'Employee attendance saved' }));
    setAttModal(false);
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">HRMS — Leave & Attendance</h1>
          <p className="page-subtitle">Employee leave workflow and daily attendance tracking</p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          {canReview && (
            <button type="button" className="btn btn-outline" onClick={() => setAttModal(true)}>
              Mark Employee Attendance
            </button>
          )}
          {canApplyLeave && (
            <button type="button" className="btn btn-primary" onClick={() => setLeaveModal(true)}>
              <CalendarPlus size={15} /> Apply Leave
            </button>
          )}
        </div>
      </div>

      {user?.primaryRole !== 'SUPER_ADMIN' && (
        <div className="card" style={{ marginBottom: 18 }}>
          <div className="card-header">
            <h3 className="card-title">Leave Requests</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  {canReview && <th>Review</th>}
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l._id}>
                    <td style={{ fontWeight: 600 }}>{l.employeeId?.userId?.fullName || l.applicantName || 'Employee'}</td>
                    <td>{l.leaveType}</td>
                    <td>{formatDate(l.startDate)} – {formatDate(l.endDate)}</td>
                    <td>{l.days}</td>
                    <td>{l.reason}</td>
                    <td><StatusBadge status={l.finalStatus || l.status} /></td>
                    {canReview && (
                      <td>
                        {['PENDING_MANAGER', 'PENDING_HR', 'Pending Admin'].includes(l.finalStatus || l.status) ? (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => reviewLeave(l._id, 'APPROVED')}>
                              <Check size={14} /> Approve
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => reviewLeave(l._id, 'REJECTED')}>
                              <X size={14} />
                            </button>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>Reviewed</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {canReview && (
        <div className="card">
          <div className="card-header">
            <h3 className="card-title">Recent Employee Attendance</h3>
          </div>
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {attendance.map((a) => (
                  <tr key={a._id}>
                    <td style={{ fontWeight: 600 }}>{a.employeeId?.userId?.fullName}</td>
                    <td>{formatDate(a.date)}</td>
                    <td><StatusBadge status={a.status} /></td>
                    <td>{a.remarks || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <Modal open={leaveModal} onClose={() => setLeaveModal(false)} title="Apply for Leave">
        <form onSubmit={applyLeave} className="form-grid">
          <div className="form-field">
            <label className="form-label">Leave Type</label>
            <select className="form-select" value={leaveForm.leaveType} onChange={(e) => setLeaveForm({ ...leaveForm, leaveType: e.target.value })}>
              <option value="CASUAL">Casual</option>
              <option value="SICK">Sick</option>
              <option value="EARNED">Earned</option>
              <option value="COMPENSATORY">Compensatory</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Days</label>
            <input type="number" step="0.5" min="0.5" className="form-input" value={leaveForm.days} onChange={(e) => setLeaveForm({ ...leaveForm, days: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Start Date</label>
            <input type="date" className="form-input" value={leaveForm.startDate} onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">End Date</label>
            <input type="date" className="form-input" value={leaveForm.endDate} onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Reason</label>
            <textarea className="form-textarea" rows={3} required value={leaveForm.reason} onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Leave Request</button>
          </div>
        </form>
      </Modal>

      <Modal open={attModal} onClose={() => setAttModal(false)} title="Mark Employee Attendance">
        <form onSubmit={markAttendance} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Employee</label>
            <select className="form-select" value={attForm.employeeId} onChange={(e) => setAttForm({ ...attForm, employeeId: e.target.value })}>
              {employees.map((emp) => (
                <option key={emp._id} value={emp._id}>{emp.userId?.fullName} ({emp.employeeId})</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Date</label>
            <input type="date" className="form-input" value={attForm.date} onChange={(e) => setAttForm({ ...attForm, date: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Status</label>
            <select className="form-select" value={attForm.status} onChange={(e) => setAttForm({ ...attForm, status: e.target.value })}>
              <option value="PRESENT">Present</option>
              <option value="ABSENT">Absent</option>
              <option value="LATE">Late</option>
              <option value="EXCUSED">Excused</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Remarks</label>
            <input className="form-input" value={attForm.remarks} onChange={(e) => setAttForm({ ...attForm, remarks: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Save Attendance</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
