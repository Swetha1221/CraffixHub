import React, { useCallback, useEffect, useState } from 'react';
import { useDispatch } from 'react-redux';
import { Lightbulb, Send, Link2, CheckCircle2, FileUp } from 'lucide-react';
import api from '../../services/api';
import { useRealtimeSync } from '../../hooks/useRealtimeSync';
import { pushToast } from '../../app/uiSlice';
import { Modal } from '../../components/common/Modal';
import { StatusBadge, EmptyState } from '../../components/common/UI';
import { formatDateTime } from '../../utils/format';

const DOMAINS = ['AI/ML', 'Web3', 'EdTech', 'Cloud', 'Open Innovation'];

export function IdeaPitchingView() {
  const dispatch = useDispatch();
  const [pitches, setPitches] = useState([]);
  const [submitting, setSubmitting] = useState(false);
  const [confirmModal, setConfirmModal] = useState(null);
  const [form, setForm] = useState({
    category: 'AI/ML',
    problemStatement: '',
    abstractSolution: '',
    pitchDeckUrl: '',
    pitchDeckName: '',
  });

  const loadPitches = useCallback(async () => {
    const res = await api.get('/idea-pitches');
    setPitches(res.data.data || []);
  }, []);

  useEffect(() => {
    loadPitches();
  }, [loadPitches]);

  useRealtimeSync(loadPitches, ['ideas']);

  const handleMockPdfSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setForm((prev) => ({
      ...prev,
      pitchDeckName: file.name,
      pitchDeckUrl: prev.pitchDeckUrl || `pitch-deck://${file.name}`,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await api.post('/idea-pitches', form);
      const created = res.data.data;
      dispatch(
        pushToast({
          type: 'success',
          title: 'Submitted for Admin Review',
          message: `Pitch ${created.pitchCode} queued for evaluation.`,
        })
      );
      setConfirmModal(created);
      setForm({ category: 'AI/ML', problemStatement: '', abstractSolution: '', pitchDeckUrl: '', pitchDeckName: '' });
      loadPitches();
    } catch (err) {
      dispatch(pushToast({ type: 'error', title: 'Submission Error', message: err.response?.data?.message || 'Failed' }));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div>
      <div className="page-header">
        <div>
          <h1 className="page-title">Guest Portal — Idea Pitching</h1>
          <p className="page-subtitle">Pitch innovative solutions to CraffixWeb Technologies and track administrative review status</p>
        </div>
      </div>

      <div className="grid-2" style={{ gap: 20, alignItems: 'start' }}>
        <div className="card">
          <div className="card-header">
            <h3 className="card-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Lightbulb size={18} color="var(--color-secondary)" /> Submit New Idea Pitch
            </h3>
          </div>
          <form onSubmit={handleSubmit} className="form-grid">
            <div className="form-field full">
              <label className="form-label">Category / Domain</label>
              <select
                className="form-select"
                value={form.category}
                onChange={(e) => setForm({ ...form, category: e.target.value })}
              >
                {DOMAINS.map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>

            <div className="form-field full">
              <label className="form-label">Problem Statement *</label>
              <textarea
                className="form-textarea"
                required
                rows={3}
                placeholder="Describe the real-world industry, campus, or social challenge you are solving..."
                value={form.problemStatement}
                onChange={(e) => setForm({ ...form, problemStatement: e.target.value })}
              />
            </div>

            <div className="form-field full">
              <label className="form-label">Abstract Solution & Tech Stack *</label>
              <textarea
                className="form-textarea"
                required
                rows={5}
                placeholder="Outline your proposed architecture, key workflows, and tech stack (e.g., React 19, Edge AI, Cloud Functions)..."
                value={form.abstractSolution}
                onChange={(e) => setForm({ ...form, abstractSolution: e.target.value })}
              />
            </div>

            <div className="form-field full">
              <label className="form-label">Attachment / Pitch Deck URL (Optional)</label>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <input
                  className="form-input"
                  style={{ flex: 1, minWidth: 200 }}
                  placeholder="https://drive.google.com/... or upload PDF deck"
                  value={form.pitchDeckUrl}
                  onChange={(e) => setForm({ ...form, pitchDeckUrl: e.target.value })}
                />
                <label className="btn btn-outline btn-sm" style={{ cursor: 'pointer' }}>
                  <FileUp size={14} /> {form.pitchDeckName ? form.pitchDeckName : 'Attach PDF'}
                  <input type="file" accept=".pdf,.ppt,.pptx" onChange={handleMockPdfSelect} style={{ display: 'none' }} />
                </label>
              </div>
            </div>

            <div className="form-field full">
              <button type="submit" className="btn btn-primary" disabled={submitting}>
                <Send size={15} /> {submitting ? 'Submitting Pitch...' : 'Submit Idea for Admin Review'}
              </button>
            </div>
          </form>
        </div>

        <div className="card">
          <div className="card-header">
            <h3 className="card-title">My Submitted Pitches ({pitches.length})</h3>
          </div>
          {pitches.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No idea pitches submitted yet"
              description="Submit your first pitch using the form to receive Admin feedback and shortlisting status."
            />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {pitches.map((p) => (
                <div
                  key={p._id}
                  style={{
                    padding: 14,
                    borderRadius: 12,
                    border: '1px solid var(--border-color)',
                    background: 'var(--bg-subtle)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                      <span className="badge badge-neutral">{p.pitchCode}</span>
                      <span className="badge badge-primary">{p.category}</span>
                    </div>
                    <StatusBadge status={p.status} />
                  </div>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text-primary)', marginBottom: 4 }}>
                    {p.problemStatement}
                  </div>
                  <div style={{ fontSize: 12.5, color: 'var(--text-secondary)', marginBottom: 8 }}>
                    {p.abstractSolution}
                  </div>
                  {p.pitchDeckUrl && (
                    <div style={{ fontSize: 12, color: 'var(--color-indigo)', display: 'flex', alignItems: 'center', gap: 5, marginBottom: 6 }}>
                      <Link2 size={13} /> {p.pitchDeckName || p.pitchDeckUrl}
                    </div>
                  )}
                  {p.reviewRemarks && (
                    <div
                      style={{
                        marginTop: 6,
                        padding: '8px 10px',
                        borderRadius: 8,
                        background: 'var(--bg-surface)',
                        border: '1px solid var(--border-color)',
                        fontSize: 12,
                      }}
                    >
                      <strong>Admin Feedback:</strong> {p.reviewRemarks}
                    </div>
                  )}
                  <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                    Submitted {formatDateTime(p.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      <Modal
        open={Boolean(confirmModal)}
        onClose={() => setConfirmModal(null)}
        title="Idea Pitch Submitted"
        maxWidth={440}
      >
        {confirmModal && (
          <div style={{ textAlign: 'center', padding: '8px 4px' }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: '50%',
                background: 'var(--color-success-soft)',
                color: 'var(--color-secondary)',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                marginBottom: 12,
              }}
            >
              <CheckCircle2 size={28} />
            </div>
            <h3 style={{ margin: '0 0 6px', fontSize: 18 }}>Submitted for Admin Review</h3>
            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--text-secondary)' }}>
              Your pitch <strong>{confirmModal.pitchCode}</strong> in <strong>{confirmModal.category}</strong> has been logged and the Administration team has been notified.
            </p>
            <button type="button" className="btn btn-primary" onClick={() => setConfirmModal(null)}>
              Track Status
            </button>
          </div>
        )}
      </Modal>
    </div>
  );
}
