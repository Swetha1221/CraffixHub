import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { Lightbulb, LayoutGrid, List, Check, X, MessageSquare, ExternalLink, Eye, Crown } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge, EmptyState } from '../../components/common/UI';
import { formatDateTime } from '../../utils/format';

export function AdminIdeaReview() {
  const dispatch = useDispatch();
  const [pitches, setPitches] = useState([]);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'card'
  const [domainFilter, setDomainFilter] = useState('');
  const [previewPitch, setPreviewPitch] = useState(null);
  const [remarks, setRemarks] = useState('');

  const loadPitches = useCallback(async () => {
    const res = await api.get('/idea-pitches');
    setPitches(res.data.data || []);
  }, []);

  useEffect(() => {
    loadPitches();
  }, [loadPitches]);

  useRealtimeSync(loadPitches, ['ideas']);

  const handleReview = async (pitchId, decision, customRemarks = '') => {
    try {
      await api.post(`/idea-pitches/${pitchId}/review`, {
        decision,
        remarks: customRemarks,
      });
      dispatch(
        pushToast({
          type: 'success',
          title: 'Pitch Reviewed',
          message: `Guest pitch status updated (${decision})`,
        })
      );
      setPreviewPitch(null);
      setRemarks('');
      loadPitches();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Error', message: err.response?.data?.message || 'Failed' }));
    }
  };

  const filtered = domainFilter ? pitches.filter((p) => p.category === domainFilter) : pitches;

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Guest Idea Pitches — Review Queue</h1>
          <p className="page-subtitle">
            Evaluate incoming guest innovation pitches, approve or shortlist candidates, or request clarification
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <select
            className="form-select"
            style={{ width: 170 }}
            value={domainFilter}
            onChange={(e) => setDomainFilter(e.target.value)}
          >
            <option value="">All Domains</option>
            <option value="AI/ML">AI/ML</option>
            <option value="Web3">Web3</option>
            <option value="EdTech">EdTech</option>
            <option value="Cloud">Cloud</option>
            <option value="Open Innovation">Open Innovation</option>
          </select>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'table' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('table')}
          >
            <List size={14} /> Table
          </button>
          <button
            type="button"
            className={`btn btn-sm ${viewMode === 'card' ? 'btn-primary' : 'btn-outline'}`}
            onClick={() => setViewMode('card')}
          >
            <LayoutGrid size={14} /> Cards
          </button>
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="card">
          <EmptyState
            icon={Lightbulb}
            title="No guest idea pitches found"
            description="When guest participants pitch ideas from the Guest Portal, they appear here in real time."
          />
        </div>
      ) : viewMode === 'table' ? (
        <div className="card">
          <div className="table-wrap">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Pitch</th>
                  <th>Guest & Contact</th>
                  <th>Domain</th>
                  <th>Problem Statement</th>
                  <th>Submitted</th>
                  <th>Status</th>
                  <th>Review Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((p) => (
                  <tr key={p._id}>
                    <td style={{ fontWeight: 700 }}>{p.pitchCode}</td>
                    <td>
                      <div style={{ fontWeight: 600 }}>{p.guestUser?.fullName || 'Guest User'}</div>
                      <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                        {p.guestUser?.email}
                        {p.guestUser?.phone ? ` • ${p.guestUser.phone}` : ''}
                      </div>
                    </td>
                    <td><span className="badge badge-primary">{p.category}</span></td>
                    <td style={{ maxWidth: 280 }}>
                      <div style={{ fontWeight: 600, fontSize: 13 }}>
                        {p.problemStatement.length > 90 ? `${p.problemStatement.slice(0, 90)}...` : p.problemStatement}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setPreviewPitch(p);
                          setRemarks(p.reviewRemarks || '');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          padding: 0,
                          marginTop: 4,
                          color: 'var(--color-secondary)',
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: 'pointer',
                        }}
                      >
                        Preview Abstract Solution →
                      </button>
                    </td>
                    <td style={{ fontSize: 12, color: 'var(--text-muted)' }}>{formatDateTime(p.createdAt)}</td>
                    <td><StatusBadge status={p.status} /></td>
                    <td>
                      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                        <button
                          type="button"
                          className="btn btn-primary btn-sm"
                          onClick={() => handleReview(p._id, 'APPROVE', 'Approved for innovation showcase')}
                        >
                          <Check size={13} /> Approve
                        </button>
                        <button
                          type="button"
                          className="btn btn-success btn-sm"
                          onClick={() => handleReview(p._id, 'SHORTLIST', 'Shortlisted for next round')}
                        >
                          <Check size={13} /> Shortlist
                        </button>
                        <button
                          type="button"
                          className="btn btn-outline btn-sm"
                          onClick={() => {
                            setPreviewPitch(p);
                            setRemarks(p.reviewRemarks || '');
                          }}
                        >
                          <MessageSquare size={13} /> Review
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleReview(p._id, 'REJECT', 'Not shortlisted for current cohort')}
                        >
                          <X size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="grid-3">
          {filtered.map((p) => (
            <div key={p._id} className="card" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span className="badge badge-primary">{p.category}</span>
                <StatusBadge status={p.status} />
              </div>
              <div>
                <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
                  {p.pitchCode} • {p.guestUser?.fullName} ({p.guestUser?.email})
                </div>
                <h3 style={{ margin: '4px 0', fontSize: 15, fontWeight: 700 }}>{p.problemStatement}</h3>
                <p style={{ margin: 0, fontSize: 12.5, color: 'var(--text-secondary)' }}>
                  {p.abstractSolution.length > 140 ? `${p.abstractSolution.slice(0, 140)}...` : p.abstractSolution}
                </p>
              </div>
              <div style={{ marginTop: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => handleReview(p._id, 'APPROVE', 'Approved for innovation showcase')}
                >
                  <Check size={13} /> Approve
                </button>
                <button
                  type="button"
                  className="btn btn-success btn-sm"
                  onClick={() => handleReview(p._id, 'SHORTLIST', 'Shortlisted for next round')}
                >
                  <Check size={13} /> Shortlist
                </button>
                <button
                  type="button"
                  className="btn btn-outline btn-sm"
                  onClick={() => {
                    setPreviewPitch(p);
                    setRemarks(p.reviewRemarks || '');
                  }}
                >
                  Review
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(previewPitch)}
        onClose={() => setPreviewPitch(null)}
        title={`Idea Review — ${previewPitch?.pitchCode || ''}`}
        maxWidth={620}
      >
        {previewPitch && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <div>
                <strong>{previewPitch.guestUser?.fullName}</strong>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {previewPitch.guestUser?.email} {previewPitch.guestUser?.phone ? `• ${previewPitch.guestUser.phone}` : ''}
                </div>
              </div>
              <StatusBadge status={previewPitch.status} />
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>PROBLEM STATEMENT</div>
              <div style={{ fontSize: 13.5, fontWeight: 600 }}>{previewPitch.problemStatement}</div>
            </div>

            <div style={{ padding: 12, borderRadius: 10, background: 'var(--bg-subtle)' }}>
              <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', marginBottom: 4 }}>ABSTRACT SOLUTION & TECH STACK</div>
              <div style={{ fontSize: 13, lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>{previewPitch.abstractSolution}</div>
            </div>

            {previewPitch.pitchDeckUrl && (
              <div style={{ fontSize: 12.5, display: 'flex', alignItems: 'center', gap: 6 }}>
                <ExternalLink size={14} color="var(--color-secondary)" />
                <span>Attachment: <strong>{previewPitch.pitchDeckName || previewPitch.pitchDeckUrl}</strong></span>
              </div>
            )}

            <div className="form-field">
              <label className="form-label">Review Remarks / Clarification Note</label>
              <textarea
                className="form-textarea"
                rows={2}
                placeholder="Write feedback for the guest participant..."
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>

            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => handleReview(previewPitch._id, 'APPROVE', remarks || 'Approved for innovation showcase')}
              >
                <Check size={14} /> Approve
              </button>
              <button
                type="button"
                className="btn btn-success btn-sm"
                onClick={() => handleReview(previewPitch._id, 'SHORTLIST', remarks || 'Shortlisted for next round')}
              >
                <Check size={14} /> Shortlist
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleReview(previewPitch._id, 'REVIEWED', remarks || 'Reviewed by Administration')}
              >
                <MessageSquare size={14} /> Mark Reviewed
              </button>
              <button
                type="button"
                className="btn btn-outline btn-sm"
                onClick={() => handleReview(previewPitch._id, 'CLARIFICATION', remarks || 'Please share more implementation details.')}
              >
                <MessageSquare size={14} /> Request Clarification
              </button>
              <button
                type="button"
                className="btn btn-danger btn-sm"
                onClick={() => handleReview(previewPitch._id, 'REJECT', remarks)}
              >
                <X size={14} /> Reject
              </button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
