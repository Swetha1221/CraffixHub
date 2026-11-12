import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Check, Plus, IndianRupee, ArrowRight, Eye, X, Send, Clock } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatCard, StatusBadge, EmptyState } from '../../components/common/UI';
import { formatINR, formatDate, formatDateTime } from '../../utils/format';

const DUE_STEPS = [
  'Submitted',
  'Mentor',
  'Coordinator',
  'Admin / Super Admin',
  'Coordinator Notice',
  'Completed',
];

function getDueStepState(req, step) {
  const status = req.status;
  if (step === 'Submitted') return 'done';
  if (step === 'Mentor') {
    if (status === 'Pending Mentor') return 'current';
    return 'done';
  }
  if (step === 'Coordinator') {
    if (status === 'Pending Mentor') return 'pending';
    if (status === 'Pending Coordinator') return 'current';
    return 'done';
  }
  if (step === 'Admin / Super Admin') {
    if (['Pending Mentor', 'Pending Coordinator'].includes(status)) return 'pending';
    if (['Pending Admin', 'Pending Super Admin'].includes(status)) return 'current';
    if (req.decisionOutcome === 'REJECTED') return 'rejected';
    return 'done';
  }
  if (step === 'Coordinator Notice') {
    if (['Pending Mentor', 'Pending Coordinator', 'Pending Admin', 'Pending Super Admin'].includes(status)) {
      return 'pending';
    }
    if (['Approved - Forwarded to Coordinator', 'Rejected - Forwarded to Coordinator'].includes(status)) {
      return 'current';
    }
    return req.decisionOutcome === 'REJECTED' ? 'rejected' : 'done';
  }
  // Completed
  if (status === 'Completed') return 'done';
  if (status === 'Rejected') return 'rejected';
  return 'pending';
}

