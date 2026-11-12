import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Award, Download, ExternalLink, Plus, ShieldOff, Check, X } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge } from '../../components/common/UI';
import { formatDate } from '../../utils/format';

export function CertificatesPage() {
  const dispatch = useDispatch();
  const user = useSelector((state) => state.auth.user);
  const canRequestOrIssue = ['ADMIN', 'COORDINATOR', 'MENTOR'].includes(user?.primaryRole);
  const isAdminLevel = ['ADMIN'].includes(user?.primaryRole);

  const [certs, setCerts] = useState([]);
  const [students, setStudents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    userId: '',
    certificateType: 'COURSE_COMPLETION',
    programTitle: '',
  });

  const loadData = useCallback(async () => {
    const res = await api.get('/certificates');
    setCerts(res.data.data || []);
    if (canRequestOrIssue) {
      // Student-only recipients per business rule
      const sRes = await api.get('/students?limit=100');
      const sList = (sRes.data.data || []).filter((s) => s.userId?._id);
      setStudents(sList);
      setForm((prev) => ({ ...prev, userId: prev.userId || sList[0]?.userId?._id || '' }));
    }
  }, [canRequestOrIssue]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  useRealtimeSync(loadData, ['certificates']);

  const handleIssue = async (e) => {
    e.preventDefault();
    try {
      const res = await api.post('/certificates/issue', form);
      dispatch(
        pushToast({
          type: 'success',
          title: isAdminLevel ? 'Certificate Issued' : 'Submitted for Admin Approval',
          message: res.data.message || form.programTitle,
        })
      );
      setModalOpen(false);
      setForm({ ...form, programTitle: '' });
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleApprove = async (certId, decision) => {
    try {
      await api.post(`/certificates/${certId}/approve`, { decision });
      dispatch(pushToast({ type: 'success', title: `Certificate ${decision}`, message: 'Student notified in real time' }));
      loadData();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const handleDownloadPdf = async (cert) => {
    const res = await api.get(`/certificates/${cert._id}/pdf`, { responseType: 'blob' });
    const url = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', `${cert.certificateNumber}.pdf`);
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.URL.revokeObjectURL(url);
  };

  const handleRevoke = async (certId) => {
    await api.post(`/certificates/${certId}/revoke`, { reason: 'Revoked by administrator' });
    dispatch(pushToast({ type: 'info', title: 'Revoked', message: 'Certificate marked REVOKED' }));
    loadData();
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Certificate Management</h1>
          <p className="page-subtitle">Student-only certificates • Mentor & Coordinator requests require Admin approval</p>
        </div>
        {canRequestOrIssue && (
          <button type="button" className="btn btn-primary" onClick={() => setModalOpen(true)}>
            <Plus size={15} /> {isAdminLevel ? 'Issue Certificate' : 'Request Certificate (Admin Approval)'}
          </button>
        )}
      </div>

      <div className="card">
        <div className="table-wrap">
          <table className="erp-table">
            <thead>
              <tr>
                <th>Certificate #</th>
                <th>Student Recipient</th>
                <th>Type</th>
                <th>Program</th>
                <th>Requested By</th>
                <th>Approval</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {certs.map((c) => (
                <tr key={c._id}>
                  <td style={{ fontWeight: 700 }}>{c.certificateNumber}</td>
                  <td>
                    <div style={{ fontWeight: 600 }}>{c.recipientName}</div>
                    <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{c.recipientEmail}</div>
                  </td>
                  <td><span className="badge badge-primary">{c.certificateType.replace(/_/g, ' ')}</span></td>
                  <td>
                    <div>{c.programTitle}</div>
                    <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{formatDate(c.issuedAt)}</div>
                  </td>
                  <td style={{ fontSize: 12.5 }}>{c.requestedBy?.fullName || 'Admin'}</td>
                  <td><StatusBadge status={c.approvalStatus || 'APPROVED'} /></td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {isAdminLevel && c.approvalStatus === 'PENDING_ADMIN_APPROVAL' && (
                        <>
                          <button type="button" className="btn btn-success btn-sm" onClick={() => handleApprove(c._id, 'APPROVED')}>
                            <Check size={13} /> Approve
                          </button>
                          <button type="button" className="btn btn-danger btn-sm" onClick={() => handleApprove(c._id, 'REJECTED')}>
                            <X size={13} /> Reject
                          </button>
                        </>
                      )}
                      {c.status === 'ACTIVE' && (
                        <>
                          <button type="button" className="btn btn-primary btn-sm" onClick={() => handleDownloadPdf(c)}>
                            <Download size={13} /> PDF
                          </button>
                          <a
                            href={`/verify/${c.verificationToken}`}
                            target="_blank"
                            rel="noreferrer"
                            className="btn btn-outline btn-sm"
                          >
                            <ExternalLink size={13} /> Verify
                          </a>
                        </>
                      )}
                      {isAdminLevel && c.status === 'ACTIVE' && (
                        <button type="button" className="btn btn-danger btn-sm" onClick={() => handleRevoke(c._id)}>
                          <ShieldOff size={13} /> Revoke
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={isAdminLevel ? 'Issue Student Certificate' : 'Request Student Certificate (Requires Admin Approval)'}
      >
        <form onSubmit={handleIssue} className="form-grid">
          <div className="form-field full">
            <label className="form-label">Student Recipient (Students Only)</label>
            <select className="form-select" required value={form.userId} onChange={(e) => setForm({ ...form, userId: e.target.value })}>
              {students.map((s) => (
                <option key={s._id} value={s.userId._id}>
                  {s.userId.fullName} ({s.studentId}) — {s.userId.email}
                </option>
              ))}
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Certificate Type</label>
            <select className="form-select" value={form.certificateType} onChange={(e) => setForm({ ...form, certificateType: e.target.value })}>
              <option value="COURSE_COMPLETION">Course Completion</option>
              <option value="INTERNSHIP">Internship</option>
              <option value="WORKSHOP_PARTICIPATION">Workshop Participation</option>
              <option value="HACKATHON_PARTICIPATION">Hackathon Participation</option>
              <option value="COMPETITION_WINNER">Competition Winner</option>
              <option value="TRAINING_PROGRAM">Training Program</option>
              <option value="APPRECIATION">Appreciation</option>
            </select>
          </div>
          <div className="form-field full">
            <label className="form-label">Course / Program Title</label>
            <input className="form-input" required value={form.programTitle} onChange={(e) => setForm({ ...form, programTitle: e.target.value })} />
          </div>
          <div className="form-field full">
            <button type="submit" className="btn btn-primary">
              <Award size={15} /> {isAdminLevel ? 'Generate & Issue' : 'Submit for Admin Approval'}
            </button>
          </div>
        </form>
      </Modal>
    </div>
  );
}