function DueRequestStepper({ req }) {
  return (
    <div className="leave-stepper" style={{ gridTemplateColumns: `repeat(${DUE_STEPS.length}, minmax(0, 1fr))` }}>
      {DUE_STEPS.map((label, idx) => {
        const st = getDueStepState(req, label);
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

export function FinancePage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const role = user?.primaryRole || 'STUDENT';
  const isSuperAdmin = role === 'SUPER_ADMIN';
  const isMentor = role === 'MENTOR';
  const isStudent = role === 'STUDENT';
  const canVerify = ['SUPER_ADMIN', 'ADMIN', 'COORDINATOR'].includes(role);
  const canExpense = ['ADMIN', 'COORDINATOR'].includes(role);
  const canIssueAmount = ['COORDINATOR', 'ADMIN', 'SUPER_ADMIN'].includes(role);
  const canViewExpenses = canExpense || isSuperAdmin;

  const [tab, setTab] = useState(isMentor ? 'due-requests' : 'invoices');
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [dueRequests, setDueRequests] = useState([]);
  const [mentors, setMentors] = useState([]);
  const [students, setStudents] = useState([]);
  const [payModal, setPayModal] = useState(null);
  const [expModal, setExpModal] = useState(false);
  const [issueModalOpen, setIssueModalOpen] = useState(false);
  const [dueModal, setDueModal] = useState(null);
  const [detailDue, setDetailDue] = useState(null);
  const [dueRemarks, setDueRemarks] = useState('');

  const [payForm, setPayForm] = useState({ amount: '', paymentMethod: 'UPI', transactionReference: '', notes: '' });
  const [expForm, setExpForm] = useState({ category: 'Infrastructure', description: '', vendorName: '', amount: '' });
  const [issueForm, setIssueForm] = useState({
    studentId: '',
    invoiceId: '',
    issueMode: 'RECORD_PAID',
    amount: '',
    paymentMethod: 'UPI',
    transactionReference: '',
    notes: '',
  });
  const [dueForm, setDueForm] = useState({
    requestedAmount: '',
    requestType: 'DUE_EXTENSION',
    proposedDate: '',
    assignedMentorId: '',
    reason: '',
  });

  const loadData = useCallback(async () => {
    const reqs = [
      isMentor ? Promise.resolve({ data: { data: [] } }) : api.get('/finance/invoices'),
      isMentor ? Promise.resolve({ data: { data: [] } }) : api.get('/finance/payments'),
      api.get('/finance/due-requests'),
    ];
    if (canViewExpenses) reqs.push(api.get('/finance/expenses'));
    else reqs.push(Promise.resolve(null));
    if (isStudent) reqs.push(api.get('/mentors'));
    else reqs.push(Promise.resolve(null));
    if (canIssueAmount) reqs.push(api.get('/students?limit=100'));
    else reqs.push(Promise.resolve(null));

    const [iRes, pRes, dRes, eRes, mRes, sRes] = await Promise.all(reqs);
    setInvoices(iRes.data.data || []);
    setPayments(pRes.data.data || []);
    setDueRequests(dRes.data.data || []);
    if (eRes) setExpenses(eRes.data.data || []);
    if (mRes) {
      const mList = mRes.data.data || [];
      setMentors(mList);
      setDueForm((prev) => ({ ...prev, assignedMentorId: prev.assignedMentorId || mList[0]?._id || '' }));
    }
    if (sRes) {
      const sList = sRes.data.data || [];
      setStudents(sList);
      setIssueForm((prev) => ({ ...prev, studentId: prev.studentId || sList[0]?._id || '' }));
    }
  }, [canViewExpenses, canIssueAmount, isMentor, isStudent]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['finance']);

  const verifiedTotal = payments.filter((p) => p.paymentStatus === 'VERIFIED').reduce((s, p) => s + p.amount, 0);
  const pendingVerificationTotal = payments
    .filter((p) => p.paymentStatus === 'PENDING_VERIFICATION')
    .reduce((s, p) => s + p.amount, 0);
  const totalDue = invoices.reduce((s, inv) => s + inv.dueAmount, 0);
  const approvedExpenses = expenses
    .filter((e) => e.approvalStatus === 'APPROVED')
    .reduce((s, e) => s + e.amount, 0);

  const handleRecordPayment = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/payments', {
        invoiceId: payModal._id,
        amount: Number(payForm.amount),
        paymentMethod: payForm.paymentMethod,
        transactionReference: payForm.transactionReference,
        notes: payForm.notes,
      });
      dispatch(pushToast({ type: 'success', title: 'Payment Recorded', message: 'Awaiting finance verification' }));
      setPayModal(null);
      setPayForm({ amount: '', paymentMethod: 'UPI', transactionReference: '', notes: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleVerifyPayment = async (id, decision) => {
    await api.post(`/finance/payments/${id}/verify`, { decision });
    dispatch(pushToast({ type: 'success', title: 'Payment Updated', message: `Marked ${decision}` }));
    loadData();
  };

  const handleCreateExpense = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/expenses', { ...expForm, amount: Number(expForm.amount) });
      dispatch(pushToast({ type: 'success', title: 'Expense Submitted', message: 'Pending approval' }));
      setExpModal(false);
      setExpForm({ category: 'Infrastructure', description: '', vendorName: '', amount: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleIssueAmount = async (e) => {
    e.preventDefault();
    try {
      await api.post('/finance/issue-amount', {
        ...issueForm,
        amount: Number(issueForm.amount),
      });
      dispatch(
        pushToast({
          type: 'success',
          title: 'Transaction Issued',
          message: `Processed ${formatINR(issueForm.amount)} (${issueForm.paymentMethod})`,
        })
      );
      setIssueModalOpen(false);
      setIssueForm((prev) => ({ ...prev, invoiceId: '', amount: '', transactionReference: '', notes: '' }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed to issue amount' }));
    }
  };

  const handleApproveExpense = async (id, decision) => {
    try {
      await api.post(`/finance/expenses/${id}/approve`, { decision });
      dispatch(pushToast({ type: 'success', title: 'Expense Updated', message: `Marked ${decision}` }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Approval Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const openDueRequestModal = (inv) => {
    setDueModal(inv);
    setDueForm((prev) => ({
      ...prev,
      requestedAmount: inv.dueAmount,
      proposedDate: inv.dueDate ? String(inv.dueDate).slice(0, 10) : '',
      reason: '',
    }));
  };

  const handleCreateDueRequest = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/finance/due-requests', {
        invoiceId: dueModal._id,
        requestedAmount: Number(dueForm.requestedAmount),
        requestType: dueForm.requestType,
        proposedDate: dueForm.proposedDate,
        assignedMentorId: dueForm.assignedMentorId || null,
        reason: dueForm.reason,
      });
      dispatch(pushToast({ type: 'success', title: 'Due Request Submitted', message: res.data.message }));
      setDueModal(null);
      setTab('due-requests');
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleDueTransition = async (reqId, action, remarksNote = '') => {
    try {
      const res = await api.post(`/finance/due-requests/${reqId}/transition`, {
        action,
        remarks: remarksNote,
      });
      dispatch(pushToast({ type: 'success', title: 'Due Request Updated', message: res.data.message }));
      setDetailDue(null);
      setDueRemarks('');
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Action Blocked', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const getDueActions = (r) => {
    if (role === 'MENTOR' && r.status === 'Pending Mentor') {
      return [{ action: 'FORWARD_TO_COORDINATOR', label: 'Forward to Coordinator', cls: 'btn-primary' }];
    }
    if (role === 'COORDINATOR' && r.status === 'Pending Coordinator') {
      return [{ action: 'FORWARD_TO_ADMIN', label: 'Forward to Admin / Super Admin', cls: 'btn-primary' }];
    }
    if (role === 'ADMIN' && r.status === 'Pending Admin') {
      return [
        { action: 'APPROVE', label: 'Approve', cls: 'btn-success' },
        { action: 'REJECT', label: 'Reject', cls: 'btn-danger' },
        { action: 'FORWARD_TO_SUPER_ADMIN', label: 'Forward to Super Admin', cls: 'btn-outline' },
      ];
    }
    if (role === 'SUPER_ADMIN' && ['Pending Admin', 'Pending Super Admin'].includes(r.status)) {
      return [
        { action: 'APPROVE', label: 'Approve', cls: 'btn-success' },
        { action: 'REJECT', label: 'Reject', cls: 'btn-danger' },
      ];
    }
    if (
      role === 'COORDINATOR' &&
      ['Approved - Forwarded to Coordinator', 'Rejected - Forwarded to Coordinator'].includes(r.status)
    ) {
      const isApp = r.decisionOutcome === 'APPROVED';
      return [
        {
          action: 'FORWARD_DECISION_TO_STUDENT',
          label: isApp ? 'Forward Approval to Student' : 'Forward Rejection to Student',
          cls: isApp ? 'btn-success' : 'btn-danger',
        },
      ];
    }
    return [];
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {isMentor ? 'Due Amount Requests' : 'Finance & Fee Management'}
          </h1>
          <p className="page-subtitle">
            {isMentor
              ? 'Review student due amount requests and forward to Course Coordinator'
              : 'Invoices, verified payments, due amount forwarding workflow, and expense approvals'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {canIssueAmount && (
            <button type="button" className="btn btn-primary" onClick={() => setIssueModalOpen(true)}>
              <IndianRupee size={15} /> Issue Amount
            </button>
          )}
          {canExpense && (
            <button type="button" className="btn btn-outline" onClick={() => setExpModal(true)}>
              <Plus size={15} /> Record Expense
            </button>
          )}
        </div>
      </div>

      {!isMentor && (
        <div className="kpi-grid">
          <StatCard label="Verified Collections" value={formatINR(verifiedTotal)} icon={IndianRupee} iconBg="rgba(0,194,168,0.14)" iconColor="#059669" />
          <StatCard label="Pending Verification" value={formatINR(pendingVerificationTotal)} icon={IndianRupee} iconBg="rgba(245,158,11,0.14)" iconColor="#F59E0B" />
          <StatCard label="Outstanding Dues" value={formatINR(totalDue)} icon={IndianRupee} iconBg="rgba(239,68,68,0.12)" iconColor="#EF4444" />
          {canViewExpenses ? (
            <StatCard label="Approved Expenses" value={formatINR(approvedExpenses)} icon={IndianRupee} />
          ) : (
            <StatCard label="Due Requests" value={dueRequests.length} icon={Clock} />
          )}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {!isMentor && (
          <>
            <button type="button" className={`btn btn-sm ${tab === 'invoices' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('invoices')}>
              Invoices ({invoices.length})
            </button>
            <button type="button" className={`btn btn-sm ${tab === 'payments' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('payments')}>
              Payments ({payments.length})
            </button>
          </>
        )}
        <button type="button" className={`btn btn-sm ${tab === 'due-requests' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('due-requests')}>
          Due Requests ({dueRequests.length})
        </button>
        {canViewExpenses && (
          <button type="button" className={`btn btn-sm ${tab === 'expenses' ? 'btn-primary' : 'btn-outline'}`} onClick={() => setTab('expenses')}>
            Expenses ({expenses.length})
          </button>
        )}
      </div>

      {tab === 'invoices' && !isMentor && (
        <div className="card">
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Invoice #</th>
                  <th>Student</th>
                  <th>Course</th>
                  <th>Total</th>
                  <th>Paid</th>
                  <th>Due</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {invoices.map((inv) => (
                  <tr key={inv._id}>
                    <td style={{ fontWeight: 700 }}>{inv.invoiceNumber}</td>
                    <td>{inv.studentId?.userId?.fullName}</td>
                    <td>{inv.enrollmentId?.courseId?.title}</td>
                    <td>{formatINR(inv.totalAmount)}</td>
                    <td style={{ color: '#059669', fontWeight: 700 }}>{formatINR(inv.paidAmount)}</td>
                    <td style={{ color: inv.dueAmount > 0 ? 'var(--color-danger)' : 'inherit', fontWeight: 700 }}>
                      {formatINR(inv.dueAmount)}
                    </td>
                    <td><StatusBadge status={inv.status} /></td>
                    <td>
                      {!isSuperAdmin && inv.dueAmount > 0 && (
                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            onClick={() => {
                              setPayModal(inv);
                              setPayForm({ ...payForm, amount: inv.dueAmount });
                            }}
                          >
                            Record Payment
                          </button>
                          {isStudent && (
                            <button
                              type="button"
                              className="btn btn-outline btn-sm"
                              onClick={() => openDueRequestModal(inv)}
                            >
                              Request Due Approval
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === 'payments' && !isMentor && (
        <div className="card">
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Payment #</th>
                  <th>Student</th>
                  <th>Amount</th>
                  <th>Method</th>
                  <th>Ref</th>
                  <th>Date</th>
                  <th>Status</th>
                  {canVerify && <th>Verify</th>}
                </tr>
              </thead>
              <tbody>
                {payments.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontWeight: 700 }}>{p.paymentNumber}</td>
                    <td>{p.studentId?.userId?.fullName}</td>
                    <td style={{ fontWeight: 700 }}>{formatINR(p.amount)}</td>
                    <td>{p.paymentMethod}</td>
                    <td style={{ fontSize: 12 }}>{p.transactionReference}</td>
                    <td>{formatDate(p.paidAt)}</td>
                    <td><StatusBadge status={p.paymentStatus} /></td>
                    {canVerify && (
                      <td>
                        {p.paymentStatus === 'PENDING_VERIFICATION' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => handleVerifyPayment(p._id, 'VERIFIED')}>
                              <Check size={14} /> Verify
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleVerifyPayment(p._id, 'REJECTED')}>
                              Reject
                            </button>
                          </div>
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

      {tab === 'due-requests' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {dueRequests.length === 0 ? (
            <div className="card">
              <EmptyState
                icon={IndianRupee}
                title="No due amount requests"
                description={
                  isStudent
                    ? 'Open the Invoices tab and click Request Due Approval on any invoice with an outstanding balance.'
                    : 'Submitted due amount requests will appear here as they move through Mentor → Coordinator → Admin / Super Admin.'
                }
              />
            </div>
          ) : (
            dueRequests.map((req) => {
              const actions = getDueActions(req);
              return (
                <div key={req._id} className="card">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <span className="badge badge-neutral">{req.requestCode}</span>
                        <span className="badge badge-primary">{req.invoiceNumber}</span>
                        <strong>{req.applicantName}</strong>
                        <StatusBadge status={req.status} />
                      </div>
                      <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginTop: 6 }}>
                        <strong>{req.courseTitle}</strong> • Requested Due Amount: <strong>{formatINR(req.requestedAmount)}</strong> (Current Due: {formatINR(req.currentDueAmount)})
                        {req.proposedDate && ` • Proposed Date: ${formatDate(req.proposedDate)}`}
                        {req.assignedMentorName && ` • Mentor: ${req.assignedMentorName}`}
                      </div>
                      <div style={{ fontSize: 13, marginTop: 4 }}>{req.reason}</div>
                    </div>

                    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      {actions.map((act) => (
                        <button
                          key={act.action}
                          type="button"
                          className={`btn btn-sm ${act.cls}`}
                          onClick={() => {
                            setDetailDue(req);
                            setDueRemarks('');
                          }}
                        >
                          {act.action === 'REJECT' ? <X size={13} /> : <Check size={13} />} {act.label}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => {
                          setDetailDue(req);
                          setDueRemarks('');
                        }}
                      >
                        <Eye size={13} /> Timeline
                      </button>
                    </div>
                  </div>

                  <DueRequestStepper req={req} />
                </div>
              );
            })
          )}
        </div>
      )}

      {tab === 'expenses' && canViewExpenses && (
        <div className="card">
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Expense #</th>
                  <th>Category</th>
                  <th>Description</th>
                  <th>Vendor</th>
                  <th>Amount</th>
                  <th>Status</th>
                  {canVerify && <th>Approve</th>}
                </tr>
              </thead>
              <tbody>
                {expenses.map((exp) => (
                  <tr key={exp._id}>
                    <td style={{ fontWeight: 700 }}>{exp.expenseNumber}</td>
                    <td>{exp.category}</td>
                    <td>{exp.description}</td>
                    <td>{exp.vendorName || '—'}</td>
                    <td style={{ fontWeight: 700 }}>{formatINR(exp.amount)}</td>
                    <td><StatusBadge status={exp.approvalStatus} /></td>
                    {canVerify && (
                      <td>
                        {exp.approvalStatus === 'PENDING' && (
                          <div style={{ display: 'flex', gap: 6 }}>
                            <button type="button" className="btn btn-success btn-sm" onClick={() => handleApproveExpense(exp._id, 'APPROVED')}>
                              Approve
                            </button>
                            <button type="button" className="btn btn-danger btn-sm" onClick={() => handleApproveExpense(exp._id, 'REJECTED')}>
                              Reject
                            </button>
                          </div>
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

      <Modal open={Boolean(payModal)} onClose={() => setPayModal(null)} title={`Record Payment (${payModal?.invoiceNumber || ''})`}>
        <form onSubmit={handleRecordPayment} className="form-grid">
          <div className="form-field">
            <label className="form-label">Amount (INR)</label>
            <input type="number" min="1" required className="form-input" value={payForm.amount} onChange={(e) => setPayForm({ ...payForm, amount: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Method</label>
            <select className="form-select" value={payForm.paymentMethod} onChange={(e) => setPayForm({ ...payForm, paymentMethod: e.target.value })}>
              <option value="UPI">UPI</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="CARD">Card</option>
              <option value="CASH">Cash</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Transaction Reference</label>
            <input className="form-input" required placeholder="e.g. UPI-99887766" value={payForm.transactionReference} onChange={(e) => setPayForm({ ...payForm, transactionReference: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Payment Record</button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(dueModal)} onClose={() => setDueModal(null)} title={`Request Due Approval (${dueModal?.invoiceNumber || ''})`} maxWidth={540}>
        <form onSubmit={handleCreateDueRequest} className="form-grid">
          <div className="form-field">
            <label className="form-label">Requested Due Amount (INR)</label>
            <input
              type="number"
              min="1"
              max={dueModal?.dueAmount || undefined}
              required
              className="form-input"
              value={dueForm.requestedAmount}
              onChange={(e) => setDueForm({ ...dueForm, requestedAmount: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Request Type</label>
            <select className="form-select" value={dueForm.requestType} onChange={(e) => setDueForm({ ...dueForm, requestType: e.target.value })}>
              <option value="DUE_EXTENSION">Due Date Extension</option>
              <option value="INSTALLMENT_PLAN">Installment Plan</option>
              <option value="PARTIAL_DEFERRAL">Partial Fee Deferral</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Proposed Payment Date</label>
            <input
              type="date"
              required
              className="form-input"
              value={dueForm.proposedDate}
              onChange={(e) => setDueForm({ ...dueForm, proposedDate: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Assign Mentor</label>
            <select
              className="form-select"
              required
              value={dueForm.assignedMentorId}
              onChange={(e) => setDueForm({ ...dueForm, assignedMentorId: e.target.value })}
            >
              <option value="">Select Mentor</option>
              {mentors.map((m) => (
                <option key={m._id} value={m._id}>{m.fullName}</option>
              ))}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Reason / Justification</label>
            <textarea
              className="form-textarea"
              rows={3}
              required
              placeholder="Explain why you need this due amount extension or installment plan..."
              value={dueForm.reason}
              onChange={(e) => setDueForm({ ...dueForm, reason: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">
              <Send size={14} /> Submit Due Amount Request
            </button>
          </div>
        </form>
      </Modal>

      <Modal open={Boolean(detailDue)} onClose={() => setDetailDue(null)} title={`Due Request Tracker — ${detailDue?.requestCode || ''}`} maxWidth={660}>
        {detailDue && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{detailDue.applicantName}</strong> • {detailDue.invoiceNumber}
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>
                  {detailDue.courseTitle} • Requested: {formatINR(detailDue.requestedAmount)}
                  {detailDue.proposedDate && ` • Proposed Date: ${formatDate(detailDue.proposedDate)}`}
                </div>
              </div>
              <StatusBadge status={detailDue.status} />
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)', fontSize: 13 }}>
              <strong>Reason:</strong> {detailDue.reason}
            </div>

            <DueRequestStepper req={detailDue} />

            <div>
              <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 8 }}>Forwarding & Approval Trail</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {(detailDue.history || []).map((h, idx) => (
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
                      <strong>{h.step}</strong> — {h.actorName} ({h.actorRole})
                      {h.remarks && <div style={{ color: 'var(--text-secondary)', marginTop: 2 }}>{h.remarks}</div>}
                    </div>
                    <div style={{ color: 'var(--text-muted)', whiteSpace: 'nowrap', fontSize: 11.5 }}>
                      {formatDateTime(h.timestamp)}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {getDueActions(detailDue).length > 0 && (
              <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div className="form-field">
                  <label className="form-label">Review / Forwarding Remarks (Optional)</label>
                  <input
                    className="form-input"
                    placeholder="Add remarks before forwarding, approving, or rejecting..."
                    value={dueRemarks}
                    onChange={(e) => setDueRemarks(e.target.value)}
                  />
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  {getDueActions(detailDue).map((act) => (
                    <button
                      key={act.action}
                      type="button"
                      className={`btn btn-sm ${act.cls}`}
                      onClick={() => handleDueTransition(detailDue._id, act.action, dueRemarks)}
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

      <Modal open={expModal} onClose={() => setExpModal(false)} title="Record Company Expense">
        <form onSubmit={handleCreateExpense} className="form-grid">
          <div className="form-field">
            <label className="form-label">Category</label>
            <input className="form-input" required value={expForm.category} onChange={(e) => setExpForm({ ...expForm, category: e.target.value })} />
          </div>
          <div className="form-field">
            <label className="form-label">Amount (INR)</label>
            <input type="number" min="1" required className="form-input" value={expForm.amount} onChange={(e) => setExpForm({ ...expForm, amount: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Vendor Name</label>
            <input className="form-input" value={expForm.vendorName} onChange={(e) => setExpForm({ ...expForm, vendorName: e.target.value })} />
          </div>
          <div className="form-field full">
            <label className="form-label">Description</label>
            <textarea className="form-textarea" rows={3} required value={expForm.description} onChange={(e) => setExpForm({ ...expForm, description: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Expense</button>
          </div>
        </form>
      </Modal>

      <Modal open={issueModalOpen} onClose={() => setIssueModalOpen(false)} title="Issue Amount / Student Transaction">
        <form onSubmit={handleIssueAmount} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Select Registered Student</label>
            <select
              className="form-select"
              required
              value={issueForm.studentId}
              onChange={(e) => setIssueForm({ ...issueForm, studentId: e.target.value, invoiceId: '' })}
            >
              <option value="">Select Student</option>
              {students.map((s) => (
                <option key={s._id} value={s._id}>
                  {s.userId?.fullName} ({s.studentId})
                </option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Action Type</label>
            <select
              className="form-select"
              value={issueForm.issueMode}
              onChange={(e) => setIssueForm({ ...issueForm, issueMode: e.target.value })}
            >
              <option value="RECORD_PAID">Record Paid Transaction</option>
              <option value="ISSUE_INVOICE">Issue Payable Invoice</option>
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Linked Invoice (Optional)</label>
            <select
              className="form-select"
              value={issueForm.invoiceId}
              onChange={(e) => {
                const invId = e.target.value;
                const matched = invoices.find((i) => i._id === invId);
                setIssueForm({
                  ...issueForm,
                  invoiceId: invId,
                  amount: matched ? String(matched.dueAmount || matched.totalAmount || '') : issueForm.amount,
                });
              }}
            >
              <option value="">Create New / Standalone Invoice</option>
              {invoices
                .filter((i) => !issueForm.studentId || String(i.studentId?._id || i.studentId) === String(issueForm.studentId))
                .map((i) => (
                  <option key={i._id} value={i._id}>
                    {i.invoiceNumber} — Due {formatINR(i.dueAmount)}
                  </option>
                ))}
            </select>
          </div>
          <div className="form-field">
            <label className="form-label">Amount (INR)</label>
            <input
              type="number"
              min="1"
              required
              className="form-input"
              value={issueForm.amount}
              onChange={(e) => setIssueForm({ ...issueForm, amount: e.target.value })}
            />
          </div>
          <div className="form-field">
            <label className="form-label">Transaction Format</label>
            <select
              className="form-select"
              value={issueForm.paymentMethod}
              onChange={(e) => setIssueForm({ ...issueForm, paymentMethod: e.target.value })}
            >
              <option value="UPI">UPI</option>
              <option value="CARD">Card</option>
              <option value="NET_BANKING">Net Banking</option>
              <option value="BANK_TRANSFER">Bank Transfer</option>
              <option value="NEFT_RTGS">NEFT / RTGS</option>
              <option value="CHEQUE">Cheque</option>
              <option value="CASH">Cash</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Transaction Reference</label>
            <input
              className="form-input"
              placeholder="Optional reference / receipt number"
              value={issueForm.transactionReference}
              onChange={(e) => setIssueForm({ ...issueForm, transactionReference: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <label className="form-label">Notes</label>
            <textarea
              className="form-textarea"
              rows={2}
              placeholder="Fee details or transaction remarks..."
              value={issueForm.notes}
              onChange={(e) => setIssueForm({ ...issueForm, notes: e.target.value })}
            />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">Submit Transaction</button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
